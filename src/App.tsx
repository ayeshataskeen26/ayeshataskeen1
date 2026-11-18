import { useEffect, useState } from 'react';
import { BatchScreenerView } from './components/BatchScreenerView';
import { CandidateLibraryView } from './components/CandidateLibraryView';
import { TargetsAssaysView } from './components/TargetsAssaysView';
import { TopBar, type WorkspaceTab } from './components/TopBar';
import { WorkbenchView } from './components/WorkbenchView';
import {
  DEFAULT_THRESHOLDS,
  INITIAL_ASSAYS,
  INITIAL_CANDIDATES,
  INITIAL_TARGETS,
} from './data/seedData';
import type {
  AiPredictionResult,
  AssayRecord,
  BiologicalTarget,
  CandidateStatus,
  DrugCandidate,
  ScreeningThresholds,
} from './types/chemistry';
import { analyzeSmiles } from './utils/cheminformatics';

const STORAGE_KEY = 'molspec_discovery_state_v1';

function loadInitialState(): {
  targets: BiologicalTarget[];
  candidates: DrugCandidate[];
  assays: AssayRecord[];
  thresholds: ScreeningThresholds;
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        targets: INITIAL_TARGETS,
        candidates: INITIAL_CANDIDATES,
        assays: INITIAL_ASSAYS,
        thresholds: DEFAULT_THRESHOLDS,
      };
    }
    const parsed = JSON.parse(raw);
    const hydratedCandidates: DrugCandidate[] = Array.isArray(parsed.candidates)
      ? parsed.candidates.map((c: DrugCandidate) => ({
          ...c,
          descriptors: c.descriptors ?? analyzeSmiles(c.smiles).descriptors,
        }))
      : INITIAL_CANDIDATES;

    return {
      targets: Array.isArray(parsed.targets) && parsed.targets.length > 0 ? parsed.targets : INITIAL_TARGETS,
      candidates: hydratedCandidates,
      assays: Array.isArray(parsed.assays) ? parsed.assays : INITIAL_ASSAYS,
      thresholds: parsed.thresholds ?? DEFAULT_THRESHOLDS,
    };
  } catch {
    return {
      targets: INITIAL_TARGETS,
      candidates: INITIAL_CANDIDATES,
      assays: INITIAL_ASSAYS,
      thresholds: DEFAULT_THRESHOLDS,
    };
  }
}

