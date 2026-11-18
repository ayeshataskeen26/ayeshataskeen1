import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, BookmarkPlus, FlaskConical, Play, RotateCcw } from 'lucide-react';
import type {
  AiPredictionResult,
  BiologicalTarget,
  CandidateStatus,
  DrugCandidate,
  MolecularDescriptors,
  ScreeningThresholds,
} from '../types/chemistry';
import { analyzeSmiles, evaluateThresholds } from '../utils/cheminformatics';
import { DEFAULT_THRESHOLDS } from '../data/seedData';
import { RadarPropertyChart } from './RadarPropertyChart';
import { StatusGlyph } from './StatusGlyph';
import { StructureViewport } from './StructureViewport';

interface WorkbenchViewProps {
  targets: BiologicalTarget[];
  selectedTargetId: string;
  onSelectTarget: (targetId: string) => void;
  candidates: DrugCandidate[];
  activeCandidateId: string | null;
  onSelectCandidate: (candidate: DrugCandidate) => void;
  onSaveCandidate: (candidate: DrugCandidate) => void;
  onUpdateStatus: (candidateId: string, status: CandidateStatus) => void;
  onSaveAiPrediction: (candidateId: string, prediction: AiPredictionResult) => void;
  thresholds: ScreeningThresholds;
  onChangeThresholds: (next: ScreeningThresholds) => void;
}

const SCAFFOLD_SNIPPETS: Array<{ label: string; smiles: string; name: string }> = [
  { label: 'Aspirin', name: 'Aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O' },
  { label: 'Caffeine', name: 'Caffeine', smiles: 'Cn1cnc2c1c(=O)n(C)c(=O)n2C' },
  { label: 'Erlotinib', name: 'Erlotinib', smiles: 'COc1cc2ncnc(Nc3cccc(C#C)c3)c2cc1OCCOC' },
  { label: 'Nirmatrelvir', name: 'Nirmatrelvir', smiles: 'CC1(C)[C@@H]2[C@@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)C(F)(F)F)C(=O)N[C@@H](CC1CCNC1=O)C#N' },
];

