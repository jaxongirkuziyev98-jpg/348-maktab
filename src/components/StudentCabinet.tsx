import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Home,
  BookOpen,
  PlayCircle,
  BookMarked,
  ClipboardList,
  CheckSquare,
  Award,
  Globe,
  Bell,
  CreditCard,
  LogOut,
  Star,
  Trophy,
  Upload,
  HelpCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Menu,
  X,
  Download,
  FileText,
  ExternalLink,
  Search,
} from 'lucide-react';
import type {
  Ebook,
  Homework,
  HomeworkSubmission,
  IntegrationStatus,
  Lang,
  LanguageCourse,
  LanguageProgress,
  NotificationItem,
  PaymentRecord,
  Subject,
  TestAttempt,
  TestItem,
  User,
  VideoLesson,
} from '../types/lms.ts';
import {
  buildGoogleBookSearchUrl,
  formatGrade,
  formatLocale,
  t,
} from '../i18n/translations.ts';
import { ApiError, apiRequest, uploadFileToServer } from '../lib/api.ts';
import { VideoLessonViewer, getYouTubeThumbnail } from './VideoLessonViewer.tsx';
import { TestRunnerModal } from './TestRunnerModal.tsx';
import { SubscriptionModal } from './SubscriptionModal.tsx';
import { LanguageCenter } from './LanguageCenter.tsx';
import { HomeworkBreakdownBar, PerformanceLineChart, SubjectBarChart } from './Charts.tsx';
import { PdfBookReader } from './PdfBookReader.tsx';
import { ThemeToggleButton, type AppTheme } from './ThemeToggleButton.tsx';

type StudentTab =
  | 'overview'
  | 'subjects'
  | 'videos'
  | 'ebooks'
  | 'homeworks'
  | 'tests'
  | 'grades'
  | 'languages'
  | 'notifications';

interface StudentDashboardData {
  student: User;
  subjects: Subject[];
  videoLessons: VideoLesson[];
  ebooks: Ebook[];
  homeworks: Homework[];
  submissions: HomeworkSubmission[];
  tests: TestItem[];
  testAttempts: TestAttempt[];
  notifications: NotificationItem[];
  languageCourses: LanguageCourse[];
  languageProgress: LanguageProgress[];
  payments: PaymentRecord[];
  integrations: IntegrationStatus;
}

