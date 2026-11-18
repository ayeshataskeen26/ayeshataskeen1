import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Search, Trash2 } from 'lucide-react';
import type { BiologicalTarget, CandidateStatus, DrugCandidate } from '../types/chemistry';
import { StatusGlyph } from './StatusGlyph';

interface CandidateLibraryViewProps {
  candidates: DrugCandidate[];
  targets: BiologicalTarget[];
  onInspectCandidate: (candidate: DrugCandidate) => void;
  onUpdateStatus: (candidateId: string, status: CandidateStatus) => void;
  onDeleteCandidate: (candidateId: string) => void;
}

const STATUS_TABS: Array<'All' | CandidateStatus> = [
  'All',
  'Shortlisted',
  'In Assay',
  'Advancing',
  'Screened',
  'Rejected',
];

export const CandidateLibraryView: React.FC<CandidateLibraryViewProps> = ({
  candidates,
  targets,
  onInspectCandidate,
  onUpdateStatus,
  onDeleteCandidate,
}) => {
  const [statusFilter, setStatusFilter] = useState<'All' | CandidateStatus>('All');
  const [targetFilter, setTargetFilter] = useState<string>('all');
  const [query, setQuery] = useState('');

  const targetMap = useMemo(() => {
    const map = new Map<string, BiologicalTarget>();
    for (const t of targets) map.set(t.id, t);
    return map;
  }, [targets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((c) => {
      if (statusFilter !== 'All' && c.status !== statusFilter) return false;
      if (targetFilter !== 'all' && c.targetId !== targetFilter) return false;
      if (q) {
        const matchName = c.name.toLowerCase().includes(q);
        const matchSmiles = c.smiles.toLowerCase().includes(q);
        const matchFormula = c.descriptors?.formula.toLowerCase().includes(q);
        if (!matchName && !matchSmiles && !matchFormula) return false;
      }
      return true;
    });
  }, [candidates, statusFilter, targetFilter, query]);

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-5">
      <div className="bg-white border border-slate-200 rounded-md p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Candidate Review & Pipeline Library
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Review shortlisted compounds, evaluate structure-property compliance, and advance hits into experimental assays.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by name, SMILES, formula..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 w-60 focus:outline-none focus:border-cyan-600"
              />
            </div>

            <select
              aria-label="Filter by biological target"
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-cyan-600"
            >
              <option value="all">All Targets</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Interactive Segmented Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-md w-fit">
          {STATUS_TABS.map((tab) => {
            const count =
              tab === 'All'
                ? candidates.length
                : candidates.filter((c) => c.status === tab).length;
            const active = statusFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Candidate Cards Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-md p-10 text-center text-sm text-slate-500">
          No drug candidates match the current pipeline filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((cand) => {
            const target = targetMap.get(cand.targetId);
            const d = cand.descriptors;
            return (
              <article
                key={cand.id}
                className="bg-white border border-slate-200 rounded-md p-4 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-slate-900 truncate">
                        {cand.name}
                      </h2>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {target?.name ?? 'Unassigned Target'} · {cand.source}
                      </div>
                    </div>
                    <StatusGlyph
                      tone={
                        cand.status === 'Advancing' || cand.status === 'Shortlisted'
                          ? 'good'
                          : cand.status === 'Rejected'
                            ? 'bad'
                            : cand.status === 'In Assay'
                              ? 'warn'
                              : 'neutral'
                      }
                      label={cand.status}
                    />
                  </div>

                  {d && (
                    <div className="h-36 lab-grid-bg border border-slate-200 rounded flex items-center justify-center p-2 overflow-hidden">
                      <div
                        className="mol-svg-container w-full h-full flex items-center justify-center"
                        dangerouslySetInnerHTML={{ __html: d.svgMarkup }}
                      />
                    </div>
                  )}

                  {d && (
                    <div className="grid grid-cols-4 gap-2 pt-1 text-xs">
                      <div>
                        <div className="text-[10px] font-mono uppercase text-slate-400">MW</div>
                        <div className="font-mono tabular-nums font-medium text-slate-900">
                          {d.molecularWeight.toFixed(1)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase text-slate-400">cLogP</div>
                        <div className="font-mono tabular-nums font-medium text-slate-900">
                          {d.cLogP.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase text-slate-400">TPSA</div>
                        <div className="font-mono tabular-nums font-medium text-slate-900">
                          {d.tpsa.toFixed(0)} Å²
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono uppercase text-slate-400">QED</div>
                        <div className="font-mono tabular-nums font-semibold text-cyan-700">
                          {d.qedScore.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}

                  {cand.notes && (
                    <p className="text-xs text-slate-600 line-clamp-2">{cand.notes}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                  <select
                    aria-label={`Change pipeline status for ${cand.name}`}
                    value={cand.status}
                    onChange={(e) => onUpdateStatus(cand.id, e.target.value as CandidateStatus)}
                    className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-800 focus:outline-none focus:border-cyan-600"
                  >
                    <option value="Screened">Screened</option>
                    <option value="Shortlisted">Shortlisted</option>
                    <option value="In Assay">In Assay</option>
                    <option value="Advancing">Advancing</option>
                    <option value="Rejected">Rejected</option>
                  </select>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onDeleteCandidate(cand.id)}
                      aria-label={`Remove ${cand.name}`}
                      className="p-1.5 text-slate-400 hover:text-rose-700 border border-transparent hover:border-rose-200 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onInspectCandidate(cand)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Workbench</span>
                      <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
