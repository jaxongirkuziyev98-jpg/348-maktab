import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  GraduationCap,
  ShieldCheck,
  Smartphone,
  CheckCircle2,
  Globe,
  ArrowRight,
  Users,
} from 'lucide-react';
import type { IntegrationStatus, Lang, User, UserRole } from '../types/lms.ts';
import { t } from '../i18n/translations.ts';
import { apiRequest, setAuthToken } from '../lib/api.ts';
import { ThemeToggleButton, type AppTheme } from './ThemeToggleButton.tsx';

export function LandingAndAuth({
  lang,
  onLangChange,
  theme,
  onToggleTheme,
  integrations,
  onAuthenticated,
}: {
  lang: Lang;
  onLangChange: (l: Lang) => void;
  theme: AppTheme;
  onToggleTheme: () => void;
  integrations: IntegrationStatus;
  onAuthenticated: (user: User) => void;
}) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [loginMethod, setLoginMethod] = useState<'password' | 'sms'>('sms');
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [regRole, setRegRole] = useState<'student' | 'teacher'>('student');

  // Login fields
  const [phone, setPhone] = useState('+998903000003');
  const [password, setPassword] = useState('student348');
  const [otpCode, setOtpCode] = useState('');
  const [demoOtpHint, setDemoOtpHint] = useState('');

  // Registration fields
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regGrade, setRegGrade] = useState(5);
  const [regPhone, setRegPhone] = useState('+998');
  const [regEmail, setRegEmail] = useState('');
  const [regParentPhone, setRegParentPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regOtpCode, setRegOtpCode] = useState('');
  const [regOtpSent, setRegOtpSent] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  function fillQuickAccount(role: UserRole, demoPhone: string, demoPass: string) {
    setAuthMode('login');
    setLoginMethod('password');
    setSelectedRole(role);
    setPhone(demoPhone);
    setPassword(demoPass);
    setError('');
    setSuccessMsg('');
  }

  async function handleSendOtp(targetPhone: string, isRegistration: boolean) {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setDemoOtpHint('');
    try {
      const res = await apiRequest<{ ok: boolean; mode: 'gateway' | 'demo'; demoCode?: string }>(
        '/api/auth/send-otp',
        {
          method: 'POST',
          body: JSON.stringify({ phone: targetPhone }),
        }
      );
      if (isRegistration) setRegOtpSent(true);
      if (res.mode === 'demo' && res.demoCode) {
        setDemoOtpHint(res.demoCode);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'SMS yuborishda xatolik');
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      if (loginMethod === 'password') {
        const res = await apiRequest<{ user: User; token: string }>('/api/auth/login-password', {
          method: 'POST',
          body: JSON.stringify({ phone, password, role: selectedRole }),
        });
        if (res.token) setAuthToken(res.token);
        onAuthenticated(res.user);
      } else {
        const res = await apiRequest<{ user: User; token: string }>('/api/auth/login-phone-otp', {
          method: 'POST',
          body: JSON.stringify({ phone, otpCode, role: selectedRole }),
        });
        if (res.token) setAuthToken(res.token);
        onAuthenticated(res.user);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kirishda xatolik');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      if (regRole === 'student') {
        const res = await apiRequest<{ user: User; token: string }>('/api/auth/register-student', {
          method: 'POST',
          body: JSON.stringify({
            firstName: regFirstName,
            lastName: regLastName,
            grade: regGrade,
            phone: regPhone,
            parentPhone: regParentPhone || undefined,
            password: regPassword,
            otpCode: regOtpCode,
          }),
        });
        if (res.token) setAuthToken(res.token);
        onAuthenticated(res.user);
      } else {
        const res = await apiRequest<{
          ok: boolean;
          needsFaceVerification?: boolean;
          user?: User;
          token?: string;
          message?: string;
        }>('/api/auth/register-teacher', {
          method: 'POST',
          body: JSON.stringify({
            firstName: regFirstName,
            lastName: regLastName,
            phone: regPhone,
            email: regEmail,
            password: regPassword,
            otpCode: regOtpCode,
          }),
        });
        if (res.token) setAuthToken(res.token);
        if (res.user) {
          onAuthenticated(res.user);
        } else {
          setSuccessMsg(res.message || 'Ro‘yxatdan o‘tish yakunlandi.');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ro‘yxatdan o‘tishda xatolik');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones (no duplicate registration button) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3 sm:gap-8">
          <a
            href="#top"
            className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
          >
            {t(lang, 'brand')}
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#platform" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              {t(lang, 'navAbout')}
            </a>
            <a href="#subjects" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              {t(lang, 'navSubjects')}
            </a>
            <a href="#languages" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              {t(lang, 'navLanguages')}
            </a>
            <a href="#auth-portal" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              {t(lang, 'ctaRegister')}
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a
              href="#auth-portal"
              className="md:hidden px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
            >
              {t(lang, 'ctaRegister')}
            </a>
            <ThemeToggleButton theme={theme} lang={lang} onToggle={onToggleTheme} />
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
              {(['uz', 'ru', 'en'] as Lang[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onLangChange(code)}
                  className={`px-2 sm:px-2.5 py-1.5 text-xs font-semibold uppercase transition-colors whitespace-nowrap ${
                    lang === code ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Split */}
      <section id="platform" className="max-w-7xl mx-auto px-3.5 sm:px-6 pt-5 sm:pt-8 pb-7 sm:pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="lg:col-span-7 flex flex-col justify-between bg-white border border-slate-200 rounded-2xl p-5 sm:p-10"
          >
            <div className="space-y-3 sm:space-y-5">
              <div className="text-xs font-medium text-blue-700">
                O‘zbek · Русский · English · 1–11-sinflar
              </div>
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 text-balance leading-[1.15]">
                {t(lang, 'heroTitle')}
              </h1>
              <p className="text-sm sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                {t(lang, 'heroSubtitle')}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-5 mt-5 sm:pt-8 sm:mt-8 border-t border-slate-100">
              <div>
                <div className="text-xl sm:text-2xl font-bold font-mono-num text-slate-900">1–11</div>
                <div className="text-xs text-slate-500 mt-0.5">Sinflar qamrovi</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold font-mono-num text-slate-900">14+</div>
                <div className="text-xs text-slate-500 mt-0.5">Maktab fanlari</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold font-mono-num text-slate-900">20</div>
                <div className="text-xs text-slate-500 mt-0.5">Savollik testlar</div>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold font-mono-num text-slate-900">12</div>
                <div className="text-xs text-slate-500 mt-0.5">Til kurslari</div>
              </div>
            </div>
          </motion.div>

          <div className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 h-52 sm:h-64 lg:h-auto lg:min-h-[280px]">
            <img
              src="/src/assets/images/school_campus_hero_1794918538372.jpg"
              alt="348-MAKTAB zamonaviy kampusi"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent flex flex-col justify-end p-4 sm:p-6 text-white">
              <div className="text-xs text-slate-300">Toshkent · Raqamli Ta’lim Tizimi</div>
              <div className="text-sm sm:text-lg font-semibold mt-1 leading-snug">
                Uchta alohida himoyalangan kabinet: O‘quvchi, O‘qituvchi, Administrator
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Authentication & SMS Registration Portal */}
      <section id="auth-portal" className="max-w-7xl mx-auto px-3.5 sm:px-6 pb-10 sm:pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left: Auth Card */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 sm:pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {authMode === 'register' ? t(lang, 'registerTab') : t(lang, 'loginTab')}
                </h2>
                {authMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setError('');
                      setSuccessMsg('');
                      setDemoOtpHint('');
                    }}
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    ← {t(lang, 'registerTab')}
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-500">
                SMS holati:{' '}
                <span className="font-semibold text-slate-700">
                  {integrations.sms.configured ? 'Gateway ulangan' : 'DEMO rejim'}
                </span>
              </div>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="mt-5 sm:mt-6 space-y-4 sm:space-y-5">
                {/* 2 Primary Roles (O‘quvchi / O‘qituvchi) + discreet Admin switch */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <label className="text-xs font-semibold text-slate-600">
                      Kabinet turini tanlang
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRole(selectedRole === 'admin' ? 'student' : 'admin');
                        setError('');
                      }}
                      className={`inline-flex items-center gap-1 text-xs font-medium transition-colors py-1 ${
                        selectedRole === 'admin'
                          ? 'text-slate-900 font-semibold underline'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {selectedRole === 'admin' ? 'O‘quvchi / O‘qituvchiga qaytish' : 'Administrator kirishi'}
                    </button>
                  </div>

                  {selectedRole === 'admin' ? (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-900 bg-slate-900 text-white text-xs sm:text-sm font-semibold">
                      <span className="inline-flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        {t(lang, 'roleAdmin')} kabineti
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedRole('student')}
                        className="text-xs font-normal text-slate-300 hover:text-white underline"
                      >
                        O‘zgartirish
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      {(
                        [
                          { role: 'student', label: t(lang, 'roleStudent'), icon: <GraduationCap className="w-4 h-4" /> },
                          { role: 'teacher', label: t(lang, 'roleTeacher'), icon: <BookOpen className="w-4 h-4" /> },
                        ] as const
                      ).map((item) => (
                        <button
                          key={item.role}
                          type="button"
                          onClick={() => {
                            setSelectedRole(item.role);
                            setError('');
                          }}
                          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-semibold transition-colors ${
                            selectedRole === item.role
                              ? 'border-blue-600 bg-blue-50 text-blue-800'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {item.icon}
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Login Method Toggle */}
                <div className="flex items-center gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() => setLoginMethod('password')}
                    className={`font-semibold pb-1 border-b-2 transition-colors ${
                      loginMethod === 'password'
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-slate-500'
                    }`}
                  >
                    {t(lang, 'loginWithPassword')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod('sms')}
                    className={`font-semibold pb-1 border-b-2 transition-colors ${
                      loginMethod === 'sms'
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-slate-500'
                    }`}
                  >
                    {t(lang, 'loginWithSms')}
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t(lang, 'phone')}
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+998901234567"
                      required
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>

                  {loginMethod === 'password' ? (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        {t(lang, 'password')}
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="6 xonali SMS kod"
                          required
                          className="w-full sm:flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendOtp(phone, false)}
                          disabled={loading}
                          className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap"
                        >
                          {t(lang, 'sendSms')}
                        </button>
                      </div>
                      {demoOtpHint && (
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                          <span className="font-semibold">SMS DEMO REJIM:</span> Haqiqiy SMS Gateway ulanmagan. Sinov kodi:{' '}
                          <span className="font-mono-num font-bold">{demoOtpHint}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <span>{loading ? 'Tekshirilmoqda...' : 'Kabinetga kirish'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              /* Unified Registration: ONLY O‘quvchi or O‘qituvchi */
              <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    Ro‘yxatdan o‘tish turini tanlang
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRegRole('student');
                        setError('');
                        setSuccessMsg('');
                      }}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-semibold transition-colors ${
                        regRole === 'student'
                          ? 'border-blue-600 bg-blue-50 text-blue-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>{t(lang, 'roleStudent')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRegRole('teacher');
                        setError('');
                        setSuccessMsg('');
                      }}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs sm:text-sm font-semibold transition-colors ${
                        regRole === 'teacher'
                          ? 'border-blue-600 bg-blue-50 text-blue-800'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>{t(lang, 'roleTeacher')}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t(lang, 'firstName')}
                    </label>
                    <input
                      type="text"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      placeholder={regRole === 'student' ? 'Masalan: Amirbek' : 'Masalan: Dilnoza'}
                      required
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {t(lang, 'lastName')}
                    </label>
                    <input
                      type="text"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      placeholder={regRole === 'student' ? 'Masalan: Karimov' : 'Masalan: Rahimova'}
                      required
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                {regRole === 'student' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Nechinchi sinf? (1–11)
                      </label>
                      <select
                        value={regGrade}
                        onChange={(e) => setRegGrade(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                          <option key={g} value={g}>
                            {g}-sinf {g <= 4 ? '(O‘yinli dizayn)' : '(Minimalistik)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        {t(lang, 'phone')}
                      </label>
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+998901234567"
                        required
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        {t(lang, 'parentPhone')}
                      </label>
                      <input
                        type="tel"
                        value={regParentPhone}
                        onChange={(e) => setRegParentPhone(e.target.value)}
                        placeholder="+99890..."
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        {t(lang, 'phone')}
                      </label>
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="+998901234567"
                        required
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        {t(lang, 'email')}
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="ism.familiya@gmail.com"
                        required
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {`${t(lang, 'password')} (ixtiyoriy)`}
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Ixtiyoriy — bo‘sh qoldirish mumkin"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      SMS orqali telefonni tasdiqlash
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSendOtp(regPhone, true)}
                      disabled={loading}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap"
                    >
                      {regOtpSent ? 'Qayta yuborish' : t(lang, 'sendSms')}
                    </button>
                  </div>

                  {demoOtpHint && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                      <span className="font-semibold">DEMO SMS:</span> Tasdiqlash kodi:{' '}
                      <span className="font-mono-num font-bold">{demoOtpHint}</span>
                    </div>
                  )}

                  <input
                    type="text"
                    value={regOtpCode}
                    onChange={(e) => setRegOtpCode(e.target.value)}
                    placeholder="6 xonali SMS kodni kiriting"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {regRole === 'teacher' ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    O‘qituvchilar uchun platforma bepul! Ro‘yxatdan o‘tib bo‘lganingizdan so‘ng dumaloq kamera ochiladi — yuzingiz tasdiqlangach darhol O‘qituvchi kabinetiga kirasiz.
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    O‘quvchi ro‘yxatdan o‘tib bo‘lgach to‘lov oynasi ochiladi (10 000 so‘m / 30 kun). To‘lov qabul qilinmaguncha o‘quvchi kabinetiga kirilmaydi.
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-2">
                    <div>{error}</div>
                    {error.includes('allaqachon ro‘yxatdan o‘tgan') && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login');
                          setSelectedRole(regRole);
                          setLoginMethod('sms');
                          setPhone(regPhone);
                          setError('');
                        }}
                        className="font-semibold underline text-red-800"
                      >
                        Ushbu raqam bilan hisobni ochish →
                      </button>
                    )}
                  </div>
                )}

                {successMsg && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-2">
                    <div>{successMsg}</div>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setSelectedRole('teacher');
                        setSuccessMsg('');
                      }}
                      className="font-semibold underline text-emerald-900"
                    >
                      Tizimga kirish sahifasiga o‘tish →
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {loading
                    ? 'Ro‘yxatdan o‘tkazilmoqda...'
                    : regRole === 'teacher'
                      ? 'Ro‘yxatdan o‘tish va yuzni tasdiqlashga o‘tish →'
                      : 'Ro‘yxatdan o‘tish va to‘lovga o‘tish →'}
                </button>

                <div className="pt-2 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setError('');
                      setSuccessMsg('');
                      setDemoOtpHint('');
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 underline"
                  >
                    Hisobingiz bormi? O‘qituvchi / Administrator kirishi →
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right: Quick Access & Architecture Overview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="w-4 h-4 text-blue-600" />
                Tezkor kirish (Tayyor rollar)
              </div>
              <p className="text-xs text-slate-600">
                Barcha 3 kabinet va 1–4 / 5–11-sinf dizaynlarini darhol sinab ko‘rish uchun quyidagi hisoblardan birini tanlang:
              </p>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => fillQuickAccount('student', '+998903000003', 'student348')}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Aziza Tursunova · 3-sinf</div>
                    <div className="text-xs text-slate-500">1–4-sinf o‘yinli va yulduzchali kabinet</div>
                  </div>
                  <span className="text-xs font-mono-num text-blue-700 shrink-0">+998903000003</span>
                </button>

                <button
                  type="button"
                  onClick={() => fillQuickAccount('student', '+998903000009', 'student348')}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Sardor Mirzayev · 9-sinf</div>
                    <div className="text-xs text-slate-500">5–11-sinf minimalistik premium kabinet</div>
                  </div>
                  <span className="text-xs font-mono-num text-blue-700 shrink-0">+998903000009</span>
                </button>

                <button
                  type="button"
                  onClick={() => fillQuickAccount('student', '+998903000008', 'student348')}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Madina Qodirova · 8-sinf</div>
                    <div className="text-xs text-amber-700">Muddati tugagan obuna (Click yangilash)</div>
                  </div>
                  <span className="text-xs font-mono-num text-amber-700 shrink-0">+998903000008</span>
                </button>

                <button
                  type="button"
                  onClick={() => fillQuickAccount('teacher', '+998902000001', 'teacher348')}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Malika Rustamova · O‘qituvchi</div>
                    <div className="text-xs text-slate-500">3, 4, 8, 9-sinflar · Matematika / Informatika</div>
                  </div>
                  <span className="text-xs font-mono-num text-emerald-700 shrink-0">+998902000001</span>
                </button>

                <button
                  type="button"
                  onClick={() => fillQuickAccount('admin', '+998901000001', 'admin348')}
                  className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-slate-900 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">Dilshod Karimov · Administrator</div>
                    <div className="text-xs text-slate-500">To‘liq maktab, til markazi va to‘lov nazorati</div>
                  </div>
                  <span className="text-xs font-mono-num text-slate-700 shrink-0">+998901000001</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Curriculum & 12 Languages Preview */}
      <section id="subjects" className="max-w-7xl mx-auto px-3.5 sm:px-6 pb-10 sm:pb-14">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 space-y-5 sm:space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">1–11-sinf fanlari va ta’lim jarayoni</h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Matematika, Ona tili, Adabiyot, Ingliz tili, Rus tili, Fizika, Kimyo, Biologiya, Tarix, Geografiya, Informatika, Huquq, Tarbiya va Tabiiy fanlar.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            <div className="p-4 sm:p-5 rounded-xl border border-slate-200 space-y-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">O‘qituvchi tasdiqlaydigan vazifalar</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                O‘quvchi matn, rasm yoki PDF yuklaydi. Vazifa avval Kutilmoqda holatida turadi, faqat o‘qituvchi tekshirgach yashil ✓ beriladi.
              </p>
            </div>
            <div className="p-4 sm:p-5 rounded-xl border border-slate-200 space-y-2">
              <GraduationCap className="w-5 h-5 text-emerald-600" />
              <h3 className="font-semibold text-slate-900">20 savollik avtomatik testlar</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Har bir test A, B, C, D variantli 20 ta savoldan iborat bo‘lib, yakunda foiz, ball va xatolar izohi bilan saqlanadi.
              </p>
            </div>
            <div id="languages" className="p-4 sm:p-5 rounded-xl border border-slate-200 space-y-2">
              <Globe className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-slate-900">12 ta til kursi markazi</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ingliz, Rus, Nemis, Fransuz, Ispan, Arab, Xitoy, Koreys, Yapon, Turk, Italyan va Qozoq tillari Beginner–Advanced darajalarida.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>348-MAKTAB · Onlayn maktab va til markazi</span>
          <span>O‘zbek · Русский · English</span>
        </div>
      </footer>
    </div>
  );
}
