import React, { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ArrowLeft,
  ArrowRight,
  Wallet,
} from 'lucide-react';
import type {
  IntegrationStatus,
  Lang,
  PaymentProviderApp,
  PaymentRecord,
  User,
} from '../types/lms.ts';
import { apiRequest } from '../lib/api.ts';
import { formatCurrency, t } from '../i18n/translations.ts';

export const TARGET_CARD_DISPLAY = '5614 6820 1497 0760';
export const TARGET_CARD_RAW = '5614682014970760';

interface PaymentAppOption {
  id: PaymentProviderApp;
  name: string;
  tagline: string;
  badgeBg: string;
  badgeText: string;
  cardBorder: string;
}

const PAYMENT_APPS: PaymentAppOption[] = [
  {
    id: 'click',
    name: 'Click',
    tagline: 'Click Up / Karta o‘tkazma',
    badgeBg: 'bg-sky-600',
    badgeText: 'text-white',
    cardBorder: 'border-sky-200 hover:border-sky-500 hover:bg-sky-50/60',
  },
  {
    id: 'payme',
    name: 'Payme',
    tagline: 'Payme karta o‘tkazma',
    badgeBg: 'bg-teal-500',
    badgeText: 'text-white',
    cardBorder: 'border-teal-200 hover:border-teal-500 hover:bg-teal-50/60',
  },
  {
    id: 'uzum',
    name: 'Uzum Bank',
    tagline: 'Uzum tezkor o‘tkazma',
    badgeBg: 'bg-violet-600',
    badgeText: 'text-white',
    cardBorder: 'border-violet-200 hover:border-violet-500 hover:bg-violet-50/60',
  },
  {
    id: 'paynet',
    name: 'Paynet',
    tagline: 'Paynet kartaga to‘lov',
    badgeBg: 'bg-emerald-600',
    badgeText: 'text-white',
    cardBorder: 'border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50/60',
  },
  {
    id: 'anorbank',
    name: 'Anorbank',
    tagline: 'Anorbank P2P o‘tkazma',
    badgeBg: 'bg-rose-600',
    badgeText: 'text-white',
    cardBorder: 'border-rose-200 hover:border-rose-500 hover:bg-rose-50/60',
  },
  {
    id: 'oson',
    name: 'Oson',
    tagline: 'Oson hamyon / karta',
    badgeBg: 'bg-blue-700',
    badgeText: 'text-white',
    cardBorder: 'border-blue-200 hover:border-blue-500 hover:bg-blue-50/60',
  },
];