export function StudentCabinet({
  user,
  lang,
  onLangChange,
  theme,
  onToggleTheme,
  onUserUpdated,
  onLogout,
}: {
  user: User;
  lang: Lang;
  onLangChange: (l: Lang) => void;
  theme: AppTheme;
  onToggleTheme: () => void;
  onUserUpdated: (u: User) => void;
  onLogout: () => void;
}) {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<StudentTab>(() => {
    try {
      const saved = window.localStorage.getItem(`maktab348_tab_${user.id}`) as StudentTab | null;
      const valid: StudentTab[] = ['overview', 'subjects', 'videos', 'ebooks', 'homeworks', 'tests', 'grades', 'languages', 'notifications'];
      if (saved && valid.includes(saved)) return saved;
    } catch {
      // ignore
    }
    return 'overview';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Detail states
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    try {
      return window.localStorage.getItem(`maktab348_subj_${user.id}`) || '';
    } catch {
      return '';
    }
  });
  const [selectedVideo, setSelectedVideo] = useState<VideoLesson | null>(null);
  const [inlineSubjectVideo, setInlineSubjectVideo] = useState<VideoLesson | null>(null);
  const [videoSubjectFilter, setVideoSubjectFilter] = useState<string>('all');
  const videoPlayerRef = useRef<HTMLDivElement | null>(null);
  const [selectedEbook, setSelectedEbook] = useState<Ebook | null>(null);
  const [ebookViewMode, setEbookViewMode] = useState<'pdf' | 'text'>('pdf');
  const [activeTest, setActiveTest] = useState<TestItem | null>(null);
  const [helpHomework, setHelpHomework] = useState<Homework | null>(null);
  const [submitHomework, setSubmitHomework] = useState<Homework | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  function openVideoInApp(vid: VideoLesson) {
    setSelectedVideo(vid);
    setActiveTab('videos');
    window.setTimeout(() => {
      videoPlayerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(`maktab348_tab_${user.id}`, activeTab);
    } catch {
      // ignore
    }
  }, [activeTab, user.id]);

  useEffect(() => {
    if (!selectedSubjectId) return;
    try {
      window.localStorage.setItem(`maktab348_subj_${user.id}`, selectedSubjectId);
    } catch {
      // ignore
    }
  }, [selectedSubjectId, user.id]);

  // Submission form
  const [hwText, setHwText] = useState('');
  const [hwImageUrl, setHwImageUrl] = useState('');
  const [hwFileUrl, setHwFileUrl] = useState('');
  const [hwFileName, setHwFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submittingHw, setSubmittingHw] = useState(false);

  const isJunior = (user.grade || 1) <= 4;

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await apiRequest<StudentDashboardData>('/api/student/dashboard');
      setData(res);
      onUserUpdated(res.student);
      if (!selectedSubjectId && res.subjects.length > 0) {
        setSelectedSubjectId(res.subjects[0].id);
      }
      if (res.student.subscriptionStatus === 'expired') {
        setShowSubscriptionModal(true);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        onLogout();
        return;
      }
      setError(err instanceof Error ? err.message : t(lang, 'loadingError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFileUpload(file: File, kind: 'image' | 'file') {
    setUploading(true);
    try {
      const uploaded = await uploadFileToServer(file);
      if (kind === 'image') {
        setHwImageUrl(uploaded.url);
      } else {
        setHwFileUrl(uploaded.url);
        setHwFileName(uploaded.safeName);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t(lang, 'uploadError'));
    } finally {
      setUploading(false);
    }
  }

  async function handleHomeworkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submitHomework) return;
    setSubmittingHw(true);
    setError('');
    try {
      await apiRequest('/api/student/submissions', {
        method: 'POST',
        body: JSON.stringify({
          homeworkId: submitHomework.id,
          textAnswer: hwText,
          imageUrl: hwImageUrl || undefined,
          fileUrl: hwFileUrl || undefined,
          fileName: hwFileName || undefined,
        }),
      });
      setSubmitHomework(null);
      setHwText('');
      setHwImageUrl('');
      setHwFileUrl('');
      setHwFileName('');
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t(lang, 'loadingError'));
    } finally {
      setSubmittingHw(false);
    }
  }

  async function markAllNotificationsRead() {
    await apiRequest('/api/notifications/read', { method: 'POST' });
    await loadDashboard();
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-sm text-slate-600">
        {t(lang, 'studentLoading')}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-sm text-red-600">{error || t(lang, 'notFoundError')}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadDashboard}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm"
          >
            {t(lang, 'retry')}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm"
          >
            {t(lang, 'logout')}
          </button>
        </div>
      </div>
    );
  }

  const {
    student,
    subjects,
    videoLessons,
    ebooks,
    homeworks,
    submissions,
    tests,
    testAttempts,
    notifications,
    languageCourses,
    languageProgress,
    integrations,
  } = data;

  const unreadCount = notifications.filter((n) => !n.read).length;
  const approvedHwCount = submissions.filter((s) => s.status === 'approved').length;
  const pendingHwCount = submissions.filter((s) => s.status === 'pending').length;
  const revisionHwCount = submissions.filter((s) => s.status === 'revision_needed').length;
  const notSubmittedCount = Math.max(0, homeworks.length - submissions.length);
  const avgTestScore =
    testAttempts.length > 0
      ? Math.round(testAttempts.reduce((acc, a) => acc + a.scorePercent, 0) / testAttempts.length)
      : 0;

  const schoolTests = tests.filter((tst) => !tst.languageCourseId);
  const activeSubject = subjects.find((s) => s.id === selectedSubjectId) || subjects[0];

  const navItems: Array<{ id: StudentTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'overview', label: t(lang, 'overview'), icon: <Home className="w-4 h-4" /> },
    { id: 'subjects', label: t(lang, 'subjects'), icon: <BookOpen className="w-4 h-4" /> },
    { id: 'videos', label: t(lang, 'videos'), icon: <PlayCircle className="w-4 h-4" /> },
    { id: 'ebooks', label: t(lang, 'ebooks'), icon: <BookMarked className="w-4 h-4" /> },
    { id: 'homeworks', label: t(lang, 'homeworks'), icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'tests', label: t(lang, 'tests'), icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'grades', label: t(lang, 'gradesAndResults'), icon: <Award className="w-4 h-4" /> },
    { id: 'languages', label: t(lang, 'languageCenter'), icon: <Globe className="w-4 h-4" /> },
    {
      id: 'notifications',
      label: t(lang, 'notifications'),
      icon: <Bell className="w-4 h-4" />,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
  ];

  const officialPortals = [
    {
      name: 'Eduportal.uz',
      url: 'https://eduportal.uz',
      desc: t(lang, 'portalEduDesc'),
    },
    {
      name: 'Kitob.uz',
      url: 'https://kitob.uz',
      desc: t(lang, 'portalKitobDesc'),
    },
    {
      name: 'ZiyoNET.uz',
      url: 'https://ziyonet.uz',
      desc: t(lang, 'portalZiyoDesc'),
    },
    {
      name: 'TestMakon.uz',
      url: 'https://testmakon.uz',
      desc: t(lang, 'portalTestMakonDesc'),
    },
    {
      name: 'Oliygoh.uz',
      url: 'https://oliygoh.uz',
      desc: t(lang, 'portalOliygohDesc'),
    },
    {
      name: 'Google PDF',
      url: buildGoogleBookSearchUrl(
        lang === 'ru' ? 'Школьный учебник' : lang === 'en' ? 'School textbook' : 'Maktab darslik',
        student.grade || 1,
        lang
      ),
      desc: t(lang, 'portalGoogleDesc'),
    },
  ];

  function renderSubmissionStatus(sub?: HomeworkSubmission) {
    if (!sub) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Clock className="w-3.5 h-3.5" />
          {t(lang, 'notSubmittedStatus')}
        </span>
      );
    }
    if (sub.status === 'approved') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {t(lang, 'approvedStatus')}
        </span>
      );
    }
    if (sub.status === 'revision_needed') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
          <AlertCircle className="w-4 h-4 text-red-600" />
          {t(lang, 'revisionStatus')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
        <Clock className="w-4 h-4 text-amber-600" />
        {t(lang, 'pendingStatus')}
      </span>
    );
  }

  return (
    <div
      className={`min-h-screen flex ${
        isJunior ? 'bg-sky-50/70 text-slate-900' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col w-64 shrink-0 border-r ${
          isJunior ? 'bg-white border-sky-200' : 'bg-white border-slate-200'
        }`}
      >
        <div className="p-5 border-b border-slate-100">
          <div className="text-lg font-bold tracking-tight font-display text-slate-900">
            {t(lang, 'brand')}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {student.firstName} {student.lastName} · {formatGrade(lang, student.grade)}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? isJunior
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge && (
                  <span className="font-mono-num text-xs font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2.5">
          <button
            type="button"
            onClick={() => setShowSubscriptionModal(true)}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs font-semibold ${
              student.subscriptionStatus === 'active'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-300 bg-amber-50 text-amber-900'
            }`}
          >
            <span className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              <span>{student.subscriptionStatus === 'active' ? t(lang, 'subActive') : t(lang, 'subExpired')}</span>
            </span>
          </button>

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

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 w-72 max-w-[85vw] bg-white h-full flex flex-col p-4 border-r border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="font-bold font-display text-slate-900">{t(lang, 'brand')}</div>
                <div className="text-xs text-slate-500">
                  {student.firstName} {student.lastName} · {formatGrade(lang, student.grade)}
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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-medium ${
                    activeTab === item.id
                      ? isJunior
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="font-mono-num text-xs font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowSubscriptionModal(true);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 min-h-[44px] rounded-xl border text-xs font-semibold ${
                  student.subscriptionStatus === 'active'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-300 bg-amber-50 text-amber-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  <span>{student.subscriptionStatus === 'active' ? t(lang, 'subActive') : t(lang, 'subExpired')}</span>
                </span>
              </button>
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700 shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label={t(lang, 'menuLabel')}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                {student.firstName} {student.lastName} · {formatGrade(lang, student.grade)}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 truncate">
                {isJunior ? t(lang, 'juniorCabinetSubtitle') : t(lang, 'seniorCabinetSubtitle')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <ThemeToggleButton theme={theme} lang={lang} onToggle={onToggleTheme} />
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
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
            <button
              type="button"
              onClick={() => setShowSubscriptionModal(true)}
              className="sm:hidden inline-flex items-center justify-center p-2 rounded-lg bg-blue-600 text-white min-h-[34px] min-w-[34px]"
              aria-label={t(lang, 'subscriptionShort')}
            >
              <CreditCard className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowSubscriptionModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
            >
              <CreditCard className="w-3.5 h-3.5" />
              {t(lang, 'subscriptionShort')}
            </button>
          </div>
        </header>

        <main className="flex-1 p-3.5 sm:p-6 pb-24 lg:pb-6 max-w-6xl w-full mx-auto space-y-5 sm:space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {isJunior ? (
                /* GRADES 1-4: PLAYFUL GAMIFIED HERO + STARS + MEDALS */
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
                >
                  <div className="lg:col-span-8 bg-white border border-sky-200 rounded-2xl p-4 sm:p-6 flex flex-col justify-between gap-4 sm:gap-5">
                    <div>
                      <div className="text-xs font-semibold text-sky-700">
                        {t(lang, 'juniorGreeting')} · {formatGrade(lang, student.grade)}
                      </div>
                      <h1 className="text-xl sm:text-3xl font-bold text-slate-900 mt-1">
                        {student.firstName} {student.lastName}, {t(lang, 'juniorHeroHeadingSuffix')}
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-600 mt-1.5">
                        {t(lang, 'juniorHeroSubtext')}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                      <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-400 shrink-0" />
                          <span className="truncate">{t(lang, 'starsLabel')}</span>
                        </div>
                        <div className="text-xl sm:text-2xl font-bold font-mono-num text-amber-900 mt-1">
                          {student.stars}
                        </div>
                      </div>
                      <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                          <Trophy className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="truncate">{t(lang, 'medalsLabel')}</span>
                        </div>
                        <div className="text-xl sm:text-2xl font-bold font-mono-num text-emerald-900 mt-1">
                          {student.medals.length}
                        </div>
                      </div>
                      <div className="col-span-2 sm:col-span-1 p-3.5 sm:p-4 rounded-xl bg-sky-50 border border-sky-200">
                        <div className="text-xs font-semibold text-sky-800">{t(lang, 'avgTestLabel')}</div>
                        <div className="text-xl sm:text-2xl font-bold font-mono-num text-sky-900 mt-1">
                          {avgTestScore}%
                        </div>
                      </div>
                    </div>

                    {student.medals.length > 0 && (
                      <div className="pt-3 border-t border-slate-100">
                        <div className="text-xs font-semibold text-slate-600 mb-2">
                          {t(lang, 'earnedMedalsLabel')}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {student.medals.map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900"
                            >
                              <Trophy className="w-3.5 h-3.5 text-amber-600" />
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-4 rounded-2xl overflow-hidden border border-sky-200 bg-sky-100 h-44 sm:min-h-[220px]">
                    <img
                      src="/src/assets/images/junior_scholar_emblem_1794918539130.jpg"
                      alt={t(lang, 'juniorImgAlt')}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </motion.div>
              ) : (
                /* GRADES 5-11: MINIMALIST PREMIUM DASHBOARD */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
                  <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 flex flex-col justify-between gap-4 sm:gap-5">
                    <div>
                      <div className="text-xs font-medium text-slate-500">
                        {t(lang, 'seniorCabinetLabel')} · {formatGrade(lang, student.grade)} · {t(lang, 'subscriptionLabel')}:{' '}
                        <span className="font-semibold text-slate-800">
                          {student.subscriptionStatus === 'active' ? t(lang, 'subActiveShort') : t(lang, 'subExpired')}
                        </span>
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                        {student.firstName} {student.lastName}
                      </h1>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                      <div>
                        <div className="text-xs text-slate-500">{t(lang, 'subjects')}</div>
                        <div className="text-2xl font-bold font-mono-num text-slate-900 mt-1">
                          {subjects.length}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">{t(lang, 'approvedShort')}</div>
                        <div className="text-2xl font-bold font-mono-num text-emerald-700 mt-1">
                          {approvedHwCount}/{homeworks.length}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">{t(lang, 'testAverageLabel')}</div>
                        <div className="text-2xl font-bold font-mono-num text-blue-700 mt-1">
                          {avgTestScore}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">{t(lang, 'activeDaysLabel')}</div>
                        <div className="text-2xl font-bold font-mono-num text-slate-900 mt-1">
                          {student.streakDays}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-4 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 h-40 sm:min-h-[200px]">
                    <img
                      src="/src/assets/images/senior_study_banner_1794918539040.jpg"
                      alt={t(lang, 'seniorImgAlt')}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Charts & Quick Actions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                  <h2 className="text-base font-semibold text-slate-900">
                    {t(lang, 'testDynamicsTitle')}
                  </h2>
                  <PerformanceLineChart
                    lang={lang}
                    points={testAttempts
                      .slice(0, 8)
                      .reverse()
                      .map((a, idx) => ({
                        label: `Test ${idx + 1}`,
                        value: a.scorePercent,
                      }))}
                    accentColor={isJunior ? '#0284C7' : '#2563EB'}
                  />
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                  <h2 className="text-base font-semibold text-slate-900">
                    {t(lang, 'homeworkStatusTitle')}
                  </h2>
                  <HomeworkBreakdownBar
                    lang={lang}
                    approved={approvedHwCount}
                    pending={pendingHwCount}
                    revisionNeeded={revisionHwCount}
                    notSubmitted={notSubmittedCount}
                  />
                  <div className="pt-2 grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('homeworks')}
                      className="px-3.5 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                    >
                      {t(lang, 'goToHomeworks')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('tests')}
                      className="px-3.5 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50"
                    >
                      {t(lang, 'twentyQuestionTests')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Grade-Matched YouTube Video Lessons Preview */}
              {videoLessons.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        {formatGrade(lang, student.grade)} — {t(lang, 'videos')}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {lang === 'ru'
                          ? 'Смотрите видеоуроки для вашего класса и тем прямо внутри приложения'
                          : lang === 'en'
                          ? 'Watch grade- and topic-matched video lessons right inside the app'
                          : 'Sinfingiz va mavzularingizga mos darslarni shu ilovaning o‘zida tomosha qiling'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('videos')}
                      className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
                    >
                      {t(lang, 'viewVideosArrow')}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {videoLessons.slice(0, 3).map((vid) => {
                      const subj = subjects.find((s) => s.id === vid.subjectId);
                      const thumb = getYouTubeThumbnail(vid.videoUrl);
                      return (
                        <button
                          key={vid.id}
                          type="button"
                          onClick={() => openVideoInApp(vid)}
                          className="text-left rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50 hover:border-blue-500 hover:bg-blue-50/30 transition-colors flex flex-col"
                        >
                          <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={vid.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <PlayCircle className="w-10 h-10" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center">
                              <span className="w-11 h-11 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow">
                                <PlayCircle className="w-6 h-6 text-blue-600" />
                              </span>
                            </div>
                            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-950/80 text-white text-[10px] font-mono-num">
                              {vid.durationMinutes} {t(lang, 'minutesShort')}
                            </span>
                          </div>
                          <div className="p-3.5 space-y-1 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="text-[11px] font-semibold text-blue-700 truncate">
                                {subj?.name[lang] || t(lang, 'subjectFallback')} · {vid.topic}
                              </div>
                              <div className="text-sm font-semibold text-slate-900 mt-0.5 line-clamp-2">
                                {vid.title}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUBJECTS TAB */}
          {activeTab === 'subjects' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
              {/* Mobile horizontal scrollable subject picker */}
              <div className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
                {subjects.map((subj) => {
                  const active = activeSubject?.id === subj.id;
                  return (
                    <button
                      key={subj.id}
                      type="button"
                      onClick={() => setSelectedSubjectId(subj.id)}
                      className={`shrink-0 px-3.5 py-2 min-h-[42px] rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors ${
                        active
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {subj.name[lang]}
                    </button>
                  );
                })}
              </div>

              {/* Desktop subject list */}
              <div className="hidden lg:block lg:col-span-4 space-y-2">
                {subjects.map((subj) => {
                  const active = activeSubject?.id === subj.id;
                  return (
                    <button
                      key={subj.id}
                      type="button"
                      onClick={() => setSelectedSubjectId(subj.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${
                        active
                          ? 'border-blue-600 bg-blue-50/70 text-slate-900'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{subj.name[lang]}</span>
                        <span className="text-xs font-mono-num text-slate-500">{subj.code}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {subj.description[lang]}
                      </p>
                    </button>
                  );
                })}
              </div>

              {activeSubject && (() => {
                const subjectVideos = videoLessons.filter((v) => v.subjectId === activeSubject.id);
                const activeInlineVid =
                  inlineSubjectVideo && inlineSubjectVideo.subjectId === activeSubject.id
                    ? inlineSubjectVideo
                    : null;
                return (
                  <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5 sm:space-y-6">
                    <div>
                      <div className="text-xs text-slate-500">
                        {formatGrade(lang, student.grade)} · {activeSubject.code}
                      </div>
                      <h2 className="text-2xl font-bold text-slate-900 mt-1">
                        {activeSubject.name[lang]}
                      </h2>
                      <p className="text-sm text-slate-600 mt-1">{activeSubject.description[lang]}</p>
                    </div>

                    {/* Inline Video Player directly inside Subject tab */}
                    {activeInlineVid && (
                      <div className="space-y-2.5 pt-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-blue-700">
                              {formatGrade(lang, activeInlineVid.grade)} · {activeInlineVid.topic}
                            </div>
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                              {activeInlineVid.title}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setInlineSubjectVideo(null)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 shrink-0"
                          >
                            {t(lang, 'close')}
                          </button>
                        </div>
                        <VideoLessonViewer
                          lang={lang}
                          title={activeInlineVid.title}
                          topic={activeInlineVid.topic}
                          description={activeInlineVid.description}
                          videoUrl={activeInlineVid.videoUrl}
                          slides={activeInlineVid.lessonSlides}
                          durationMinutes={activeInlineVid.durationMinutes}
                        />
                      </div>
                    )}

                    {/* Topics */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-slate-900">{t(lang, 'topicsTitle')}</h3>
                      {activeSubject.topics.length === 0 ? (
                        <p className="text-xs text-slate-500">{t(lang, 'topicsSoon')}</p>
                      ) : (
                        activeSubject.topics.map((top) => (
                          <div key={top.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-semibold text-sm text-slate-900">{top.title[lang]}</div>
                              {subjectVideos[0] && (
                                <button
                                  type="button"
                                  onClick={() => setInlineSubjectVideo(subjectVideos[0])}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold whitespace-nowrap"
                                >
                                  <PlayCircle className="w-3.5 h-3.5" />
                                  {t(lang, 'openLesson')}
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-slate-600">{top.summary[lang]}</p>
                            <div className="text-xs text-slate-500">
                              {t(lang, 'keyPointsLabel')} {top.keyPoints.join(' · ')}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Subject Video Lessons directly playable inside this Subject */}
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {activeSubject.name[lang]} · {formatGrade(lang, student.grade)} — {t(lang, 'videos')} ({subjectVideos.length})
                        </h3>
                        {subjectVideos.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setVideoSubjectFilter(activeSubject.id);
                              setActiveTab('videos');
                            }}
                            className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
                          >
                            {t(lang, 'viewVideosArrow')}
                          </button>
                        )}
                      </div>

                      {subjectVideos.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {subjectVideos.map((vid) => {
                            const thumb = getYouTubeThumbnail(vid.videoUrl);
                            const isPlaying = activeInlineVid?.id === vid.id;
                            return (
                              <button
                                key={vid.id}
                                type="button"
                                onClick={() => setInlineSubjectVideo(vid)}
                                className={`text-left rounded-xl border overflow-hidden transition-colors flex flex-col ${
                                  isPlaying
                                    ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600'
                                    : 'border-slate-200 bg-white hover:border-blue-400'
                                }`}
                              >
                                <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                                  {thumb && (
                                    <img
                                      src={thumb}
                                      alt={vid.title}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  )}
                                  <div className="absolute inset-0 bg-slate-950/30 flex items-center justify-center">
                                    <span className="w-10 h-10 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow">
                                      <PlayCircle className="w-5 h-5 text-blue-600" />
                                    </span>
                                  </div>
                                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-950/80 text-white text-[10px] font-mono-num">
                                    {vid.durationMinutes} {t(lang, 'minutesShort')}
                                  </span>
                                </div>
                                <div className="p-3 space-y-1">
                                  <div className="text-[11px] font-medium text-blue-700 truncate">
                                    {vid.topic}
                                  </div>
                                  <div className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-2">
                                    {vid.title}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          {formatGrade(lang, student.grade)} — {t(lang, 'noVideosForGrade')}
                        </p>
                      )}
                    </div>

                    {/* Homeworks & Tests counter */}
                    <div className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-slate-700">{t(lang, 'homeworksAndTests')}</div>
                        <div className="text-xl font-bold font-mono-num text-slate-900 mt-0.5">
                          {homeworks.filter((h) => h.subjectId === activeSubject.id).length} /{' '}
                          {schoolTests.filter((tst) => tst.subjectId === activeSubject.id).length}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('homeworks')}
                        className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                      >
                        {t(lang, 'goToHomeworksArrow')}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* VIDEO LESSONS TAB */}
          {activeTab === 'videos' && (() => {
            const videoSubjects = subjects.filter((s) => videoLessons.some((v) => v.subjectId === s.id));
            const filteredVideos =
              videoSubjectFilter === 'all'
                ? videoLessons
                : videoLessons.filter((v) => v.subjectId === videoSubjectFilter);
            return (
              <div className="space-y-6">
                {/* Subject Filter Pills */}
                {videoSubjects.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button
                      type="button"
                      onClick={() => setVideoSubjectFilter('all')}
                      className={`shrink-0 px-3.5 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors ${
                        videoSubjectFilter === 'all'
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {lang === 'ru' ? 'Все предметы' : lang === 'en' ? 'All Subjects' : 'Barcha fanlar'} ({videoLessons.length})
                    </button>
                    {videoSubjects.map((s) => {
                      const count = videoLessons.filter((v) => v.subjectId === s.id).length;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setVideoSubjectFilter(s.id)}
                          className={`shrink-0 px-3.5 py-2 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors ${
                            videoSubjectFilter === s.id
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {s.name[lang]} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedVideo && (
                  <div ref={videoPlayerRef} className="space-y-3 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-blue-700">
                          {subjects.find((s) => s.id === selectedVideo.subjectId)?.name[lang] || t(lang, 'subjectFallback')} ·{' '}
                          {formatGrade(lang, selectedVideo.grade)} · {selectedVideo.topic}
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                          {selectedVideo.title}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedVideo(null)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 shrink-0"
                      >
                        {t(lang, 'close')}
                      </button>
                    </div>
                    <VideoLessonViewer
                      lang={lang}
                      title={selectedVideo.title}
                      topic={selectedVideo.topic}
                      description={selectedVideo.description}
                      videoUrl={selectedVideo.videoUrl}
                      slides={selectedVideo.lessonSlides}
                      durationMinutes={selectedVideo.durationMinutes}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredVideos.map((vid) => {
                    const subj = subjects.find((s) => s.id === vid.subjectId);
                    const thumb = getYouTubeThumbnail(vid.videoUrl);
                    const isActive = selectedVideo?.id === vid.id;
                    return (
                      <div
                        key={vid.id}
                        className={`bg-white border rounded-2xl overflow-hidden flex flex-col justify-between transition-colors ${
                          isActive ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'
                        }`}
                      >
                        <div>
                          <button
                            type="button"
                            onClick={() => openVideoInApp(vid)}
                            className="relative aspect-video w-full bg-slate-900 overflow-hidden block text-left group"
                          >
                            {thumb ? (
                              <img
                                src={thumb}
                                alt={vid.title}
                                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <PlayCircle className="w-12 h-12" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-slate-950/30 group-hover:bg-slate-950/15 transition-colors flex items-center justify-center">
                              <span className="w-12 h-12 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-md">
                                <PlayCircle className="w-6 h-6 text-blue-600" />
                              </span>
                            </div>
                            <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md bg-slate-950/80 text-white text-[11px] font-semibold">
                              {formatGrade(lang, vid.grade)}
                            </span>
                            <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-slate-950/80 text-white text-[11px] font-mono-num">
                              {vid.durationMinutes} {t(lang, 'minutesShort')}
                            </span>
                          </button>

                          <div className="p-4">
                            <div className="text-xs font-semibold text-blue-700">
                              {subj?.name[lang] || t(lang, 'subjectFallback')} · {vid.topic}
                            </div>
                            <h3 className="text-base font-semibold text-slate-900 mt-1 line-clamp-2">
                              {vid.title}
                            </h3>
                            <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{vid.description}</p>
                          </div>
                        </div>

                        <div className="px-4 pb-4">
                          <button
                            type="button"
                            onClick={() => openVideoInApp(vid)}
                            className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-900 hover:bg-slate-800 text-white'
                            }`}
                          >
                            <PlayCircle className="w-4 h-4" />
                            {isActive
                              ? lang === 'ru'
                                ? 'Сейчас воспроизводится'
                                : lang === 'en'
                                ? 'Now Playing'
                                : 'Hozir ijro etilmoqda'
                              : t(lang, 'openLesson')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredVideos.length === 0 && (
                    <div className="col-span-full p-8 text-center bg-white border border-slate-200 rounded-2xl text-sm text-slate-500">
                      {formatGrade(lang, student.grade)} — {t(lang, 'noVideosForGrade')}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* E-BOOKS TAB (Canvas PDF Reader + Google PDF + Official Uzbekistan Portals) */}
          {activeTab === 'ebooks' && (
            <div className="space-y-6">
              {selectedEbook && (() => {
                const resolvedPdfUrl = selectedEbook.pdfUrl || `/api/ebooks/${selectedEbook.id}/pdf`;
                const downloadUrl = `/api/ebooks/${selectedEbook.id}/pdf?download=1`;
                const googleUrl = buildGoogleBookSearchUrl(selectedEbook.title, selectedEbook.grade, lang);
                return (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{selectedEbook.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {selectedEbook.author} · {formatGrade(lang, selectedEbook.grade)} · {selectedEbook.pagesCount} {t(lang, 'pagesWord')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                          <button
                            type="button"
                            onClick={() => setEbookViewMode('pdf')}
                            className={`px-3 py-1 rounded-md text-xs font-semibold ${
                              ebookViewMode === 'pdf'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600'
                            }`}
                          >
                            {t(lang, 'pdfView')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEbookViewMode('text')}
                            className={`px-3 py-1 rounded-md text-xs font-semibold ${
                              ebookViewMode === 'text'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600'
                            }`}
                          >
                            {t(lang, 'textView')}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedEbook(null)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          {t(lang, 'close')}
                        </button>
                      </div>
                    </div>

                    {ebookViewMode === 'pdf' ? (
                      <PdfBookReader
                        pdfUrl={resolvedPdfUrl}
                        downloadUrl={downloadUrl}
                        googleSearchUrl={googleUrl}
                        title={selectedEbook.title}
                        lang={lang}
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        {selectedEbook.previewText}
                      </pre>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ebooks.map((book) => {
                  const subj = subjects.find((s) => s.id === book.subjectId);
                  const downloadUrl = `/api/ebooks/${book.id}/pdf?download=1`;
                  const googleBookUrl = buildGoogleBookSearchUrl(book.title, book.grade, lang);
                  return (
                    <div
                      key={book.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="text-xs text-slate-500">
                          {subj?.name[lang] || t(lang, 'subjectFallback')} · {formatGrade(lang, book.grade)} · {book.pagesCount} {t(lang, 'pagesWord')} · PDF
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 mt-1">{book.title}</h3>
                        <p className="text-xs text-slate-600 mt-1">{book.description}</p>
                      </div>
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEbook(book);
                            setEbookViewMode('pdf');
                          }}
                          className="col-span-2 sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap"
                        >
                          <BookMarked className="w-4 h-4" />
                          {t(lang, 'readPdf')}
                        </button>
                        <a
                          href={googleBookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold whitespace-nowrap"
                        >
                          <Search className="w-3.5 h-3.5 text-blue-600" />
                          Google PDF
                        </a>
                        <a
                          href={downloadUrl}
                          download={`${book.id}.pdf`}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold whitespace-nowrap"
                        >
                          <Download className="w-4 h-4" />
                          {t(lang, 'downloadShort')}
                        </a>
                      </div>
                    </div>
                  );
                })}
                {ebooks.length === 0 && (
                  <div className="col-span-full p-8 text-center bg-white border border-slate-200 rounded-2xl text-sm text-slate-500">
                    {formatGrade(lang, student.grade)} — {t(lang, 'noEbooksForGrade')}
                  </div>
                )}
              </div>

              {/* Official Electronic Textbook Library & Google Links */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {t(lang, 'officialPortalsTitle')}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {t(lang, 'officialPortalsDesc')}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {officialPortals.map((portal) => (
                    <a
                      key={portal.name}
                      href={portal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 transition-colors flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{portal.name}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{portal.desc}</div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* HOMEWORKS TAB */}
          {activeTab === 'homeworks' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-slate-900">
                  {t(lang, 'homeworks')} ({formatGrade(lang, student.grade)})
                </h2>
                <span className="text-xs text-slate-500">
                  {t(lang, 'homeworkRuleNote')}
                </span>
              </div>

              {homeworks.map((hw) => {
                const subj = subjects.find((s) => s.id === hw.subjectId);
                const sub = submissions.find((s) => s.homeworkId === hw.id);
                const isOverdue = !sub && new Date(hw.dueDate).getTime() < Date.now();

                return (
                  <div key={hw.id} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500">
                          {subj?.name[lang] || t(lang, 'subjectFallback')} · {hw.topic} · {t(lang, 'dueDateLabel')}{' '}
                          <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
                            {new Date(hw.dueDate).toLocaleDateString(formatLocale(lang))}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 mt-1">{hw.title}</h3>
                        <p className="text-sm text-slate-600 mt-1">{hw.description}</p>
                      </div>
                      <div className="shrink-0">{renderSubmissionStatus(sub)}</div>
                    </div>

                    {sub && (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                        <div>
                          <span className="font-semibold text-slate-700">{t(lang, 'yourAnswerLabel')}</span>{' '}
                          {sub.textAnswer || t(lang, 'fileAttached')}
                        </div>
                        {sub.fileUrl && (
                          <div>
                            <a
                              href={sub.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 underline inline-flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {sub.fileName || t(lang, 'uploadedFileLabel')}
                            </a>
                          </div>
                        )}
                        {sub.imageUrl && (
                          <div>
                            <a
                              href={sub.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-700 underline"
                            >
                              {t(lang, 'viewUploadedImage')}
                            </a>
                          </div>
                        )}
                        {sub.gradeScore !== null && (
                          <div className="font-semibold text-slate-900">
                            {t(lang, 'gradeScoreLabel')} <span className="font-mono-num">{sub.gradeScore}</span>
                          </div>
                        )}
                        {sub.teacherComment && (
                          <div className="text-slate-700">
                            <span className="font-semibold">{t(lang, 'teacherCommentLabel')}</span> {sub.teacherComment}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitHomework(hw);
                          setHwText(sub?.textAnswer || '');
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
                      >
                        <Upload className="w-4 h-4" />
                        {sub ? t(lang, 'resubmitHomework') : t(lang, 'submitHomework')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHelpHomework(hw)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold whitespace-nowrap"
                      >
                        <HelpCircle className="w-4 h-4" />
                        {t(lang, 'homeworkHelp')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TESTS TAB */}
          {activeTab === 'tests' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">
                {t(lang, 'twentyQuestionTests')} ({formatGrade(lang, student.grade)})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {schoolTests.map((tst) => {
                  const subj = subjects.find((s) => s.id === tst.subjectId);
                  const latestAttempt = testAttempts.find((a) => a.testId === tst.id);
                  return (
                    <div
                      key={tst.id}
                      className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="text-xs text-slate-500">
                          {subj?.name[lang] || t(lang, 'subjectFallback')} · {t(lang, 'questionsCountLabel')} · {tst.durationMinutes} {t(lang, 'minutesShort')}
                        </div>
                        <h3 className="text-base font-semibold text-slate-900 mt-1">{tst.title}</h3>
                        {latestAttempt && (
                          <div className="mt-2 text-xs font-mono-num font-semibold text-emerald-700">
                            {t(lang, 'lastResultLabel')} {latestAttempt.correctCount}/20 ({latestAttempt.scorePercent}%)
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTest(tst)}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                      >
                        {t(lang, 'startTest')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* GRADES & RESULTS TAB */}
          {activeTab === 'grades' && (
            <div className="space-y-5 sm:space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <h2 className="text-lg font-bold text-slate-900">{t(lang, 'subjectTestResultsTitle')}</h2>
                <SubjectBarChart
                  lang={lang}
                  data={testAttempts.map((att) => {
                    const tst = tests.find((x) => x.id === att.testId);
                    return {
                      label: tst?.title || 'Test',
                      value: att.scorePercent,
                    };
                  })}
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6">
                <h3 className="text-base font-semibold text-slate-900 mb-4">{t(lang, 'allTestAttemptsTitle')}</h3>
                <div className="sm:hidden space-y-2.5">
                  {testAttempts.map((att) => {
                    const tst = tests.find((x) => x.id === att.testId);
                    return (
                      <div key={att.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {tst?.title || att.testId}
                          </span>
                          <span className="font-mono-num text-sm font-bold text-blue-700 shrink-0">
                            {att.scorePercent}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-mono-num">
                            {att.correctCount} / {att.wrongCount}
                          </span>
                          <span>{new Date(att.completedAt).toLocaleString(formatLocale(lang))}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs text-slate-500">
                        <th className="py-2.5 pr-4">{t(lang, 'colTestName')}</th>
                        <th className="py-2.5 pr-4">{t(lang, 'colCorrectWrong')}</th>
                        <th className="py-2.5 pr-4">{t(lang, 'colPercent')}</th>
                        <th className="py-2.5">{t(lang, 'colDate')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {testAttempts.map((att) => {
                        const tst = tests.find((x) => x.id === att.testId);
                        return (
                          <tr key={att.id}>
                            <td className="py-3 pr-4 font-medium text-slate-900">{tst?.title || att.testId}</td>
                            <td className="py-3 pr-4 font-mono-num">
                              {att.correctCount} / {att.wrongCount}
                            </td>
                            <td className="py-3 pr-4 font-mono-num font-bold text-blue-700">
                              {att.scorePercent}%
                            </td>
                            <td className="py-3 text-xs text-slate-500">
                              {new Date(att.completedAt).toLocaleString(formatLocale(lang))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 12 LANGUAGES TAB */}
          {activeTab === 'languages' && (
            <LanguageCenter
              lang={lang}
              courses={languageCourses}
              progressList={languageProgress}
              tests={tests}
              testAttempts={testAttempts}
              onProgressUpdated={(updated) => {
                setData((prev) => {
                  if (!prev) return prev;
                  const exists = prev.languageProgress.some((p) => p.id === updated.id);
                  return {
                    ...prev,
                    languageProgress: exists
                      ? prev.languageProgress.map((p) => (p.id === updated.id ? updated : p))
                      : [...prev.languageProgress, updated],
                  };
                });
              }}
              onStartTest={(tst) => setActiveTest(tst)}
            />
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900">{t(lang, 'notifications')}</h2>
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="text-xs font-semibold text-blue-700 hover:underline"
                >
                  {t(lang, 'markAllRead')}
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <div key={n.id} className={`py-3.5 ${n.read ? 'opacity-70' : ''}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{n.title}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(n.createdAt).toLocaleString(formatLocale(lang))}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{n.body}</p>
                  </div>
                ))}
                {notifications.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-500">{t(lang, 'noNotifications')}</p>
                )}
              </div>
            </div>
          )}
        </main>

        {/* Mobile Bottom Thumb-Zone Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1.5 py-1 pb-safe">
          <div className="grid grid-cols-5 gap-1">
            {[
              { id: 'overview' as StudentTab, label: t(lang, 'overview'), icon: <Home className="w-4 h-4" /> },
              { id: 'subjects' as StudentTab, label: t(lang, 'subjects'), icon: <BookOpen className="w-4 h-4" /> },
              { id: 'homeworks' as StudentTab, label: t(lang, 'homeworks'), icon: <ClipboardList className="w-4 h-4" /> },
              { id: 'tests' as StudentTab, label: t(lang, 'tests'), icon: <CheckSquare className="w-4 h-4" /> },
            ].map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-semibold min-h-[44px] ${
                    active
                      ? isJunior
                        ? 'text-sky-700 bg-sky-50'
                        : 'text-blue-700 bg-blue-50'
                      : 'text-slate-500'
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
              className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-semibold min-h-[44px] ${
                ['videos', 'ebooks', 'grades', 'languages', 'notifications'].includes(activeTab)
                  ? 'text-blue-700 bg-blue-50'
                  : 'text-slate-500'
              }`}
            >
              <Menu className="w-4 h-4" />
              <span className="truncate max-w-full">{t(lang, 'menuLabel')}</span>
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-2 font-mono-num text-[9px] font-bold px-1 rounded bg-red-600 text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </nav>
      </div>

      {/* Homework Submission Modal */}
      {submitHomework && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3 sm:p-4">
          <form
            onSubmit={handleHomeworkSubmit}
            className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {t(lang, 'submitHomeworkModalTitle')} {submitHomework.title}
              </h3>
              <button type="button" onClick={() => setSubmitHomework(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t(lang, 'writtenAnswerLabel')}
              </label>
              <textarea
                rows={4}
                value={hwText}
                onChange={(e) => setHwText(e.target.value)}
                placeholder={t(lang, 'writtenAnswerPlaceholder')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t(lang, 'uploadImageOptional')}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, 'image');
                  }}
                  className="text-xs w-full"
                />
                {hwImageUrl && <div className="text-xs text-emerald-700 mt-1">{t(lang, 'imageUploadedOk')}</div>}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t(lang, 'uploadFileOptional')}
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, 'file');
                  }}
                  className="text-xs w-full"
                />
                {hwFileName && <div className="text-xs text-emerald-700 mt-1">{hwFileName} ✓</div>}
              </div>
            </div>

            <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              {t(lang, 'homeworkPendingReminder')}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubmitHomework(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700"
              >
                {t(lang, 'cancel')}
              </button>
              <button
                type="submit"
                disabled={submittingHw || uploading}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-60"
              >
                {uploading ? t(lang, 'uploading') : submittingHw ? t(lang, 'submitting') : t(lang, 'submit')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Homework Help Modal */}
      {helpHomework && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {t(lang, 'homeworkHelp')} · {helpHomework.title}
              </h3>
              <button type="button" onClick={() => setHelpHomework(null)}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-sm text-slate-800 leading-relaxed">
              <div className="text-xs font-semibold text-blue-800 mb-1">{t(lang, 'extraExplanationLabel')}</div>
              {helpHomework.helpExplanation || helpHomework.description}
            </div>

            {helpHomework.helpVideoUrl && (
              <VideoLessonViewer
                lang={lang}
                title={`${t(lang, 'helperVideoTitle')} ${helpHomework.topic}`}
                videoUrl={helpHomework.helpVideoUrl}
              />
            )}

            {helpHomework.helpImageUrl && (
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1.5">{t(lang, 'helperImageLabel')}</div>
                <img
                  src={helpHomework.helpImageUrl}
                  alt={t(lang, 'helperImageLabel')}
                  referrerPolicy="no-referrer"
                  className="max-h-72 rounded-xl border border-slate-200 object-contain"
                />
              </div>
            )}

            {helpHomework.helpPdfUrl && (
              <a
                href={helpHomework.helpPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold"
              >
                <Download className="w-4 h-4" />
                {helpHomework.helpPdfName || t(lang, 'openPdfMaterial')}
              </a>
            )}
          </div>
        </div>
      )}

      {/* 20-Question Test Modal */}
      {activeTest && (
        <TestRunnerModal
          test={activeTest}
          lang={lang}
          onClose={() => setActiveTest(null)}
          onCompleted={() => {
            loadDashboard();
          }}
        />
      )}

      {/* 30-day Click Subscription Modal */}
      {showSubscriptionModal && (
        <SubscriptionModal
          user={student}
          integrations={integrations}
          lang={lang}
          onClose={() => setShowSubscriptionModal(false)}
          onActivated={(updated) => {
            onUserUpdated(updated);
            loadDashboard();
          }}
        />
      )}
    </div>
  );
}
