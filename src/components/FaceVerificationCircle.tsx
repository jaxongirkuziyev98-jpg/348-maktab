import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, RefreshCw, Upload } from 'lucide-react';
import type { Lang } from '../types/lms.ts';

interface FaceDetectorLandmark {
  type?: string;
  locations?: Array<{ x: number; y: number }>;
}

interface DetectedFace {
  boundingBox: DOMRectReadOnly;
  landmarks?: FaceDetectorLandmark[];
}

interface FaceDetectorLike {
  detect: (input: HTMLVideoElement | HTMLCanvasElement) => Promise<DetectedFace[]>;
}

declare global {
  interface Window {
    FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;
  }
}

const REQUIRED_STEADY_TICKS = 14; // ~3.1 seconds steady straight hold (220ms each)

export function FaceVerificationCircle({
  lang,
  value,
  autoStart = false,
  onChange,
}: {
  lang: Lang;
  value: string;
  autoStart?: boolean;
  onChange: (dataUrl: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevLumaGridRef = useRef<Float32Array | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const alignedStreakRef = useRef(0);
  const capturedRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [alignProgress, setAlignProgress] = useState(0);
  const [guidance, setGuidance] = useState('');

  const labels = {
    title:
      lang === 'ru'
        ? 'Подтверждение лица (круглая камера)'
        : lang === 'en'
        ? 'Face Verification (Circular Camera)'
        : 'Yuzni tasdiqlash (Dumaloq kamera)',
    subtitle:
      lang === 'ru'
        ? 'Держите лицо ровно и спокойно в центре круга — когда рамка станет зелёной, снимок сделается автоматически.'
        : lang === 'en'
        ? 'Hold your face straight and steady inside the circle — when green, the photo is captured automatically.'
        : 'Yuzingizni doira (sharikcha) markaziga to‘g‘ri va tekis tutib turing — yashil bo‘lganda o‘zi rasmga oladi.',
    startBtn:
      lang === 'ru'
        ? 'Включить камеру'
        : lang === 'en'
        ? 'Start Camera'
        : 'Kamerani yoqish',
    snapBtn:
      lang === 'ru'
        ? 'Сделать снимок вручную'
        : lang === 'en'
        ? 'Capture Photo'
        : 'Rasmga olish',
    retakeBtn:
      lang === 'ru'
        ? 'Переснять'
        : lang === 'en'
        ? 'Retake Photo'
        : 'Qayta rasmga olish',
    uploadFallback:
      lang === 'ru'
        ? 'Загрузить фото (если нет камеры)'
        : lang === 'en'
        ? 'Upload photo (no camera)'
        : 'Kamera bo‘lmasa rasm yuklash',
    verifiedBadge:
      lang === 'ru'
        ? 'Лицо подтверждено ✓'
        : lang === 'en'
        ? 'Face Verified ✓'
        : 'Yuz tasdiqlandi ✓',
    holdSteady:
      lang === 'ru'
        ? 'Отлично! Держите ровно, идёт съёмка...'
        : lang === 'en'
        ? 'Great! Hold straight and steady...'
        : 'Ajoyib! Tekis va qimirlamay turing...',
    keepStill:
      lang === 'ru'
        ? 'Зафиксируйте голову ровно, не двигайтесь'
        : lang === 'en'
        ? 'Hold still, please avoid moving'
        : 'Qimirlamang — boshni tekis tutib turing',
    keepLevel:
      lang === 'ru'
        ? 'Держите голову ровно (горизонтально)'
        : lang === 'en'
        ? 'Keep your head straight and level'
        : 'Boshingizni qiyshaytirmay, tekis tuting',
    centerFace:
      lang === 'ru'
        ? 'Поместите лицо точно в центр круга'
        : lang === 'en'
        ? 'Center your face inside the circle'
        : 'Yuzingizni doira markaziga to‘g‘ri joylashtiring',
    moveCloser:
      lang === 'ru'
        ? 'Подвиньтесь ближе к камере'
        : lang === 'en'
        ? 'Move slightly closer'
        : 'Kameraga biroz yaqinroq keling',
    moveBack:
      lang === 'ru'
        ? 'Отодвиньтесь немного назад'
        : lang === 'en'
        ? 'Move slightly back'
        : 'Kameradan biroz uzoqroq turing',
    tooDark:
      lang === 'ru'
        ? 'Слишком темно — добавьте освещение'
        : lang === 'en'
        ? 'Too dark — move to brighter light'
        : 'Yorug‘lik kam — yorug‘roq joyga turing',
  };

  function stopStream() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  useEffect(() => {
    if (autoStart && !value) {
      startCamera();
    }
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function captureFrameFromVideo() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0 || capturedRef.current) return;
    capturedRef.current = true;

    const size = 400;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;

    // Mirror horizontally to match preview
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    stopStream();
    setAlignProgress(100);
    setGuidance(labels.verifiedBadge);
    onChange(dataUrl);
  }

  async function startCamera() {
    setCameraError('');
    capturedRef.current = false;
    alignedStreakRef.current = 0;
    prevLumaGridRef.current = null;
    setAlignProgress(0);
    setGuidance(labels.centerFace);
    if (value) onChange('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        lang === 'ru'
          ? 'Камера недоступна в этом браузере. Загрузите фото ниже.'
          : lang === 'en'
          ? 'Camera not available in this browser. Please upload a photo below.'
          : 'Bu brauzerda kamera ishlamadi. Pastdan rasm yuklashingiz mumkin.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      }, 40);
    } catch {
      setCameraError(
        lang === 'ru'
          ? 'Доступ к камере отклонён. Разрешите камеру или загрузите фото.'
          : lang === 'en'
          ? 'Camera permission denied. Allow camera access or upload a photo.'
          : 'Kameraga ruxsat berilmadi. Ruxsat bering yoki rasm yuklang.'
      );
    }
  }

  // Calm, deliberate alignment + level + stillness check (~3.1s hold)
  useEffect(() => {
    if (!cameraActive || value) return;
    let cancelled = false;
    const detector = window.FaceDetector ? new window.FaceDetector({ fastMode: false, maxDetectedFaces: 1 }) : null;

    const timer = window.setInterval(async () => {
      if (cancelled || capturedRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      let canvas = analysisCanvasRef.current;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 120;
        analysisCanvasRef.current = canvas;
      }
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const side = Math.min(video.videoWidth, video.videoHeight);
      const sx = (video.videoWidth - side) / 2;
      const sy = (video.videoHeight - side) / 2;
      ctx.drawImage(video, sx, sy, side, side, 0, 0, 120, 120);

      const frame = ctx.getImageData(0, 0, 120, 120).data;

      let lumaSum = 0;
      let leftSum = 0;
      let rightSum = 0;
      let count = 0;
      let edgeSum = 0;
      const currGrid = new Float32Array(36 * 36);
      let gIdx = 0;

      for (let y = 24; y < 96; y += 2) {
        for (let x = 24; x < 96; x += 2) {
          const idx = (y * 120 + x) * 4;
          const luma = 0.299 * frame[idx] + 0.587 * frame[idx + 1] + 0.114 * frame[idx + 2];
          lumaSum += luma;
          if (x < 60) leftSum += luma;
          else rightSum += luma;
          currGrid[gIdx++] = luma;
          count++;

          if (x + 2 < 96) {
            const nIdx = (y * 120 + (x + 2)) * 4;
            const nLuma = 0.299 * frame[nIdx] + 0.587 * frame[nIdx + 1] + 0.114 * frame[nIdx + 2];
            edgeSum += Math.abs(luma - nLuma);
          }
        }
      }

      // Compute frame-to-frame motion delta
      let motionDiff = 0;
      if (prevLumaGridRef.current && prevLumaGridRef.current.length === currGrid.length) {
        let diffSum = 0;
        for (let i = 0; i < currGrid.length; i++) {
          diffSum += Math.abs(currGrid[i] - prevLumaGridRef.current[i]);
        }
        motionDiff = diffSum / currGrid.length;
      }
      prevLumaGridRef.current = currGrid;

      const avgLuma = lumaSum / Math.max(1, count);
      const avgEdge = edgeSum / Math.max(1, count);
      const lrImbalance = Math.abs(leftSum - rightSum) / Math.max(1, count / 2);

      if (avgLuma < 42) {
        alignedStreakRef.current = Math.max(0, alignedStreakRef.current - 2);
        setAlignProgress(Math.round((alignedStreakRef.current / REQUIRED_STEADY_TICKS) * 100));
        setGuidance(labels.tooDark);
        return;
      }

      if (motionDiff > 14) {
        alignedStreakRef.current = Math.max(0, alignedStreakRef.current - 1);
        setAlignProgress(Math.round((alignedStreakRef.current / REQUIRED_STEADY_TICKS) * 100));
        setGuidance(labels.keepStill);
        return;
      }

      let statusMessage = labels.holdSteady;
      let isStraightAndCentered =
        avgLuma >= 45 && avgLuma <= 238 && avgEdge >= 5.2 && lrImbalance <= 28;

      if (!isStraightAndCentered && lrImbalance > 28) {
        statusMessage = labels.centerFace;
      }

      if (detector) {
        try {
          const faces = await detector.detect(canvas);
          if (faces.length === 0) {
            isStraightAndCentered = false;
            statusMessage = labels.centerFace;
          } else {
            const face = faces[0];
            const box = face.boundingBox;
            const cx = (box.x + box.width / 2) / 120;
            const cy = (box.y + box.height / 2) / 120;
            const sizeRatio = box.width / 120;

            if (sizeRatio < 0.28) {
              isStraightAndCentered = false;
              statusMessage = labels.moveCloser;
            } else if (sizeRatio > 0.76) {
              isStraightAndCentered = false;
              statusMessage = labels.moveBack;
            } else if (Math.abs(cx - 0.5) > 0.14 || Math.abs(cy - 0.48) > 0.16) {
              isStraightAndCentered = false;
              statusMessage = labels.centerFace;
            } else {
              // Check eye alignment landmarks if browser FaceDetector provides them (tekis holat)
              const eyes = (face.landmarks || []).filter((l) => l.type === 'eye' && l.locations?.length);
              if (eyes.length >= 2) {
                const p1 = eyes[0].locations![0];
                const p2 = eyes[1].locations![0];
                const dx = Math.abs(p1.x - p2.x);
                const dy = Math.abs(p1.y - p2.y);
                if (dx > 5 && dy / dx > 0.16) {
                  isStraightAndCentered = false;
                  statusMessage = labels.keepLevel;
                }
              }
            }
          }
        } catch {
          // Keep pixel heuristic fallback if FaceDetector throws
        }
      }

      if (isStraightAndCentered) {
        alignedStreakRef.current = Math.min(REQUIRED_STEADY_TICKS, alignedStreakRef.current + 1);
        const pct = Math.round((alignedStreakRef.current / REQUIRED_STEADY_TICKS) * 100);
        setAlignProgress(pct);
        setGuidance(labels.holdSteady);
        if (alignedStreakRef.current >= REQUIRED_STEADY_TICKS) {
          captureFrameFromVideo();
        }
      } else {
        alignedStreakRef.current = Math.max(0, alignedStreakRef.current - 1);
        setAlignProgress(Math.round((alignedStreakRef.current / REQUIRED_STEADY_TICKS) * 100));
        setGuidance(statusMessage);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cameraActive, value]);

  function handleFileFallback(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 400;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        stopStream();
        setAlignProgress(100);
        setGuidance(labels.verifiedBadge);
        onChange(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  }

  const isVerified = Boolean(value);
  const isAlmostReady = cameraActive && alignProgress >= 25;
  const ringStrokeDashoffset = 283 - (283 * alignProgress) / 100;

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4">
      <div className="text-center space-y-1">
        <div className="text-xs sm:text-sm font-semibold text-slate-900 inline-flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-blue-600" />
          {labels.title}
        </div>
        <p className="text-xs text-slate-600 max-w-md mx-auto">{labels.subtitle}</p>
      </div>

      {/* Circular Face Bubble ("Dumaloq sharikcha") */}
      <div className="relative w-56 h-56 sm:w-60 sm:h-60 mx-auto flex items-center justify-center">
        {/* Progress Ring SVG */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-20" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={isVerified ? '#10B981' : '#E2E8F0'}
            strokeWidth="4"
          />
          {(cameraActive || isVerified) && (
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={isVerified || isAlmostReady ? '#10B981' : '#2563EB'}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray="283"
              strokeDashoffset={isVerified ? 0 : ringStrokeDashoffset}
              className="transition-all duration-200"
            />
          )}
        </svg>

        {/* Inner Circle Container */}
        <div
          className={`w-48 h-48 sm:w-52 sm:h-52 rounded-full overflow-hidden relative flex items-center justify-center transition-all duration-300 ${
            isVerified
              ? 'bg-emerald-50 ring-4 ring-emerald-500/30 border-4 border-emerald-500'
              : cameraActive
              ? isAlmostReady
                ? 'bg-slate-900 ring-4 ring-emerald-400/35 border-4 border-emerald-500'
                : 'bg-slate-900 border-4 border-blue-500'
              : 'bg-white border-2 border-dashed border-slate-300'
          }`}
        >
          {isVerified ? (
            <img
              src={value}
              alt="Tasdiqlangan o‘qituvchi rasmi"
              className="w-full h-full object-cover"
            />
          ) : cameraActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {/* Face alignment oval inside circle */}
              <div
                className={`absolute inset-6 rounded-full border-2 border-dashed pointer-events-none transition-colors duration-300 ${
                  isAlmostReady ? 'border-emerald-400' : 'border-white/75'
                }`}
              />
              {/* Subtle level crosshairs */}
              <div className="absolute inset-x-10 top-1/2 h-px bg-white/25 pointer-events-none" />
            </>
          ) : (
            <button
              type="button"
              onClick={startCamera}
              className="flex flex-col items-center justify-center gap-2 p-4 text-center text-slate-600 hover:text-blue-700 transition-colors"
            >
              <span className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </span>
              <span className="text-xs font-semibold">{labels.startBtn}</span>
            </button>
          )}
        </div>

        {isVerified && (
          <div className="absolute bottom-2 right-4 z-30 w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md border-2 border-white">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Live Status / Guidance */}
      {(cameraActive || isVerified) && (
        <div className="text-center">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              isVerified || isAlmostReady
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-blue-100 text-blue-800'
            }`}
          >
            {isVerified ? labels.verifiedBadge : `${guidance} (${alignProgress}%)`}
          </span>
        </div>
      )}

      {cameraError && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 text-center">
          {cameraError}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {!cameraActive && !isVerified && (
          <button
            type="button"
            onClick={startCamera}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            <Camera className="w-3.5 h-3.5" />
            {labels.startBtn}
          </button>
        )}

        {cameraActive && !isVerified && (
          <button
            type="button"
            onClick={captureFrameFromVideo}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {labels.snapBtn}
          </button>
        )}

        {isVerified && (
          <button
            type="button"
            onClick={startCamera}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {labels.retakeBtn}
          </button>
        )}

        <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer">
          <Upload className="w-3.5 h-3.5" />
          <span>{labels.uploadFallback}</span>
          <input
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileFallback(f);
            }}
          />
        </label>
      </div>
    </div>
  );
}
