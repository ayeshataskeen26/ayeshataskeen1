import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import type { AssayRecord, BiologicalTarget, DrugCandidate } from '../types/chemistry';
import { StatusGlyph } from './StatusGlyph';

interface TargetsAssaysViewProps {
  targets: BiologicalTarget[];
  selectedTargetId: string;
  onSelectTargetAndOpenWorkbench: (targetId: string) => void;
  onAddTarget: (target: BiologicalTarget) => void;
  candidates: DrugCandidate[];
  assays: AssayRecord[];
  onAddAssay: (assay: AssayRecord) => void;
}

export const TargetsAssaysView: React.FC<TargetsAssaysViewProps> = ({
  targets,
  selectedTargetId,
  onSelectTargetAndOpenWorkbench,
  onAddTarget,
  candidates,
  assays,
  onAddAssay,
}) => {
  const [showNewTarget, setShowNewTarget] = useState(false);
  const [targetName, setTargetName] = useState('');
  const [pdbId, setPdbId] = useState('');
  const [uniprotId, setUniprotId] = useState('');
  const [therapeuticArea, setTherapeuticArea] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [bbbRequired, setBbbRequired] = useState(false);

  const [assayCandId, setAssayCandId] = useState(candidates[0]?.id ?? '');
  const [assayType, setAssayType] = useState<AssayRecord['assayType']>('Biochemical IC50');
  const [measuredValue, setMeasuredValue] = useState('12.5');
  const [unit, setUnit] = useState('nM');
  const [outcome, setOutcome] = useState<AssayRecord['outcome']>('Active');
  const [performedBy, setPerformedBy] = useState('Medicinal Chemistry Assay Lab');
  const [assayNotes, setAssayNotes] = useState('');

  const handleCreateTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetName.trim()) return;
    onAddTarget({
      id: `target-${Date.now()}`,
      name: targetName.trim(),
      pdbId: pdbId.trim() || 'N/A',
      uniprotId: uniprotId.trim() || 'N/A',
      targetClass: 'Custom Screening Target',
      therapeuticArea: therapeuticArea.trim() || 'Investigational',
      projectTitle: projectTitle.trim() || `${targetName.trim()} Discovery Series`,
      bbbRequired,
      targetPic50Threshold: 7.0,
      description: 'User-defined pharmaceutical target campaign.',
    });
    setTargetName('');
    setPdbId('');
    setUniprotId('');
    setTherapeuticArea('');
    setProjectTitle('');
    setBbbRequired(false);
    setShowNewTarget(false);
  };

  const handleLogAssay = (e: React.FormEvent) => {
    e.preventDefault();
    const cand = candidates.find((c) => c.id === assayCandId);
    if (!cand) return;
    const numeric = Number(measuredValue);
    if (Number.isNaN(numeric)) return;

    onAddAssay({
      id: `assay-${Date.now()}`,
      candidateId: cand.id,
      candidateName: cand.name,
      targetId: cand.targetId,
      assayType,
      measuredValue: numeric,
      unit: unit.trim() || 'nM',
      outcome,
      performedBy: performedBy.trim() || 'Assay Core',
      recordedAt: new Date().toISOString(),
      notes: assayNotes.trim() || 'Experimental verification readout logged.',
    });
    setAssayNotes('');
  };

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-5 space-y-6">
      {/* Biological Targets & Research Projects */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Biological Targets & Research Projects
            </h1>
            <p className="text-sm text-slate-600">
              Active target campaigns governing binding potency goals and blood-brain barrier constraints.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewTarget((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{showNewTarget ? 'Cancel' : 'Add Biological Target'}</span>
          </button>
        </div>

        {showNewTarget && (
          <form
            onSubmit={handleCreateTarget}
            className="bg-white border border-slate-200 rounded-md p-4 grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <input
              type="text"
              required
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              placeholder="Target name (e.g. KRAS G12C)"
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-cyan-600"
            />
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Research project title"
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-cyan-600"
            />
            <input
              type="text"
              value={therapeuticArea}
              onChange={(e) => setTherapeuticArea(e.target.value)}
              placeholder="Therapeutic area (e.g. Oncology)"
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-cyan-600"
            />
            <input
              type="text"
              value={pdbId}
              onChange={(e) => setPdbId(e.target.value)}
              placeholder="PDB ID (e.g. 6OIM)"
              className="px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-cyan-600"
            />
            <input
              type="text"
              value={uniprotId}
              onChange={(e) => setUniprotId(e.target.value)}
              placeholder="UniProt ID (e.g. P01116)"
              className="px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-cyan-600"
            />
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bbbRequired}
                  onChange={(e) => setBbbRequired(e.target.checked)}
                  className="accent-cyan-700"
                />
                <span>CNS BBB Required</span>
              </label>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded cursor-pointer"
              >
                Create Target
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {targets.map((t) => {
            const count = candidates.filter((c) => c.targetId === t.id).length;
            const isActive = t.id === selectedTargetId;
            return (
              <div
                key={t.id}
                className={`bg-white border rounded-md p-4 flex flex-col justify-between gap-3 ${
                  isActive ? 'border-cyan-600' : 'border-slate-200'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-mono text-slate-500">
                        {t.therapeuticArea} · PDB {t.pdbId} · UniProt {t.uniprotId}
                      </div>
                      <h2 className="text-sm font-semibold text-slate-900 mt-0.5">
                        {t.name}
                      </h2>
                    </div>
                    <StatusGlyph
                      tone={t.bbbRequired ? 'warn' : 'neutral'}
                      label={t.bbbRequired ? 'BBB Required' : 'Peripheral'}
                    />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{t.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-500 tabular-nums">
                    {count} candidates · Goal pIC50 ≥ {t.targetPic50Threshold.toFixed(1)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectTargetAndOpenWorkbench(t.id)}
                    className="font-medium text-cyan-700 hover:text-cyan-900 cursor-pointer"
                  >
                    Open in Workbench →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Experimental Assay Log & Entry */}
      <section className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">
        <form
          onSubmit={handleLogAssay}
          className="bg-white border border-slate-200 rounded-md p-4 space-y-3"
        >
          <h2 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-200">
            Log Experimental Assay Readout
          </h2>

          <div>
            <label htmlFor="assay-cand" className="block text-xs font-medium text-slate-600 mb-1">
              Candidate Molecule
            </label>
            <select
              id="assay-cand"
              value={assayCandId}
              onChange={(e) => setAssayCandId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-cyan-600"
            >
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="assay-type" className="block text-xs font-medium text-slate-600 mb-1">
              Assay Type
            </label>
            <select
              id="assay-type"
              value={assayType}
              onChange={(e) => setAssayType(e.target.value as AssayRecord['assayType'])}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-cyan-600"
            >
              <option value="Biochemical IC50">Biochemical IC50</option>
              <option value="Cellular Viability">Cellular Viability</option>
              <option value="hERG Patch-Clamp">hERG Patch-Clamp</option>
              <option value="Caco-2 Permeability">Caco-2 Permeability</option>
              <option value="Microsomal Stability">Microsomal Stability</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="assay-val" className="block text-xs font-medium text-slate-600 mb-1">
                Measured Value
              </label>
              <input
                id="assay-val"
                type="number"
                step="any"
                required
                value={measuredValue}
                onChange={(e) => setMeasuredValue(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-cyan-600"
              />
            </div>
            <div>
              <label htmlFor="assay-unit" className="block text-xs font-medium text-slate-600 mb-1">
                Unit
              </label>
              <input
                id="assay-unit"
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-cyan-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="assay-outcome" className="block text-xs font-medium text-slate-600 mb-1">
                Outcome
              </label>
              <select
                id="assay-outcome"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as AssayRecord['outcome'])}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-cyan-600"
              >
                <option value="Active">Active</option>
                <option value="Borderline">Borderline</option>
                <option value="Inactive">Inactive</option>
                <option value="Toxic Flag">Toxic Flag</option>
              </select>
            </div>
            <div>
              <label htmlFor="assay-lab" className="block text-xs font-medium text-slate-600 mb-1">
                Lab / Operator
              </label>
              <input
                id="assay-lab"
                type="text"
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-cyan-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="assay-notes" className="block text-xs font-medium text-slate-600 mb-1">
              Observation Notes
            </label>
            <textarea
              id="assay-notes"
              rows={2}
              value={assayNotes}
              onChange={(e) => setAssayNotes(e.target.value)}
              placeholder="IC50 curve slope, solubility limit, or selectivity note"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-cyan-600"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded transition-colors cursor-pointer"
          >
            Record Assay Result
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Wet-Lab & ADMET Assay Ledger ({assays.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4 font-medium">Candidate</th>
                  <th className="py-2.5 px-3 font-medium">Assay</th>
                  <th className="py-2.5 px-3 font-medium text-right">Readout</th>
                  <th className="py-2.5 px-3 font-medium">Outcome</th>
                  <th className="py-2.5 px-4 font-medium">Notes & Lab</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {assays.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {a.candidateName}
                    </td>
                    <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                      {a.assayType}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-right text-slate-900 whitespace-nowrap">
                      {a.measuredValue} <span className="text-slate-400">{a.unit}</span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusGlyph
                        tone={
                          a.outcome === 'Active'
                            ? 'good'
                            : a.outcome === 'Borderline'
                              ? 'warn'
                              : a.outcome === 'Toxic Flag'
                                ? 'bad'
                                : 'neutral'
                        }
                        label={a.outcome}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-700">{a.notes}</div>
                      <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {a.performedBy} · {new Date(a.recordedAt).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
