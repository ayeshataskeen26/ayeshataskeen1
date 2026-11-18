import React, { useState } from 'react';
import { Check, Copy, Hash, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { MolecularDescriptors } from '../types/chemistry';
import { formatFormulaParts } from '../utils/cheminformatics';

interface StructureViewportProps {
  compoundName: string;
  descriptors: MolecularDescriptors | null;
  parseError?: string;
  showAtomNumbers: boolean;
  onToggleAtomNumbers: () => void;
}

export const StructureViewport: React.FC<StructureViewportProps> = ({
  compoundName,
  descriptors,
  parseError,
  showAtomNumbers,
  onToggleAtomNumbers,
}) => {
  const [zoom, setZoom] = useState(1);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: Math.round(e.clientX - rect.left),
      y: Math.round(e.clientY - rect.top),
    });
  };

  const handleCopySmiles = async () => {
    if (!descriptors?.canonicalSmiles) return;
    try {
      await navigator.clipboard.writeText(descriptors.canonicalSmiles);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const formulaParts = descriptors ? formatFormulaParts(descriptors.formula) : [];

  return (
    <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 truncate">
            {compoundName || 'Untitled Molecule'}
          </h2>
          {descriptors && (
            <span className="text-xs font-mono text-slate-600 tabular-nums shrink-0">
              {formulaParts.map((part, idx) =>
                part.isSub ? (
                  <sub key={idx} className="text-[10px]">
                    {part.text}
                  </sub>
                ) : (
                  <span key={idx}>{part.text}</span>
                )
              )}
            </span>
          )}
          {descriptors && (
            <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0 hidden sm:inline">
              Exact Mass {descriptors.exactMass.toFixed(4)} Da
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleAtomNumbers}
            aria-pressed={showAtomNumbers}
            title="Toggle Atom Indices"
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showAtomNumbers
                ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Hash className="w-3 h-3" aria-hidden="true" />
            <span>Indices</span>
          </button>

          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
            aria-label="Zoom out structure"
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded transition-colors cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.8, Number((z + 0.15).toFixed(2))))}
            aria-label="Zoom in structure"
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded transition-colors cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setZoom(1)}
            aria-label="Reset zoom"
            className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setCoords(null)}
        className="relative h-[300px] lab-grid-bg flex items-center justify-center overflow-hidden cursor-crosshair select-none"
      >
        {descriptors ? (
          <div
            className="mol-svg-container w-full h-full p-6 flex items-center justify-center transition-transform duration-150 ease-out"
            style={{ transform: `scale(${zoom})` }}
            dangerouslySetInnerHTML={{ __html: descriptors.svgMarkup }}
          />
        ) : (
          <div className="px-6 text-center max-w-md">
            <p className="text-sm font-medium text-rose-700">
              {parseError || 'Invalid SMILES notation'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Verify ring closure digits, balanced parentheses, and valid organic valence.
            </p>
          </div>
        )}

        {descriptors && (
          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none">
            <span className="text-[11px] font-mono text-slate-400 tabular-nums bg-white/85 px-1.5 py-0.5 border border-slate-200/80 rounded">
              {descriptors.heavyAtomCount} heavy atoms · {descriptors.bondCount} bonds ·{' '}
              {descriptors.ringCount} rings ({descriptors.aromaticRingCount} arom)
            </span>
            <span className="text-[11px] font-mono text-slate-400 tabular-nums bg-white/85 px-1.5 py-0.5 border border-slate-200/80 rounded">
              {coords ? `X:${coords.x} Y:${coords.y}` : `${Math.round(zoom * 100)}%`}
            </span>
          </div>
        )}
      </div>

      {descriptors && (
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 shrink-0">
              Canonical
            </span>
            <code className="text-xs font-mono text-slate-700 truncate">
              {descriptors.canonicalSmiles}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopySmiles}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" aria-hidden="true" />
                <span>Copy SMILES</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
