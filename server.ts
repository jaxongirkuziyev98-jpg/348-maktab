import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { getDb, saveDb, saveUploadedFile, readUploadedFile } from './server/store.ts';
import { buildEbookPdfBuffer } from './server/pdf.ts';
import {
  COOKIE_NAME,
  normalizePhone,
  hashPassword,
  verifyPassword,
  signToken,
  sanitizeUser,
  requireRoleMiddleware,
  extractTokenFromReq,
  verifyToken,
  type AuthedRequest,
} from './server/auth.ts';
import {
  SUBSCRIPTION_DAYS,
  SUBSCRIPTION_PRICE_UZS,
  buildClickMerchantCheckoutUrl,
  dispatchSms,
  getIntegrationStatus,
  runOverdueHomeworkSmsScheduler,
  verifyClickPrepareOrCompleteSignature,
} from './server/integrations.ts';
import type { LanguageLevel, TestAttempt, TestQuestion, UserRole } from './src/types/lms.ts';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  const findUserById = (id: string) => getDb().users.find((u) => u.id === id);
  const requireAuth = requireRoleMiddleware(findUserById);
  const requireStudent = requireRoleMiddleware(findUserById, ['student']);
  const requireTeacher = requireRoleMiddleware(findUserById, ['teacher']);
  const requireTeacherPendingOrApproved = requireRoleMiddleware(findUserById, ['teacher'], {
    allowUnapprovedTeacher: true,
  });
  const requireAdmin = requireRoleMiddleware(findUserById, ['admin']);
  const requireTeacherOrAdmin = requireRoleMiddleware(findUserById, ['teacher', 'admin']);

  function setAuthCookie(req: express.Request, res: express.Response, token: string) {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
  }

  // --- Health & Integration Status ---
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: '348-MAKTAB', time: new Date().toISOString() });
  });

  app.get('/api/integrations/status', (_req, res) => {
    res.json(getIntegrationStatus());
  });

  // --- Public Language Center Preview Metadata ---
  app.get('/api/public/overview', (_req, res) => {
    const db = getDb();
    res.json({
      subjectsCount: db.subjects.length,
      languageCourses: db.languageCourses.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        nativeName: c.nativeName,
      })),
      studentsCount: db.users.filter((u) => u.role === 'student').length,
      teachersCount: db.users.filter((u) => u.role === 'teacher' && u.approved).length,
      integrations: getIntegrationStatus(),
    });
  });

  // --- File Upload & Retrieval ---
  app.post('/api/upload', requireAuth, (req: AuthedRequest, res) => {
    try {
      const { filename, mimeType, base64Data } = req.body as {
        filename?: string;
        mimeType?: string;
        base64Data?: string;
      };
      if (!filename || !base64Data) {
        return res.status(400).json({ error: 'Fayl nomi va tarkibi majburiy' });
      }
      const saved = saveUploadedFile({
        filename,
        mimeType: mimeType || 'application/octet-stream',
        base64Data,
      });
      res.json(saved);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fayl yuklashda xatolik';
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/files/:fileId', (req, res) => {
    const file = readUploadedFile(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'Fayl topilmadi' });
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    res.send(file.buffer);
  });

  app.get('/api/ebooks/:id/pdf', (req, res) => {
    const db = getDb();
    const book = db.ebooks.find((b) => b.id === req.params.id);
    if (!book) return res.status(404).json({ error: 'Elektron kitob topilmadi' });

    const isDownload = req.query.download === '1';
    const disposition = isDownload ? 'attachment' : 'inline';

    if (book.pdfUrl && book.pdfUrl.startsWith('/api/files/')) {
      const fileId = book.pdfUrl.replace('/api/files/', '');
      const uploaded = readUploadedFile(fileId);
      if (uploaded) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `${disposition}; filename="${encodeURIComponent(uploaded.originalName || `${book.id}.pdf`)}"`
        );
        return res.send(uploaded.buffer);
      }
    }

    const subj = db.subjects.find((s) => s.id === book.subjectId);
    const pdfBuffer = buildEbookPdfBuffer(book, subj?.name.uz);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${book.id}.pdf"`);
    return res.send(pdfBuffer);
  });

  // --- Auth & SMS OTP ---
  app.post('/api/auth/send-otp', async (req, res) => {
    const rawPhone = String(req.body?.phone || '');
    const phone = normalizePhone(rawPhone);
    if (phone.length < 12) {
      return res.status(400).json({ error: 'Telefon raqamini to‘liq kiriting (masalan: +998901234567)' });
    }

    const db = getDb();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const status = getIntegrationStatus();

    // Remove previous unverified OTPs for this phone
    db.smsOtps = db.smsOtps.filter((o) => o.phone !== phone);
    db.smsOtps.push({
      phone,
      code,
      expiresAt,
      verified: false,
      mode: status.sms.mode,
      createdAt: new Date().toISOString(),
    });

    await dispatchSms({
      phone,
      message: `348-MAKTAB tasdiqlash kodi: ${code}. Kodni hech kimga bermang.`,
      recipientType: 'otp',
    });

    saveDb();
    res.json({
      ok: true,
      phone,
      mode: status.sms.mode,
      // Only expose demoCode when SMS Gateway is explicitly unconfigured (DEMO mode)
      demoCode: status.sms.mode === 'demo' ? code : undefined,
    });
  });

  app.post('/api/auth/register-student', (req, res) => {
    const { firstName, lastName, grade, phone: rawPhone, parentPhone: rawParentPhone, otpCode, password } =
      req.body as {
        firstName?: string;
        lastName?: string;
        grade?: number;
        phone?: string;
        parentPhone?: string;
        otpCode?: string;
        password?: string;
      };

    const phone = normalizePhone(String(rawPhone || ''));
    const parentPhone = rawParentPhone ? normalizePhone(String(rawParentPhone)) : undefined;
    const numericGrade = Number(grade);
    const cleanPassword = (password || '').trim();

    if (!firstName?.trim() || !lastName?.trim()) {
      return res.status(400).json({ error: 'Ism va familiyani kiriting' });
    }
    if (!Number.isInteger(numericGrade) || numericGrade < 1 || numericGrade > 11) {
      return res.status(400).json({ error: 'Sinf 1 dan 11 gacha bo‘lishi kerak' });
    }
    if (phone.length < 12) {
      return res.status(400).json({ error: 'Telefon raqami noto‘g‘ri' });
    }
    if (cleanPassword.length > 0 && cleanPassword.length < 4) {
      return res.status(400).json({ error: 'Parol kamida 4 ta belgidan iborat bo‘lishi kerak' });
    }
    if (!otpCode?.trim()) {
      return res.status(400).json({ error: 'SMS tasdiqlash kodini kiriting' });
    }

    const db = getDb();
    const existing = db.users.find((u) => u.phone === phone);
    if (existing) {
      return res.status(409).json({ error: 'Bu telefon raqami allaqachon ro‘yxatdan o‘tgan' });
    }

    const otp = db.smsOtps.find((o) => o.phone === phone && o.code === otpCode.trim());
    if (!otp || new Date(otp.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: 'SMS tasdiqlash kodi noto‘g‘ri yoki muddati tugagan' });
    }

    otp.verified = true;
    const effectivePassword = cleanPassword || crypto.randomBytes(12).toString('hex');

    const newUser = {
      id: `usr-stu-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      role: 'student' as const,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone,
      parentPhone,
      passwordHash: hashPassword(effectivePassword),
      grade: numericGrade,
      approved: true,
      stars: 20,
      medals: numericGrade <= 4 ? ['Yangi Bilimdon'] : [],
      streakDays: 1,
      subscriptionStatus: 'expired' as const,
      subscriptionExpiresAt: null,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      userId: newUser.id,
      title: '348-MAKTABga xush kelibsiz!',
      body: `${numericGrade}-sinf hisobingiz yaratildi. Kabinetga kirish uchun 30 kunlik obuna to‘lovini yakunlang.`,
      type: 'subscription',
      read: false,
      createdAt: new Date().toISOString(),
    });
    saveDb();

    const token = signToken({ id: newUser.id, role: newUser.role });
    setAuthCookie(req, res, token);
    res.status(201).json({ user: sanitizeUser(newUser), token });
  });

  app.post('/api/auth/register-teacher', (req, res) => {
    const { firstName, lastName, phone: rawPhone, email: rawEmail, otpCode, password } =
      req.body as {
        firstName?: string;
        lastName?: string;
        phone?: string;
        email?: string;
        otpCode?: string;
        password?: string;
      };

    const phone = normalizePhone(String(rawPhone || ''));
    const email = String(rawEmail || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!firstName?.trim() || !lastName?.trim()) {
      return res.status(400).json({ error: 'Ism va familiyani kiriting' });
    }
    if (phone.length < 12) {
      return res.status(400).json({ error: 'Telefon raqami noto‘g‘ri' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'To‘g‘ri Gmail / Email manzilini kiriting' });
    }
    if (cleanPassword.length > 0 && cleanPassword.length < 4) {
      return res.status(400).json({ error: 'Parol kamida 4 ta belgidan iborat bo‘lishi kerak' });
    }
    if (!otpCode?.trim()) {
      return res.status(400).json({ error: 'SMS tasdiqlash kodini kiriting' });
    }

    const db = getDb();
    if (db.users.some((u) => u.phone === phone)) {
      return res.status(409).json({ error: 'Bu telefon raqami allaqachon ro‘yxatdan o‘tgan' });
    }
    if (db.users.some((u) => u.email && u.email.toLowerCase() === email)) {
      return res.status(409).json({ error: 'Bu Gmail manzili allaqachon ro‘yxatdan o‘tgan' });
    }

    const otp = db.smsOtps.find((o) => o.phone === phone && o.code === otpCode.trim());
    if (!otp || new Date(otp.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: 'SMS tasdiqlash kodi noto‘g‘ri yoki muddati tugagan' });
    }

    otp.verified = true;

    const effectivePassword = cleanPassword || crypto.randomBytes(12).toString('hex');

    const newTeacher = {
      id: `usr-tch-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      role: 'teacher' as const,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone,
      email,
      passwordHash: hashPassword(effectivePassword),
      assignedGrades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      assignedSubjectIds: db.subjects.map((s) => s.id),
      approved: false,
      stars: 0,
      medals: [],
      streakDays: 1,
      subscriptionStatus: 'active' as const,
      subscriptionExpiresAt: null,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newTeacher);
    saveDb();

    const token = signToken({ id: newTeacher.id, role: newTeacher.role });
    setAuthCookie(req, res, token);

    res.status(201).json({
      ok: true,
      needsFaceVerification: true,
      user: sanitizeUser(newTeacher),
      token,
      message: 'Ro‘yxatdan o‘tish yakunlandi. Endi yuzingizni dumaloq kamera orqali tasdiqlang.',
    });
  });

  app.post('/api/teacher/verify-face', requireTeacherPendingOrApproved, (req: AuthedRequest, res) => {
    const { avatarDataUrl } = req.body as { avatarDataUrl?: string };
    if (!avatarDataUrl || !avatarDataUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Yuzingizni dumaloq kamera orqali rasmga olib tasdiqlang' });
    }

    const db = getDb();
    const teacher = db.users.find((u) => u.id === req.authUser!.id && u.role === 'teacher');
    if (!teacher) {
      return res.status(404).json({ error: 'O‘qituvchi topilmadi' });
    }

    try {
      const mimeMatch = avatarDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
      const mimeType = mimeMatch?.[1] || 'image/jpeg';
      const ext = mimeType.includes('png') ? 'png' : 'jpg';
      const saved = saveUploadedFile({
        filename: `teacher-face.${ext}`,
        mimeType,
        base64Data: avatarDataUrl,
      });
      teacher.avatarUrl = saved.url;
    } catch {
      return res.status(400).json({ error: 'O‘qituvchi rasmini saqlashda xatolik yuz berdi' });
    }

    teacher.approved = true;
    if (!teacher.assignedGrades || teacher.assignedGrades.length === 0) {
      teacher.assignedGrades = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    }
    if (!teacher.assignedSubjectIds || teacher.assignedSubjectIds.length === 0) {
      teacher.assignedSubjectIds = db.subjects.map((s) => s.id);
    }

    db.notifications.unshift({
      id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      userId: teacher.id,
      title: 'O‘qituvchi kabineti faollashtirildi ✓',
      body: 'Yuzingiz muvaffaqiyatli tasdiqlandi. Endi 1–11-sinflar uchun vazifalar berish va topshirilgan ishlarni baholashingiz mumkin.',
      type: 'system',
      read: false,
      createdAt: new Date().toISOString(),
    });
    saveDb();

    res.json({
      ok: true,
      user: sanitizeUser(teacher),
    });
  });

  const ROLE_LABELS_UZ: Record<UserRole, string> = {
    student: 'O‘quvchi',
    teacher: 'O‘qituvchi',
    admin: 'Administrator',
  };

  app.post('/api/auth/login-phone-otp', (req, res) => {
    const phone = normalizePhone(String(req.body?.phone || ''));
    const otpCode = String(req.body?.otpCode || '').trim();
    const expectedRole = req.body?.role as UserRole | undefined;

    const db = getDb();
    const user = db.users.find((u) => u.phone === phone);
    if (!user) {
      return res.status(404).json({ error: 'Bu telefon raqami bilan foydalanuvchi topilmadi' });
    }
    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({
        error: `Ushbu raqam ${ROLE_LABELS_UZ[user.role]} roliga tegishli. Iltimos, "${ROLE_LABELS_UZ[user.role]}" bo‘limini tanlang.`,
      });
    }
    const otp = db.smsOtps.find((o) => o.phone === phone && o.code === otpCode);
    if (!otp || new Date(otp.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: 'SMS kod noto‘g‘ri yoki muddati tugagan' });
    }
    otp.verified = true;
    saveDb();

    const token = signToken({ id: user.id, role: user.role });
    setAuthCookie(req, res, token);
    res.json({ user: sanitizeUser(user), token });
  });

  app.post('/api/auth/login-password', (req, res) => {
    const phone = normalizePhone(String(req.body?.phone || ''));
    const password = String(req.body?.password || '');
    const expectedRole = req.body?.role as UserRole | undefined;

    const db = getDb();
    const user = db.users.find((u) => u.phone === phone);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Telefon raqam yoki parol noto‘g‘ri' });
    }
    if (expectedRole && user.role !== expectedRole) {
      return res.status(403).json({
        error: `Ushbu hisob ${ROLE_LABELS_UZ[user.role]} roliga tegishli. Iltimos, "${ROLE_LABELS_UZ[user.role]}" bo‘limini tanlang.`,
      });
    }

    const token = signToken({ id: user.id, role: user.role });
    setAuthCookie(req, res, token);
    res.json({ user: sanitizeUser(user), token });
  });

  app.post('/api/auth/logout', (req, res) => {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.clearCookie(COOKIE_NAME, {
      path: '/',
      sameSite: isHttps ? 'none' : 'lax',
      secure: isHttps,
    });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req, res) => {
    const token = extractTokenFromReq(req);
    if (!token) return res.json({ user: null });
    const payload = verifyToken(token);
    if (!payload) return res.json({ user: null });
    const user = findUserById(payload.uid);
    if (!user) return res.json({ user: null });

    // Check subscription expiry dynamically
    if (
      user.role === 'student' &&
      user.subscriptionExpiresAt &&
      new Date(user.subscriptionExpiresAt).getTime() < Date.now() &&
      user.subscriptionStatus === 'active'
    ) {
      user.subscriptionStatus = 'expired';
      saveDb();
    }

    res.json({ user: sanitizeUser(user) });
  });

  // ==========================================================
  // STUDENT ROUTES (Strictly scoped to req.authUser.id & grade)
  // ==========================================================
  app.get('/api/student/dashboard', requireStudent, (req: AuthedRequest, res) => {
    const db = getDb();
    const student = db.users.find((u) => u.id === req.authUser!.id)!;

    if (
      student.subscriptionExpiresAt &&
      new Date(student.subscriptionExpiresAt).getTime() < Date.now()
    ) {
      student.subscriptionStatus = 'expired';
      saveDb();
    }

    if (student.subscriptionStatus !== 'active') {
      return res.status(402).json({
        error: 'O‘quvchi kabinetiga kirish uchun obuna to‘lovini amalga oshiring',
        subscriptionRequired: true,
      });
    }

    const grade = student.grade || 1;
    const subjects = db.subjects.filter((s) => grade >= s.gradeMin && grade <= s.gradeMax);
    const videoLessons = db.videoLessons.filter((v) => v.grade === grade);
    const ebooks = db.ebooks.filter((e) => e.grade === grade);
    const homeworks = db.homeworks.filter((h) => h.grade === grade && h.status !== 'cancelled');
    const submissions = db.submissions.filter((sub) => sub.studentId === student.id);
    const tests = db.tests.filter((t) => t.grade === grade || Boolean(t.languageCourseId));
    const testAttempts = db.testAttempts.filter((a) => a.studentId === student.id);
    const notifications = db.notifications.filter((n) => n.userId === student.id);
    const languageProgress = db.languageProgress.filter((lp) => lp.studentId === student.id);
    const payments = db.payments.filter((p) => p.userId === student.id);

    res.json({
      student: sanitizeUser(student),
      subjects,
      videoLessons,
      ebooks,
      homeworks,
      submissions,
      tests,
      testAttempts,
      notifications,
      languageCourses: db.languageCourses,
      languageProgress,
      payments,
      integrations: getIntegrationStatus(),
    });
  });

  app.post('/api/student/submissions', requireStudent, (req: AuthedRequest, res) => {
    const db = getDb();
    const student = db.users.find((u) => u.id === req.authUser!.id)!;
    if (student.subscriptionStatus !== 'active') {
      return res.status(402).json({ error: 'Vazifa topshirish uchun avval obuna to‘lovini yakunlang' });
    }
    const { homeworkId, textAnswer, imageUrl, fileUrl, fileName } = req.body as {
      homeworkId?: string;
      textAnswer?: string;
      imageUrl?: string;
      fileUrl?: string;
      fileName?: string;
    };

    const hw = db.homeworks.find((h) => h.id === homeworkId && h.status === 'active');
    if (!hw) {
      return res.status(404).json({ error: 'Uy vazifasi topilmadi' });
    }
    if (hw.grade !== student.grade) {
      return res.status(403).json({ error: 'Bu vazifa sizning sinfingizga tegishli emas' });
    }
    if (!textAnswer?.trim() && !imageUrl && !fileUrl) {
      return res.status(400).json({ error: 'Javob matni, rasm yoki fayl yuklang' });
    }

    const existingIdx = db.submissions.findIndex(
      (s) => s.homeworkId === hw.id && s.studentId === student.id
    );

    // IMPORTANT: Never auto-approve! Always starts as 'pending' until teacher reviews.
    const submission = {
      id: existingIdx >= 0 ? db.submissions[existingIdx].id : `sub-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      homeworkId: hw.id,
      studentId: student.id,
      textAnswer: (textAnswer || '').trim(),
      imageUrl: imageUrl || undefined,
      fileUrl: fileUrl || undefined,
      fileName: fileName || undefined,
      status: 'pending' as const,
      gradeScore: null,
      teacherComment: undefined,
      submittedAt: new Date().toISOString(),
      reviewedAt: undefined,
      reviewedBy: undefined,
    };

    if (existingIdx >= 0) {
      db.submissions[existingIdx] = submission;
    } else {
      db.submissions.unshift(submission);
    }

    // Notify assigned teacher(s)
    const teachers = db.users.filter(
      (u) =>
        u.role === 'teacher' &&
        u.approved &&
        u.assignedGrades?.includes(hw.grade) &&
        u.assignedSubjectIds?.includes(hw.subjectId)
    );
    for (const t of teachers) {
      db.notifications.unshift({
        id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        userId: t.id,
        title: 'Yangi uy vazifasi topshirildi',
        body: `${student.firstName} ${student.lastName} (${student.grade}-sinf) "${hw.title}" ishini yubordi.`,
        type: 'homework',
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    saveDb();
    res.status(201).json({ submission });
  });

  app.post('/api/student/tests/:testId/submit', requireStudent, (req: AuthedRequest, res) => {
    const db = getDb();
    const student = db.users.find((u) => u.id === req.authUser!.id)!;
    if (student.subscriptionStatus !== 'active') {
      return res.status(402).json({ error: 'Test topshirish uchun avval obuna to‘lovini yakunlang' });
    }
    const test = db.tests.find((t) => t.id === req.params.testId);
    if (!test) return res.status(404).json({ error: 'Test topilmadi' });

    if (test.grade && test.grade !== student.grade) {
      return res.status(403).json({ error: 'Bu test sizning sinfingiz uchun emas' });
    }

    const answers = req.body?.answers as number[] | undefined;
    if (!Array.isArray(answers) || answers.length !== 20) {
      return res.status(400).json({ error: 'Barcha 20 ta savol javobi yuborilishi shart' });
    }

    let correctCount = 0;
    const details = test.questions.map((q, idx) => {
      const selectedIndex = typeof answers[idx] === 'number' ? answers[idx] : -1;
      const isCorrect = selectedIndex === q.correctIndex;
      if (isCorrect) correctCount++;
      return {
        questionId: q.id,
        selectedIndex,
        correctIndex: q.correctIndex,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const wrongCount = test.questions.length - correctCount;
    const scorePercent = Math.round((correctCount / test.questions.length) * 100);
    const totalPoints = correctCount * 5; // 100 max points

    const attempt: TestAttempt = {
      id: `att-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      testId: test.id,
      studentId: student.id,
      answers,
      correctCount,
      wrongCount,
      scorePercent,
      totalPoints,
      details,
      completedAt: new Date().toISOString(),
    };

    db.testAttempts.unshift(attempt);

    // Gamification rewards for junior students (and progress stars for all)
    student.stars += Math.max(5, correctCount);
    if (scorePercent === 100 && !student.medals.includes('20/20 Test Chempioni')) {
      student.medals.push('20/20 Test Chempioni');
    } else if (scorePercent >= 80 && !student.medals.includes('Faol Bilimdon')) {
      student.medals.push('Faol Bilimdon');
    }

    // Notify teachers
    if (test.grade && test.subjectId) {
      const teachers = db.users.filter(
        (u) =>
          u.role === 'teacher' &&
          u.approved &&
          u.assignedGrades?.includes(test.grade!) &&
          u.assignedSubjectIds?.includes(test.subjectId!)
      );
      for (const t of teachers) {
        db.notifications.unshift({
          id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
          userId: t.id,
          title: 'Test natijasi saqlandi',
          body: `${student.firstName} ${student.lastName} "${test.title}" testidan ${scorePercent}% (${correctCount}/20) oldi.`,
          type: 'test',
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    saveDb();
    res.status(201).json({ attempt, student: sanitizeUser(student) });
  });

  app.post('/api/student/language-progress', requireStudent, (req: AuthedRequest, res) => {
    const db = getDb();
    const student = db.users.find((u) => u.id === req.authUser!.id)!;
    if (student.subscriptionStatus !== 'active') {
      return res.status(402).json({ error: 'Til kurslarini ochish uchun avval obuna to‘lovini yakunlang' });
    }
    const { courseId, level, toggleSection, learnedWordId, homeworkAnswer } = req.body as {
      courseId?: string;
      level?: LanguageLevel;
      toggleSection?: string;
      learnedWordId?: string;
      homeworkAnswer?: string;
    };

    if (!courseId || !level) {
      return res.status(400).json({ error: 'Til kursi va daraja ko‘rsatilishi shart' });
    }

    let record = db.languageProgress.find(
      (lp) => lp.studentId === student.id && lp.courseId === courseId && lp.level === level
    );

    if (!record) {
      record = {
        id: `lp-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        studentId: student.id,
        courseId,
        level,
        completedSections: [],
        learnedWordIds: [],
        updatedAt: new Date().toISOString(),
      };
      db.languageProgress.push(record);
    }

    if (toggleSection) {
      if (!record.completedSections.includes(toggleSection)) {
        record.completedSections.push(toggleSection);
      }
    }
    if (learnedWordId) {
      if (record.learnedWordIds.includes(learnedWordId)) {
        record.learnedWordIds = record.learnedWordIds.filter((id) => id !== learnedWordId);
      } else {
        record.learnedWordIds.push(learnedWordId);
      }
    }
    if (typeof homeworkAnswer === 'string') {
      record.homeworkAnswer = homeworkAnswer.trim();
      if (homeworkAnswer.trim() && !record.completedSections.includes('homework')) {
        record.completedSections.push('homework');
      }
    }
    record.updatedAt = new Date().toISOString();
    saveDb();

    res.json({ progress: record });
  });

  app.post('/api/notifications/read', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    for (const n of db.notifications) {
      if (n.userId === req.authUser!.id) n.read = true;
    }
    saveDb();
    res.json({ ok: true });
  });

  // ==========================================================
  // TEACHER ROUTES (Strictly scoped to assigned grades & subjects)
  // ==========================================================
  app.get('/api/teacher/dashboard', requireTeacher, (req: AuthedRequest, res) => {
    const db = getDb();
    const teacher = req.authUser!;
    const assignedGrades = teacher.assignedGrades || [];
    const assignedSubjectIds = teacher.assignedSubjectIds || [];

    const subjects = db.subjects.filter((s) => assignedSubjectIds.includes(s.id));
    const classes = db.classes.filter((c) => assignedGrades.includes(c.grade));
    const students = db.users
      .filter((u) => u.role === 'student' && u.grade && assignedGrades.includes(u.grade))
      .map(sanitizeUser);
    const studentIds = new Set(students.map((s) => s.id));

    const homeworks = db.homeworks.filter(
      (h) => assignedGrades.includes(h.grade) && assignedSubjectIds.includes(h.subjectId)
    );
    const hwIds = new Set(homeworks.map((h) => h.id));

    const submissions = db.submissions.filter(
      (sub) => hwIds.has(sub.homeworkId) && studentIds.has(sub.studentId)
    );

    const tests = db.tests.filter(
      (t) => t.grade && assignedGrades.includes(t.grade) && (!t.subjectId || assignedSubjectIds.includes(t.subjectId))
    );
    const testIds = new Set(tests.map((t) => t.id));
    const testAttempts = db.testAttempts.filter(
      (a) => testIds.has(a.testId) && studentIds.has(a.studentId)
    );

    const smsLogs = db.smsLogs.filter(
      (log) => log.studentId && studentIds.has(log.studentId)
    );
    const notifications = db.notifications.filter((n) => n.userId === teacher.id);

    res.json({
      teacher,
      classes,
      subjects,
      students,
      homeworks,
      submissions,
      tests,
      testAttempts,
      smsLogs,
      notifications,
      integrations: getIntegrationStatus(),
    });
  });

  app.post('/api/teacher/homeworks', requireTeacher, (req: AuthedRequest, res) => {
    const db = getDb();
    const teacher = req.authUser!;
    const {
      title,
      grade,
      subjectId,
      topic,
      dueDate,
      description,
      helpVideoUrl,
      helpPdfUrl,
      helpPdfName,
      helpImageUrl,
      helpExplanation,
    } = req.body as {
      title?: string;
      grade?: number;
      subjectId?: string;
      topic?: string;
      dueDate?: string;
      description?: string;
      helpVideoUrl?: string;
      helpPdfUrl?: string;
      helpPdfName?: string;
      helpImageUrl?: string;
      helpExplanation?: string;
    };

    const numGrade = Number(grade);
    if (!teacher.assignedGrades?.includes(numGrade) || !teacher.assignedSubjectIds?.includes(String(subjectId))) {
      return res.status(403).json({ error: 'Siz faqat o‘zingizga biriktirilgan sinf va fan uchun vazifa yarata olasiz' });
    }
    if (!title?.trim() || !topic?.trim() || !dueDate) {
      return res.status(400).json({ error: 'Vazifa nomi, mavzu va muddat majburiy' });
    }

    const hw = {
      id: `hw-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      title: title.trim(),
      subjectId: String(subjectId),
      grade: numGrade,
      topic: topic.trim(),
      dueDate: new Date(dueDate).toISOString(),
      description: (description || '').trim(),
      helpVideoUrl: helpVideoUrl?.trim() || undefined,
      helpPdfUrl: helpPdfUrl?.trim() || undefined,
      helpPdfName: helpPdfName?.trim() || undefined,
      helpImageUrl: helpImageUrl?.trim() || undefined,
      helpExplanation: (helpExplanation || '').trim(),
      status: 'active' as const,
      createdBy: teacher.id,
      createdAt: new Date().toISOString(),
    };

    db.homeworks.unshift(hw);

    const students = db.users.filter((u) => u.role === 'student' && u.grade === numGrade);
    const subjName = db.subjects.find((s) => s.id === hw.subjectId)?.name.uz || 'Fan';
    for (const st of students) {
      db.notifications.unshift({
        id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        userId: st.id,
        title: 'Yangi uy vazifasi',
        body: `${subjName}: "${hw.title}" topshirig‘i yuklandi.`,
        type: 'homework',
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    saveDb();
    res.status(201).json({ homework: hw });
  });

  app.patch('/api/teacher/homeworks/:id/status', requireTeacher, (req: AuthedRequest, res) => {
    const db = getDb();
    const teacher = req.authUser!;
    const hw = db.homeworks.find((h) => h.id === req.params.id);
    if (!hw) return res.status(404).json({ error: 'Vazifa topilmadi' });
    if (!teacher.assignedGrades?.includes(hw.grade) || !teacher.assignedSubjectIds?.includes(hw.subjectId)) {
      return res.status(403).json({ error: 'Ruxsat yo‘q' });
    }
    const nextStatus = req.body?.status === 'cancelled' ? 'cancelled' : 'active';
    hw.status = nextStatus;
    saveDb();
    res.json({ homework: hw });
  });

  app.patch('/api/teacher/submissions/:id/review', requireTeacher, (req: AuthedRequest, res) => {
    const db = getDb();
    const teacher = req.authUser!;
    const sub = db.submissions.find((s) => s.id === req.params.id);
    if (!sub) return res.status(404).json({ error: 'Topshirilgan ish topilmadi' });

    const hw = db.homeworks.find((h) => h.id === sub.homeworkId);
    if (!hw || !teacher.assignedGrades?.includes(hw.grade) || !teacher.assignedSubjectIds?.includes(hw.subjectId)) {
      return res.status(403).json({ error: 'Ushbu topshiriqni tekshirish huquqingiz yo‘q' });
    }

    const { status, gradeScore, teacherComment } = req.body as {
      status?: 'approved' | 'revision_needed' | 'pending';
      gradeScore?: number | null;
      teacherComment?: string;
    };

    if (!status || !['approved', 'revision_needed', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Holat noto‘g‘ri' });
    }

    sub.status = status;
    sub.gradeScore = typeof gradeScore === 'number' ? gradeScore : sub.gradeScore;
    sub.teacherComment = teacherComment?.trim() || '';
    sub.reviewedAt = new Date().toISOString();
    sub.reviewedBy = teacher.id;

    // Reward student stars when approved
    const student = db.users.find((u) => u.id === sub.studentId);
    if (student && status === 'approved') {
      student.stars += 15;
    }

    db.notifications.unshift({
      id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      userId: sub.studentId,
      title: status === 'approved' ? 'Uy vazifasi qabul qilindi ✓' : 'Uy vazifasi qayta ishlashga yuborildi',
      body: `${hw.title}: ${sub.teacherComment || (status === 'approved' ? 'Tasdiqlandi' : 'Xatolarni tuzating')}`,
      type: 'grade',
      read: false,
      createdAt: new Date().toISOString(),
    });

    saveDb();
    res.json({ submission: sub });
  });

  app.post('/api/teacher/tests', requireTeacherOrAdmin, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const { title, grade, subjectId, languageCourseId, languageLevel, durationMinutes, questions } =
      req.body as {
        title?: string;
        grade?: number;
        subjectId?: string;
        languageCourseId?: string;
        languageLevel?: LanguageLevel;
        durationMinutes?: number;
        questions?: TestQuestion[];
      };

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Test nomi kiritilishi shart' });
    }
    if (!Array.isArray(questions) || questions.length !== 20) {
      return res.status(400).json({ error: 'Har bir test aynan 20 ta savoldan iborat bo‘lishi kerak' });
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text?.trim() || !Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => !o?.trim())) {
        return res.status(400).json({ error: `${i + 1}-savol matni va 4 ta javob varianti to‘liq bo‘lishi kerak` });
      }
    }

    if (user.role === 'teacher') {
      const numGrade = Number(grade);
      if (!user.assignedGrades?.includes(numGrade) || !user.assignedSubjectIds?.includes(String(subjectId))) {
        return res.status(403).json({ error: 'Siz faqat o‘z sinf va fanlaringiz uchun test yarata olasiz' });
      }
    }

    const newTest = {
      id: `test-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      title: title.trim(),
      subjectId: subjectId || undefined,
      languageCourseId: languageCourseId || undefined,
      languageLevel: languageLevel || undefined,
      grade: grade ? Number(grade) : undefined,
      durationMinutes: Number(durationMinutes) || 25,
      questions: questions.map((q, idx) => ({
        id: q.id || `q-${Date.now()}-${idx + 1}`,
        text: q.text.trim(),
        options: [q.options[0].trim(), q.options[1].trim(), q.options[2].trim(), q.options[3].trim()] as [
          string,
          string,
          string,
          string
        ],
        correctIndex: q.correctIndex,
        explanation: q.explanation?.trim() || 'To‘g‘ri javob belgilangan variantdir.',
      })),
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    db.tests.unshift(newTest);
    saveDb();
    res.status(201).json({ test: newTest });
  });

  app.post('/api/sms/run-scheduler', requireTeacherOrAdmin, async (req, res) => {
    const includeParents = Boolean(req.body?.includeParents);
    const result = await runOverdueHomeworkSmsScheduler({ includeParents });
    res.json(result);
  });

  // ==========================================================
  // ADMIN ROUTES
  // ==========================================================
  app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
    const db = getDb();
    res.json({
      students: db.users.filter((u) => u.role === 'student').map(sanitizeUser),
      teachers: db.users.filter((u) => u.role === 'teacher').map(sanitizeUser),
      admins: db.users.filter((u) => u.role === 'admin').map(sanitizeUser),
      classes: db.classes,
      subjects: db.subjects,
      videoLessons: db.videoLessons,
      ebooks: db.ebooks,
      homeworks: db.homeworks,
      submissions: db.submissions,
      tests: db.tests,
      testAttempts: db.testAttempts,
      languageCourses: db.languageCourses,
      payments: db.payments,
      smsLogs: db.smsLogs,
      integrations: getIntegrationStatus(),
    });
  });

  app.post('/api/admin/teachers', requireAdmin, (req, res) => {
    const db = getDb();
    const { firstName, lastName, phone: rawPhone, email: rawEmail, password, assignedGrades, assignedSubjectIds } =
      req.body as {
        firstName?: string;
        lastName?: string;
        phone?: string;
        email?: string;
        password?: string;
        assignedGrades?: number[];
        assignedSubjectIds?: string[];
      };

    const phone = normalizePhone(String(rawPhone || ''));
    const email = rawEmail?.trim() ? rawEmail.trim().toLowerCase() : undefined;
    if (!firstName?.trim() || !lastName?.trim() || phone.length < 12) {
      return res.status(400).json({ error: 'O‘qituvchi ma’lumotlari to‘liq emas' });
    }
    if (db.users.some((u) => u.phone === phone)) {
      return res.status(409).json({ error: 'Bu telefon raqami tizimda mavjud' });
    }

    const teacher = {
      id: `usr-tch-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      role: 'teacher' as const,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone,
      email,
      passwordHash: hashPassword(password?.trim() || 'teacher348'),
      assignedGrades: Array.isArray(assignedGrades) ? assignedGrades.map(Number) : [],
      assignedSubjectIds: Array.isArray(assignedSubjectIds) ? assignedSubjectIds : [],
      approved: true,
      stars: 0,
      medals: [],
      streakDays: 1,
      subscriptionStatus: 'active' as const,
      subscriptionExpiresAt: null,
      createdAt: new Date().toISOString(),
    };

    db.users.push(teacher);
    saveDb();
    res.status(201).json({ teacher: sanitizeUser(teacher) });
  });

  app.patch('/api/admin/teachers/:id', requireAdmin, (req, res) => {
    const db = getDb();
    const teacher = db.users.find((u) => u.id === req.params.id && u.role === 'teacher');
    if (!teacher) return res.status(404).json({ error: 'O‘qituvchi topilmadi' });

    const { approved, assignedGrades, assignedSubjectIds } = req.body as {
      approved?: boolean;
      assignedGrades?: number[];
      assignedSubjectIds?: string[];
    };

    const wasApproved = teacher.approved;
    if (typeof approved === 'boolean') teacher.approved = approved;
    if (Array.isArray(assignedGrades)) teacher.assignedGrades = assignedGrades.map(Number);
    if (Array.isArray(assignedSubjectIds)) teacher.assignedSubjectIds = assignedSubjectIds;

    if (!wasApproved && teacher.approved) {
      db.notifications.unshift({
        id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        userId: teacher.id,
        title: 'O‘qituvchi hisobingiz tasdiqlandi',
        body: 'Administrator hisobingizni faollashtirdi. Endi O‘qituvchi kabinetiga kirishingiz mumkin.',
        type: 'system',
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    saveDb();
    res.json({ teacher: sanitizeUser(teacher) });
  });

  app.patch('/api/admin/students/:id/subscription', requireAdmin, (req, res) => {
    const db = getDb();
    const student = db.users.find((u) => u.id === req.params.id && u.role === 'student');
    if (!student) return res.status(404).json({ error: 'O‘quvchi topilmadi' });

    const action = req.body?.action as 'activate_30' | 'expire';
    if (action === 'activate_30') {
      student.subscriptionStatus = 'active';
      student.subscriptionExpiresAt = new Date(Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    } else if (action === 'expire') {
      student.subscriptionStatus = 'expired';
      student.subscriptionExpiresAt = new Date(Date.now() - 1000).toISOString();
    }
    saveDb();
    res.json({ student: sanitizeUser(student) });
  });

  app.post('/api/admin/classes', requireAdmin, (req, res) => {
    const db = getDb();
    const { grade, section, roomNumber, homeroomTeacherId } = req.body as {
      grade?: number;
      section?: string;
      roomNumber?: string;
      homeroomTeacherId?: string;
    };
    const numGrade = Number(grade);
    if (!Number.isInteger(numGrade) || numGrade < 1 || numGrade > 11 || !section?.trim()) {
      return res.status(400).json({ error: 'Sinf (1-11) va bo‘lim harfi kerak' });
    }
    const cls = {
      id: `class-${numGrade}${section.trim().toLowerCase()}-${Date.now()}`,
      grade: numGrade,
      section: section.trim().toUpperCase(),
      roomNumber: roomNumber?.trim() || `${100 + numGrade}`,
      homeroomTeacherId: homeroomTeacherId || undefined,
    };
    db.classes.push(cls);
    saveDb();
    res.status(201).json({ schoolClass: cls });
  });

  app.post('/api/admin/subjects', requireAdmin, (req, res) => {
    const db = getDb();
    const { nameUz, nameRu, nameEn, code, gradeMin, gradeMax, descriptionUz } = req.body as {
      nameUz?: string;
      nameRu?: string;
      nameEn?: string;
      code?: string;
      gradeMin?: number;
      gradeMax?: number;
      descriptionUz?: string;
    };
    if (!nameUz?.trim()) return res.status(400).json({ error: 'Fan nomi (UZ) majburiy' });
    const subject = {
      id: `subj-${Date.now()}`,
      code: (code || nameUz.slice(0, 3)).toUpperCase(),
      name: {
        uz: nameUz.trim(),
        ru: nameRu?.trim() || nameUz.trim(),
        en: nameEn?.trim() || nameUz.trim(),
      },
      description: {
        uz: descriptionUz?.trim() || 'Maktab dasturi asosidagi fan.',
        ru: descriptionUz?.trim() || 'Школьный учебный предмет.',
        en: descriptionUz?.trim() || 'School curriculum subject.',
      },
      gradeMin: Number(gradeMin) || 1,
      gradeMax: Number(gradeMax) || 11,
      accentColor: '#2563EB',
      topics: [],
    };
    db.subjects.push(subject);
    saveDb();
    res.status(201).json({ subject });
  });

  app.post('/api/admin/videos', requireTeacherOrAdmin, (req: AuthedRequest, res) => {
    const db = getDb();
    const { subjectId, grade, title, topic, description, durationMinutes, videoUrl, lessonSlides } =
      req.body as {
        subjectId?: string;
        grade?: number;
        title?: string;
        topic?: string;
        description?: string;
        durationMinutes?: number;
        videoUrl?: string;
        lessonSlides?: string[];
      };
    if (!subjectId || !title?.trim()) {
      return res.status(400).json({ error: 'Fan va video dars nomi majburiy' });
    }
    const video = {
      id: `vid-${Date.now()}`,
      subjectId,
      grade: Number(grade) || 1,
      title: title.trim(),
      topic: topic?.trim() || title.trim(),
      description: description?.trim() || '',
      durationMinutes: Number(durationMinutes) || 15,
      videoUrl: videoUrl?.trim() || undefined,
      lessonSlides: Array.isArray(lessonSlides) && lessonSlides.length ? lessonSlides : [description?.trim() || title.trim()],
      createdBy: req.authUser!.id,
      createdAt: new Date().toISOString(),
    };
    db.videoLessons.unshift(video);
    saveDb();
    res.status(201).json({ video });
  });

  app.post('/api/admin/ebooks', requireTeacherOrAdmin, (req: AuthedRequest, res) => {
    const db = getDb();
    const { subjectId, grade, title, author, pagesCount, description, pdfUrl, previewText } = req.body as {
      subjectId?: string;
      grade?: number;
      title?: string;
      author?: string;
      pagesCount?: number;
      description?: string;
      pdfUrl?: string;
      previewText?: string;
    };
    if (!subjectId || !title?.trim()) {
      return res.status(400).json({ error: 'Fan va kitob nomi majburiy' });
    }
    const id = `ebk-${Date.now()}`;
    const ebook = {
      id,
      subjectId,
      grade: Number(grade) || 1,
      title: title.trim(),
      author: author?.trim() || '348-MAKTAB',
      pagesCount: Number(pagesCount) || 50,
      description: description?.trim() || '',
      pdfUrl: pdfUrl?.trim() || `/api/ebooks/${id}/pdf`,
      previewText: previewText?.trim() || description?.trim() || title.trim(),
      createdBy: req.authUser!.id,
      createdAt: new Date().toISOString(),
    };
    db.ebooks.unshift(ebook);
    saveDb();
    res.status(201).json({ ebook });
  });

  app.patch('/api/admin/language-courses/:courseId/video', requireAdmin, (req, res) => {
    const db = getDb();
    const { level, videoUrl, videoTitle } = req.body as {
      level?: LanguageLevel;
      videoUrl?: string;
      videoTitle?: string;
    };
    const course = db.languageCourses.find((c) => c.id === req.params.courseId);
    if (!course) return res.status(404).json({ error: 'Til kursi topilmadi' });
    const lvl = course.levels.find((l) => l.level === level);
    if (!lvl) return res.status(404).json({ error: 'Daraja topilmadi' });

    if (videoUrl !== undefined) lvl.videoUrl = videoUrl.trim() || undefined;
    if (videoTitle?.trim()) lvl.videoTitle = videoTitle.trim();
    saveDb();
    res.json({ course });
  });

  app.post('/api/admin/sms/send-manual', requireTeacherOrAdmin, async (req, res) => {
    const db = getDb();
    const { studentId, recipientType, message } = req.body as {
      studentId?: string;
      recipientType?: 'student' | 'parent';
      message?: string;
    };
    const student = db.users.find((u) => u.id === studentId && u.role === 'student');
    if (!student) return res.status(404).json({ error: 'O‘quvchi topilmadi' });

    const targetPhone = recipientType === 'parent' ? student.parentPhone : student.phone;
    if (!targetPhone) {
      return res.status(400).json({ error: 'Ota-ona yoki qonuniy vakil telefon raqami kiritilmagan' });
    }
    if (!message?.trim()) {
      return res.status(400).json({ error: 'SMS matni bo‘sh bo‘lmasligi kerak' });
    }

    const log = await dispatchSms({
      phone: targetPhone,
      message: message.trim(),
      recipientType: recipientType || 'student',
      studentId: student.id,
    });
    res.json({ log });
  });

  // ==========================================================
  // CARD TRANSFER & PAYMENT APPS (Click, Payme, Uzum, Paynet, Anorbank, Oson)
  // ==========================================================
  const TARGET_CARD_RAW = '5614682014970760';
  const TARGET_CARD_DISPLAY = '5614 6820 1497 0760';
  const ALLOWED_PAYMENT_APPS = ['click', 'payme', 'uzum', 'paynet', 'anorbank', 'oson'] as const;

  app.post('/api/payments/card-transfer', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.authUser!.id);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    const { providerApp, amountUzs, targetCard } = req.body as {
      providerApp?: string;
      amountUzs?: number | string;
      targetCard?: string;
    };

    const appKey = String(providerApp || 'click').toLowerCase() as (typeof ALLOWED_PAYMENT_APPS)[number];
    if (!ALLOWED_PAYMENT_APPS.includes(appKey)) {
      return res.status(400).json({ error: 'To‘lov ilovasi noto‘g‘ri tanlangan' });
    }

    const cleanCard = String(targetCard || TARGET_CARD_RAW).replace(/\s+/g, '');
    if (cleanCard !== TARGET_CARD_RAW) {
      return res.status(400).json({ error: `Faqat ${TARGET_CARD_DISPLAY} kartasiga o‘tkazish mumkin` });
    }

    const numericAmount = Number(String(amountUzs || '').replace(/[^\d]/g, ''));
    if (!Number.isFinite(numericAmount) || numericAmount < SUBSCRIPTION_PRICE_UZS) {
      return res.status(400).json({
        error: `Summa kamida ${SUBSCRIPTION_PRICE_UZS.toLocaleString('uz-UZ')} so‘m bo‘lishi kerak`,
      });
    }

    const status = getIntegrationStatus();
    const merchantTransId = `M348-${appKey.toUpperCase()}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const nowIso = new Date().toISOString();

    const payment = {
      id: `pay-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      userId: user.id,
      amountUzs: numericAmount,
      provider: appKey,
      targetCard: TARGET_CARD_DISPLAY,
      mode: status.click.mode,
      status: 'completed' as const,
      merchantTransId,
      clickTransId: `${appKey.toUpperCase()}-${Date.now()}`,
      createdAt: nowIso,
      completedAt: nowIso,
    };
    db.payments.unshift(payment);

    const baseTime =
      user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt).getTime() > Date.now()
        ? new Date(user.subscriptionExpiresAt).getTime()
        : Date.now();
    user.subscriptionStatus = 'active';
    user.subscriptionExpiresAt = new Date(
      baseTime + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    db.notifications.unshift({
      id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      userId: user.id,
      title: 'To‘lov qabul qilindi ✓',
      body: `${appKey.toUpperCase()} orqali ${TARGET_CARD_DISPLAY} kartasiga ${numericAmount.toLocaleString('uz-UZ')} so‘m to‘lov qabul qilindi. 30 kunlik obuna faollashtirildi.`,
      type: 'subscription',
      read: false,
      createdAt: nowIso,
    });
    saveDb();

    res.json({
      ok: true,
      accepted: true,
      message: 'To‘lov qabul qilindi ✓',
      payment,
      user: sanitizeUser(user),
    });
  });

  // ==========================================================
  // CLICK SUBSCRIPTION PAYMENT ROUTES (Server-Verified, NO Card/PIN stored)
  // ==========================================================
  app.post('/api/payments/click/initiate', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const status = getIntegrationStatus();
    const merchantTransId = `M348-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;

    const payment = {
      id: `pay-${Date.now()}`,
      userId: user.id,
      amountUzs: SUBSCRIPTION_PRICE_UZS,
      provider: 'click' as const,
      mode: status.click.mode,
      status: 'pending' as const,
      merchantTransId,
      createdAt: new Date().toISOString(),
    };
    db.payments.unshift(payment);
    saveDb();

    const origin = `${req.protocol}://${req.get('host')}`;
    const checkoutUrl = buildClickMerchantCheckoutUrl({
      merchantTransId,
      amount: SUBSCRIPTION_PRICE_UZS,
      returnUrl: `${origin}/?payment=${payment.id}`,
    });

    res.json({
      payment,
      mode: status.click.mode,
      checkoutUrl,
    });
  });

  app.post('/api/payments/click/demo-confirm', requireAuth, (req: AuthedRequest, res) => {
    const status = getIntegrationStatus();
    if (status.click.mode !== 'demo') {
      return res.status(403).json({ error: 'Jonli Click rejimida demo tasdiqlash o‘chirilgan' });
    }
    const db = getDb();
    const payment = db.payments.find(
      (p) => p.id === req.body?.paymentId && p.userId === req.authUser!.id
    );
    if (!payment) return res.status(404).json({ error: 'To‘lov yozuvi topilmadi' });
    if (payment.status === 'completed') {
      const u = db.users.find((usr) => usr.id === payment.userId);
      return res.json({ payment, user: u ? sanitizeUser(u) : null });
    }

    payment.status = 'completed';
    payment.clickTransId = `DEMO-CLK-${Date.now()}`;
    payment.completedAt = new Date().toISOString();

    const user = db.users.find((u) => u.id === payment.userId)!;
    const baseTime =
      user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt).getTime() > Date.now()
        ? new Date(user.subscriptionExpiresAt).getTime()
        : Date.now();
    user.subscriptionStatus = 'active';
    user.subscriptionExpiresAt = new Date(baseTime + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      userId: user.id,
      title: '30 kunlik obuna faollashtirildi (DEMO)',
      body: `Click DEMO to‘lovi (${SUBSCRIPTION_PRICE_UZS} so‘m) tasdiqlandi.`,
      type: 'subscription',
      read: false,
      createdAt: new Date().toISOString(),
    });
    saveDb();

    res.json({ payment, user: sanitizeUser(user) });
  });

  // Official Click Merchant API Prepare & Complete Webhooks
  app.post('/api/payments/click/prepare', (req, res) => {
    const { click_trans_id, service_id, merchant_trans_id, amount, action, sign_time, sign_string } = req.body;
    const valid = verifyClickPrepareOrCompleteSignature({
      clickTransId: String(click_trans_id || ''),
      serviceId: String(service_id || ''),
      merchantTransId: String(merchant_trans_id || ''),
      amount: String(amount || ''),
      action: String(action || ''),
      signTime: String(sign_time || ''),
      signString: String(sign_string || ''),
    });
    if (!valid) return res.json({ error: -1, error_note: 'SIGN CHECK FAILED!' });

    const db = getDb();
    const payment = db.payments.find((p) => p.merchantTransId === String(merchant_trans_id));
    if (!payment) return res.json({ error: -5, error_note: 'Order not found' });
    if (Number(amount) !== payment.amountUzs) return res.json({ error: -2, error_note: 'Incorrect parameter amount' });

    return res.json({
      click_trans_id,
      merchant_trans_id,
      merchant_prepare_id: payment.id,
      error: 0,
      error_note: 'Success',
    });
  });

  app.post('/api/payments/click/complete', (req, res) => {
    const {
      click_trans_id,
      service_id,
      merchant_trans_id,
      merchant_prepare_id,
      amount,
      action,
      error,
      sign_time,
      sign_string,
    } = req.body;

    const valid = verifyClickPrepareOrCompleteSignature({
      clickTransId: String(click_trans_id || ''),
      serviceId: String(service_id || ''),
      merchantTransId: String(merchant_trans_id || ''),
      merchantPrepareId: String(merchant_prepare_id || ''),
      amount: String(amount || ''),
      action: String(action || ''),
      signTime: String(sign_time || ''),
      signString: String(sign_string || ''),
    });
    if (!valid) return res.json({ error: -1, error_note: 'SIGN CHECK FAILED!' });

    const db = getDb();
    const payment = db.payments.find((p) => p.merchantTransId === String(merchant_trans_id));
    if (!payment) return res.json({ error: -5, error_note: 'Order not found' });

    if (Number(error) < 0) {
      payment.status = 'failed';
      saveDb();
      return res.json({ error: -9, error_note: 'Transaction cancelled' });
    }

    if (payment.status !== 'completed') {
      payment.status = 'completed';
      payment.clickTransId = String(click_trans_id);
      payment.completedAt = new Date().toISOString();
      const user = db.users.find((u) => u.id === payment.userId);
      if (user) {
        user.subscriptionStatus = 'active';
        user.subscriptionExpiresAt = new Date(
          Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();
      }
      saveDb();
    }

    return res.json({
      click_trans_id,
      merchant_trans_id,
      merchant_confirm_id: payment.id,
      error: 0,
      error_note: 'Success',
    });
  });

  // Start background overdue-homework SMS scheduler (every 5 minutes)
  setInterval(() => {
    runOverdueHomeworkSmsScheduler().catch((err) => {
      console.error('SMS scheduler error:', err);
    });
  }, 5 * 60 * 1000);

  // --- Vite Dev / Static Production Serving ---
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`348-MAKTAB server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
