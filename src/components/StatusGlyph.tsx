import React from 'react';

interface StatusGlyphProps {
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  label: string;
}

export const StatusGlyph: React.FC<StatusGlyphProps> = ({ tone, label }) => {
  const styles: Record<StatusGlyphProps['tone'], { glyph: string; cls: string }> = {
    good: { glyph: '●', cls: 'text-emerald-700' },
    warn: { glyph: '▲', cls: 'text-amber-700' },
    bad: { glyph: '✖', cls: 'text-rose-700' },
    neutral: { glyph: '○', cls: 'text-slate-600' },
  };
  const cfg = styles[tone];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${cfg.cls}`}>
      <span aria-hidden="true" className="text-[10px] leading-none">
        {cfg.glyph}
      </span>
      <span>{label}</span>
    </span>
  );
};