export const WorkbenchView: React.FC<WorkbenchViewProps> = ({
  targets,
  selectedTargetId,
  onSelectTarget,
  candidates,
  activeCandidateId,
  onSelectCandidate,
  onSaveCandidate,
  onUpdateStatus,
  onSaveAiPrediction,
  thresholds,
  onChangeThresholds,
}) => {
  const activeTarget = useMemo(
    () => targets.find((t) => t.id === selectedTargetId) ?? targets[0],
    [targets, selectedTargetId]
  );

  const activeCandidate = useMemo(
    () => candidates.find((c) => c.id === activeCandidateId) ?? null,
    [candidates, activeCandidateId]
  );

  const [compoundName, setCompoundName] = useState<string>(
    activeCandidate?.name ?? 'Erlotinib'
  );
  const [smilesInput, setSmilesInput] = useState<string>(
    activeCandidate?.smiles ?? 'COc1cc2ncnc(Nc3cccc(C#C)c3)c2cc1OCCOC'
  );
  const [showAtomNumbers, setShowAtomNumbers] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [localPrediction, setLocalPrediction] = useState<AiPredictionResult | null>(
    activeCandidate?.aiPrediction ?? null
  );
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Sync editor when user clicks a candidate from table or library
  const loadMoleculeIntoEditor = (name: string, smiles: string, existingPrediction?: AiPredictionResult) => {
    setCompoundName(name);
    setSmilesInput(smiles);
    setAiError(null);
    setLocalPrediction(existingPrediction ?? null);
  };

  const parsed = useMemo(
    () => analyzeSmiles(smilesInput, { showAtomNumbers }),
    [smilesInput, showAtomNumbers]
  );

  const descriptors: MolecularDescriptors | null = parsed.valid ? parsed.descriptors ?? null : null;

  const thresholdEval = useMemo(() => {
    if (!descriptors) return null;
    return evaluateThresholds(descriptors, thresholds);
  }, [descriptors, thresholds]);

  const displayedPrediction = useMemo(() => {
    if (localPrediction && localPrediction.targetId === activeTarget.id) {
      return localPrediction;
    }
    if (
      activeCandidate &&
      activeCandidate.smiles === smilesInput.trim() &&
      activeCandidate.aiPrediction &&
      activeCandidate.aiPrediction.targetId === activeTarget.id
    ) {
      return activeCandidate.aiPrediction;
    }
    return null;
  }, [localPrediction, activeCandidate, smilesInput, activeTarget.id]);

  const handleRunAiAnalysis = async () => {
    if (!descriptors) return;
    setAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch('/api/analyze-molecule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smiles: descriptors.canonicalSmiles,
          name: compoundName.trim() || 'Unnamed Candidate',
          targetName: activeTarget.name,
          targetPdb: activeTarget.pdbId,
          therapeuticArea: activeTarget.therapeuticArea,
          bbbRequired: activeTarget.bbbRequired,
          descriptors,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || `Prediction request failed (${response.status}).`);
      }

      const result: AiPredictionResult = {
        ...payload,
        analyzedAt: new Date().toISOString(),
        targetId: activeTarget.id,
      };
      setLocalPrediction(result);

      if (activeCandidate && activeCandidate.smiles === smilesInput.trim()) {
        onSaveAiPrediction(activeCandidate.id, result);
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Unable to reach AI prediction service.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveToLibrary = (targetStatus: CandidateStatus = 'Shortlisted') => {
    if (!descriptors) return;
    const cleanName = compoundName.trim() || `Compound-${descriptors.formula}`;
    const existing = candidates.find(
      (c) =>
        c.descriptors?.canonicalSmiles === descriptors.canonicalSmiles &&
        c.targetId === activeTarget.id
    );

    if (existing) {
      onUpdateStatus(existing.id, targetStatus);
      if (displayedPrediction) {
        onSaveAiPrediction(existing.id, displayedPrediction);
      }
      setSaveFeedback(`Updated ${existing.name} to ${targetStatus}`);
    } else {
      const newCandidate: DrugCandidate = {
        id: `cand-${Date.now()}`,
        name: cleanName,
        smiles: descriptors.canonicalSmiles,
        targetId: activeTarget.id,
        status: targetStatus,
        source: 'Manual Entry',
        addedAt: new Date().toISOString(),
        descriptors,
        aiPrediction: displayedPrediction ?? undefined,
      };
      onSaveCandidate(newCandidate);
      onSelectCandidate(newCandidate);
      setSaveFeedback(`Saved ${cleanName} as ${targetStatus}`);
    }
    setTimeout(() => setSaveFeedback(null), 2600);
  };

  const handleAppendGroup = (groupSmiles: string, label: string) => {
    const trimmed = smilesInput.trim();
    if (!trimmed) return;
    // Append substituent cleanly to end of chain/ring if valid, otherwise try wrapping branch
    const attemptDirect = `${trimmed}${groupSmiles}`;
    const checkDirect = analyzeSmiles(attemptDirect);
    if (checkDirect.valid) {
      setSmilesInput(attemptDirect);
      setCompoundName((prev) => (prev.includes('+') ? prev : `${prev} (${label})`));
      setLocalPrediction(null);
      return;
    }
    const attemptBranch = `${trimmed}(${groupSmiles})`;
    const checkBranch = analyzeSmiles(attemptBranch);
    if (checkBranch.valid) {
      setSmilesInput(attemptBranch);
      setCompoundName((prev) => (prev.includes('+') ? prev : `${prev} (${label})`));
      setLocalPrediction(null);
    }
  };

  const targetCandidates = useMemo(
    () => candidates.filter((c) => c.targetId === activeTarget.id),
    [candidates, activeTarget.id]
  );

  const riskTone = (risk: 'Low' | 'Moderate' | 'High'): 'good' | 'warn' | 'bad' => {
    if (risk === 'Low') return 'good';
    if (risk === 'Moderate') return 'warn';
    return 'bad';
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-5">
      {/* Top Target Telemetry Ribbon */}
      <div className="bg-white border border-slate-200 rounded-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono uppercase tracking-wider text-slate-400">Project</span>
            <span className="font-semibold text-slate-900">{activeTarget.projectTitle}</span>
          </div>
          <span className="text-slate-300" aria-hidden="true">/</span>
          <div className="flex items-center gap-2">
            <span className="font-mono uppercase tracking-wider text-slate-400">Target</span>
            <span className="font-medium text-slate-800">{activeTarget.name}</span>
          </div>
          <span className="text-slate-300" aria-hidden="true">/</span>
          <div className="font-mono text-slate-600 tabular-nums">
            PDB {activeTarget.pdbId} · UniProt {activeTarget.uniprotId}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="font-mono text-slate-600 tabular-nums">
            Potency Goal: pIC50 ≥ {activeTarget.targetPic50Threshold.toFixed(1)}
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <StatusGlyph
            tone={activeTarget.bbbRequired ? 'warn' : 'neutral'}
            label={activeTarget.bbbRequired ? 'CNS BBB Required' : 'Peripheral Target'}
          />
        </div>
      </div>

      {/* Asymmetric Split Console */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">
        {/* Left Control & Parameter Column */}
        <aside className="bg-white border border-slate-200 rounded-md p-4 space-y-5">
          <div>
            <label
              htmlFor="target-select"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Biological Target
            </label>
            <select
              id="target-select"
              value={activeTarget.id}
              onChange={(e) => {
                onSelectTarget(e.target.value);
                setLocalPrediction(null);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-cyan-600"
            >
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.name} ({target.therapeuticArea})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="compound-name"
                className="text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Structure Input (SMILES)
              </label>
              <button
                type="button"
                onClick={() =>
                  loadMoleculeIntoEditor(
                    'Erlotinib',
                    'COc1cc2ncnc(Nc3cccc(C#C)c3)c2cc1OCCOC'
                  )
                }
                className="text-xs text-cyan-700 hover:text-cyan-900 font-medium cursor-pointer"
              >
                Reset sample
              </button>
            </div>

            <input
              id="compound-name"
              type="text"
              value={compoundName}
              onChange={(e) => setCompoundName(e.target.value)}
              placeholder="Compound identifier or name"
              className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-cyan-600"
            />

            <textarea
              aria-label="SMILES notation input"
              rows={3}
              value={smilesInput}
              onChange={(e) => {
                setSmilesInput(e.target.value);
                setLocalPrediction(null);
              }}
              spellCheck={false}
              placeholder="Paste SMILES string, e.g. CC(=O)Oc1ccccc1C(=O)O"
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded text-slate-900 focus:outline-none focus:border-cyan-600 resize-y"
            />

            <div>
              <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                Quick-Load Reference Scaffolds
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {SCAFFOLD_SNIPPETS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => loadMoleculeIntoEditor(s.name, s.smiles)}
                    className="px-2.5 py-1.5 text-xs font-medium text-left text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded truncate transition-colors cursor-pointer"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                Terminal Functional Group Probe
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '+F', smi: 'F' },
                  { label: '+CF3', smi: 'C(F)(F)F' },
                  { label: '+OH', smi: 'O' },
                  { label: '+CN', smi: 'C#N' },
                  { label: '+OCH3', smi: 'OC' },
                ].map((grp) => (
                  <button
                    key={grp.label}
                    type="button"
                    onClick={() => handleAppendGroup(grp.smi, grp.label)}
                    className="px-2 py-1 text-xs font-mono text-slate-700 bg-white hover:bg-cyan-50 hover:text-cyan-900 border border-slate-200 hover:border-cyan-300 rounded transition-colors cursor-pointer"
                  >
                    {grp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Screening Filter Calibration */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Screening Thresholds
              </span>
              <button
                type="button"
                onClick={() => onChangeThresholds(DEFAULT_THRESHOLDS)}
                className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>Default</span>
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Max Molecular Weight</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {thresholds.maxMw} Da
                  </span>
                </div>
                <input
                  type="range"
                  min={250}
                  max={700}
                  step={10}
                  value={thresholds.maxMw}
                  onChange={(e) =>
                    onChangeThresholds({ ...thresholds, maxMw: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Max cLogP</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {thresholds.maxLogP.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={2.0}
                  max={7.0}
                  step={0.2}
                  value={thresholds.maxLogP}
                  onChange={(e) =>
                    onChangeThresholds({ ...thresholds, maxLogP: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Max TPSA</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {thresholds.maxTpsa} Å²
                  </span>
                </div>
                <input
                  type="range"
                  min={60}
                  max={180}
                  step={5}
                  value={thresholds.maxTpsa}
                  onChange={(e) =>
                    onChangeThresholds({ ...thresholds, maxTpsa: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">Min Drug-Likeness (QED)</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {thresholds.minQed.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={0.8}
                  step={0.05}
                  value={thresholds.minQed}
                  onChange={(e) =>
                    onChangeThresholds({ ...thresholds, minQed: Number(e.target.value) })
                  }
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Primary Action Bar */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <button
              type="button"
              disabled={!descriptors || aiLoading}
              onClick={handleRunAiAnalysis}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-cyan-700 hover:bg-cyan-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              <span>{aiLoading ? 'Predicting Activity & Toxicity...' : 'Predict Activity & Toxicity'}</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!descriptors}
                onClick={() => handleSaveToLibrary('Shortlisted')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded transition-colors cursor-pointer"
              >
                <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Shortlist</span>
              </button>
              <button
                type="button"
                disabled={!descriptors}
                onClick={() => handleSaveToLibrary('In Assay')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded transition-colors cursor-pointer"
              >
                <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Send to Assay</span>
              </button>
            </div>

            {saveFeedback && (
              <p className="text-xs font-medium text-emerald-700 text-center pt-1">
                {saveFeedback}
              </p>
            )}
          </div>
        </aside>

        {/* Main Viewport Stage */}
        <section className="space-y-5 min-w-0">
          <StructureViewport
            compoundName={compoundName}
            descriptors={descriptors}
            parseError={parsed.error}
            showAtomNumbers={showAtomNumbers}
            onToggleAtomNumbers={() => setShowAtomNumbers((v) => !v)}
          />

          {/* Quantitative Physicochemical Strip */}
          <div className="bg-white border border-slate-200 rounded-md p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Physicochemical & Drug-Likeness Readout
              </h3>
              {descriptors && thresholdEval && (
                <div className="flex flex-wrap items-center gap-4">
                  <StatusGlyph
                    tone={descriptors.lipinskiPass ? 'good' : 'bad'}
                    label={`Lipinski Ro5 (${descriptors.lipinskiViolations} viol.)`}
                  />
                  <StatusGlyph
                    tone={descriptors.veberPass ? 'good' : 'warn'}
                    label={descriptors.veberPass ? 'Veber Oral Pass' : 'Veber Alert'}
                  />
                  <StatusGlyph
                    tone={thresholdEval.pass ? 'good' : 'warn'}
                    label={thresholdEval.pass ? 'Passes Filter' : 'Filter Out-of-Bounds'}
                  />
                </div>
              )}
            </div>

            {descriptors ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-4">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    Mol. Weight
                  </div>
                  <div className="mt-1 flex items-baseline">
                    <span className="text-xl font-mono font-semibold text-slate-900 tabular-nums">
                      {descriptors.molecularWeight.toFixed(2)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 ml-1">Da</span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    cLogP
                  </div>
                  <div className="mt-1 flex items-baseline">
                    <span className="text-xl font-mono font-semibold text-slate-900 tabular-nums">
                      {descriptors.cLogP.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    TPSA
                  </div>
                  <div className="mt-1 flex items-baseline">
                    <span className="text-xl font-mono font-semibold text-slate-900 tabular-nums">
                      {descriptors.tpsa.toFixed(1)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 ml-1">Å²</span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    HBD / HBA
                  </div>
                  <div className="mt-1 flex items-baseline">
                    <span className="text-xl font-mono font-semibold text-slate-900 tabular-nums">
                      {descriptors.hbd} / {descriptors.hba}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    Rot. Bonds
                  </div>
                  <div className="mt-1 flex items-baseline">
                    <span className="text-xl font-mono font-semibold text-slate-900 tabular-nums">
                      {descriptors.rotatableBonds}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    cLogS
                  </div>
                  <div className="mt-1 flex items-baseline">
                    <span className="text-xl font-mono font-semibold text-slate-900 tabular-nums">
                      {descriptors.cLogS.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    QED Score
                  </div>
                  <div className="mt-1 flex items-baseline">
                    <span className="text-xl font-mono font-semibold text-cyan-700 tabular-nums">
                      {descriptors.qedScore.toFixed(2)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 ml-1">/1.0</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Enter a valid SMILES structure to compute physicochemical descriptors.
              </p>
            )}
          </div>

          {/* Radar Chart + AI Biological Activity & Toxicity Prediction */}
          <div className="grid grid-cols-1 xl:grid-cols-[290px_1fr] gap-5 items-start">
            <RadarPropertyChart descriptors={descriptors} thresholds={thresholds} />

            <div className="bg-white border border-slate-200 rounded-md p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-700" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    AI Biological Activity & Toxicity Assessment
                  </h3>
                </div>
                {displayedPrediction && (
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    Target: {activeTarget.pdbId}
                  </span>
                )}
              </div>

              {aiError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold">Prediction Error</p>
                    <p className="mt-0.5">{aiError}</p>
                  </div>
                </div>
              )}

              {aiLoading && (
                <div className="py-8 space-y-3">
                  <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse" />
                  <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
                  <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse" />
                  <p className="text-xs font-mono text-slate-500 pt-2">
                    Evaluating scaffold SAR against {activeTarget.name} and ADMET liabilities...
                  </p>
                </div>
              )}

              {!aiLoading && !displayedPrediction && !aiError && (
                <div className="py-6 space-y-3">
                  <p className="text-sm text-slate-600 max-w-xl">
                    Run AI activity and toxicity prediction to estimate target potency (pIC50 / IC50),
                    hERG cardiotoxicity, Ames mutagenicity, hepatotoxicity, CYP3A4 inhibition, and
                    receive chemically verified analog optimization proposals.
                  </p>
                  <button
                    type="button"
                    disabled={!descriptors}
                    onClick={handleRunAiAnalysis}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 disabled:bg-slate-300 rounded transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Analyze Candidate with AI</span>
                  </button>
                </div>
              )}

              {!aiLoading && displayedPrediction && (
                <div className="space-y-5">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {displayedPrediction.summary}
                  </p>

                  {/* Activity & Toxicity Key Numbers */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-y border-slate-200">
                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                        Pred. pIC50
                      </div>
                      <div className="mt-1 text-xl font-mono font-semibold text-slate-900 tabular-nums">
                        {displayedPrediction.predictedActivity.pIC50.toFixed(2)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                        Est. IC50
                      </div>
                      <div className="mt-1 flex items-baseline">
                        <span className="text-xl font-mono font-semibold text-slate-900 tabular-nums">
                          {displayedPrediction.predictedActivity.ic50EstimateNm >= 1000
                            ? (displayedPrediction.predictedActivity.ic50EstimateNm / 1000).toFixed(2)
                            : displayedPrediction.predictedActivity.ic50EstimateNm.toFixed(1)}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 ml-1">
                          {displayedPrediction.predictedActivity.ic50EstimateNm >= 1000 ? 'µM' : 'nM'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                        Binding Prob.
                      </div>
                      <div className="mt-1 flex items-baseline">
                        <span className="text-xl font-mono font-semibold text-cyan-700 tabular-nums">
                          {Math.round(displayedPrediction.predictedActivity.bindingProbability * 100)}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 ml-1">%</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                        Oral Bioavail.
                      </div>
                      <div className="mt-1 flex items-baseline">
                        <span className="text-xl font-mono font-semibold text-slate-900 tabular-nums">
                          {Math.round(displayedPrediction.toxicityProfile.oralBioavailabilityPct)}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 ml-1">%</span>
                      </div>
                    </div>
                  </div>

                  {/* ADMET & Toxicity Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        ADMET & Safety Profile
                      </h4>
                      <dl className="divide-y divide-slate-100 text-xs">
                        <div className="py-1.5 flex items-center justify-between">
                          <dt className="text-slate-600">Overall Toxicity Risk</dt>
                          <dd>
                            <StatusGlyph
                              tone={riskTone(displayedPrediction.toxicityProfile.overallRisk)}
                              label={displayedPrediction.toxicityProfile.overallRisk}
                            />
                          </dd>
                        </div>
                        <div className="py-1.5 flex items-center justify-between">
                          <dt className="text-slate-600">hERG Cardiotoxicity</dt>
                          <dd>
                            <StatusGlyph
                              tone={riskTone(displayedPrediction.toxicityProfile.hergRisk)}
                              label={displayedPrediction.toxicityProfile.hergRisk}
                            />
                          </dd>
                        </div>
                        <div className="py-1.5 flex items-center justify-between">
                          <dt className="text-slate-600">Ames Mutagenicity</dt>
                          <dd>
                            <StatusGlyph
                              tone={
                                displayedPrediction.toxicityProfile.amesMutagenicity === 'Negative'
                                  ? 'good'
                                  : displayedPrediction.toxicityProfile.amesMutagenicity === 'Equivocal'
                                    ? 'warn'
                                    : 'bad'
                              }
                              label={displayedPrediction.toxicityProfile.amesMutagenicity}
                            />
                          </dd>
                        </div>
                        <div className="py-1.5 flex items-center justify-between">
                          <dt className="text-slate-600">Hepatotoxicity (DILI)</dt>
                          <dd>
                            <StatusGlyph
                              tone={riskTone(displayedPrediction.toxicityProfile.hepatotoxicity)}
                              label={displayedPrediction.toxicityProfile.hepatotoxicity}
                            />
                          </dd>
                        </div>
                        <div className="py-1.5 flex items-center justify-between">
                          <dt className="text-slate-600">CYP3A4 Inhibition</dt>
                          <dd>
                            <StatusGlyph
                              tone={riskTone(displayedPrediction.toxicityProfile.cyp3a4Inhibition)}
                              label={displayedPrediction.toxicityProfile.cyp3a4Inhibition}
                            />
                          </dd>
                        </div>
                        <div className="py-1.5 flex items-center justify-between">
                          <dt className="text-slate-600">BBB Permeability</dt>
                          <dd className="font-mono text-slate-800">
                            {displayedPrediction.toxicityProfile.bbbPermeability}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Putative Binding Interactions
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed mb-2">
                          {displayedPrediction.predictedActivity.mechanismRationale}
                        </p>
                        <ul className="space-y-1 text-xs text-slate-700">
                          {displayedPrediction.predictedActivity.keyInteractions.map((inter, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-cyan-700 font-mono" aria-hidden="true">·</span>
                              <span>{inter}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Structural Alerts & Safety Notes
                        </h4>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {displayedPrediction.toxicityProfile.toxicityRationale}
                        </p>
                        {displayedPrediction.toxicityProfile.structuralAlerts.length > 0 && (
                          <p className="mt-1.5 text-xs font-mono text-amber-800">
                            Alerts: {displayedPrediction.toxicityProfile.structuralAlerts.join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AI Analog Suggestions */}
                  {displayedPrediction.analogSuggestions.length > 0 && (
                    <div className="pt-4 border-t border-slate-200 space-y-2.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Proposed Analog Optimizations (Click to Load Structure)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {displayedPrediction.analogSuggestions.map((analog, idx) => (
                          <button
                            key={idx}
                            type="button"
                            disabled={analog.validSmiles === false}
                            onClick={() => {
                              if (analog.validSmiles !== false) {
                                loadMoleculeIntoEditor(analog.name, analog.smiles);
                              }
                            }}
                            className="text-left p-3 border border-slate-200 hover:border-cyan-500 bg-slate-50/70 hover:bg-white rounded transition-colors disabled:opacity-50 cursor-pointer flex flex-col justify-between gap-2"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-900 truncate">
                                  {analog.name}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-cyan-700 shrink-0" aria-hidden="true" />
                              </div>
                              <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                                {analog.modificationSummary}
                              </p>
                              <p className="text-[11px] font-medium text-emerald-700 mt-1">
                                {analog.expectedImprovement}
                              </p>
                            </div>
                            <div className="pt-1.5 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono text-slate-500 tabular-nums">
                              {analog.validSmiles === false ? (
                                <span className="text-rose-700">Invalid SMILES</span>
                              ) : (
                                <>
                                  <span>MW {analog.molecularWeight ?? '—'}</span>
                                  <span>cLogP {analog.cLogP ?? '—'}</span>
                                </>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Target Screening Queue Tray */}
          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Target Queue · {activeTarget.name} ({targetCandidates.length})
              </h3>
              <span className="text-xs text-slate-400">
                Click any row to load into structure workbench
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4 font-medium">Candidate</th>
                    <th className="py-2.5 px-3 font-medium">Formula</th>
                    <th className="py-2.5 px-3 font-medium text-right">MW (Da)</th>
                    <th className="py-2.5 px-3 font-medium text-right">cLogP</th>
                    <th className="py-2.5 px-3 font-medium text-right">TPSA</th>
                    <th className="py-2.5 px-3 font-medium text-right">QED</th>
                    <th className="py-2.5 px-3 font-medium text-right">Pred. pIC50</th>
                    <th className="py-2.5 px-4 font-medium">Pipeline Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {targetCandidates.map((cand) => {
                    const isSelected = cand.smiles === smilesInput.trim();
                    const d = cand.descriptors;
                    return (
                      <tr
                        key={cand.id}
                        onClick={() => {
                          onSelectCandidate(cand);
                          loadMoleculeIntoEditor(cand.name, cand.smiles, cand.aiPrediction);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-cyan-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                          {cand.name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {d?.formula ?? '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-700">
                          {d ? d.molecularWeight.toFixed(1) : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-700">
                          {d ? d.cLogP.toFixed(2) : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-700">
                          {d ? d.tpsa.toFixed(1) : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right font-medium text-cyan-800">
                          {d ? d.qedScore.toFixed(2) : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-right text-slate-700">
                          {cand.aiPrediction ? cand.aiPrediction.predictedActivity.pIC50.toFixed(2) : '—'}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
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
                        </td>
                      </tr>
                    );
                  })}
                  {targetCandidates.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 px-4 text-center text-xs text-slate-500">
                        No candidates assigned to this biological target yet. Save or screen molecules to populate this queue.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
