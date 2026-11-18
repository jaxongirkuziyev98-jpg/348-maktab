import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, ExternalLink, Search } from 'lucide-react';
import type { Lang } from '../types/lms.ts';
import { t } from '../i18n/translations.ts';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

function toGoogleDrivePreview(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('drive.google.com')) {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (m && m[1]) {
        return `https://drive.google.com/file/d/${m[1]}/preview`;
      }
      const id = u.searchParams.get('id');
      if (id) {
        return `https://drive.google.com/file/d/${id}/preview`;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function PdfBookReader({
  pdfUrl,
  downloadUrl,
  googleSearchUrl,
  title,
  lang,
}: {
  pdfUrl: string;
  downloadUrl: string;
  googleSearchUrl?: string;
  title: string;
  lang: Lang;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const drivePreview = toGoogleDrivePreview(pdfUrl);
  const isExternalUrl =
    (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) && !drivePreview;

  useEffect(() => {
    if (drivePreview || isExternalUrl) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    setPageNum(1);

    const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
    loadingTask.promise
      .then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t(lang, 'pdfLoadError'));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy().catch(() => undefined);
    };
  }, [pdfUrl, drivePreview, isExternalUrl, lang]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let renderTask: pdfjsLib.RenderTask | null = null;
    let cancelled = false;

    pdfDoc.getPage(pageNum).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = '100%';
      canvas.style.maxWidth = `${Math.floor(viewport.width)}px`;
      canvas.style.height = 'auto';

      const transform =
        outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      renderTask = page.render({
        canvasContext: context,
        transform,
        viewport,
        canvas,
      });
      renderTask.promise.catch(() => undefined);
    });

    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNum, scale]);

  if (drivePreview) {
    return (
      <div className="space-y-3">
        <iframe
          src={drivePreview}
          title={title}
          className="w-full h-[540px] rounded-xl border border-slate-200 bg-slate-100"
          allow="autoplay"
        />
        <div className="flex flex-wrap items-center justify-end gap-4">
          {googleSearchUrl && (
            <a
              href={googleSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              <Search className="w-3.5 h-3.5" />
              {t(lang, 'searchGooglePdf')}
            </a>
          )}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t(lang, 'openInNewTab')}
          </a>
        </div>
      </div>
    );
  }

  if (isExternalUrl) {
    return (
      <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm font-medium text-slate-800">{title}</div>
        <div className="flex flex-wrap items-center gap-2">
          {googleSearchUrl && (
            <a
              href={googleSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-100"
            >
              <Search className="w-4 h-4" />
              {t(lang, 'searchGooglePdf')}
            </a>
          )}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
          >
            <ExternalLink className="w-4 h-4" />
            {t(lang, 'openInNewTab')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            {t(lang, 'previous')}
          </button>
          <span className="text-xs font-mono-num font-semibold text-slate-800 px-2">
            {numPages > 0 ? `${pageNum} / ${numPages}` : '...'}
          </span>
          <button
            type="button"
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
            disabled={pageNum >= numPages}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {t(lang, 'next')}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.7, Number((s - 0.15).toFixed(2))))}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono-num text-slate-600 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2, Number((s + 0.15).toFixed(2))))}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          {googleSearchUrl && (
            <a
              href={googleSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5" />
              Google PDF
            </a>
          )}
          <a
            href={downloadUrl}
            download={`${title}.pdf`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            {t(lang, 'downloadPdf')}
          </a>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="p-4 overflow-auto max-h-[600px] flex justify-center">
        {loading && (
          <div className="py-16 text-sm text-slate-600">{t(lang, 'loadingPdf')}</div>
        )}
        {error && (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-red-600">{error}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <a
                href={downloadUrl}
                download
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
              >
                <Download className="w-4 h-4" />
                {t(lang, 'downloadPdf')}
              </a>
              {googleSearchUrl && (
                <a
                  href={googleSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold"
                >
                  <Search className="w-4 h-4" />
                  {t(lang, 'searchGooglePdf')}
                </a>
              )}
            </div>
          </div>
        )}
        {!loading && !error && (
          <canvas
            ref={canvasRef}
            className="shadow-md rounded bg-white max-w-full h-auto"
          />
        )}
      </div>
    </div>
  );
}
