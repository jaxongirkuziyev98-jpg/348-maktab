import crypto from 'node:crypto';
import { getDb, saveDb } from './store.ts';
import type { IntegrationStatus, SmsLog } from '../src/types/lms.ts';

export const SUBSCRIPTION_PRICE_UZS = 10000;
export const SUBSCRIPTION_DAYS = 30;

export function getIntegrationStatus(): IntegrationStatus {
  const smsConfigured = Boolean(process.env.SMS_GATEWAY_URL && process.env.SMS_GATEWAY_TOKEN);
  const clickConfigured = Boolean(
    process.env.CLICK_SERVICE_ID &&
      process.env.CLICK_MERCHANT_ID &&
      process.env.CLICK_SECRET_KEY
  );

  return {
    sms: {
      configured: smsConfigured,
      mode: smsConfigured ? 'gateway' : 'demo',
      providerLabel: smsConfigured ? 'Uzbekistan SMS Gateway API' : 'DEMO rejim (SMS Gateway ulanmagan)',
    },
    click: {
      configured: clickConfigured,
      mode: clickConfigured ? 'live' : 'demo',
      priceUzs: SUBSCRIPTION_PRICE_UZS,
      durationDays: SUBSCRIPTION_DAYS,
    },
  };
}

export async function dispatchSms(params: {
  phone: string;
  message: string;
  recipientType: 'student' | 'parent' | 'otp';
  homeworkId?: string;
  studentId?: string;
}): Promise<SmsLog> {
  const db = getDb();
  const gatewayUrl = process.env.SMS_GATEWAY_URL;
  const gatewayToken = process.env.SMS_GATEWAY_TOKEN;
  const sender = process.env.SMS_GATEWAY_SENDER || '348-MAKTAB';

  let status: SmsLog['status'] = 'demo_logged';
  let mode: SmsLog['mode'] = 'demo';

  if (gatewayUrl && gatewayToken) {
    mode = 'gateway';
    try {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${gatewayToken}`,
        },
        body: JSON.stringify({
          mobile_phone: params.phone.replace('+', ''),
          message: params.message,
          from: sender,
        }),
      });
      status = response.ok ? 'sent' : 'failed';
    } catch {
      status = 'failed';
    }
  }

  const log: SmsLog = {
    id: `sms-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    homeworkId: params.homeworkId,
    studentId: params.studentId,
    recipientType: params.recipientType,
    phone: params.phone,
    message: params.message,
    status,
    mode,
    sentAt: new Date().toISOString(),
  };

  db.smsLogs.unshift(log);
  saveDb();
  return log;
}

export async function runOverdueHomeworkSmsScheduler(options?: {
  includeParents?: boolean;
}): Promise<{ checkedHomeworks: number; dispatchedCount: number; mode: 'gateway' | 'demo' }> {
  const db = getDb();
  const nowMs = Date.now();
  const status = getIntegrationStatus();
  let dispatchedCount = 0;

  const overdueHomeworks = db.homeworks.filter(
    (hw) => hw.status === 'active' && new Date(hw.dueDate).getTime() < nowMs
  );

  for (const hw of overdueHomeworks) {
    const subject = db.subjects.find((s) => s.id === hw.subjectId);
    const subjectName = subject?.name.uz || 'Fan';
    const classStudents = db.users.filter((u) => u.role === 'student' && u.grade === hw.grade);

    for (const student of classStudents) {
      // Rule 1: If submitted, do NOT send SMS
      const hasSubmission = db.submissions.some(
        (sub) => sub.homeworkId === hw.id && sub.studentId === student.id
      );
      if (hasSubmission) continue;

      // Rule 2: Do NOT send duplicate SMS for same homework & student
      const alreadySent = db.smsLogs.some(
        (log) =>
          log.homeworkId === hw.id &&
          log.studentId === student.id &&
          log.recipientType === 'student'
      );
      if (!alreadySent) {
        const msg = `Assalomu alaykum! Hurmatli ${student.firstName} ${student.lastName}, siz ${student.grade}-sinf o‘quvchisisiz. Sizda ${subjectName} fanidan '${hw.title}' uyga vazifasi bajarilmagan. Iltimos, 348-MAKTAB platformasiga kirib, uyga vazifangizni bajaring.`;
        await dispatchSms({
          phone: student.phone,
          message: msg,
          recipientType: 'student',
          homeworkId: hw.id,
          studentId: student.id,
        });
        db.notifications.unshift({
          id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
          userId: student.id,
          title: 'Uy vazifasi muddati o‘tdi',
          body: `${subjectName}: "${hw.title}" vazifasini bajarish eslatmasi yuborildi.`,
          type: 'sms',
          read: false,
          createdAt: new Date().toISOString(),
        });
        dispatchedCount++;
      }

      // Optional Parent / Guardian notification
      if (options?.includeParents && student.parentPhone) {
        const parentAlreadySent = db.smsLogs.some(
          (log) =>
            log.homeworkId === hw.id &&
            log.studentId === student.id &&
            log.recipientType === 'parent'
        );
        if (!parentAlreadySent) {
          const parentMsg = `Assalomu alaykum! Hurmatli ota-ona, ${student.grade}-sinf o‘quvchisi ${student.firstName} ${student.lastName}da ${subjectName} fanidan '${hw.title}' uyga vazifasi bajarilmagan. Iltimos, 348-MAKTAB platformasida nazorat qiling.`;
          await dispatchSms({
            phone: student.parentPhone,
            message: parentMsg,
            recipientType: 'parent',
            homeworkId: hw.id,
            studentId: student.id,
          });
          dispatchedCount++;
        }
      }
    }
  }

  saveDb();
  return {
    checkedHomeworks: overdueHomeworks.length,
    dispatchedCount,
    mode: status.sms.mode,
  };
}

export function verifyClickPrepareOrCompleteSignature(params: {
  clickTransId: string;
  serviceId: string;
  merchantTransId: string;
  merchantPrepareId?: string;
  amount: string;
  action: string;
  signTime: string;
  signString: string;
}): boolean {
  const secretKey = process.env.CLICK_SECRET_KEY;
  if (!secretKey) return false;
  const raw =
    params.clickTransId +
    params.serviceId +
    secretKey +
    params.merchantTransId +
    (params.action === '1' ? params.merchantPrepareId || '' : '') +
    params.amount +
    params.action +
    params.signTime;
  const expected = crypto.createHash('md5').update(raw).digest('hex');
  return expected === params.signString;
}

export function buildClickMerchantCheckoutUrl(params: {
  merchantTransId: string;
  amount: number;
  returnUrl: string;
}): string | null {
  const serviceId = process.env.CLICK_SERVICE_ID;
  const merchantId = process.env.CLICK_MERCHANT_ID;
  const merchantUserId = process.env.CLICK_MERCHANT_USER_ID || '';
  if (!serviceId || !merchantId) return null;

  const url = new URL('https://my.click.uz/services/pay');
  url.searchParams.set('service_id', serviceId);
  url.searchParams.set('merchant_id', merchantId);
  if (merchantUserId) url.searchParams.set('merchant_user_id', merchantUserId);
  url.searchParams.set('amount', String(params.amount));
  url.searchParams.set('transaction_param', params.merchantTransId);
  url.searchParams.set('return_url', params.returnUrl);
  return url.toString();
}
