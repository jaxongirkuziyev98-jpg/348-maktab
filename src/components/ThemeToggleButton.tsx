import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type { Lang } from '../types/lms.ts';

export type AppTheme = 'light' | 'dark';

export function ThemeToggleButton({
  theme,
  lang,
  onToggle,
}: {
  theme: AppTheme;
  lang: Lang;
  onToggle: () => void;
}) {
  const isDark = theme === 'dark';
  const label = isDark
    ? lang === 'ru'
      ? 'День'
      : lang === 'en'
      ? 'Day'
      : 'Kun'
    : lang === 'ru'
    ? 'Ночь'
    : lang === 'en'
    ? 'Night'
    : 'Tun';

  const title = isDark
    ? lang === 'ru'
      ? 'Переключить на дневной режим'
      : lang === 'en'
      ? 'Switch to Day mode'
      : 'Kun rejimiga o‘tish'
    : lang === 'ru'
    ? 'Переключить на ночной режим'
    : lang === 'en'
    ? 'Switch to Night mode'
    : 'Tun rejimiga o‘tish';

  return (
    <button
      type="button"
      onClick={onToggle}
      title={title}
      aria-label={title}
      className="theme-toggle-btn inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors shrink-0 min-h-[32px]"
    >
      {isDark ? (
        <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      ) : (
        <Moon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
