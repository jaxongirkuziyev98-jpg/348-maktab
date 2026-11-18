import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ClipboardPlus,
  CheckCircle2,
  FileSpreadsheet,
  BarChart3,
  MessageSquare,
  Bell,
  LogOut,
  Menu,
  X,
  AlertCircle,
  Clock,
  FileText,
  Sparkles,
} from 'lucide-react';
import type {
  Homework,
  HomeworkSubmission,
  IntegrationStatus,
  Lang,
  NotificationItem,
  SchoolClass,
  SmsLog,
  Subject,
  TestAttempt,
  TestItem,
  TestQuestion,
  User,
} from '../types/lms.ts';
import { formatGrade, formatLocale, t } from '../i18n/translations.ts';
import { ApiError, apiRequest, uploadFileToServer } from '../lib/api.ts';
import { HomeworkBreakdownBar, SubjectBarChart } from './Charts.tsx';
import { ThemeToggleButton, type AppTheme } from './ThemeToggleButton.tsx';

type TeacherTab = 'overview' | 'students' | 'homeworks' | 'review' | 'tests' | 'sms' | 'notifications';

interface TeacherDashboardData {
  teacher: User;
  classes: SchoolClass[];
  subjects: Subject[];
  students: User[];
  homeworks: Homework[];
  submissions: HomeworkSubmission[];
  tests: TestItem[];
  testAttempts: TestAttempt[];
  smsLogs: SmsLog[];
  notifications: NotificationItem[];
  integrations: IntegrationStatus;
}

function createEmpty20Questions(lang: Lang): TestQuestion[] {
  const qPrefix = lang === 'ru' ? 'Вопрос' : lang === 'en' ? 'Question' : 'savol matni';
  const optWord = lang === 'ru' ? 'Вариант' : lang === 'en' ? 'Option' : 'Variant';
  const expText =
    lang === 'ru'
      ? 'Пояснение правильного ответа для вопроса'
      : lang === 'en'
      ? 'Explanation for the correct answer of question'
      : 'savol uchun to‘g‘ri javob izohi';
  return Array.from({ length: 20 }, (_, i) => ({
    id: `tq-${i + 1}`,
    text: lang === 'uz' ? `${i + 1}-${qPrefix}` : `${qPrefix} #${i + 1}`,
    options: [`${optWord} A`, `${optWord} B`, `${optWord} C`, `${optWord} D`],
    correctIndex: 0,
    explanation: lang === 'uz' ? `${i + 1}-${expText}.` : `${expText} #${i + 1}.`,
  }));
}

