import React, { useState } from 'react';
import { Play, ChevronLeft, ChevronRight, FileVideo, ExternalLink, BookOpen } from 'lucide-react';
import type { Lang } from '../types/lms.ts';
import { t } from '../i18n/translations.ts';

export function extractYouTubeId(url?: string): string | null {
  if (!url || !url.trim()) return null;
  const clean = url.trim();
  try {
    const parsed = new URL(clean);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const v = parsed.searchParams.get('v');
      if (v) return v;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
        return parts[1] || null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function getYouTubeThumbnail(url?: string): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

function getEmbedUrl(url?: string): { type: 'video' | 'iframe' | 'external' | 'none'; src?: string } {
  if (!url || !url.trim()) return { type: 'none' };
  const clean = url.trim();
  if (clean.startsWith('/api/files/') || clean.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
    return { type: 'video', src: clean };
  }
  const ytId = extractYouTubeId(clean);
  if (ytId) {
    return {
      type: 'iframe',
      src: `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1&playsinline=1`,
    };
  }
  try {
    const parsed = new URL(clean);
    if (parsed.hostname.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id) return { type: 'iframe', src: `https://player.vimeo.com/video/${id}` };
    }
    return { type: 'external', src: clean };
  } catch {
    return { type: 'none' };
  }
}

export function VideoLessonViewer({
  title,
  topic,
  description,
  videoUrl,
  slides,
  durationMinutes,
  lang = 'uz',
}: {
  title: string;
  topic?: string;
  description?: string;
  videoUrl?: string;
  slides?: string[];
  durationMinutes?: number;
  lang?: Lang;
}) {
  const [slideIdx, setSlideIdx] = useState(0);
  const media = getEmbedUrl(videoUrl);
  const effectiveSlides = slides && slides.length > 0 ? slides : description ? [description] : [title];

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      {media.type === 'video' && media.src && (
        <div className="bg-slate-950 aspect-video w-full">
          <video src={media.src} controls playsInline className="w-full h-full object-contain" />
        </div>
      )}

      {media.type === 'iframe' && media.src && (
        <div className="bg-slate-950 aspect-video w-full">
          <iframe
            key={media.src}
            src={media.src}
            title={title}
            className="w-full h-full border-0"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      )}

      {media.type === 'external' && media.src && (
        <div className="bg-slate-900 text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileVideo className="w-6 h-6 text-blue-400 shrink-0" />
            <div>
              <p className="font-semibold text-sm">{title}</p>
              <p className="text-xs text-slate-300 mt-0.5">{t(lang, 'externalVideoAttached')}</p>
            </div>
          </div>
          <a
            href={media.src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white whitespace-nowrap shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            {t(lang, 'openVideo')}
          </a>
        </div>
      )}

      {media.type === 'none' && (
        <div className="bg-slate-900 text-white p-6 md:p-8 flex flex-col justify-between min-h-[220px]">
          <div className="flex items-center justify-between gap-4 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-400" />
              {t(lang, 'interactiveLessonNotes')} · {topic || t(lang, 'lessonFallback')}
            </span>
            {durationMinutes && (
              <span className="font-mono-num">
                {durationMinutes} {t(lang, 'minutesShort')}
              </span>
            )}
          </div>

          <div className="my-6">
            <h4 className="text-lg font-semibold text-white mb-3">{title}</h4>
            <p className="text-sm md:text-base text-slate-200 leading-relaxed bg-slate-800/70 border border-slate-700 rounded-lg p-4">
              {effectiveSlides[slideIdx]}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="text-xs text-slate-400 font-mono-num">
              {t(lang, 'slideLabel')} {slideIdx + 1} / {effectiveSlides.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
                disabled={slideIdx === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-medium text-white whitespace-nowrap"
              >
                <ChevronLeft className="w-4 h-4" />
                {t(lang, 'previous')}
              </button>
              <button
                type="button"
                onClick={() => setSlideIdx((i) => Math.min(effectiveSlides.length - 1, i + 1))}
                disabled={slideIdx >= effectiveSlides.length - 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-xs font-medium text-white whitespace-nowrap"
              >
                {t(lang, 'next')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {media.type !== 'none' && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 space-y-2.5">
          {description && (
            <div className="text-xs sm:text-sm text-slate-700 flex items-start gap-2">
              <Play className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>{description}</span>
            </div>
          )}
          {slides && slides.length > 0 && (
            <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {t(lang, 'interactiveLessonNotes')} {topic ? `· ${topic}` : ''}
              </div>
              <ul className="space-y-1 text-xs text-slate-600 list-disc pl-4">
                {slides.map((s, idx) => (
                  <li key={idx}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
