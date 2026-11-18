import React from 'react';
import { CreditCard, LogOut } from 'lucide-react';
import type { IntegrationStatus, Lang, User } from '../types/lms.ts';
import { formatGrade, t } from '../i18n/translations.ts';
import { CardTransferCheckout } from './CardTransferCheckout.tsx';
import { ThemeToggleButton, type AppTheme } from './ThemeToggleButton.tsx';

export function StudentPaymentGate({
  user,
  integrations,
  lang,
  onLangChange,
  theme,
  onToggleTheme,
  onActivated,
  onLogout,
}: {
  user: User;
  integrations: IntegrationStatus;
  lang: Lang;
  onLangChange: (l: Lang) => void;
  theme: AppTheme;
  onToggleTheme: () => void;
  onActivated: (updatedUser: User) => void;
  onLogout: () => void;
}) {
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
        <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-sm p-5 sm:p-7 space-y-5">
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold">
              <CreditCard className="w-4 h-4" />
              {lang === 'ru'
                ? 'Шаг 2 · Активация кабинета ученика'
                : lang === 'en'
                ? 'Step 2 · Student Subscription Payment'
                : '2-bosqich · O‘quvchi kabineti uchun to‘lov'}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
              {user.firstName} {user.lastName} · {formatGrade(lang, user.grade)}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600">
              {lang === 'ru'
                ? 'Регистрация завершена! Для входа в кабинет ученика выберите платёжное приложение и переведите 10 000 сум на карту 5614 6820 1497 0760.'
                : lang === 'en'
                ? 'Registration complete! Choose a payment app and transfer at least 10,000 UZS to card 5614 6820 1497 0760 to unlock your Student Cabinet.'
                : 'Ro‘yxatdan o‘tish yakunlandi! O‘quvchi kabinetiga kirish uchun to‘lov ilovasini tanlang va 5614 6820 1497 0760 kartasiga summa kiriting.'}
            </p>
          </div>

          <CardTransferCheckout
            user={user}
            integrations={integrations}
            lang={lang}
            autoEnterDelayMs={900}
            onActivated={onActivated}
          />
        </div>
      </main>
    </div>
  );
}
