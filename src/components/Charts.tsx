import React from 'react';
import type { Lang } from '../types/lms.ts';
import { t } from '../i18n/translations.ts';

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
  sublabel?: string;
}

export function SubjectBarChart({
  data,
  maxValue = 100,
  unit = '%',
  lang = 'uz',
}: {
  data: ChartDatum[];
  maxValue?: number;
  unit?: string;
  lang?: Lang;
}) {
  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        {t(lang, 'chartNoData')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const pct = Math.max(0, Math.min(100, (item.value / maxValue) * 100));
        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-slate-700 truncate min-w-0 flex-1">{item.label}</span>
              <span className="font-mono-num font-semibold text-slate-900 shrink-0">
                {item.value}
                {unit}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color || '#2563EB',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PerformanceLineChart({
  points,
  accentColor = '#2563EB',
  lang = 'uz',
}: {
  points: Array<{ label: string; value: number }>;
  accentColor?: string;
  lang?: Lang;
}) {
  if (points.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">
        {t(lang, 'chartWaitResults')}
      </div>
    );
  }

  const width = 520;
  const height = 180;
  const padX = 32;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = points.map((p, idx) => {
    const x = points.length === 1 ? padX + innerW / 2 : padX + (idx / (points.length - 1)) * innerW;
    const y = padY + innerH - (Math.max(0, Math.min(100, p.value)) / 100) * innerH;
    return { ...p, x, y };
  });

  const linePath = coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`
      : '';

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-48">
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = padY + innerH - (tick / 100) * innerH;
          return (
            <g key={tick}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#E2E8F0" strokeDasharray="3 3" />
              <text x={4} y={y + 4} fontSize="10" fill="#64748B" className="font-mono-num">
                {tick}
              </text>
            </g>
          );
        })}

        {areaPath && <path d={areaPath} fill={accentColor} fillOpacity="0.08" />}
        {coords.length > 1 && (
          <path d={linePath} fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" />
        )}

        {coords.map((c, idx) => (
          <g key={`${c.label}-${idx}`}>
            <circle cx={c.x} cy={c.y} r="4.5" fill="#FFFFFF" stroke={accentColor} strokeWidth="2.5" />
            <text
              x={c.x}
              y={height - 4}
              textAnchor="middle"
              fontSize="10"
              fill="#64748B"
              className="font-mono-num"
            >
              {c.label.slice(0, 8)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function HomeworkBreakdownBar({
  approved,
  pending,
  revisionNeeded,
  notSubmitted,
  lang = 'uz',
}: {
  approved: number;
  pending: number;
  revisionNeeded: number;
  notSubmitted: number;
  lang?: Lang;
}) {
  const total = Math.max(1, approved + pending + revisionNeeded + notSubmitted);
  const segs = [
    { label: t(lang, 'approvedStatus'), count: approved, color: '#059669' },
    { label: t(lang, 'pendingStatus'), count: pending, color: '#D97706' },
    { label: t(lang, 'chartRevisionShort'), count: revisionNeeded, color: '#DC2626' },
    { label: t(lang, 'notSubmittedStatus'), count: notSubmitted, color: '#CBD5E1' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {segs.map((s) =>
          s.count > 0 ? (
            <div
              key={s.label}
              style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
              title={`${s.label}: ${s.count}`}
            />
          ) : null
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        {segs.map((s) => (
          <div key={s.label} className="flex items-center justify-between border border-slate-200 rounded-lg px-2.5 py-2">
            <span className="text-slate-600 truncate">{s.label}</span>
            <span className="font-mono-num font-semibold text-slate-900 ml-2">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
