import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Users,
  GraduationCap,
  BookOpen,
  PlayCircle,
  BookMarked,
  Globe,
  CreditCard,
  MessageSquare,
  BarChart3,
  LogOut,
  Menu,
  X,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import type {
  Ebook,
  Homework,
  HomeworkSubmission,
  IntegrationStatus,
  Lang,
  LanguageCourse,
  LanguageLevel,
  PaymentRecord,
  SchoolClass,
  SmsLog,
  Subject,
  TestAttempt,
  TestItem,
  User,
  VideoLesson,
} from '../types/lms.ts';
import { t } from '../i18n/translations.ts';
import { ApiError, apiRequest, uploadFileToServer } from '../lib/api.ts';
import { HomeworkBreakdownBar, SubjectBarChart } from './Charts.tsx';
import { ThemeToggleButton, type AppTheme } from './ThemeToggleButton.tsx';

type AdminTab =
  | 'overview'
  | 'teachers'
  | 'students'
  | 'curriculum'
  | 'languages'
  | 'payments'
  | 'sms'
  | 'reports';

interface AdminDashboardData {
  students: User[];
  teachers: User[];
  admins: User[];
  classes: SchoolClass[];
  subjects: Subject[];
  videoLessons: VideoLesson[];
  ebooks: Ebook[];
  homeworks: Homework[];
  submissions: HomeworkSubmission[];
  tests: TestItem[];
  testAttempts: TestAttempt[];
  languageCourses: LanguageCourse[];
  payments: PaymentRecord[];
  smsLogs: SmsLog[];
  integrations: IntegrationStatus;
}

