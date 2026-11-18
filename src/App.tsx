/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState } from 'react';
import type { IntegrationStatus, Lang, User } from './types/lms.ts';
import { apiRequest, getAuthToken, getSavedUser, setAuthToken, setSavedUser } from './lib/api.ts';
import { t } from './i18n/translations.ts';
import { LandingAndAuth } from './components/LandingAndAuth.tsx';
import { StudentCabinet } from './components/StudentCabinet.tsx';
import { StudentPaymentGate } from './components/StudentPaymentGate.tsx';
import { TeacherCabinet } from './components/TeacherCabinet.tsx';
import { TeacherFaceVerificationGate } from './components/TeacherFaceVerificationGate.tsx';
import { AdminCabinet } from './components/AdminCabinet.tsx';
import type { AppTheme } from './components/ThemeToggleButton.tsx';

function getInitialLang(): Lang {
  try {
    const saved = window.localStorage.getItem('maktab348_lang');
    if (saved === 'uz' || saved === 'ru' || saved === 'en') return saved;
  } catch {
    // ignore
  }
  return 'uz';
}

function getInitialTheme(): AppTheme {
  try {
    const saved = window.localStorage.getItem('maktab348_theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore
  }
  return 'light';
}

export default function App() {
  const initialToken = getAuthToken();
  const initialCachedUser = initialToken ? getSavedUser<User>() : null;

  const [lang, setLangState] = useState<Lang>(getInitialLang);
  const [theme, setThemeState] = useState<AppTheme>(getInitialTheme);
  const [user, setUserState] = useState<User | null>(initialCachedUser);
  const [checkingAuth, setCheckingAuth] = useState(!initialCachedUser);
  const [integrations, setIntegrations] = useState<IntegrationStatus>({
    sms: { configured: false, mode: 'demo', providerLabel: 'DEMO' },
    click: { configured: false, mode: 'demo', priceUzs: 10000, durationDays: 30 },
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem('maktab348_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  function toggleTheme() {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }

  function setUser(next: User | null) {
    setUserState(next);
    setSavedUser(next);
  }

  function setLang(next: Lang) {
    setLangState(next);
    try {
      window.localStorage.setItem('maktab348_lang', next);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    async function bootstrap() {
      try {
        const [meRes, intRes] = await Promise.all([
          apiRequest<{ user: User | null }>('/api/auth/me'),
          apiRequest<IntegrationStatus>('/api/integrations/status'),
        ]);
        if (meRes.user) {
          setUser(meRes.user);
        } else {
          setAuthToken(null);
          setUser(null);
        }
        setIntegrations(intRes);
      } catch {
        if (!initialCachedUser) {
          setUser(null);
        }
      } finally {
        setCheckingAuth(false);
      }
    }
    bootstrap();
  }, []);

  async function handleLogout() {
    setAuthToken(null);
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        {t(lang, 'appLoading')}
      </div>
    );
  }

  if (!user) {
    return (
      <LandingAndAuth
        lang={lang}
        onLangChange={setLang}
        theme={theme}
        onToggleTheme={toggleTheme}
        integrations={integrations}
        onAuthenticated={(u) => setUser(u)}
      />
    );
  }

  if (user.role === 'student') {
    if (user.subscriptionStatus !== 'active') {
      return (
        <StudentPaymentGate
          user={user}
          integrations={integrations}
          lang={lang}
          onLangChange={setLang}
          theme={theme}
          onToggleTheme={toggleTheme}
          onActivated={(updated) => setUser(updated)}
          onLogout={handleLogout}
        />
      );
    }
    return (
      <StudentCabinet
        user={user}
        lang={lang}
        onLangChange={setLang}
        theme={theme}
        onToggleTheme={toggleTheme}
        onUserUpdated={(u) => setUser(u)}
        onLogout={handleLogout}
      />
    );
  }

  if (user.role === 'teacher') {
    if (!user.approved) {
      return (
        <TeacherFaceVerificationGate
          user={user}
          lang={lang}
          onLangChange={setLang}
          theme={theme}
          onToggleTheme={toggleTheme}
          onVerified={(updated) => setUser(updated)}
          onLogout={handleLogout}
        />
      );
    }
    return (
      <TeacherCabinet
        user={user}
        lang={lang}
        onLangChange={setLang}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <AdminCabinet
      user={user}
      lang={lang}
      onLangChange={setLang}
      theme={theme}
      onToggleTheme={toggleTheme}
      onLogout={handleLogout}
    />
  );
}
