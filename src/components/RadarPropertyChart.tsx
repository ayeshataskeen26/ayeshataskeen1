import React from 'react';
import type { MolecularDescriptors, ScreeningThresholds } from '../types/chemistry';

interface RadarPropertyChartProps {
  descriptors: MolecularDescriptors | null;
  thresholds: ScreeningThresholds;
}

interface AxisSpec {
  label: string;
  boundLabel: string;
  value: number;
  limit: number;
  normalized: number; // 0..1 where 0.72 represents the threshold boundary
}

export const RadarPropertyChart: React.FC<RadarPropertyChartProps> = ({
  descriptors,
  thresholds,
}) => {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 82;

  const axes: AxisSpec[] = descriptors
    ? [
        {
          label: 'MW',
          boundLabel: `${thresholds.maxMw}`,
          value: descriptors.molecularWeight,
          limit: thresholds.maxMw,
          normalized: Math.min(1, (descriptors.molecularWeight / Math.max(thresholds.maxMw, 1)) * 0.72),
        },
        {
          label: 'cLogP',
          boundLabel: `${thresholds.maxLogP}`,
          value: Math.max(0, descriptors.cLogP),
          limit: thresholds.maxLogP,
          normalized: Math.min(1, (Math.max(0, descriptors.cLogP) / Math.max(thresholds.maxLogP, 0.5)) * 0.72),
        },
        {
          label: 'TPSA',
          boundLabel: `${thresholds.maxTpsa}`,
          value: descriptors.tpsa,
          limit: thresholds.maxTpsa,
          normalized: Math.min(1, (descriptors.tpsa / Math.max(thresholds.maxTpsa, 1)) * 0.72),
        },
        {
          label: 'HBD',
          boundLabel: `${thresholds.maxHbd}`,
          value: descriptors.hbd,
          limit: thresholds.maxHbd,
          normalized: Math.min(1, (descriptors.hbd / Math.max(thresholds.maxHbd, 1)) * 0.72),
        },
        {
          label: 'HBA',
          boundLabel: `${thresholds.maxHba}`,
          value: descriptors.hba,
          limit: thresholds.maxHba,
          normalized: Math.min(1, (descriptors.hba / Math.max(thresholds.maxHba, 1)) * 0.72),
        },
        {
          label: 'ROT',
          boundLabel: `${thresholds.maxRotBonds}`,
          value: descriptors.rotatableBonds,
          limit: thresholds.maxRotBonds,
          normalized: Math.min(1, (descriptors.rotatableBonds / Math.max(thresholds.maxRotBonds, 1)) * 0.72),
        },
      ]
    : [
        { label: 'MW', boundLabel: `${thresholds.maxMw}`, value: 0, limit: thresholds.maxMw, normalized: 0 },
        { label: 'cLogP', boundLabel: `${thresholds.maxLogP}`, value: 0, limit: thresholds.maxLogP, normalized: 0 },
        { label: 'TPSA', boundLabel: `${thresholds.maxTpsa}`, value: 0, limit: thresholds.maxTpsa, normalized: 0 },
        { label: 'HBD', boundLabel: `${thresholds.maxHbd}`, value: 0, limit: thresholds.maxHbd, normalized: 0 },
        { label: 'HBA', boundLabel: `${thresholds.maxHba}`, value: 0, limit: thresholds.maxHba, normalized: 0 },
        { label: 'ROT', boundLabel: `${thresholds.maxRotBonds}`, value: 0, limit: thresholds.maxRotBonds, normalized: 0 },
      ];

  const angleStep = (Math.PI * 2) / axes.length;

  const getPoint = (idx: number, ratio: number) => {
    const angle = -Math.PI / 2 + idx * angleStep;
    return {
      x: cx + Math.cos(angle) * maxRadius * ratio,
      y: cy + Math.sin(angle) * maxRadius * ratio,
    };
  };

  const ringLevels = [0.25, 0.5, 0.72, 1.0];

  const candidatePolygon = axes
    .map((axis, idx) => {
      const pt = getPoint(idx, Math.max(0.06, axis.normalized));
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');

  const thresholdPolygon = axes
    .map((_, idx) => {
      const pt = getPoint(idx, 0.72);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="bg-white border border-slate-200 rounded-md p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Physicochemical Envelope
        </h3>
        <span className="text-[11px] font-mono text-slate-400">
          Dashed: Filter Limit
        </span>
      </div>

      <div className="flex items-center justify-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full max-w-[260px] h-auto"
          role="img"
          aria-label="Physicochemical property radar chart"
        >
          {ringLevels.map((level) => {
            const pts = axes
              .map((_, idx) => {
                const pt = getPoint(idx, level);
                return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
              })
              .join(' ');
            const isLimit = level === 0.72;
            return (
              <polygon
                key={level}
                points={pts}
                fill="none"
                stroke={isLimit ? '#94a3b8' : '#e2e8f0'}
                strokeWidth={isLimit ? 1.25 : 1}
                strokeDasharray={isLimit ? '3 3' : undefined}
              />
            );
          })}

          {axes.map((axis, idx) => {
            const outer = getPoint(idx, 1);
            const labelPt = getPoint(idx, 1.23);
            return (
              <g key={axis.label}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
                <text
                  x={labelPt.x}
                  y={labelPt.y - 4}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-700 text-[10px] font-mono font-semibold"
                >
                  {axis.label}
                </text>
                <text
                  x={labelPt.x}
                  y={labelPt.y + 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-slate-400 text-[9px] font-mono tabular-nums"
                >
                  ≤{axis.boundLabel}
                </text>
              </g>
            );
          })}

          <polygon
            points={thresholdPolygon}
            fill="none"
            stroke="#64748b"
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          {descriptors && (
            <>
              <polygon
                points={candidatePolygon}
                fill="rgba(6, 182, 212, 0.18)"
                stroke="#0891b2"
                strokeWidth={2}
              />
              {axes.map((axis, idx) => {
                const pt = getPoint(idx, Math.max(0.06, axis.normalized));
                const overLimit = axis.value > axis.limit;
                return (
                  <circle
                    key={axis.label}
                    cx={pt.x}
                    cy={pt.y}
                    r={3.2}
                    fill={overLimit ? '#e11d48' : '#0891b2'}
                    stroke="#ffffff"
                    strokeWidth={1.2}
                  />
                );
              })}
            </>
          )}
        </svg>
      </div>
    </div>
  );
};
