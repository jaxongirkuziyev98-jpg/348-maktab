import React, { useState } from 'react';
import { CheckCircle2, LogOut, ShieldCheck } from 'lucide-react';
import type { Lang, User } from '../types/lms.ts';
import { apiRequest } from '../lib/api.ts';
import { t } from '../i18n/translations.ts';
import { FaceVerificationCircle } from './FaceVerificationCircle.tsx';
import { ThemeToggleButton, type AppTheme } from './ThemeToggleButton.tsx';

export function TeacherFaceVerificationGate({
  user,
  lang,
  onLangChange,
  theme,
  onToggleTheme,
  onVerified,
  onLogout,
}: {
  user: User;
  lang: Lang;
  onLangChange: (l: Lang) => void;
  theme: AppTheme;
  onToggleTheme: () => void;
  onVerified: (updatedUser: User) => void;
  onLogout: () => void;
}) {
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleFaceCaptured(dataUrl: string) {
    setAvatarDataUrl(dataUrl);
    if (!dataUrl || submitting) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await apiRequest<{ ok: boolean; user: User }>('/api/teacher/verify-face', {
        method: 'POST',
        body: JSON.stringify({ avatarDataUrl: dataUrl }),
      });
      setDone(true);
      // Let teacher briefly see green check confirmation, then enter TeacherCabinet automatically
      window.setTimeout(() => {
        onVerified(res.user);
      }, 650);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : lang === 'ru'
          ? 'Ошибка подтверждения лица'
          : lang === 'en'
          ? 'Face verification failed'
          : 'Yuzni tasdiqlashda xatolik yuz berdi'
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="font-bold text-lg font-display text-slate-900">{t(lang, 'brand')}</div>
        <div className="flex items-center gap-2">
          <ThemeToggleButton theme={theme} lang={lang} onToggle={onToggleTheme} />
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
            {(['uz', 'ru', 'en'] as Lang[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onLangChange(code)}
                className={`px-2 py-1 text-xs font-semibold uppercase ${
                  lang === code ? 'bg-slate-900 text-white' : 'text-slate-600'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t(lang, 'logout')}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-7 space-y-5">
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4" />
              {lang === 'ru'
                ? 'Шаг 2 · Биометрическая проверка учителя'
                : lang === 'en'
                ? 'Step 2 · Teacher Face Check'
                : '2-bosqich · O‘qituvchi yuzini tasdiqlash'}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {lang === 'ru'
                ? 'Регистрация завершена! Теперь посмотрите прямо и ровно в круглую камеру — вы автоматически войдёте в кабинет учителя.'
                : lang === 'en'
                ? 'Registration complete! Look straight into the circular camera to automatically enter your Teacher Cabinet.'
                : 'Ro‘yxatdan o‘tish yakunlandi! Endi dumaloq kameraga yuzingizni to‘g‘ri va tekis tuting — tasdiqlangach avtomatik O‘qituvchi kabinetiga kirasiz.'}
            </p>
          </div>

          <FaceVerificationCircle
            lang={lang}
            value={avatarDataUrl}
            autoStart={true}
            onChange={handleFaceCaptured}
          />

          {submitting && !done && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800 text-center">
              {lang === 'ru'
                ? 'Сохраняем фото и открываем кабинет...'
                : lang === 'en'
                ? 'Saving portrait and entering cabinet...'
                : 'Rasmingiz saqlanmoqda va kabinet ochilmoqda...'}
            </div>
          )}

          {done && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {lang === 'ru'
                  ? 'Подтверждено! Входим в кабинет учителя...'
                  : lang === 'en'
                  ? 'Verified! Entering Teacher Cabinet...'
                  : 'Tasdiqlandi ✓ O‘qituvchi kabinetiga kirilmoqda...'}
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center">
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