export function CardTransferCheckout({
  user,
  integrations,
  lang,
  autoEnterDelayMs = 0,
  onActivated,
  onDoneButtonClick,
}: {
  user: User;
  integrations: IntegrationStatus;
  lang: Lang;
  autoEnterDelayMs?: number;
  onActivated: (updatedUser: User) => void;
  onDoneButtonClick?: () => void;
}) {
  const minPrice = integrations.click.priceUzs || 10000;
  const [selectedApp, setSelectedApp] = useState<PaymentAppOption | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completedPayment, setCompletedPayment] = useState<PaymentRecord | null>(null);
  const amountRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectedApp && !completedPayment) {
      window.setTimeout(() => {
        amountRef.current?.focus();
      }, 60);
    }
  }, [selectedApp, completedPayment]);

  async function handleCopyCard() {
    try {
      await navigator.clipboard.writeText(TARGET_CARD_RAW);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  }

  function handleSelectApp(app: PaymentAppOption) {
    setSelectedApp(app);
    setAmountInput('');
    setError('');
  }

  async function submitTransfer(customAmount?: number) {
    if (!selectedApp || loading) return;
    const rawDigits = String(customAmount ?? amountInput).replace(/[^\d]/g, '');
    const numericAmount = Number(rawDigits);

    if (!numericAmount || numericAmount < minPrice) {
      setError(
        lang === 'ru'
          ? `Введите сумму не менее ${minPrice.toLocaleString('ru-RU')} сум`
          : lang === 'en'
          ? `Please enter at least ${minPrice.toLocaleString('en-US')} UZS`
          : `Iltimos, kamida ${minPrice.toLocaleString('uz-UZ')} so‘m summa kiriting`
      );
      amountRef.current?.focus();
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{
        ok: boolean;
        accepted: boolean;
        message: string;
        payment: PaymentRecord;
        user: User;
      }>('/api/payments/card-transfer', {
        method: 'POST',
        body: JSON.stringify({
          providerApp: selectedApp.id,
          amountUzs: numericAmount,
          targetCard: TARGET_CARD_RAW,
        }),
      });
      setCompletedPayment(res.payment);
      if (autoEnterDelayMs > 0) {
        window.setTimeout(() => {
          onActivated(res.user);
        }, autoEnterDelayMs);
      } else {
        onActivated(res.user);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t(lang, 'paymentConfirmError'));
    } finally {
      setLoading(false);
    }
  }

  const isExpired = user.subscriptionStatus !== 'active';

  const copyText = {
    cardTitle:
      lang === 'ru'
        ? 'Карта для оплаты (348-MAKTAB)'
        : lang === 'en'
        ? 'Recipient Card (348-MAKTAB)'
        : 'Pul o‘tkazish kartasi (348-MAKTAB)',
    copyBtn: lang === 'ru' ? 'Копировать' : lang === 'en' ? 'Copy' : 'Nusxa olish',
    copiedBtn: lang === 'ru' ? 'Скопировано ✓' : lang === 'en' ? 'Copied ✓' : 'Nusxa olindi ✓',
    chooseApp:
      lang === 'ru'
        ? 'Выберите платёжное приложение (нажмите на приложение):'
        : lang === 'en'
        ? 'Choose a payment app to enter transfer amount:'
        : 'To‘lov ilovasini tanlang (ustiga bosing — summa kiritish joyi ochiladi):',
    enterAmountLabel:
      lang === 'ru'
        ? 'Введите сумму перевода (сум)'
        : lang === 'en'
        ? 'Enter transfer amount (UZS)'
        : 'Summa kiriting (qancha pul o‘tkazasiz)',
    enterAmountPlaceholder:
      lang === 'ru'
        ? `Введите сумму (минимум ${minPrice.toLocaleString('ru-RU')})`
        : lang === 'en'
        ? `Enter amount (min ${minPrice.toLocaleString('en-US')})`
        : `Summa kiriting (masalan: ${minPrice.toLocaleString('uz-UZ')})`,
    sendTransferBtn:
      lang === 'ru'
        ? 'Перевести на карту и подтвердить →'
        : lang === 'en'
        ? 'Transfer to Card & Confirm →'
        : 'Kartaga o‘tkazish va tasdiqlash →',
    backApps: lang === 'ru' ? '← Все приложения' : lang === 'en' ? '← All Apps' : '← Barcha ilovalar',
    acceptedTitle:
      lang === 'ru'
        ? 'Оплата принята ✓'
        : lang === 'en'
        ? 'Payment Accepted ✓'
        : 'Qabul qilindi ✓',
    acceptedDesc:
      autoEnterDelayMs > 0
        ? lang === 'ru'
          ? 'Оплата принята! Открываем кабинет ученика...'
          : lang === 'en'
          ? 'Payment accepted! Entering Student Cabinet...'
          : 'To‘lovingiz qabul qilindi! O‘quvchi kabinetiga kirilmoqda...'
        : lang === 'ru'
        ? 'Ваш перевод принят, 30-дневная подписка активирована!'
        : lang === 'en'
        ? 'Your transfer was accepted and your 30-day subscription is active!'
        : 'To‘lovingiz muvaffaqiyatli qabul qilindi va 30 kunlik obunangiz avtomatik faollashtirildi!',
    paymentRequiredWarning:
      lang === 'ru'
        ? 'Для входа в кабинет ученика необходимо оплатить 30-дневную подписку (10 000 сум).'
        : lang === 'en'
        ? 'A 30-day student subscription payment (10,000 UZS) is required to enter the Student Cabinet.'
        : 'O‘quvchi kabinetiga kirish uchun 30 kunlik obuna to‘lovini (10 000 so‘m) amalga oshiring.',
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {isExpired && !completedPayment && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>{copyText.paymentRequiredWarning}</div>
        </div>
      )}

      {/* Target Card Box */}
      {!completedPayment && (
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white p-4 sm:p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
            <span>{copyText.cardTitle}</span>
            <span className="font-mono-num font-semibold text-emerald-300">
              {formatCurrency(lang, minPrice)} / 30 kun
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-lg sm:text-xl font-bold font-mono-num tracking-wider">
              {TARGET_CARD_DISPLAY}
            </div>
            <button
              type="button"
              onClick={handleCopyCard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold text-white transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? copyText.copiedBtn : copyText.copyBtn}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: ACCEPTED CONFIRMATION SCREEN */}
      {completedPayment ? (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="text-xl font-bold text-emerald-900">{copyText.acceptedTitle}</div>
            <p className="text-xs sm:text-sm text-emerald-800">{copyText.acceptedDesc}</p>
          </div>

          <div className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Karta raqami:</span>
              <span className="font-mono-num font-semibold text-slate-900">
                {completedPayment.targetCard || TARGET_CARD_DISPLAY}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">To‘lov ilovasi:</span>
              <span className="font-semibold text-slate-900 uppercase">
                {selectedApp?.name || completedPayment.provider}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">O‘tkazilgan summa:</span>
              <span className="font-mono-num font-bold text-emerald-700">
                {formatCurrency(lang, completedPayment.amountUzs)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-slate-500">Chek / ID:</span>
              <span className="font-mono-num text-slate-700">{completedPayment.merchantTransId}</span>
            </div>
          </div>

          {onDoneButtonClick && (
            <button
              type="button"
              onClick={onDoneButtonClick}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
            >
              {t(lang, 'close')}
            </button>
          )}
        </div>
      ) : !selectedApp ? (
        /* STEP 1: CHOOSE PAYMENT APP */
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-blue-600" />
            {copyText.chooseApp}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {PAYMENT_APPS.map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => handleSelectApp(app)}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2.5 min-h-[92px] bg-white ${app.cardBorder}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold tracking-tight ${app.badgeBg} ${app.badgeText}`}
                  >
                    {app.name}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-[11px] font-medium text-slate-600 leading-snug">
                  {app.tagline}
                </div>
              </button>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>{t(lang, 'securityGuarantee')}</div>
          </div>
        </div>
      ) : (
        /* STEP 2: DIRECTLY AT "SUMMA KIRITING" TRANSFER SCREEN FOR SELECTED APP */
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitTransfer();
          }}
          className="space-y-4 border border-slate-200 rounded-2xl p-4 sm:p-5 bg-slate-50/70"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <button
              type="button"
              onClick={() => {
                setSelectedApp(null);
                setError('');
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {copyText.backApps}
            </button>
            <span
              className={`px-3 py-1 rounded-lg text-xs font-bold ${selectedApp.badgeBg} ${selectedApp.badgeText}`}
            >
              {selectedApp.name}
            </span>
          </div>

          <div className="text-xs text-slate-600 flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-200">
            <span>Qabul qiluvchi karta:</span>
            <span className="font-mono-num font-bold text-slate-900">{TARGET_CARD_DISPLAY}</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              {copyText.enterAmountLabel}
            </label>
            <input
              ref={amountRef}
              type="number"
              min={minPrice}
              step={1000}
              value={amountInput}
              onChange={(e) => {
                setAmountInput(e.target.value);
                if (error) setError('');
              }}
              placeholder={copyText.enterAmountPlaceholder}
              required
              className="w-full rounded-xl border-2 border-blue-500 bg-white px-4 py-3 text-lg font-bold font-mono-num text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <div className="flex flex-wrap gap-2 mt-2.5">
              {[minPrice, minPrice * 2, minPrice * 3].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAmountInput(String(preset));
                    setError('');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono-num font-semibold border transition-colors ${
                    Number(amountInput) === preset
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {preset.toLocaleString('uz-UZ')} so‘m
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-60"
          >
            {loading ? t(lang, 'confirmingBtn') : copyText.sendTransferBtn}
          </button>
        </form>
      )}
    </div>
  );
}