export function AdminCabinet({
  user,
  lang,
  onLangChange,
  theme,
  onToggleTheme,
  onLogout,
}: {
  user: User;
  lang: Lang;
  onLangChange: (l: Lang) => void;
  theme: AppTheme;
  onToggleTheme: () => void;
  onLogout: () => void;
}) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    try {
      const saved = window.localStorage.getItem(`maktab348_tab_${user.id}`) as AdminTab | null;
      const valid: AdminTab[] = ['overview', 'teachers', 'students', 'curriculum', 'languages', 'payments', 'sms', 'reports'];
      if (saved && valid.includes(saved)) return saved;
    } catch {
      // ignore
    }
    return 'overview';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(`maktab348_tab_${user.id}`, activeTab);
    } catch {
      // ignore
    }
  }, [activeTab, user.id]);

  // Create Teacher Form
  const [tFirst, setTFirst] = useState('');
  const [tLast, setTLast] = useState('');
  const [tPhone, setTPhone] = useState('+998');
  const [tEmail, setTEmail] = useState('');
  const [tPass, setTPass] = useState('teacher348');
  const [tGrades, setTGrades] = useState<number[]>([5, 6]);
  const [tSubjects, setTSubjects] = useState<string[]>(['subj-math']);

  // Create Class & Subject Forms
  const [cGrade, setCGrade] = useState(1);
  const [cSection, setCSection] = useState('B');
  const [cRoom, setCRoom] = useState('112');
  const [sNameUz, setSNameUz] = useState('');
  const [sCode, setSCode] = useState('');

  // Create Video Lesson Form
  const [vSubjectId, setVSubjectId] = useState('subj-math');
  const [vGrade, setVGrade] = useState(5);
  const [vTitle, setVTitle] = useState('');
  const [vDesc, setVDesc] = useState('');
  const [vUrl, setVUrl] = useState('');

  // Create Ebook Form
  const [bSubjectId, setBSubjectId] = useState('subj-math');
  const [bGrade, setBGrade] = useState(5);
  const [bTitle, setBTitle] = useState('');
  const [bAuthor, setBAuthor] = useState('348-MAKTAB');
  const [bPdfUrl, setBPdfUrl] = useState('');

  // Language Course Video Management
  const [langCourseId, setLangCourseId] = useState('lang-en');
  const [langLevel, setLangLevel] = useState<LanguageLevel>('Beginner');
  const [langVideoUrl, setLangVideoUrl] = useState('');

  // Manual SMS
  const [smsStudentId, setSmsStudentId] = useState('');
  const [smsRecipientType, setSmsRecipientType] = useState<'student' | 'parent'>('parent');
  const [smsCustomMsg, setSmsCustomMsg] = useState('');

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await apiRequest<AdminDashboardData>('/api/admin/dashboard');
      setData(res);
      if (!smsStudentId && res.students.length > 0) setSmsStudentId(res.students[0].id);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : 'Admin kabinetini yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateTeacher(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStatusMsg('');
    try {
      await apiRequest('/api/admin/teachers', {
        method: 'POST',
        body: JSON.stringify({
          firstName: tFirst,
          lastName: tLast,
          phone: tPhone,
          email: tEmail || undefined,
          password: tPass,
          assignedGrades: tGrades,
          assignedSubjectIds: tSubjects,
        }),
      });
      setTFirst('');
      setTLast('');
      setTPhone('+998');
      setTEmail('');
      setStatusMsg('O‘qituvchi yaratildi va sinf/fanlarga biriktirildi.');
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  async function toggleTeacherAssignment(
    teacher: User,
    field: 'grade' | 'subject',
    value: number | string
  ) {
    const nextGrades =
      field === 'grade'
        ? teacher.assignedGrades?.includes(value as number)
          ? teacher.assignedGrades.filter((g) => g !== value)
          : [...(teacher.assignedGrades || []), value as number]
        : teacher.assignedGrades || [];

    const nextSubjects =
      field === 'subject'
        ? teacher.assignedSubjectIds?.includes(value as string)
          ? teacher.assignedSubjectIds.filter((s) => s !== value)
          : [...(teacher.assignedSubjectIds || []), value as string]
        : teacher.assignedSubjectIds || [];

    await apiRequest(`/api/admin/teachers/${teacher.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        assignedGrades: nextGrades,
        assignedSubjectIds: nextSubjects,
      }),
    });
    await loadDashboard();
  }

  async function handleUploadMedia(file: File, target: 'video' | 'ebook' | 'langVideo') {
    try {
      const uploaded = await uploadFileToServer(file);
      if (target === 'video') setVUrl(uploaded.url);
      if (target === 'ebook') setBPdfUrl(uploaded.url);
      if (target === 'langVideo') setLangVideoUrl(uploaded.url);
      setStatusMsg(`Fayl yuklandi: ${uploaded.safeName}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Yuklash xatosi');
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        Administrator kabineti yuklanmoqda...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-sm text-red-600">{error || 'Administrator kabineti ma’lumotlari topilmadi'}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadDashboard}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm"
          >
            Qayta urinish
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm"
          >
            Chiqish
          </button>
        </div>
      </div>
    );
  }

  const {
    students,
    teachers,
    classes,
    subjects,
    videoLessons,
    ebooks,
    homeworks,
    submissions,
    tests,
    testAttempts,
    languageCourses,
    payments,
    smsLogs,
    integrations,
  } = data;

  const totalRevenue = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.amountUzs, 0);

  const navItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Boshqaruv paneli', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'teachers', label: 'O‘qituvchilar', icon: <Users className="w-4 h-4" /> },
    { id: 'students', label: 'O‘quvchilar va Sinflar', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'curriculum', label: 'Fanlar, Video va Kitoblar', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'languages', label: '12 Til kursi', icon: <Globe className="w-4 h-4" /> },
    { id: 'payments', label: 'To‘lovlar va Obunalar', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'sms', label: 'SMS xabarnomalar', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'reports', label: 'Hisobotlar va Statistika', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-white border-r border-slate-200">
        <div className="p-5 border-b border-slate-100">
          <div className="text-lg font-bold font-display">348-MAKTAB</div>
          <div className="text-xs text-slate-500 mt-0.5">
            Administrator · {user.firstName} {user.lastName}
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="w-4 h-4" />
            {t(lang, 'logout')}
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 w-72 max-w-[85vw] bg-white h-full flex flex-col p-4 border-r border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="font-bold font-display text-slate-900">Administrator</div>
                <div className="text-xs text-slate-500">
                  {user.firstName} {user.lastName}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-medium ${
                    activeTab === item.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm text-red-600 font-medium hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                {t(lang, 'logout')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label={t(lang, 'menuLabel')}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                348-MAKTAB · Administrator
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 truncate">
                SMS: {integrations.sms.configured ? 'Ulangan' : 'DEMO'} · Click:{' '}
                {integrations.click.configured ? 'Jonli' : 'DEMO'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <ThemeToggleButton theme={theme} lang={lang} onToggle={onToggleTheme} />
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50 shrink-0">
              {(['uz', 'ru', 'en'] as Lang[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => onLangChange(code)}
                  className={`px-2 py-1 text-[11px] sm:text-xs font-semibold uppercase ${
                    lang === code ? 'bg-slate-900 text-white' : 'text-slate-600'
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="flex-1 p-3.5 sm:p-6 pb-24 lg:pb-6 max-w-6xl w-full mx-auto space-y-5 sm:space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}
          {statusMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              {statusMsg}
            </div>
          )}

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5 sm:space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <div className="text-xs text-slate-500">O‘quvchilar</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono-num mt-1">{students.length}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <div className="text-xs text-slate-500">O‘qituvchilar</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono-num mt-1">{teachers.length}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <div className="text-xs text-slate-500">Video / Kitob / Test</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono-num mt-1">
                    {videoLessons.length} / {ebooks.length} / {tests.length}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <div className="text-xs text-slate-500">Click tushumi</div>
                  <div className="text-lg sm:text-2xl font-bold font-mono-num text-emerald-700 mt-1">
                    {totalRevenue.toLocaleString('uz-UZ')} so‘m
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-2">
                  <div className="text-sm font-semibold text-slate-900">
                    SMS Gateway integratsiyasi
                  </div>
                  <p className="text-xs text-slate-600">
                    Holat: <span className="font-semibold">{integrations.sms.providerLabel}</span>. Haqiqiy SMS yuborish uchun server muhitiga <span className="font-mono-num">SMS_GATEWAY_URL</span> va <span className="font-mono-num">SMS_GATEWAY_TOKEN</span> qo‘shing.
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-2">
                  <div className="text-sm font-semibold text-slate-900">
                    Click.uz Merchant API holati
                  </div>
                  <p className="text-xs text-slate-600">
                    Holat:{' '}
                    <span className="font-semibold">
                      {integrations.click.configured ? 'Jonli Click Merchant ulangan' : 'DEMO rejim (API kalitlari ulanmagan)'}
                    </span>
                    . Tarif: 30 kun / 10 000 so‘m.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TEACHERS MANAGEMENT */}
          {activeTab === 'teachers' && (
            <div className="space-y-5 sm:space-y-6">
              <form
                onSubmit={handleCreateTeacher}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4"
              >
                <h2 className="text-lg font-bold text-slate-900">Yangi o‘qituvchi qo‘shish</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <input
                    type="text"
                    placeholder="Ism"
                    value={tFirst}
                    onChange={(e) => setTFirst(e.target.value)}
                    required
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Familiya"
                    value={tLast}
                    onChange={(e) => setTLast(e.target.value)}
                    required
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="tel"
                    placeholder="+99890..."
                    value={tPhone}
                    onChange={(e) => setTPhone(e.target.value)}
                    required
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono-num"
                  />
                  <input
                    type="email"
                    placeholder="Gmail (ixtiyoriy)"
                    value={tEmail}
                    onChange={(e) => setTEmail(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Parol"
                    value={tPass}
                    onChange={(e) => setTPass(e.target.value)}
                    required
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-1.5">Biriktiriladigan sinflar:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() =>
                          setTGrades((prev) =>
                            prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono-num font-semibold border ${
                          tGrades.includes(g)
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        {g}-sinf
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-1.5">Biriktiriladigan fanlar:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {subjects.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          setTSubjects((prev) =>
                            prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                          tSubjects.includes(s.id)
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 text-slate-700'
                        }`}
                      >
                        {s.name[lang]}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  O‘qituvchini yaratish
                </button>
              </form>

              <div className="space-y-3">
                {[...teachers]
                  .sort((a, b) => Number(a.approved) - Number(b.approved))
                  .map((tch) => (
                  <div
                    key={tch.id}
                    className={`bg-white border rounded-2xl p-4 sm:p-5 space-y-3 ${
                      tch.approved ? 'border-slate-200' : 'border-amber-300 bg-amber-50/20'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {tch.avatarUrl ? (
                          <img
                            src={tch.avatarUrl}
                            alt={`${tch.firstName} ${tch.lastName}`}
                            className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {tch.firstName.charAt(0)}
                            {tch.lastName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">
                            {tch.firstName} {tch.lastName}
                          </div>
                          <div className="text-xs text-slate-500 font-mono-num truncate">
                            {tch.phone}
                            {tch.email ? ` · ${tch.email}` : ''}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/teachers/${tch.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ approved: !tch.approved }),
                          });
                          loadDashboard();
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          tch.approved
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {tch.approved ? 'Tasdiqlangan ✓' : 'Tasdiqlash (Kutilmoqda)'}
                      </button>
                    </div>

                    <div className="text-xs text-slate-600">
                      Sinflar (bosib o‘zgartiring):
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => toggleTeacherAssignment(tch, 'grade', g)}
                            className={`px-2 py-0.5 rounded border font-mono-num ${
                              tch.assignedGrades?.includes(g)
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="text-xs text-slate-600">
                      Fanlar (bosib o‘zgartiring):
                      <div className="flex flex-wrap gap-1 mt-1">
                        {subjects.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => toggleTeacherAssignment(tch, 'subject', s.id)}
                            className={`px-2 py-0.5 rounded border ${
                              tch.assignedSubjectIds?.includes(s.id)
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-white border-slate-200 text-slate-600'
                            }`}
                          >
                            {s.name[lang]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STUDENTS & CLASSES */}
          {activeTab === 'students' && (
            <div className="space-y-5 sm:space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Yangi sinf yaratish</h2>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2.5 sm:gap-3">
                  <select
                    value={cGrade}
                    onChange={(e) => setCGrade(Number(e.target.value))}
                    className="col-span-2 sm:col-span-1 rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={g}>
                        {g}-sinf
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={cSection}
                    onChange={(e) => setCSection(e.target.value)}
                    placeholder="Bo‘lim (A, B)"
                    className="w-full sm:w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={cRoom}
                    onChange={(e) => setCRoom(e.target.value)}
                    placeholder="Xona"
                    className="w-full sm:w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest('/api/admin/classes', {
                        method: 'POST',
                        body: JSON.stringify({ grade: cGrade, section: cSection, roomNumber: cRoom }),
                      });
                      setStatusMsg(`${cGrade}-${cSection} sinfi qo‘shildi.`);
                      loadDashboard();
                    }}
                    className="col-span-2 sm:col-span-1 px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl bg-slate-900 text-white text-xs font-semibold"
                  >
                    Sinf qo‘shish
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-600 pt-2">
                  {classes.map((c) => (
                    <span key={c.id} className="px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 font-mono-num">
                      {c.grade}-{c.section} (Xona {c.roomNumber})
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6">
                <h3 className="text-base font-bold text-slate-900 mb-4">O‘quvchilar ro‘yxati</h3>

                {/* Mobile student cards */}
                <div className="sm:hidden space-y-2.5">
                  {students.map((st) => (
                    <div key={st.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-900 truncate">
                            {st.firstName} {st.lastName}
                          </div>
                          <div className="text-xs text-slate-500 font-mono-num mt-0.5">
                            {st.grade}-sinf · {st.phone}
                          </div>
                        </div>
                        <span
                          className={`shrink-0 text-xs font-semibold ${
                            st.subscriptionStatus === 'active' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          {st.subscriptionStatus === 'active' ? 'Faol ✓' : 'Tugagan'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/students/${st.id}/subscription`, {
                              method: 'PATCH',
                              body: JSON.stringify({ action: 'activate_30' }),
                            });
                            loadDashboard();
                          }}
                          className="px-3 py-2 min-h-[40px] rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                        >
                          +30 kun
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/students/${st.id}/subscription`, {
                              method: 'PATCH',
                              body: JSON.stringify({ action: 'expire' }),
                            });
                            loadDashboard();
                          }}
                          className="px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
                        >
                          Tugatish
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2.5 pr-4">O‘quvchi</th>
                        <th className="py-2.5 pr-4">Sinf</th>
                        <th className="py-2.5 pr-4">Telefon</th>
                        <th className="py-2.5 pr-4">Obuna holati</th>
                        <th className="py-2.5 text-right">Boshqarish</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((st) => (
                        <tr key={st.id}>
                          <td className="py-3 pr-4 font-medium text-slate-900">
                            {st.firstName} {st.lastName}
                          </td>
                          <td className="py-3 pr-4 font-mono-num">{st.grade}-sinf</td>
                          <td className="py-3 pr-4 font-mono-num text-xs">{st.phone}</td>
                          <td className="py-3 pr-4 text-xs">
                            <span
                              className={
                                st.subscriptionStatus === 'active'
                                  ? 'font-semibold text-emerald-700'
                                  : 'font-semibold text-red-700'
                              }
                            >
                              {st.subscriptionStatus === 'active' ? 'Faol ✓' : 'Muddati tugagan'}
                            </span>
                          </td>
                          <td className="py-3 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={async () => {
                                await apiRequest(`/api/admin/students/${st.id}/subscription`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ action: 'activate_30' }),
                                });
                                loadDashboard();
                              }}
                              className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs font-semibold"
                            >
                              +30 kun
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiRequest(`/api/admin/students/${st.id}/subscription`, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ action: 'expire' }),
                                });
                                loadDashboard();
                              }}
                              className="px-2.5 py-1 rounded-md border border-slate-200 text-xs text-slate-700"
                            >
                              Tugatish
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CURRICULUM: SUBJECTS, VIDEOS, EBOOKS */}
          {activeTab === 'curriculum' && (
            <div className="space-y-5 sm:space-y-6">
              {/* Add Subject */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Yangi fan qo‘shish</h2>
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                  <input
                    type="text"
                    value={sNameUz}
                    onChange={(e) => setSNameUz(e.target.value)}
                    placeholder="Fan nomi (masalan: Astronomiya)"
                    className="w-full sm:flex-1 min-w-0 rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={sCode}
                    onChange={(e) => setSCode(e.target.value)}
                    placeholder="Kod (AST)"
                    className="w-full sm:w-28 rounded-xl border border-slate-300 px-3.5 py-2 text-sm uppercase"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!sNameUz.trim()) return;
                      await apiRequest('/api/admin/subjects', {
                        method: 'POST',
                        body: JSON.stringify({ nameUz: sNameUz, code: sCode }),
                      });
                      setSNameUz('');
                      setSCode('');
                      setStatusMsg('Yangi fan qo‘shildi.');
                      loadDashboard();
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl bg-slate-900 text-white text-xs font-semibold"
                  >
                    Fan qo‘shish
                  </button>
                </div>
              </div>

              {/* Add Video Lesson */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-blue-600 shrink-0" />
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Video dars yuklash yoki rasmiy havola biriktirish
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={vSubjectId}
                    onChange={(e) => setVSubjectId(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name[lang]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={vGrade}
                    onChange={(e) => setVGrade(Number(e.target.value))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={g}>
                        {g}-sinf
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={vTitle}
                    onChange={(e) => setVTitle(e.target.value)}
                    placeholder="Video dars nomi"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <input
                  type="text"
                  value={vDesc}
                  onChange={(e) => setVDesc(e.target.value)}
                  placeholder="Dars tavsifi"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
                  <input
                    type="text"
                    value={vUrl}
                    onChange={(e) => setVUrl(e.target.value)}
                    placeholder="Rasmiy YouTube/Vimeo havolasi yoki video fayl yuklang"
                    className="w-full sm:flex-1 min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadMedia(f, 'video');
                    }}
                    className="text-xs w-full sm:w-auto"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!vTitle.trim()) return;
                      await apiRequest('/api/admin/videos', {
                        method: 'POST',
                        body: JSON.stringify({
                          subjectId: vSubjectId,
                          grade: vGrade,
                          title: vTitle,
                          description: vDesc,
                          videoUrl: vUrl || undefined,
                        }),
                      });
                      setVTitle('');
                      setVDesc('');
                      setVUrl('');
                      setStatusMsg('Video dars saqlandi.');
                      loadDashboard();
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl bg-blue-600 text-white text-xs font-semibold"
                  >
                    Video darsni saqlash
                  </button>
                </div>
              </div>

              {/* Add E-Book */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <BookMarked className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-lg font-bold text-slate-900">Elektron kitob (PDF) qo‘shish</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <select
                    value={bSubjectId}
                    onChange={(e) => setBSubjectId(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name[lang]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={bGrade}
                    onChange={(e) => setBGrade(Number(e.target.value))}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {Array.from({ length: 11 }, (_, i) => i + 1).map((g) => (
                      <option key={g} value={g}>
                        {g}-sinf
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={bTitle}
                    onChange={(e) => setBTitle(e.target.value)}
                    placeholder="Kitob nomi"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={bAuthor}
                    onChange={(e) => setBAuthor(e.target.value)}
                    placeholder="Muallif"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadMedia(f, 'ebook');
                    }}
                    className="text-xs"
                  />
                  {bPdfUrl && <span className="text-xs text-emerald-700">PDF yuklandi ✓</span>}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!bTitle.trim()) return;
                      await apiRequest('/api/admin/ebooks', {
                        method: 'POST',
                        body: JSON.stringify({
                          subjectId: bSubjectId,
                          grade: bGrade,
                          title: bTitle,
                          author: bAuthor,
                          pdfUrl: bPdfUrl || undefined,
                        }),
                      });
                      setBTitle('');
                      setBPdfUrl('');
                      setStatusMsg('Elektron kitob qo‘shildi.');
                      loadDashboard();
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
                  >
                    Kitobni saqlash
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 12 LANGUAGE COURSES ADMIN */}
          {activeTab === 'languages' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5">
              <h2 className="text-lg font-bold text-slate-900">
                12 ta til kursi · Video yuklash yoki rasmiy havola biriktirish
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={langCourseId}
                  onChange={(e) => setLangCourseId(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {languageCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name[lang]} ({c.nativeName})
                    </option>
                  ))}
                </select>
                <select
                  value={langLevel}
                  onChange={(e) => setLangLevel(e.target.value as LanguageLevel)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
                <input
                  type="text"
                  value={langVideoUrl}
                  onChange={(e) => setLangVideoUrl(e.target.value)}
                  placeholder="Rasmiy video URL"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadMedia(f, 'langVideo');
                  }}
                  className="text-xs w-full sm:w-auto"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await apiRequest(`/api/admin/language-courses/${langCourseId}/video`, {
                      method: 'PATCH',
                      body: JSON.stringify({ level: langLevel, videoUrl: langVideoUrl }),
                    });
                    setStatusMsg('Til kursi videosi yangilandi.');
                    loadDashboard();
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl bg-blue-600 text-white text-xs font-semibold"
                >
                  Saqlash
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-3 border-t border-slate-100">
                {languageCourses.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl border border-slate-200 text-xs">
                    <div className="font-semibold text-slate-900">{c.name[lang]}</div>
                    <div className="text-slate-500 mt-0.5">{c.nativeName} · 3 daraja</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PAYMENTS & SUBSCRIPTIONS */}
          {activeTab === 'payments' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">To‘lovlar va obunalar</h2>
                  <p className="text-xs text-slate-500">
                    Karta: <span className="font-mono-num font-semibold text-slate-700">5614 6820 1497 0760</span> ·
                    Tarif: 30 kunlik obuna · 10 000 so‘m
                  </p>
                </div>
              </div>

              {/* Mobile payment cards */}
              <div className="sm:hidden space-y-2.5">
                {payments.map((p) => {
                  const u = students.find((s) => s.id === p.userId);
                  return (
                    <div key={p.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-sm text-slate-900">
                          {u ? `${u.firstName} ${u.lastName}` : p.userId}
                        </div>
                        <div className="font-mono-num text-sm font-bold text-emerald-700 shrink-0">
                          {p.amountUzs.toLocaleString('uz-UZ')} so‘m
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-mono-num truncate">{p.merchantTransId}</span>
                        <span className="shrink-0 uppercase">{p.provider} · {p.status}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {p.targetCard ? `${p.targetCard} · ` : ''}
                        {new Date(p.createdAt).toLocaleString('uz-UZ')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop payment table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2.5 pr-4">Tranzaksiya</th>
                      <th className="py-2.5 pr-4">Foydalanuvchi</th>
                      <th className="py-2.5 pr-4">Summa</th>
                      <th className="py-2.5 pr-4">Ilova / Karta</th>
                      <th className="py-2.5">Sana</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payments.map((p) => {
                      const u = students.find((s) => s.id === p.userId);
                      return (
                        <tr key={p.id}>
                          <td className="py-3 pr-4 font-mono-num text-xs">{p.merchantTransId}</td>
                          <td className="py-3 pr-4">
                            {u ? `${u.firstName} ${u.lastName}` : p.userId}
                          </td>
                          <td className="py-3 pr-4 font-mono-num font-semibold">
                            {p.amountUzs.toLocaleString('uz-UZ')} so‘m
                          </td>
                          <td className="py-3 pr-4 text-xs">
                            <span className="font-semibold uppercase">{p.provider}</span> · {p.status}
                            {p.targetCard ? ` (${p.targetCard})` : ''}
                          </td>
                          <td className="py-3 text-xs text-slate-500">
                            {new Date(p.createdAt).toLocaleString('uz-UZ')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SMS NOTIFICATIONS */}
          {activeTab === 'sms' && (
            <div className="space-y-5 sm:space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">SMS eslatmalar va ota-ona xabarnomasi</h2>
                    <p className="text-xs text-slate-500">{integrations.sms.providerLabel}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await apiRequest<{ checkedHomeworks: number; dispatchedCount: number; mode: string }>(
                          '/api/sms/run-scheduler',
                          { method: 'POST', body: JSON.stringify({ includeParents: false }) }
                        );
                        setStatusMsg(
                          `Scheduler: ${res.checkedHomeworks} vazifa tekshirildi, ${res.dispatchedCount} ta SMS (${res.mode.toUpperCase()}).`
                        );
                        loadDashboard();
                      }}
                      className="px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl bg-slate-900 text-white text-xs font-semibold"
                    >
                      Muddati o‘tgan vazifa SMS tekshiruvi
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await apiRequest<{ checkedHomeworks: number; dispatchedCount: number; mode: string }>(
                          '/api/sms/run-scheduler',
                          { method: 'POST', body: JSON.stringify({ includeParents: true }) }
                        );
                        setStatusMsg(
                          `Ota-onalar bilan: ${res.dispatchedCount} ta SMS (${res.mode.toUpperCase()}) yuborildi.`
                        );
                        loadDashboard();
                      }}
                      className="px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl border border-slate-200 text-xs font-semibold"
                    >
                      Ota-onalarga ham yuborish
                    </button>
                  </div>
                </div>

                {/* Manual SMS to student or parent */}
                <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <select
                    value={smsStudentId}
                    onChange={(e) => setSmsStudentId(e.target.value)}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.firstName} {s.lastName} ({s.grade}-sinf)
                      </option>
                    ))}
                  </select>
                  <select
                    value={smsRecipientType}
                    onChange={(e) => setSmsRecipientType(e.target.value as 'student' | 'parent')}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="parent">Ota-ona / Qonuniy vakil</option>
                    <option value="student">O‘quvchi</option>
                  </select>
                  <input
                    type="text"
                    value={smsCustomMsg}
                    onChange={(e) => setSmsCustomMsg(e.target.value)}
                    placeholder="Xabar matni..."
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest('/api/admin/sms/send-manual', {
                        method: 'POST',
                        body: JSON.stringify({
                          studentId: smsStudentId,
                          recipientType: smsRecipientType,
                          message: smsCustomMsg,
                        }),
                      });
                      setSmsCustomMsg('');
                      setStatusMsg('SMS xabarnoma yuborildi.');
                      loadDashboard();
                    }}
                    className="px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl bg-blue-600 text-white text-xs font-semibold"
                  >
                    SMS yuborish
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 divide-y divide-slate-100">
                {smsLogs.map((log) => (
                  <div key={log.id} className="py-3 space-y-1">
                    <div className="flex flex-wrap justify-between text-xs">
                      <span className="font-mono-num font-semibold">
                        {log.phone} · {log.recipientType}
                      </span>
                      <span className="text-slate-500">
                        {log.mode.toUpperCase()} · {log.status} · {new Date(log.sentAt).toLocaleString('uz-UZ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{log.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REPORTS & STATISTICS */}
          {activeTab === 'reports' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900">
                  Maktab bo‘yicha topshirilgan vazifalar holati
                </h2>
                <HomeworkBreakdownBar
                  lang={lang}
                  approved={submissions.filter((s) => s.status === 'approved').length}
                  pending={submissions.filter((s) => s.status === 'pending').length}
                  revisionNeeded={submissions.filter((s) => s.status === 'revision_needed').length}
                  notSubmitted={Math.max(0, homeworks.length * students.length - submissions.length)}
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900">
                  Fanlar kesimida test natijalari o‘rtachasi
                </h2>
                <SubjectBarChart
                  lang={lang}
                  data={subjects.slice(0, 6).map((subj) => {
                    const subjTests = tests.filter((x) => x.subjectId === subj.id);
                    const atts = testAttempts.filter((a) => subjTests.some((x) => x.id === a.testId));
                    const avg =
                      atts.length > 0
                        ? Math.round(atts.reduce((acc, a) => acc + a.scorePercent, 0) / atts.length)
                        : 0;
                    return { label: subj.name[lang], value: avg, color: subj.accentColor };
                  })}
                />
              </div>
            </div>
          )}
        </main>

        {/* Mobile Bottom Thumb-Zone Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1.5 py-1 pb-safe">
          <div className="grid grid-cols-5 gap-1">
            {[
              { id: 'overview' as AdminTab, label: 'Panel', icon: <ShieldCheck className="w-4 h-4" /> },
              { id: 'teachers' as AdminTab, label: 'Ustozlar', icon: <Users className="w-4 h-4" /> },
              { id: 'students' as AdminTab, label: 'Sinflar', icon: <GraduationCap className="w-4 h-4" /> },
              { id: 'curriculum' as AdminTab, label: 'Fanlar', icon: <BookOpen className="w-4 h-4" /> },
            ].map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-semibold min-h-[44px] ${
                    active ? 'text-blue-700 bg-blue-50' : 'text-slate-500'
                  }`}
                >
                  {item.icon}
                  <span className="truncate max-w-full">{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-semibold min-h-[44px] ${
                ['languages', 'payments', 'sms', 'reports'].includes(activeTab)
                  ? 'text-blue-700 bg-blue-50'
                  : 'text-slate-500'
              }`}
            >
              <Menu className="w-4 h-4" />
              <span className="truncate max-w-full">{t(lang, 'menuLabel')}</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
