import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, BookmarkPlus, Play, RotateCcw } from 'lucide-react';
import type {
  BatchScreenItem,
  BiologicalTarget,
  DrugCandidate,
  ScreeningThresholds,
} from '../types/chemistry';
import { BATCH_PRESET_SMILES } from '../data/seedData';
import { analyzeSmiles, evaluateThresholds } from '../utils/cheminformatics';
import { StatusGlyph } from './StatusGlyph';

interface BatchScreenerViewProps {
  targets: BiologicalTarget[];
  selectedTargetId: string;
  onSelectTarget: (targetId: string) => void;
  thresholds: ScreeningThresholds;
  onInspectSmiles: (candidate: DrugCandidate) => void;
  onShortlistCandidate: (candidate: DrugCandidate) => void;
}

export const BatchScreenerView: React.FC<BatchScreenerViewProps> = ({
  targets,
  selectedTargetId,
  onSelectTarget,
  thresholds,
  onInspectSmiles,
  onShortlistCandidate,
}) => {
  const [batchText, setBatchText] = useState(BATCH_PRESET_SMILES);
  const [aiResults, setAiResults] = useState<Record<string, BatchScreenItem['aiScore']>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyFilterPass, setOnlyFilterPass] = useState(false);
  const [promotedIds, setPromotedIds] = useState<Record<string, boolean>>({});

  const activeTarget = useMemo(
    () => targets.find((t) => t.id === selectedTargetId) ?? targets[0],
    [targets, selectedTargetId]
  );

  const parsedItems: BatchScreenItem[] = useMemo(() => {
    const lines = batchText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    return lines.map((line, index) => {
      const parts = line.split(/[,\t]/).map((p) => p.trim());
      const smiles = parts[0] || '';
      const name = parts[1] || `Batch-${String(index + 1).padStart(2, '0')}`;
      const id = `batch-${index}-${smiles.slice(0, 12)}`;

      const parsed = analyzeSmiles(smiles);
      if (!parsed.valid || !parsed.descriptors) {
        return {
          id,
          name,
          smiles,
          valid: false,
          error: parsed.error || 'Invalid SMILES',
          passesFilter: false,
          filterReasons: ['Invalid SMILES'],
        };
      }

      const evalResult = evaluateThresholds(parsed.descriptors, thresholds);
      return {
        id,
        name,
        smiles: parsed.descriptors.canonicalSmiles,
        valid: true,
        descriptors: parsed.descriptors,
        passesFilter: evalResult.pass,
        filterReasons: evalResult.reasons,
        aiScore: aiResults[id],
      };
    });
  }, [batchText, thresholds, aiResults]);

  const validItems = useMemo(() => parsedItems.filter((i) => i.valid), [parsedItems]);
  const passingItems = useMemo(
    () => parsedItems.filter((i) => i.valid && i.passesFilter),
    [parsedItems]
  );

  const displayedItems = useMemo(() => {
    const base = onlyFilterPass ? passingItems : parsedItems;
    return [...base].sort((a, b) => {
      const aScore = a.aiScore?.predictedPic50 ?? (a.descriptors?.qedScore ?? 0);
      const bScore = b.aiScore?.predictedPic50 ?? (b.descriptors?.qedScore ?? 0);
      return bScore - aScore;
    });
  }, [parsedItems, passingItems, onlyFilterPass]);

  const handleRunBatchAi = async () => {
    const targetsToScreen = validItems.slice(0, 25);
    if (targetsToScreen.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/screen-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: targetsToScreen.map((item) => ({
            id: item.id,
            name: item.name,
            smiles: item.smiles,
            descriptors: item.descriptors,
          })),
          targetName: activeTarget.name,
          therapeuticArea: activeTarget.therapeuticArea,
          bbbRequired: activeTarget.bbbRequired,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || `Batch screening failed (${response.status}).`);
      }

      const nextMap: Record<string, BatchScreenItem['aiScore']> = { ...aiResults };
      if (Array.isArray(payload.results)) {
        for (const r of payload.results) {
          nextMap[r.id] = {
            predictedPic50: Number(r.predictedPic50),
            toxicityRisk: r.toxicityRisk,
            recommendation: r.recommendation,
            rationale: r.rationale,
          };
        }
      }
      setAiResults(nextMap);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to complete batch AI screening.');
    } finally {
      setLoading(false);
    }
  };

  const toDrugCandidate = (item: BatchScreenItem, status: DrugCandidate['status']): DrugCandidate => ({
    id: `cand-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: item.name,
    smiles: item.smiles,
    targetId: activeTarget.id,
    status,
    source: 'Batch Screen',
    addedAt: new Date().toISOString(),
    notes: item.aiScore?.rationale,
    descriptors: item.descriptors,
  });

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-5">
      <div className="bg-white border border-slate-200 rounded-md p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              High-Throughput SMILES Batch Screener
            </h1>
            <p className="text-sm text-slate-600 mt-0.5 max-w-2xl">
              Paste multiple SMILES strings (format: <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">SMILES, Name</code>) to compute exact physicochemical descriptors, filter against Lipinski/Veber bounds, and rank hits with AI target triage.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <select
              aria-label="Target biological receptor"
              value={activeTarget.id}
              onChange={(e) => {
                onSelectTarget(e.target.value);
                setAiResults({});
              }}
              className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-cyan-600"
            >
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={validItems.length === 0 || loading}
              onClick={handleRunBatchAi}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 disabled:bg-slate-300 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{loading ? 'Screening Batch...' : `Run AI Triage (${Math.min(validItems.length, 25)})`}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 pt-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="batch-smiles-input"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Candidate SMILES Batch Input
              </label>
              <button
                type="button"
                onClick={() => {
                  setBatchText(BATCH_PRESET_SMILES);
                  setAiResults({});
                }}
                className="inline-flex items-center gap-1 text-xs text-cyan-700 hover:text-cyan-900 font-medium cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>Load Preset Library</span>
              </button>
            </div>
            <textarea
              id="batch-smiles-input"
              rows={6}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              spellCheck={false}
              placeholder="CC(=O)Oc1ccccc1C(=O)O, Aspirin"
              className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-cyan-600"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Deterministic Triage Summary
              </h2>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-600">Submitted Lines</dt>
                  <dd className="font-mono tabular-nums font-semibold text-slate-900">
                    {parsedItems.length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Valid Molecular Graphs</dt>
                  <dd className="font-mono tabular-nums font-semibold text-slate-900">
                    {validItems.length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Pass Active Filter Bounds</dt>
                  <dd className="font-mono tabular-nums font-semibold text-emerald-700">
                    {passingItems.length}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Max MW / cLogP / QED</dt>
                  <dd className="font-mono tabular-nums text-slate-700">
                    {thresholds.maxMw} / {thresholds.maxLogP.toFixed(1)} / {thresholds.minQed.toFixed(2)}
                  </dd>
                </div>
              </dl>
            </div>

            <label className="flex items-center gap-2 pt-3 border-t border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyFilterPass}
                onChange={(e) => setOnlyFilterPass(e.target.checked)}
                className="accent-cyan-700 rounded cursor-pointer"
              />
              <span>Show only filter-passing hits</span>
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Screened Molecules ({displayedItems.length})
          </h2>
          <span className="text-xs text-slate-400">
            Sorted by AI pIC50 / QED Drug-Likeness
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-4 font-medium">Candidate</th>
                <th className="py-2.5 px-3 font-medium">Formula</th>
                <th className="py-2.5 px-3 font-medium text-right">MW</th>
                <th className="py-2.5 px-3 font-medium text-right">cLogP</th>
                <th className="py-2.5 px-3 font-medium text-right">TPSA</th>
                <th className="py-2.5 px-3 font-medium text-right">QED</th>
                <th className="py-2.5 px-3 font-medium">Property Filter</th>
                <th className="py-2.5 px-3 font-medium text-right">AI pIC50</th>
                <th className="py-2.5 px-3 font-medium">Tox Risk</th>
                <th className="py-2.5 px-3 font-medium">Triage</th>
                <th className="py-2.5 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {displayedItems.map((item) => {
                const d = item.descriptors;
                const isPromoted = promotedIds[item.id];
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      <div className="text-[11px] font-mono text-slate-400 max-w-[200px] truncate">
                        {item.smiles}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                      {d?.formula ?? '—'}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-right text-slate-700">
                      {d ? d.molecularWeight.toFixed(1) : '—'}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-right text-slate-700">
                      {d ? d.cLogP.toFixed(2) : '—'}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-right text-slate-700">
                      {d ? d.tpsa.toFixed(1) : '—'}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-right font-medium text-cyan-800">
                      {d ? d.qedScore.toFixed(2) : '—'}
                    </td>
                    <td className="py-3 px-3">
                      {!item.valid ? (
                        <StatusGlyph tone="bad" label="Syntax Error" />
                      ) : item.passesFilter ? (
                        <StatusGlyph tone="good" label="Pass" />
                      ) : (
                        <span title={item.filterReasons.join(', ')}>
                          <StatusGlyph tone="warn" label={item.filterReasons[0] || 'Out-of-Bounds'} />
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-right font-semibold text-slate-900">
                      {item.aiScore ? item.aiScore.predictedPic50.toFixed(2) : '—'}
                    </td>
                    <td className="py-3 px-3">
                      {item.aiScore ? (
                        <StatusGlyph
                          tone={
                            item.aiScore.toxicityRisk === 'Low'
                              ? 'good'
                              : item.aiScore.toxicityRisk === 'Moderate'
                                ? 'warn'
                                : 'bad'
                          }
                          label={item.aiScore.toxicityRisk}
                        />
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 max-w-[220px]">
                      {item.aiScore ? (
                        <div>
                          <div className="font-semibold text-slate-800">
                            {item.aiScore.recommendation}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-2">
                            {item.aiScore.rationale}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Pending AI triage</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {item.valid && (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onInspectSmiles(toDrugCandidate(item, 'Screened'))}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded cursor-pointer"
                          >
                            <span>Inspect</span>
                            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={isPromoted}
                            onClick={() => {
                              onShortlistCandidate(toDrugCandidate(item, 'Shortlisted'));
                              setPromotedIds((prev) => ({ ...prev, [item.id]: true }));
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 disabled:opacity-50 rounded cursor-pointer"
                          >
                            <BookmarkPlus className="w-3 h-3" aria-hidden="true" />
                            <span>{isPromoted ? 'Shortlisted' : 'Shortlist'}</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