export default function App() {
  const [initial] = useState(loadInitialState);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('workbench');
  const [targets, setTargets] = useState<BiologicalTarget[]>(initial.targets);
  const [selectedTargetId, setSelectedTargetId] = useState<string>(initial.targets[0].id);
  const [candidates, setCandidates] = useState<DrugCandidate[]>(initial.candidates);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(
    initial.candidates[0]?.id ?? null
  );
  const [workbenchSyncKey, setWorkbenchSyncKey] = useState(0);
  const [assays, setAssays] = useState<AssayRecord[]>(initial.assays);
  const [thresholds, setThresholds] = useState<ScreeningThresholds>(initial.thresholds);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ targets, candidates, assays, thresholds })
      );
    } catch {
      // Storage quota ignored safely
    }
  }, [targets, candidates, assays, thresholds]);

  const handleSaveCandidate = (candidate: DrugCandidate) => {
    setCandidates((prev) => {
      const exists = prev.some((c) => c.id === candidate.id);
      if (exists) {
        return prev.map((c) => (c.id === candidate.id ? candidate : c));
      }
      return [candidate, ...prev];
    });
  };

  const handleUpdateStatus = (candidateId: string, status: CandidateStatus) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, status } : c))
    );
  };

  const handleDeleteCandidate = (candidateId: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
    if (activeCandidateId === candidateId) {
      setActiveCandidateId(null);
    }
  };

  const handleSaveAiPrediction = (candidateId: string, prediction: AiPredictionResult) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, aiPrediction: prediction } : c))
    );
  };

  const handleInspectCandidate = (candidate: DrugCandidate) => {
    setCandidates((prev) => {
      if (prev.some((c) => c.id === candidate.id)) return prev;
      return [candidate, ...prev];
    });
    setSelectedTargetId(candidate.targetId);
    setActiveCandidateId(candidate.id);
    setWorkbenchSyncKey((k) => k + 1);
    setActiveTab('workbench');
  };

  const handleSelectTargetAndOpenWorkbench = (targetId: string) => {
    setSelectedTargetId(targetId);
    const firstMatch = candidates.find((c) => c.targetId === targetId) ?? null;
    setActiveCandidateId(firstMatch?.id ?? null);
    setWorkbenchSyncKey((k) => k + 1);
    setActiveTab('workbench');
  };

  const handleExportCsv = () => {
    const targetNameMap = new Map(targets.map((t) => [t.id, t.name]));
    const headers = [
      'Name',
      'Target',
      'Status',
      'Canonical_SMILES',
      'Formula',
      'MW_Da',
      'cLogP',
      'TPSA',
      'HBD',
      'HBA',
      'RotBonds',
      'QED',
      'Lipinski_Violations',
      'AI_Pred_pIC50',
      'AI_Toxicity_Risk',
    ];

    const escapeCsv = (val: string | number | undefined) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = candidates.map((c) => {
      const d = c.descriptors;
      return [
        c.name,
        targetNameMap.get(c.targetId) ?? c.targetId,
        c.status,
        d?.canonicalSmiles ?? c.smiles,
        d?.formula ?? '',
        d?.molecularWeight ?? '',
        d?.cLogP ?? '',
        d?.tpsa ?? '',
        d?.hbd ?? '',
        d?.hba ?? '',
        d?.rotatableBonds ?? '',
        d?.qedScore ?? '',
        d?.lipinskiViolations ?? '',
        c.aiPrediction?.predictedActivity.pIC50 ?? '',
        c.aiPrediction?.toxicityProfile.overallRisk ?? '',
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `molspec-screening-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onExportCsv={handleExportCsv}
      />

      <main className="flex-1">
        {activeTab === 'workbench' && (
          <WorkbenchView
            key={workbenchSyncKey}
            targets={targets}
            selectedTargetId={selectedTargetId}
            onSelectTarget={setSelectedTargetId}
            candidates={candidates}
            activeCandidateId={activeCandidateId}
            onSelectCandidate={(cand) => setActiveCandidateId(cand.id)}
            onSaveCandidate={handleSaveCandidate}
            onUpdateStatus={handleUpdateStatus}
            onSaveAiPrediction={handleSaveAiPrediction}
            thresholds={thresholds}
            onChangeThresholds={setThresholds}
          />
        )}

        {activeTab === 'batch' && (
          <BatchScreenerView
            targets={targets}
            selectedTargetId={selectedTargetId}
            onSelectTarget={setSelectedTargetId}
            thresholds={thresholds}
            onInspectSmiles={handleInspectCandidate}
            onShortlistCandidate={handleSaveCandidate}
          />
        )}

        {activeTab === 'library' && (
          <CandidateLibraryView
            candidates={candidates}
            targets={targets}
            onInspectCandidate={handleInspectCandidate}
            onUpdateStatus={handleUpdateStatus}
            onDeleteCandidate={handleDeleteCandidate}
          />
        )}

        {activeTab === 'targets' && (
          <TargetsAssaysView
            targets={targets}
            selectedTargetId={selectedTargetId}
            onSelectTargetAndOpenWorkbench={handleSelectTargetAndOpenWorkbench}
            onAddTarget={(t) => setTargets((prev) => [...prev, t])}
            candidates={candidates}
            assays={assays}
            onAddAssay={(a) => setAssays((prev) => [a, ...prev])}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-10">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            MolSpec Discovery · {candidates.length} cataloged molecules across {targets.length} biological targets
          </span>
          <span>
            In silico ADMET & bioactivity predictions are research aids requiring experimental assay confirmation.
          </span>
        </div>
      </footer>
    </div>
  );
}
