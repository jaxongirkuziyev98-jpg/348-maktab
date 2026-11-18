import React, { useRef, useState } from 'react';
import {
  Volume2,
  BookOpen,
  Mic,
  Square,
  CheckCircle2,
  GraduationCap,
  Headphones,
  FileText,
  Sparkles,
  PlayCircle,
  ClipboardCheck,
} from 'lucide-react';
import type {
  Lang,
  LanguageCourse,
  LanguageLevel,
  LanguageProgress,
  TestAttempt,
  TestItem,
} from '../types/lms.ts';
import { apiRequest } from '../lib/api.ts';
import { formatLocale, t } from '../i18n/translations.ts';
import { VideoLessonViewer } from './VideoLessonViewer.tsx';

type SectionKey =
  | 'video'
  | 'grammar'
  | 'vocab'
  | 'flashcards'
  | 'listening'
  | 'speaking'
  | 'reading'
  | 'homework'
  | 'test';

export function LanguageCenter({
  lang,
  courses,
  progressList,
  tests,
  testAttempts,
  onProgressUpdated,
  onStartTest,
}: {
  lang: Lang;
  courses: LanguageCourse[];
  progressList: LanguageProgress[];
  tests: TestItem[];
  testAttempts: TestAttempt[];
  onProgressUpdated: (updated: LanguageProgress) => void;
  onStartTest: (test: TestItem) => void;
}) {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || 'lang-en');
  const [selectedLevel, setSelectedLevel] = useState<LanguageLevel>('Beginner');
  const [activeTab, setActiveTab] = useState<SectionKey>('video');
  const [flashIdx, setFlashIdx] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [listeningChoice, setListeningChoice] = useState<number | null>(null);
  const [homeworkText, setHomeworkText] = useState('');
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const course = courses.find((c) => c.id === selectedCourseId) || courses[0];
  const levelModule =
    course?.levels.find((l) => l.level === selectedLevel) || course?.levels[0];

  const currentProgress = progressList.find(
    (p) => p.courseId === course?.id && p.level === selectedLevel
  );
  const completedSections = currentProgress?.completedSections || [];
  const learnedWordIds = currentProgress?.learnedWordIds || [];

  const matchingTest =
    tests.find(
      (tst) => tst.languageCourseId === course?.id && tst.languageLevel === selectedLevel
    ) || tests.find((tst) => tst.languageCourseId === course?.id);

  function speakText(text: string, speechLang: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = speechLang;
    utter.rate = 0.92;
    window.speechSynthesis.speak(utter);
  }

  async function markSectionDone(section: string) {
    if (!course) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ progress: LanguageProgress }>(
        '/api/student/language-progress',
        {
          method: 'POST',
          body: JSON.stringify({
            courseId: course.id,
            level: selectedLevel,
            toggleSection: section,
          }),
        }
      );
      onProgressUpdated(res.progress);
    } finally {
      setSaving(false);
    }
  }

  async function toggleLearnedWord(wordId: string) {
    if (!course) return;
    const res = await apiRequest<{ progress: LanguageProgress }>(
      '/api/student/language-progress',
      {
        method: 'POST',
        body: JSON.stringify({
          courseId: course.id,
          level: selectedLevel,
          learnedWordId: wordId,
        }),
      }
    );
    onProgressUpdated(res.progress);
  }

  async function submitLanguageHomework(e: React.FormEvent) {
    e.preventDefault();
    if (!course || !homeworkText.trim()) return;
    setSaving(true);
    try {
      const res = await apiRequest<{ progress: LanguageProgress }>(
        '/api/student/language-progress',
        {
          method: 'POST',
          body: JSON.stringify({
            courseId: course.id,
            level: selectedLevel,
            homeworkAnswer: homeworkText,
          }),
        }
      );
      onProgressUpdated(res.progress);
      setHomeworkText('');
    } finally {
      setSaving(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((tr) => tr.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      // Fallback: mark speaking practice via sample comparison if mic unavailable
    }
  }

  if (!course || !levelModule) return null;

  const progressPct = Math.round((completedSections.length / 7) * 100);
  const sectionTabs: Array<{ id: SectionKey; label: string; icon: React.ReactNode }> = [
    { id: 'video', label: t(lang, 'langTabVideo'), icon: <PlayCircle className="w-4 h-4" /> },
    { id: 'grammar', label: t(lang, 'langTabGrammar'), icon: <BookOpen className="w-4 h-4" /> },
    { id: 'vocab', label: t(lang, 'langTabVocab'), icon: <FileText className="w-4 h-4" /> },
    { id: 'flashcards', label: t(lang, 'langTabFlashcards'), icon: <Sparkles className="w-4 h-4" /> },
    { id: 'listening', label: t(lang, 'langTabListening'), icon: <Headphones className="w-4 h-4" /> },
    { id: 'speaking', label: t(lang, 'langTabSpeaking'), icon: <Mic className="w-4 h-4" /> },
    { id: 'reading', label: t(lang, 'langTabReading'), icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'homework', label: t(lang, 'langTabHomework'), icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'test', label: t(lang, 'langTabTest'), icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  const currentCard = levelModule.vocabulary[flashIdx % levelModule.vocabulary.length];
  const getWordTranslation = (w: { translationUz: string; translationRu: string }) =>
    lang === 'ru' ? w.translationRu : lang === 'en' ? `${w.translationUz} / ${w.translationRu}` : w.translationUz;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header banner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch border border-slate-200 rounded-2xl overflow-hidden bg-white">
        <div className="lg:col-span-8 p-4 sm:p-6 flex flex-col justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-blue-700">
              {t(lang, 'langCenterBannerTitle')}
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 text-balance">
              {course.name[lang]} ({course.nativeName})
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-2xl">
              {t(lang, 'langCenterDesc')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-full sm:w-auto">
              {(['Beginner', 'Intermediate', 'Advanced'] as LanguageLevel[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    setSelectedLevel(lvl);
                    setListeningChoice(null);
                  }}
                  className={`px-2 sm:px-3 py-2 sm:py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap text-center ${
                    selectedLevel === lvl
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-600">
              <span>{t(lang, 'levelProgressLabel')}</span>
              <span className="font-mono-num font-bold text-blue-700">{progressPct}%</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 relative h-40 sm:h-48 lg:h-auto lg:min-h-[180px] bg-slate-100">
          <img
            src="/src/assets/images/language_center_cover_1794918539672.jpg"
            alt={t(lang, 'langCenterBannerTitle')}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* 12 Languages Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
        {courses.map((c) => {
          const active = c.id === course.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelectedCourseId(c.id);
                setFlashIdx(0);
                setListeningChoice(null);
              }}
              className={`text-left px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-xl border transition-colors min-h-[44px] ${
                active
                  ? 'border-blue-600 bg-blue-50 text-slate-900'
                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="text-xs sm:text-sm font-semibold truncate">{c.name[lang]}</div>
              <div className="text-xs text-slate-500 truncate mt-0.5">{c.nativeName}</div>
            </button>
          );
        })}
      </div>

      {/* Module Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {sectionTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isDone = completedSections.includes(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2.5 sm:py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
            </button>
          );
        })}
      </div>

      {/* Module Workspace */}
      <div className="border border-slate-200 rounded-2xl bg-white p-4 sm:p-6">
        {activeTab === 'video' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">{levelModule.videoTitle}</h3>
              <button
                type="button"
                onClick={() => markSectionDone('video')}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap"
              >
                {completedSections.includes('video') ? t(lang, 'watchedDone') : t(lang, 'completeLesson')}
              </button>
            </div>
            <VideoLessonViewer
              lang={lang}
              title={levelModule.videoTitle}
              topic={`${course.name[lang]} · ${selectedLevel}`}
              videoUrl={levelModule.videoUrl}
              slides={[
                ...levelModule.grammarNotes,
                `${t(lang, 'langTabVocab')}: ${levelModule.vocabulary.map((v) => `${v.word} (${getWordTranslation(v)})`).join(', ')}`,
              ]}
            />
          </div>
        )}

        {activeTab === 'grammar' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">{levelModule.grammarTitle}</h3>
              <button
                type="button"
                onClick={() => markSectionDone('grammar')}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap"
              >
                {completedSections.includes('grammar') ? t(lang, 'masteredDone') : t(lang, 'markMastered')}
              </button>
            </div>
            <div className="space-y-3">
              {levelModule.grammarNotes.map((note, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-800">
                  <span className="font-mono-num font-semibold text-blue-700 mr-2">0{idx + 1}.</span>
                  {note}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'vocab' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">
                {t(lang, 'langTabVocab')} · {course.name[lang]} ({selectedLevel})
              </h3>
              <button
                type="button"
                onClick={() => markSectionDone('vocab')}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap"
              >
                {t(lang, 'markVocabDone')}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="py-2.5 pr-4 font-medium">{t(lang, 'colWord')}</th>
                    <th className="py-2.5 pr-4 font-medium">{t(lang, 'colTranscription')}</th>
                    <th className="py-2.5 pr-4 font-medium">{t(lang, 'colTranslation')}</th>
                    <th className="py-2.5 pr-4 font-medium">{t(lang, 'colExample')}</th>
                    <th className="py-2.5 text-right font-medium">{t(lang, 'colAudioStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {levelModule.vocabulary.map((w) => {
                    const learned = learnedWordIds.includes(w.id);
                    return (
                      <tr key={w.id} className="hover:bg-slate-50/70">
                        <td className="py-3 pr-4 font-semibold text-slate-900">{w.word}</td>
                        <td className="py-3 pr-4 font-mono-num text-xs text-slate-500">{w.transcription}</td>
                        <td className="py-3 pr-4 text-slate-700">{w.translationUz} / {w.translationRu}</td>
                        <td className="py-3 pr-4 text-xs text-slate-600">{w.example}</td>
                        <td className="py-3 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => speakText(w.word, course.speechLang)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 text-xs text-slate-700 hover:bg-slate-100"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            {t(lang, 'listenBtn')}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleLearnedWord(w.id)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                              learned
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {learned ? t(lang, 'learnedBtnDone') : t(lang, 'learnBtn')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'flashcards' && currentCard && (
          <div className="max-w-xl mx-auto space-y-5 py-4 text-center">
            <div className="text-xs text-slate-500 font-mono-num">
              {t(lang, 'flashcardLabel')} {(flashIdx % levelModule.vocabulary.length) + 1} / {levelModule.vocabulary.length} ·{' '}
              {t(lang, 'learnedWordsLabel')} {learnedWordIds.length}
            </div>
            <div
              onClick={() => setShowMeaning((s) => !s)}
              className="cursor-pointer border border-slate-200 rounded-2xl p-8 bg-slate-50 hover:bg-slate-100/70 transition-colors"
            >
              <div className="text-3xl font-bold text-slate-900">{currentCard.word}</div>
              <div className="text-sm font-mono-num text-slate-500 mt-1">{currentCard.transcription}</div>
              {showMeaning ? (
                <div className="mt-5 pt-5 border-t border-slate-200 space-y-1">
                  <div className="text-lg font-semibold text-blue-700">{getWordTranslation(currentCard)}</div>
                  <div className="text-xs text-slate-600">{currentCard.example}</div>
                </div>
              ) : (
                <div className="mt-5 text-xs text-slate-400">{t(lang, 'tapToSeeMeaning')}</div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => speakText(currentCard.word, course.speechLang)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Volume2 className="w-4 h-4" />
                {t(lang, 'hearBtn')}
              </button>
              <button
                type="button"
                onClick={() => toggleLearnedWord(currentCard.id)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                {learnedWordIds.includes(currentCard.id) ? t(lang, 'learnedCardDone') : t(lang, 'iLearnedIt')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFlashIdx((i) => i + 1);
                  setShowMeaning(false);
                }}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                {t(lang, 'nextWordBtn')}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'listening' && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-slate-900">{t(lang, 'listeningTitle')}</h3>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-slate-700">
                {t(lang, 'listeningDesc')}
              </div>
              <button
                type="button"
                onClick={() => speakText(levelModule.listeningScript, course.speechLang)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
              >
                <Volume2 className="w-4 h-4" />
                {t(lang, 'playAudioBtn')}
              </button>
            </div>

            <div className="space-y-2.5">
              <p className="text-sm font-semibold text-slate-900">{levelModule.listeningQuestion}</p>
              {levelModule.listeningOptions.map((opt, idx) => {
                const picked = listeningChoice === idx;
                const isRight = idx === levelModule.listeningCorrectIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setListeningChoice(idx);
                      if (isRight) markSectionDone('listening');
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                      picked
                        ? isRight
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                          : 'border-red-400 bg-red-50 text-red-900'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'speaking' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{t(lang, 'speakingTitle')}</h3>
            <p className="text-sm text-slate-700">{levelModule.speakingPrompt}</p>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800">
              <div className="text-xs font-semibold text-slate-500 mb-1">{t(lang, 'sampleAnswerLabel')}</div>
              {levelModule.speakingSample}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => speakText(levelModule.speakingSample, course.speechLang)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Volume2 className="w-4 h-4" />
                {t(lang, 'listenSampleBtn')}
              </button>
              <button
                type="button"
                onClick={toggleRecording}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white ${
                  recording ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {recording ? t(lang, 'stopRecording') : t(lang, 'recordVoiceMic')}
              </button>
              <button
                type="button"
                onClick={() => markSectionDone('speaking')}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                {t(lang, 'markSpeakingDone')}
              </button>
            </div>
            {audioUrl && (
              <div className="pt-2">
                <audio controls src={audioUrl} className="w-full max-w-md" />
              </div>
            )}
          </div>
        )}

        {activeTab === 'reading' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">{levelModule.readingTitle}</h3>
              <button
                type="button"
                onClick={() => markSectionDone('reading')}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
              >
                {t(lang, 'markReadDone')}
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800 p-4 rounded-xl border border-slate-200 bg-slate-50">
              {levelModule.readingPassage}
            </pre>
            <div className="text-xs text-slate-600">
              <span className="font-semibold">{t(lang, 'controlQuestionLabel')}</span> {levelModule.readingQuestion}
            </div>
          </div>
        )}

        {activeTab === 'homework' && (
          <form onSubmit={submitLanguageHomework} className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{t(lang, 'langHomeworkTitle')}</h3>
            <p className="text-sm text-slate-700">{levelModule.homeworkPrompt}</p>
            {currentProgress?.homeworkAnswer && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                <span className="font-semibold">{t(lang, 'lastSubmittedAnswer')}</span> {currentProgress.homeworkAnswer}
              </div>
            )}
            <textarea
              rows={4}
              value={homeworkText}
              onChange={(e) => setHomeworkText(e.target.value)}
              placeholder={t(lang, 'writeSentencePlaceholder')}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              disabled={saving || !homeworkText.trim()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? t(lang, 'saving') : t(lang, 'saveHomeworkBtn')}
            </button>
          </form>
        )}

        {activeTab === 'test' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">
              {course.name[lang]} · {t(lang, 'langTabTest')}
            </h3>
            {matchingTest ? (
              <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">{matchingTest.title}</div>
                  <div className="text-xs text-slate-600 mt-1 font-mono-num">
                    {t(lang, 'autoCheckMeta')} · {matchingTest.durationMinutes} {t(lang, 'minutesShort')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onStartTest(matchingTest)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold whitespace-nowrap"
                >
                  {t(lang, 'startTest')}
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t(lang, 'testPreparing')}</p>
            )}

            {testAttempts.filter((a) => matchingTest && a.testId === matchingTest.id).length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold text-slate-600">{t(lang, 'previousResults')}</h4>
                {testAttempts
                  .filter((a) => matchingTest && a.testId === matchingTest.id)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 text-xs"
                    >
                      <span className="text-slate-600">
                        {new Date(a.completedAt).toLocaleString(formatLocale(lang))}
                      </span>
                      <span className="font-mono-num font-bold text-slate-900">
                        {a.correctCount}/20 ({a.scorePercent}%)
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