export function TeacherCabinet({
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
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [activeTab, setActiveTab] = useState<TeacherTab>(() => {
    try {
      const saved = window.localStorage.getItem(`maktab348_tab_${user.id}`) as TeacherTab | null;
      const valid: TeacherTab[] = ['overview', 'students', 'homeworks', 'review', 'tests', 'sms', 'notifications'];
      if (saved && valid.includes(saved)) return saved;
    } catch {
      // ignore
    }
    return 'overview';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Selected student analytics
  const [selectedStudentId, setSelectedStudentId] = useState<string>(() => {
    try {
      return window.localStorage.getItem(`maktab348_stu_${user.id}`) || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(`maktab348_tab_${user.id}`, activeTab);
    } catch {
      // ignore
    }
  }, [activeTab, user.id]);

  useEffect(() => {
    if (!selectedStudentId) return;
    try {
      window.localStorage.setItem(`maktab348_stu_${user.id}`, selectedStudentId);
    } catch {
      // ignore
    }
  }, [selectedStudentId, user.id]);

  // Create Homework Form
  const [hwTitle, setHwTitle] = useState('');
  const [hwGrade, setHwGrade] = useState<number>(user.assignedGrades?.[0] || 3);
  const [hwSubjectId, setHwSubjectId] = useState<string>(user.assignedSubjectIds?.[0] || '');
  const [hwTopic, setHwTopic] = useState('');
  const [hwDueDate, setHwDueDate] = useState(() => {
    const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [hwDesc, setHwDesc] = useState('');
  const [hwHelpExp, setHwHelpExp] = useState('');
  const [hwHelpVideoUrl, setHwHelpVideoUrl] = useState('');
  const [hwHelpPdfUrl, setHwHelpPdfUrl] = useState('');
  const [hwHelpPdfName, setHwHelpPdfName] = useState('');
  const [hwHelpImageUrl, setHwHelpImageUrl] = useState('');
  const [savingHw, setSavingHw] = useState(false);

  // Review state
  const [reviewFilter, setReviewFilter] = useState<'all' | 'pending' | 'approved' | 'revision_needed'>('all');
  const [reviewEdits, setReviewEdits] = useState<
    Record<string, { gradeScore: string; teacherComment: string }>
  >({});

  // Create 20-question test state
  const [testTitle, setTestTitle] = useState('');
  const [testGrade, setTestGrade] = useState<number>(user.assignedGrades?.[0] || 9);
  const [testSubjectId, setTestSubjectId] = useState<string>(user.assignedSubjectIds?.[0] || '');
  const [testDuration, setTestDuration] = useState(25);
  const [questions, setQuestions] = useState<TestQuestion[]>(() => createEmpty20Questions(lang));
  const [editingQIdx, setEditingQIdx] = useState(0);
  const [savingTest, setSavingTest] = useState(false);

  async function loadDashboard() {
    setLoading(true);
    try {
      const res = await apiRequest<TeacherDashboardData>('/api/teacher/dashboard');
      setData(res);
      if (!hwSubjectId && res.subjects.length > 0) setHwSubjectId(res.subjects[0].id);
      if (!testSubjectId && res.subjects.length > 0) setTestSubjectId(res.subjects[0].id);
      if (!selectedStudentId && res.students.length > 0) setSelectedStudentId(res.students[0].id);
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

  async function handleUploadHelpFile(file: File, kind: 'video' | 'pdf' | 'image') {
    try {
      const uploaded = await uploadFileToServer(file);
      if (kind === 'video') setHwHelpVideoUrl(uploaded.url);
      if (kind === 'pdf') {
        setHwHelpPdfUrl(uploaded.url);
        setHwHelpPdfName(uploaded.safeName);
      }
      if (kind === 'image') setHwHelpImageUrl(uploaded.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t(lang, 'uploadError'));
    }
  }

  async function handleCreateHomework(e: React.FormEvent) {
    e.preventDefault();
    setSavingHw(true);
    setError('');
    setStatusMsg('');
    try {
      await apiRequest('/api/teacher/homeworks', {
        method: 'POST',
        body: JSON.stringify({
          title: hwTitle,
          grade: hwGrade,
          subjectId: hwSubjectId,
          topic: hwTopic,
          dueDate: hwDueDate,
          description: hwDesc,
          helpVideoUrl: hwHelpVideoUrl || undefined,
          helpPdfUrl: hwHelpPdfUrl || undefined,
          helpPdfName: hwHelpPdfName || undefined,
          helpImageUrl: hwHelpImageUrl || undefined,
          helpExplanation: hwHelpExp,
        }),
      });
      setHwTitle('');
      setHwTopic('');
      setHwDesc('');
      setHwHelpExp('');
      setHwHelpVideoUrl('');
      setHwHelpPdfUrl('');
      setHwHelpPdfName('');
      setHwHelpImageUrl('');
      setStatusMsg(t(lang, 'publishHomeworkBtn') + ' ✓');
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t(lang, 'loadingError'));
    } finally {
      setSavingHw(false);
    }
  }

  async function handleReviewSubmission(
    sub: HomeworkSubmission,
    nextStatus: 'approved' | 'revision_needed'
  ) {
    const edit = reviewEdits[sub.id] || {
      gradeScore: sub.gradeScore !== null ? String(sub.gradeScore) : nextStatus === 'approved' ? '5' : '3',
      teacherComment: sub.teacherComment || '',
    };
    setError('');
    setStatusMsg('');
    try {
      await apiRequest(`/api/teacher/submissions/${sub.id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          gradeScore: Number(edit.gradeScore) || null,
          teacherComment: edit.teacherComment,
        }),
      });
      setStatusMsg(
        nextStatus === 'approved' ? t(lang, 'approvedStatus') : t(lang, 'revisionStatus')
      );
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t(lang, 'loadingError'));
    }
  }

  async function handleCreateTest(e: React.FormEvent) {
    e.preventDefault();
    setSavingTest(true);
    setError('');
    setStatusMsg('');
    try {
      await apiRequest('/api/teacher/tests', {
        method: 'POST',
        body: JSON.stringify({
          title: testTitle,
          grade: testGrade,
          subjectId: testSubjectId,
          durationMinutes: testDuration,
          questions,
        }),
      });
      setTestTitle('');
      setQuestions(createEmpty20Questions(lang));
      setStatusMsg(t(lang, 'save20QTestBtn') + ' ✓');
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t(lang, 'loadingError'));
    } finally {
      setSavingTest(false);
    }
  }

  async function handleTriggerSms(includeParents: boolean) {
    setError('');
    setStatusMsg('');
    try {
      const res = await apiRequest<{ checkedHomeworks: number; dispatchedCount: number; mode: string }>(
        '/api/sms/run-scheduler',
        {
          method: 'POST',
          body: JSON.stringify({ includeParents }),
        }
      );
      setStatusMsg(
        `${res.checkedHomeworks} · ${res.dispatchedCount} SMS (${res.mode.toUpperCase()})`
      );
      await loadDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t(lang, 'smsSendError'));
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        {t(lang, 'teacherLoading')}
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
    integrations,
  } = data;

  const pendingSubmissions = submissions.filter((s) => s.status === 'pending');
  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0];

  function computeStudentStats(st: User) {
    const stHws = homeworks.filter((h) => h.grade === st.grade && h.status === 'active');
    const stSubs = submissions.filter((s) => s.studentId === st.id);
    const approved = stSubs.filter((s) => s.status === 'approved').length;
    const pending = stSubs.filter((s) => s.status === 'pending').length;
    const revision = stSubs.filter((s) => s.status === 'revision_needed').length;
    const stAttempts = testAttempts.filter((a) => a.studentId === st.id);
    const totalCorrect = stAttempts.reduce((sum, a) => sum + a.correctCount, 0);
    const totalWrong = stAttempts.reduce((sum, a) => sum + a.wrongCount, 0);
    const avgScore =
      stAttempts.length > 0
        ? Math.round(stAttempts.reduce((sum, a) => sum + a.scorePercent, 0) / stAttempts.length)
        : 0;

    return {
      totalHomeworks: stHws.length,
      submittedCount: stSubs.length,
      approved,
      pending,
      revision,
      notSubmitted: Math.max(0, stHws.length - stSubs.length),
      testsCount: stAttempts.length,
      totalCorrect,
      totalWrong,
      avgScore,
      stAttempts,
    };
  }

  const navItems: Array<{ id: TeacherTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'overview', label: t(lang, 'teacherNavOverview'), icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'students', label: t(lang, 'teacherNavStudents'), icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'homeworks', label: t(lang, 'teacherNavHomeworks'), icon: <ClipboardPlus className="w-4 h-4" /> },
    {
      id: 'review',
      label: t(lang, 'teacherNavReview'),
      icon: <CheckCircle2 className="w-4 h-4" />,
      badge: pendingSubmissions.length > 0 ? pendingSubmissions.length : undefined,
    },
    { id: 'tests', label: t(lang, 'teacherNavTests'), icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'sms', label: t(lang, 'teacherNavSms'), icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'notifications', label: t(lang, 'notifications'), icon: <Bell className="w-4 h-4" /> },
  ];

  const activeQ = questions[editingQIdx];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-white border-r border-slate-200">
        <div className="p-5 border-b border-slate-100">
          <div className="text-lg font-bold font-display">{t(lang, 'brand')}</div>
          <div className="flex items-center gap-2.5 mt-2.5">
            {teacher.avatarUrl ? (
              <img
                src={teacher.avatarUrl}
                alt={`${teacher.firstName} ${teacher.lastName}`}
                className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                {teacher.firstName.charAt(0)}
                {teacher.lastName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                {teacher.firstName} {teacher.lastName}
              </div>
              <div className="text-[11px] text-slate-500 truncate">{t(lang, 'roleTeacher')}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeTab === item.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                {item.icon}
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge && (
                <span className="font-mono-num text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">
                  {item.badge}
                </span>
              )}
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

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-950/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 w-72 max-w-[85vw] bg-white h-full flex flex-col p-4 border-r border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5 min-w-0">
                {teacher.avatarUrl ? (
                  <img
                    src={teacher.avatarUrl}
                    alt={`${teacher.firstName} ${teacher.lastName}`}
                    className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {teacher.firstName.charAt(0)}
                    {teacher.lastName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold font-display text-slate-900 truncate">
                    {teacher.firstName} {teacher.lastName}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{t(lang, 'teacherCabinetTitle')}</div>
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
                    activeTab === item.id ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.icon}
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="font-mono-num text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">
                      {item.badge}
                    </span>
                  )}
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
            {teacher.avatarUrl ? (
              <img
                src={teacher.avatarUrl}
                alt={`${teacher.firstName} ${teacher.lastName}`}
                className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                {teacher.firstName.charAt(0)}
                {teacher.lastName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                {teacher.firstName} {teacher.lastName} · {t(lang, 'teacherCabinetTitle')}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 truncate">
                {t(lang, 'assignedClassesLabel')} {(teacher.assignedGrades || []).join(', ')} ·{' '}
                {t(lang, 'assignedSubjectsLabel')} {subjects.map((s) => s.name[lang]).join(', ')}
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
                  <div className="text-xs text-slate-500">{t(lang, 'assignedClassesLabel')}</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono-num text-slate-900 mt-1">
                    {classes.length}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <div className="text-xs text-slate-500">{t(lang, 'teacherStudentsCount')}</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono-num text-slate-900 mt-1">
                    {students.length}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <div className="text-xs text-slate-500">{t(lang, 'teacherPendingReview')}</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono-num text-amber-700 mt-1">
                    {pendingSubmissions.length}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
                  <div className="text-xs text-slate-500">{t(lang, 'twentyQuestionTests')}</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono-num text-blue-700 mt-1">
                    {tests.length}
                  </div>
                </div>
              </div>

              {/* Incoming Homeworks Queue + Grading Criteria Preview */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {t(lang, 'incomingHomeworksTitle')}
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveTab('review')}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                    >
                      {t(lang, 'openReviewHubBtn')}
                    </button>
                  </div>

                  {submissions.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {[...submissions]
                        .sort((a, b) => (a.status === 'pending' ? -1 : b.status === 'pending' ? 1 : 0))
                        .slice(0, 5)
                        .map((sub) => {
                          const st = students.find((u) => u.id === sub.studentId);
                          const hw = homeworks.find((h) => h.id === sub.homeworkId);
                          const subj = subjects.find((s) => s.id === hw?.subjectId);
                          return (
                            <div
                              key={sub.id}
                              className="py-3 flex flex-wrap items-center justify-between gap-2.5"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-slate-900 truncate">
                                  {st?.firstName} {st?.lastName} — {hw?.title}
                                </div>
                                <div className="text-xs text-slate-500 truncate mt-0.5">
                                  {formatGrade(lang, st?.grade)} · {subj?.name[lang]} ·{' '}
                                  {new Date(sub.submittedAt).toLocaleString(formatLocale(lang))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {sub.status === 'approved' ? (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                                    {t(lang, 'approvedStatus')}
                                  </span>
                                ) : sub.status === 'revision_needed' ? (
                                  <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
                                    {t(lang, 'chartRevisionShort')}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                                    {t(lang, 'pendingStatus')}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('review')}
                                  className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800"
                                >
                                  {t(lang, 'openReviewHubBtn')}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 py-4">{t(lang, 'noSubmissionsYet')}</p>
                  )}
                </div>

                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-3">
                  <h2 className="text-base font-bold text-slate-900">{t(lang, 'gradingCriteriaTitle')}</h2>
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                      <span className="font-bold text-emerald-900">
                        5 · {lang === 'ru' ? 'Отлично' : lang === 'en' ? 'Excellent' : 'A’lo'}
                      </span>
                      <span className="font-mono-num text-emerald-700 font-semibold">90–100%</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                      <span className="font-bold text-blue-900">
                        4 · {lang === 'ru' ? 'Хорошо' : lang === 'en' ? 'Good' : 'Yaxshi'}
                      </span>
                      <span className="font-mono-num text-blue-700 font-semibold">75–89%</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                      <span className="font-bold text-amber-900">
                        3 · {lang === 'ru' ? 'Удовлетворительно' : lang === 'en' ? 'Satisfactory' : 'Qoniqarli'}
                      </span>
                      <span className="font-mono-num text-amber-700 font-semibold">60–74%</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between">
                      <span className="font-bold text-red-900">
                        2 · {lang === 'ru' ? 'Доработать' : lang === 'en' ? 'Needs Revision' : 'Qayta ishlash'}
                      </span>
                      <span className="font-mono-num text-red-700 font-semibold">0–59%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
                <h2 className="text-base font-semibold text-slate-900">
                  {t(lang, 'teacherAvgChartTitle')}
                </h2>
                <SubjectBarChart
                  lang={lang}
                  data={students.map((st) => {
                    const stats = computeStudentStats(st);
                    return {
                      label: `${st.firstName} ${st.lastName} (${formatGrade(lang, st.grade)})`,
                      value: stats.avgScore,
                    };
                  })}
                />
              </div>
            </div>
          )}

          {/* STUDENT STATISTICS */}
          {activeTab === 'students' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
              {/* Mobile compact student dropdown selector */}
              {students.length > 0 && (
                <div className="lg:hidden bg-white border border-slate-200 rounded-2xl p-3.5">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {t(lang, 'teacherNavStudents')}
                  </label>
                  <select
                    value={selectedStudent?.id || ''}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white font-medium text-slate-900"
                  >
                    {students.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.firstName} {st.lastName} · {formatGrade(lang, st.grade)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="hidden lg:block lg:col-span-4 space-y-2">
                {students.map((st) => {
                  const active = selectedStudent?.id === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setSelectedStudentId(st.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${
                        active
                          ? 'border-blue-600 bg-blue-50/70'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-slate-900">
                          {st.firstName} {st.lastName}
                        </span>
                        <span className="text-xs font-mono-num text-slate-500">
                          {formatGrade(lang, st.grade)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 font-mono-num">{st.phone}</div>
                    </button>
                  );
                })}
              </div>

              {selectedStudent && (
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5 sm:space-y-6">
                  {(() => {
                    const stats = computeStudentStats(selectedStudent);
                    return (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                          <div className="min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                              {selectedStudent.firstName} {selectedStudent.lastName}
                            </h2>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {formatGrade(lang, selectedStudent.grade)} · {selectedStudent.phone}
                            </div>
                          </div>
                          <div className="text-left sm:text-right shrink-0">
                            <div className="text-xs text-slate-500">{t(lang, 'avgScoreLabel')}</div>
                            <div className="text-2xl font-bold font-mono-num text-blue-700">
                              {stats.avgScore}%
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-3.5 rounded-xl border border-slate-200">
                            <div className="text-xs text-slate-500">{t(lang, 'totalHomeworksLabel')}</div>
                            <div className="text-xl font-bold font-mono-num mt-1">
                              {stats.totalHomeworks}
                            </div>
                          </div>
                          <div className="p-3.5 rounded-xl border border-slate-200">
                            <div className="text-xs text-slate-500">{t(lang, 'submittedLabel')}</div>
                            <div className="text-xl font-bold font-mono-num mt-1">
                              {stats.submittedCount}
                            </div>
                          </div>
                          <div className="p-3.5 rounded-xl border border-slate-200">
                            <div className="text-xs text-slate-500">{t(lang, 'testsCountLabel')}</div>
                            <div className="text-xl font-bold font-mono-num mt-1">
                              {stats.testsCount}
                            </div>
                          </div>
                          <div className="p-3.5 rounded-xl border border-slate-200">
                            <div className="text-xs text-slate-500">{t(lang, 'correctWrongLabel')}</div>
                            <div className="text-xl font-bold font-mono-num mt-1">
                              {stats.totalCorrect} / {stats.totalWrong}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {t(lang, 'homeworkDistributionTitle')}
                          </h3>
                          <HomeworkBreakdownBar
                            lang={lang}
                            approved={stats.approved}
                            pending={stats.pending}
                            revisionNeeded={stats.revision}
                            notSubmitted={stats.notSubmitted}
                          />
                        </div>

                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {t(lang, 'subjectTestResultsTitle')}
                          </h3>
                          <SubjectBarChart
                            lang={lang}
                            data={subjects.map((subj) => {
                              const subjTests = tests.filter((x) => x.subjectId === subj.id);
                              const subjAttempts = stats.stAttempts.filter((a) =>
                                subjTests.some((x) => x.id === a.testId)
                              );
                              const avg =
                                subjAttempts.length > 0
                                  ? Math.round(
                                      subjAttempts.reduce((acc, a) => acc + a.scorePercent, 0) /
                                        subjAttempts.length
                                    )
                                  : 0;
                              return { label: subj.name[lang], value: avg, color: subj.accentColor };
                            })}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* CREATE HOMEWORK */}
          {activeTab === 'homeworks' && (
            <div className="space-y-5 sm:space-y-6">
              <form
                onSubmit={handleCreateHomework}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4"
              >
                <h2 className="text-lg font-bold text-slate-900">{t(lang, 'createNewHomeworkTitle')}</h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t(lang, 'hwTitleLabel')}
                    </label>
                    <input
                      type="text"
                      value={hwTitle}
                      onChange={(e) => setHwTitle(e.target.value)}
                      required
                      placeholder={t(lang, 'hwTitlePlaceholder')}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t(lang, 'gradeShort')}
                    </label>
                    <select
                      value={hwGrade}
                      onChange={(e) => setHwGrade(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm bg-white"
                    >
                      {(teacher.assignedGrades || []).map((g) => (
                        <option key={g} value={g}>
                          {formatGrade(lang, g)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t(lang, 'subjectFallback')}
                    </label>
                    <select
                      value={hwSubjectId}
                      onChange={(e) => setHwSubjectId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm bg-white"
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name[lang]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t(lang, 'hwTopicLabel')}
                    </label>
                    <input
                      type="text"
                      value={hwTopic}
                      onChange={(e) => setHwTopic(e.target.value)}
                      required
                      placeholder={t(lang, 'hwTopicPlaceholder')}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t(lang, 'hwDueLabel')}
                    </label>
                    <input
                      type="datetime-local"
                      value={hwDueDate}
                      onChange={(e) => setHwDueDate(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-mono-num"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t(lang, 'hwDescLabel')}
                  </label>
                  <textarea
                    rows={3}
                    value={hwDesc}
                    onChange={(e) => setHwDesc(e.target.value)}
                    placeholder={t(lang, 'hwDescPlaceholder')}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t(lang, 'hwHelpExpLabel')}
                  </label>
                  <textarea
                    rows={2}
                    value={hwHelpExp}
                    onChange={(e) => setHwHelpExp(e.target.value)}
                    placeholder={t(lang, 'hwHelpExpPlaceholder')}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t(lang, 'videoLinkOrFileLabel')}
                    </label>
                    <input
                      type="text"
                      value={hwHelpVideoUrl}
                      onChange={(e) => setHwHelpVideoUrl(e.target.value)}
                      placeholder={t(lang, 'officialVideoUrlPlaceholder')}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs mb-1.5"
                    />
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadHelpFile(f, 'video');
                      }}
                      className="text-xs w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t(lang, 'pdfOrFileUploadLabel')}
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadHelpFile(f, 'pdf');
                      }}
                      className="text-xs w-full"
                    />
                    {hwHelpPdfName && <div className="text-xs text-emerald-700 mt-1">{hwHelpPdfName} ✓</div>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t(lang, 'imageUploadLabel')}
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadHelpFile(f, 'image');
                      }}
                      className="text-xs w-full"
                    />
                    {hwHelpImageUrl && <div className="text-xs text-emerald-700 mt-1">{t(lang, 'imageUploadedOk')}</div>}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingHw}
                  className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {savingHw ? t(lang, 'saving') : t(lang, 'publishHomeworkBtn')}
                </button>
              </form>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-3">
                <h3 className="text-base font-semibold text-slate-900">{t(lang, 'existingHomeworksTitle')}</h3>
                {homeworks.map((hw) => {
                  const subj = subjects.find((s) => s.id === hw.subjectId);
                  return (
                    <div
                      key={hw.id}
                      className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs text-slate-500">
                          {formatGrade(lang, hw.grade)} · {subj?.name[lang]} · {t(lang, 'dueDateLabel')}{' '}
                          {new Date(hw.dueDate).toLocaleDateString(formatLocale(lang))}
                        </div>
                        <div className="font-semibold text-sm text-slate-900">{hw.title}</div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/teacher/homeworks/${hw.id}/status`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              status: hw.status === 'active' ? 'cancelled' : 'active',
                            }),
                          });
                          loadDashboard();
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          hw.status === 'active'
                            ? 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {hw.status === 'active' ? t(lang, 'cancelAction') : t(lang, 'restoreCancelled')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* REVIEW SUBMISSIONS / VAZIFA TOPSHIRISH PUNKTI */}
          {activeTab === 'review' && (() => {
            const criteriaList = [
              {
                score: '5',
                range: '90–100%',
                label: lang === 'ru' ? 'Отлично' : lang === 'en' ? 'Excellent' : 'A’lo',
                note:
                  lang === 'ru'
                    ? 'Задание выполнено полностью и без ошибок.'
                    : lang === 'en'
                    ? 'Completed accurately with full solution.'
                    : 'Barcha shartlar to‘liq va xatosiz bajarilgan.',
                pillCls: 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
              },
              {
                score: '4',
                range: '75–89%',
                label: lang === 'ru' ? 'Хорошо' : lang === 'en' ? 'Good' : 'Yaxshi',
                note:
                  lang === 'ru'
                    ? 'Верно в целом, имеются незначительные недочёты.'
                    : lang === 'en'
                    ? 'Correct overall with minor omissions.'
                    : 'Asosiy qismi to‘g‘ri, kichik izohlar bor.',
                pillCls: 'border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100',
              },
              {
                score: '3',
                range: '60–74%',
                label: lang === 'ru' ? 'Удовл.' : lang === 'en' ? 'Satisfactory' : 'Qoniqarli',
                note:
                  lang === 'ru'
                    ? 'Часть задания решена, нужна дополнительная практика.'
                    : lang === 'en'
                    ? 'Partially solved; extra practice recommended.'
                    : 'Qisman bajarilgan, qo‘shimcha mashq kerak.',
                pillCls: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100',
              },
              {
                score: '2',
                range: '0–59%',
                label: lang === 'ru' ? 'Доработать' : lang === 'en' ? 'Revision' : 'Qayta ishlash',
                note:
                  lang === 'ru'
                    ? 'Есть ошибки, требуется пересдача.'
                    : lang === 'en'
                    ? 'Contains errors; resubmission required.'
                    : 'Xatolar mavjud, qayta topshirish kerak.',
                pillCls: 'border-red-200 bg-red-50 text-red-900 hover:bg-red-100',
              },
            ];

            const filteredSubmissions = submissions.filter((s) =>
              reviewFilter === 'all' ? true : s.status === reviewFilter
            );

            return (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-slate-900">
                    {t(lang, 'reviewSubmissionsHeading')} ({filteredSubmissions.length})
                  </h2>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: 'all', label: `${t(lang, 'filterAll')} (${submissions.length})` },
                        {
                          id: 'pending',
                          label: `${t(lang, 'pendingStatus')} (${pendingSubmissions.length})`,
                        },
                        {
                          id: 'approved',
                          label: `${t(lang, 'approvedStatus')} (${
                            submissions.filter((x) => x.status === 'approved').length
                          })`,
                        },
                        {
                          id: 'revision_needed',
                          label: `${t(lang, 'chartRevisionShort')} (${
                            submissions.filter((x) => x.status === 'revision_needed').length
                          })`,
                        },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setReviewFilter(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          reviewFilter === f.id
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grading Criteria Card (Baholash mezoni) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="text-sm font-bold text-slate-900">{t(lang, 'gradingCriteriaTitle')}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {criteriaList.map((c) => (
                      <div key={c.score} className={`p-3 rounded-xl border text-xs ${c.pillCls}`}>
                        <div className="flex items-center justify-between font-bold">
                          <span>
                            {c.score} · {c.label}
                          </span>
                          <span className="font-mono-num">{c.range}</span>
                        </div>
                        <div className="mt-1 opacity-90">{c.note}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {filteredSubmissions.map((sub) => {
                  const st = students.find((u) => u.id === sub.studentId);
                  const hw = homeworks.find((h) => h.id === sub.homeworkId);
                  const subj = subjects.find((s) => s.id === hw?.subjectId);
                  const edit = reviewEdits[sub.id] || {
                    gradeScore: sub.gradeScore !== null ? String(sub.gradeScore) : '5',
                    teacherComment: sub.teacherComment || '',
                  };

                  return (
                    <div key={sub.id} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xs text-slate-500">
                            {formatGrade(lang, st?.grade)} · {subj?.name[lang]} · {hw?.topic} ·{' '}
                            {t(lang, 'submittedAtLabel')}{' '}
                            {new Date(sub.submittedAt).toLocaleString(formatLocale(lang))}
                          </div>
                          <h3 className="text-base font-bold text-slate-900 mt-1">
                            {st?.firstName} {st?.lastName} — {hw?.title}
                          </h3>
                        </div>

                        <div className="text-xs font-semibold">
                          {sub.status === 'approved' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <CheckCircle2 className="w-4 h-4" /> {t(lang, 'approvedStatus')}
                            </span>
                          ) : sub.status === 'revision_needed' ? (
                            <span className="inline-flex items-center gap-1 text-red-700">
                              <AlertCircle className="w-4 h-4" /> {t(lang, 'chartRevisionShort')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <Clock className="w-4 h-4" /> {t(lang, 'pendingStatus')}
                            </span>
                          )}
                        </div>
                      </div>

                      {hw?.description && (
                        <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-xs text-slate-700">
                          <span className="font-semibold text-blue-900">{t(lang, 'homeworkTaskLabel')} </span>
                          {hw.description}
                        </div>
                      )}

                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 space-y-2">
                        <div className="text-xs font-semibold text-slate-500">{t(lang, 'studentAnswerLabel')}</div>
                        <div>{sub.textAnswer || t(lang, 'noTextAnswer')}</div>
                        {sub.fileUrl && (
                          <a
                            href={sub.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-blue-700 underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {sub.fileName || t(lang, 'openUploadedFile')}
                          </a>
                        )}
                        {sub.imageUrl && (
                          <div>
                            <a
                              href={sub.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-700 underline"
                            >
                              {t(lang, 'openUploadedImage')}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Quick Criterion Selectors */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-500 mr-1">
                          {t(lang, 'gradingCriteriaTitle')}:
                        </span>
                        {criteriaList.map((c) => (
                          <button
                            key={c.score}
                            type="button"
                            onClick={() =>
                              setReviewEdits({
                                ...reviewEdits,
                                [sub.id]: {
                                  gradeScore: c.score,
                                  teacherComment: edit.teacherComment || `${c.label}: ${c.note}`,
                                },
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                              edit.gradeScore === c.score
                                ? 'ring-2 ring-slate-900 ' + c.pillCls
                                : c.pillCls
                            }`}
                          >
                            {c.score} · {c.label}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            {t(lang, 'gradeScoreLabel')}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={edit.gradeScore}
                            onChange={(e) =>
                              setReviewEdits({
                                ...reviewEdits,
                                [sub.id]: { ...edit, gradeScore: e.target.value },
                              })
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-num"
                          />
                        </div>
                        <div className="sm:col-span-6">
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            {t(lang, 'teacherCommentLabel')}
                          </label>
                          <input
                            type="text"
                            value={edit.teacherComment}
                            onChange={(e) =>
                              setReviewEdits({
                                ...reviewEdits,
                                [sub.id]: { ...edit, teacherComment: e.target.value },
                              })
                            }
                            placeholder={t(lang, 'commentPlaceholder')}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleReviewSubmission(sub, 'approved')}
                            className="flex-1 px-3.5 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap"
                          >
                            {t(lang, 'approveBtn')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewSubmission(sub, 'revision_needed')}
                            className="flex-1 px-3.5 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold whitespace-nowrap"
                          >
                            {t(lang, 'chartRevisionShort')}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredSubmissions.length === 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
                    {t(lang, 'noSubmissionsYet')}
                  </div>
                )}
              </div>
            );
          })()}

          {/* CREATE 20-QUESTION TEST */}
          {activeTab === 'tests' && (
            <form
              onSubmit={handleCreateTest}
              className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5 sm:space-y-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {t(lang, 'create20QTestTitle')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t(lang, 'create20QTestRule')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const subjName = subjects.find((s) => s.id === testSubjectId)?.name[lang] || t(lang, 'subjectFallback');
                    setQuestions(
                      Array.from({ length: 20 }, (_, i) => ({
                        id: `tq-${Date.now()}-${i + 1}`,
                        text:
                          lang === 'ru'
                            ? `${i + 1}. ${subjName} (${formatGrade(lang, testGrade)}) · Контрольный вопрос №${i + 1}`
                            : lang === 'en'
                            ? `${i + 1}. ${subjName} (${formatGrade(lang, testGrade)}) · Question #${i + 1}`
                            : `${i + 1}. ${subjName} (${testGrade}-sinf) bo‘yicha nazorat savoli №${i + 1}`,
                        options:
                          lang === 'ru'
                            ? ['Правильный ответ', 'Вариант B', 'Вариант C', 'Вариант D']
                            : lang === 'en'
                            ? ['Correct Answer', 'Distractor B', 'Distractor C', 'Distractor D']
                            : ['To‘g‘ri javob varianti', 'Chalg‘ituvchi B', 'Chalg‘ituvchi C', 'Chalg‘ituvchi D'],
                        correctIndex: 0,
                        explanation:
                          lang === 'ru'
                            ? `Пояснение к вопросу №${i + 1}.`
                            : lang === 'en'
                            ? `Core rule and solution explanation for question #${i + 1}.`
                            : `${i + 1}-savol bo‘yicha asosiy qoida va yechim izohi.`,
                      }))
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  {t(lang, 'fill20TemplateBtn')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t(lang, 'testTitleLabel')}</label>
                  <input
                    type="text"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    required
                    placeholder={t(lang, 'testTitlePlaceholder')}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t(lang, 'gradeShort')}</label>
                  <select
                    value={testGrade}
                    onChange={(e) => setTestGrade(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm bg-white"
                  >
                    {(teacher.assignedGrades || []).map((g) => (
                      <option key={g} value={g}>
                        {formatGrade(lang, g)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t(lang, 'subjectAndTimeLabel')}
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={testSubjectId}
                      onChange={(e) => setTestSubjectId(e.target.value)}
                      className="flex-1 min-w-0 rounded-xl border border-slate-300 px-2.5 py-2 text-sm bg-white"
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name[lang]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={5}
                      max={120}
                      value={testDuration}
                      onChange={(e) => setTestDuration(Number(e.target.value))}
                      className="w-16 shrink-0 rounded-xl border border-slate-300 px-2 py-2 text-sm font-mono-num"
                    />
                  </div>
                </div>
              </div>

              {/* 1-20 Question Selector */}
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                {questions.map((q, idx) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setEditingQIdx(idx)}
                    className={`py-2 min-h-[40px] rounded-lg text-xs font-mono-num font-semibold border ${
                      editingQIdx === idx
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              {/* Active Question Editor */}
              {activeQ && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="text-xs font-semibold text-slate-700">
                    {lang === 'en'
                      ? `${t(lang, 'editingQuestionPrefix')}${editingQIdx + 1}`
                      : `${editingQIdx + 1}${t(lang, 'editingQuestionPrefix')}`}
                  </div>
                  <input
                    type="text"
                    value={activeQ.text}
                    onChange={(e) => {
                      const next = [...questions];
                      next[editingQIdx] = { ...activeQ, text: e.target.value };
                      setQuestions(next);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeQ.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct-${editingQIdx}`}
                          checked={activeQ.correctIndex === optIdx}
                          onChange={() => {
                            const next = [...questions];
                            next[editingQIdx] = { ...activeQ, correctIndex: optIdx as 0 | 1 | 2 | 3 };
                            setQuestions(next);
                          }}
                        />
                        <span className="text-xs font-mono-num font-bold w-4">
                          {['A', 'B', 'C', 'D'][optIdx]}
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...questions];
                            const opts = [...activeQ.options] as [string, string, string, string];
                            opts[optIdx] = e.target.value;
                            next[editingQIdx] = { ...activeQ, options: opts };
                            setQuestions(next);
                          }}
                          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {t(lang, 'explanationVisibleHint')}
                    </label>
                    <input
                      type="text"
                      value={activeQ.explanation}
                      onChange={(e) => {
                        const next = [...questions];
                        next[editingQIdx] = { ...activeQ, explanation: e.target.value };
                        setQuestions(next);
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={savingTest}
                className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-60"
              >
                {savingTest ? t(lang, 'saving') : t(lang, 'save20QTestBtn')}
              </button>
            </form>
          )}

          {/* SMS REMINDERS */}
          {activeTab === 'sms' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{t(lang, 'smsRemindersStatus')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t(lang, 'modeLabel')} <span className="font-semibold">{integrations.sms.providerLabel}</span>
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleTriggerSms(false)}
                    className="px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    {t(lang, 'checkOverdueHomeworksBtn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerSms(true)}
                    className="px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold"
                  >
                    {t(lang, 'sendToParentsTooBtn')}
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {smsLogs.map((log) => (
                  <div key={log.id} className="py-3.5 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-mono-num font-semibold text-slate-900">
                        {log.phone} ({log.recipientType})
                      </span>
                      <span className="text-slate-500">
                        {log.mode.toUpperCase()} · {log.status} · {new Date(log.sentAt).toLocaleString(formatLocale(lang))}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{log.message}</p>
                  </div>
                ))}
                {smsLogs.length === 0 && (
                  <p className="py-6 text-center text-sm text-slate-500">{t(lang, 'noSmsLogsYet')}</p>
                )}
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">{t(lang, 'notifications')}</h2>
                <button
                  type="button"
                  onClick={async () => {
                    await apiRequest('/api/notifications/read', { method: 'POST' });
                    loadDashboard();
                  }}
                  className="text-xs font-semibold text-blue-700"
                >
                  {t(lang, 'markAsReadBtn')}
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <div key={n.id} className="py-3">
                    <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{n.body}</div>
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
              { id: 'overview' as TeacherTab, label: t(lang, 'overview'), icon: <LayoutDashboard className="w-4 h-4" /> },
              { id: 'students' as TeacherTab, label: t(lang, 'teacherNavStudents'), icon: <BarChart3 className="w-4 h-4" /> },
              { id: 'homeworks' as TeacherTab, label: t(lang, 'homeworks'), icon: <ClipboardPlus className="w-4 h-4" /> },
              {
                id: 'review' as TeacherTab,
                label: t(lang, 'teacherNavReview'),
                icon: <CheckCircle2 className="w-4 h-4" />,
                badge: pendingSubmissions.length > 0 ? pendingSubmissions.length : undefined,
              },
            ].map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-semibold min-h-[44px] ${
                    active ? 'text-blue-700 bg-blue-50' : 'text-slate-500'
                  }`}
                >
                  {item.icon}
                  <span className="truncate max-w-full">{item.label}</span>
                  {item.badge && (
                    <span className="absolute top-0.5 right-2 font-mono-num text-[9px] font-bold px-1 rounded bg-amber-500 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-xl text-[10px] font-semibold min-h-[44px] ${
                ['tests', 'sms', 'notifications'].includes(activeTab)
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
