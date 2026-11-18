import React, { useEffect, useState } from 'react';
import { X, Clock, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import type { Lang, TestAttempt, TestItem } from '../types/lms.ts';
import { t } from '../i18n/translations.ts';
import { apiRequest } from '../lib/api.ts';

export function TestRunnerModal({
  test,
  lang,
  onClose,
  onCompleted,
}: {
  test: TestItem;
  lang: Lang;
  onClose: () => void;
  onCompleted: (attempt: TestAttempt) => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>(() => Array(20).fill(-1));
  const [secondsLeft, setSecondsLeft] = useState((test.durationMinutes || 25) * 60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TestAttempt | null>(null);

  useEffect(() => {
    if (result) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [result]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const currentQ = test.questions[currentIdx];
  const answeredCount = answers.filter((a) => a >= 0).length;

  async function handleFinish() {
    setSubmitting(true);
    setError('');
    try {
      const res = await apiRequest<{ attempt: TestAttempt }>(
        `/api/student/tests/${test.id}/submit`,
        {
          method: 'POST',
          body: JSON.stringify({ answers }),
        }
      );
      setResult(res.attempt);
      onCompleted(res.attempt);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t(lang, 'testSubmitError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 truncate">{test.title}</h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono-num">
              {t(lang, 'test20Marked')} · {answeredCount}/20 {t(lang, 'markedSuffix')}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!result && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono-num font-semibold text-slate-900">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70"
              aria-label={t(lang, 'close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {!result ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Question area */}
              <div className="lg:col-span-8 space-y-5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium text-slate-700">
                    {t(lang, 'questionOf')} {currentIdx + 1} / 20
                  </span>
                  <span>{t(lang, 'chooseOptionHint')}</span>
                </div>

                <p className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
                  {currentQ.text}
                </p>

                <div className="space-y-2.5">
                  {currentQ.options.map((opt, optIdx) => {
                    const letter = ['A', 'B', 'C', 'D'][optIdx];
                    const selected = answers[currentIdx] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => {
                          const next = [...answers];
                          next[currentIdx] = optIdx;
                          setAnswers(next);
                        }}
                        className={`w-full text-left px-4 py-3.5 rounded-xl border transition-colors flex items-center gap-3 ${
                          selected
                            ? 'border-blue-600 bg-blue-50 text-slate-900'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg text-xs font-mono-num font-semibold flex items-center justify-center shrink-0 ${
                            selected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="text-sm sm:text-base">{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                    disabled={currentIdx === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    {t(lang, 'previous')}
                  </button>

                  <div className="flex items-center gap-2">
                    {currentIdx < 19 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentIdx((i) => Math.min(19, i + 1))}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 whitespace-nowrap"
                      >
                        {t(lang, 'next')}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleFinish}
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap"
                      >
                        <Flag className="w-4 h-4" />
                        {submitting ? t(lang, 'checkingTestBtn') : t(lang, 'finishTest')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 1-20 Question Switcher */}
              <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6 space-y-4">
                <div className="text-xs font-semibold text-slate-700">
                  {t(lang, 'questionMapTitle')}
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {test.questions.map((q, idx) => {
                    const isAnswered = answers[idx] >= 0;
                    const isCurrent = idx === currentIdx;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setCurrentIdx(idx)}
                        className={`h-9 rounded-lg text-xs font-mono-num font-semibold border transition-colors ${
                          isCurrent
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : isAnswered
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {submitting ? t(lang, 'saving') : t(lang, 'finishTest')}
                </button>
              </div>
            </div>
          ) : (
            /* Results & Explanations */
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">{t(lang, 'resultPercentLabel')}</div>
                  <div className="text-2xl font-bold font-mono-num text-blue-700 mt-1">
                    {result.scorePercent}%
                  </div>
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="text-xs text-slate-500">{t(lang, 'totalPointsLabel')}</div>
                  <div className="text-2xl font-bold font-mono-num text-slate-900 mt-1">
                    {result.totalPoints} / 100
                  </div>
                </div>
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-4">
                  <div className="text-xs text-emerald-700">{t(lang, 'correct')}</div>
                  <div className="text-2xl font-bold font-mono-num text-emerald-700 mt-1">
                    {result.correctCount}
                  </div>
                </div>
                <div className="border border-red-200 bg-red-50/50 rounded-xl p-4">
                  <div className="text-xs text-red-700">{t(lang, 'wrong')}</div>
                  <div className="text-2xl font-bold font-mono-num text-red-700 mt-1">
                    {result.wrongCount}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">
                  {t(lang, 'errorAnalysisTitle')}
                </h4>
                {test.questions.map((q, idx) => {
                  const detail = result.details[idx];
                  const isCorrect = detail?.isCorrect;
                  const userOpt =
                    detail && detail.selectedIndex >= 0
                      ? `${['A', 'B', 'C', 'D'][detail.selectedIndex]}. ${q.options[detail.selectedIndex]}`
                      : t(lang, 'notSelectedOption');
                  const rightOpt = `${['A', 'B', 'C', 'D'][q.correctIndex]}. ${q.options[q.correctIndex]}`;

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl border ${
                        isCorrect
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : 'border-red-200 bg-red-50/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">{q.text}</p>
                        {isCorrect ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                            {t(lang, 'correct')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 shrink-0">
                            <XCircle className="w-4 h-4" />
                            {t(lang, 'wrong')}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-slate-600 space-y-1">
                        <div>
                          {t(lang, 'yourOptionLabel')}{' '}
                          <span className="font-medium text-slate-900">{userOpt}</span>
                        </div>
                        {!isCorrect && (
                          <div>
                            {t(lang, 'correctOptionLabel')}{' '}
                            <span className="font-semibold text-emerald-700">{rightOpt}</span>
                          </div>
                        )}
                        <div className="text-slate-700 pt-1">
                          <span className="font-semibold">{t(lang, 'explanation')}:</span> {q.explanation}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
