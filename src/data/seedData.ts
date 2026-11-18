import type {
  AssayRecord,
  BiologicalTarget,
  DrugCandidate,
  ScreeningThresholds,
} from '../types/chemistry';
import { analyzeSmiles } from '../utils/cheminformatics';

export const DEFAULT_THRESHOLDS: ScreeningThresholds = {
  maxMw: 520,
  minLogP: -0.5,
  maxLogP: 5.0,
  maxTpsa: 140,
  maxHbd: 5,
  maxHba: 10,
  maxRotBonds: 10,
  minQed: 0.35,
};

export const INITIAL_TARGETS: BiologicalTarget[] = [
  {
    id: 'target-egfr',
    name: 'EGFR (T790M/L858R) Tyrosine Kinase',
    uniprotId: 'P00533',
    pdbId: '1M17',
    targetClass: 'Receptor Tyrosine Kinase',
    therapeuticArea: 'Oncology (NSCLC)',
    projectTitle: 'EGFR Mutant Kinase Lead Optimization',
    bbbRequired: false,
    targetPic50Threshold: 7.5,
    description:
      'ATP-competitive and covalent hinge-binding inhibition of epidermal growth factor receptor mutants driving non-small cell lung cancer.',
  },
  {
    id: 'target-cox2',
    name: 'Cyclooxygenase-2 (COX-2)',
    uniprotId: 'P35354',
    pdbId: '5IKR',
    targetClass: 'Oxidoreductase Enzyme',
    therapeuticArea: 'Inflammation & Analgesia',
    projectTitle: 'Selective COX-2 Anti-Inflammatory Series',
    bbbRequired: false,
    targetPic50Threshold: 6.8,
    description:
      'Selective inhibition of inducible prostaglandin-endoperoxide synthase 2 while sparing constitutive COX-1 gastric protection.',
  },
  {
    id: 'target-mpro',
    name: 'Viral Main Protease (3CLpro / Mpro)',
    uniprotId: 'P0DTD1',
    pdbId: '6LU7',
    targetClass: 'Cysteine Protease',
    therapeuticArea: 'Antiviral Infectious Disease',
    projectTitle: 'Peptidomimetic & Non-Covalent Mpro Screen',
    bbbRequired: false,
    targetPic50Threshold: 7.0,
    description:
      'Active-site Cys145 targeting inhibitors blocking viral polyprotein cleavage with low CYP3A4 drug-drug interaction liability.',
  },
  {
    id: 'target-bace1',
    name: 'Beta-Secretase 1 (BACE1)',
    uniprotId: 'P56817',
    pdbId: '4DJU',
    targetClass: 'Aspartyl Protease',
    therapeuticArea: 'CNS Neurodegeneration',
    projectTitle: 'Brain-Penetrant BACE1 Discovery',
    bbbRequired: true,
    targetPic50Threshold: 7.2,
    description:
      'Central nervous system protease inhibition requiring low TPSA (<90 A^2), balanced lipophilicity, and low P-gp efflux.',
  },
];

const RAW_CANDIDATES: Array<{
  id: string;
  name: string;
  smiles: string;
  targetId: string;
  status: DrugCandidate['status'];
  source: DrugCandidate['source'];
  notes: string;
}> = [
  {
    id: 'cand-erlotinib',
    name: 'Erlotinib',
    smiles: 'COc1cc2ncnc(Nc3cccc(C#C)c3)c2cc1OCCOC',
    targetId: 'target-egfr',
    status: 'Advancing',
    source: 'Reference Library',
    notes: '4-anilinoquinazoline reversible EGFR kinase inhibitor; benchmark hinge binder.',
  },
  {
    id: 'cand-gefitinib',
    name: 'Gefitinib',
    smiles: 'COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCCN1CCOCC1',
    targetId: 'target-egfr',
    status: 'In Assay',
    source: 'Reference Library',
    notes: 'Morpholine-solubilized quinazoline scaffold with 3-chloro-4-fluoroaniline headgroup.',
  },
  {
    id: 'cand-osimertinib',
    name: 'Osimertinib',
    smiles: 'COc1cc(Nc2nccc(-c3cn(C)c4ccccc34)n2)c(NC(=O)C=C)cc1N(C)CCN(C)C',
    targetId: 'target-egfr',
    status: 'Shortlisted',
    source: 'Reference Library',
    notes: 'Irreversible acrylamide Michael acceptor targeting Cys797 in T790M EGFR.',
  },
  {
    id: 'cand-sorafenib',
    name: 'Sorafenib',
    smiles: 'CNC(=O)c1cc(Oc2ccc(NC(=O)Nc3ccc(Cl)c(C(F)(F)F)c3)cc2)ccn1',
    targetId: 'target-egfr',
    status: 'Screened',
    source: 'Reference Library',
    notes: 'Diaryl urea multi-kinase scaffold evaluated for off-target selectivity.',
  },
  {
    id: 'cand-celecoxib',
    name: 'Celecoxib',
    smiles: 'Cc1ccc(-c2cc(C(F)(F)F)nn2-c2ccc(S(N)(=O)=O)cc2)cc1',
    targetId: 'target-cox2',
    status: 'Advancing',
    source: 'Reference Library',
    notes: 'Diarylsulfonamide pyrazole filling the COX-2 secondary side pocket.',
  },
  {
    id: 'cand-ibuprofen',
    name: 'Ibuprofen',
    smiles: 'CC(C)Cc1ccc(C(C)C(=O)O)cc1',
    targetId: 'target-cox2',
    status: 'Screened',
    source: 'Reference Library',
    notes: 'Non-selective propionic acid reference comparator.',
  },
  {
    id: 'cand-nirmatrelvir',
    name: 'Nirmatrelvir',
    smiles: 'CC1(C)[C@@H]2[C@@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)C(F)(F)F)C(=O)N[C@@H](CC1CCNC1=O)C#N',
    targetId: 'target-mpro',
    status: 'Advancing',
    source: 'Reference Library',
    notes: 'Reversible covalent nitrile warhead targeting Cys145 with P1 gamma-lactam.',
  },
  {
    id: 'cand-sitagliptin',
    name: 'Sitagliptin',
    smiles: 'Fc1cc(F)c(C[C@@H](N)CC(=O)N2CCn3c(nnc3C(F)(F)F)C2)cc1F',
    targetId: 'target-mpro',
    status: 'Screened',
    source: 'Reference Library',
    notes: 'Triazolopiperazine trifluoromethyl scaffold repurposed for protease fragment screening.',
  },
  {
    id: 'cand-verubecestat',
    name: 'Verubecestat',
    smiles: 'C[C@@]1(c2cc(NC(=O)c3ccc(F)cn3)ccc2F)NC(=N)N(C)C1=O',
    targetId: 'target-bace1',
    status: 'In Assay',
    source: 'Reference Library',
    notes: 'Iminothiadiazinone-like CNS-penetrant BACE1 catalytic dyad binder.',
  },
  {
    id: 'cand-atorvastatin',
    name: 'Atorvastatin',
    smiles: 'CC(C)c1c(C(=O)Nc2ccccc2)c(-c2ccccc2)c(-c2ccc(F)cc2)n1CC[C@@H](O)C[C@@H](O)CC(=O)O',
    targetId: 'target-bace1',
    status: 'Rejected',
    source: 'Reference Library',
    notes: 'High MW (>550 Da) and polar carboxylate tail limit BBB permeation for CNS targets.',
  },
];

export const INITIAL_CANDIDATES: DrugCandidate[] = RAW_CANDIDATES.map((c, idx) => {
  const parsed = analyzeSmiles(c.smiles);
  return {
    ...c,
    addedAt: new Date(Date.now() - (10 - idx) * 86400_000).toISOString(),
    descriptors: parsed.descriptors,
  };
});

export const INITIAL_ASSAYS: AssayRecord[] = [
  {
    id: 'assay-101',
    candidateId: 'cand-erlotinib',
    candidateName: 'Erlotinib',
    targetId: 'target-egfr',
    assayType: 'Biochemical IC50',
    measuredValue: 2.1,
    unit: 'nM',
    outcome: 'Active',
    performedBy: 'Biochemical HTS Core',
    recordedAt: '2026-11-12T10:30:00Z',
    notes: 'Strong ATP-competitive inhibition against WT EGFR; 14 nM shift in 1mM ATP.',
  },
  {
    id: 'assay-102',
    candidateId: 'cand-gefitinib',
    candidateName: 'Gefitinib',
    targetId: 'target-egfr',
    assayType: 'hERG Patch-Clamp',
    measuredValue: 8.4,
    unit: 'uM',
    outcome: 'Borderline',
    performedBy: 'Safety Pharmacology Lab',
    recordedAt: '2026-11-14T15:15:00Z',
    notes: 'Moderate hERG tail-current block attributable to basic morpholine propyl tail.',
  },
  {
    id: 'assay-103',
    candidateId: 'cand-celecoxib',
    candidateName: 'Celecoxib',
    targetId: 'target-cox2',
    assayType: 'Biochemical IC50',
    measuredValue: 40.0,
    unit: 'nM',
    outcome: 'Active',
    performedBy: 'Enzymology Team',
    recordedAt: '2026-11-15T09:00:00Z',
    notes: '>350-fold selectivity over COX-1 in human whole blood assay.',
  },
  {
    id: 'assay-104',
    candidateId: 'cand-nirmatrelvir',
    candidateName: 'Nirmatrelvir',
    targetId: 'target-mpro',
    assayType: 'Biochemical IC50',
    measuredValue: 3.1,
    unit: 'nM',
    outcome: 'Active',
    performedBy: 'Virology Screening Unit',
    recordedAt: '2026-11-16T11:45:00Z',
    notes: 'FRET peptide substrate cleavage assay; rapid covalent-reversible adduct formation.',
  },
  {
    id: 'assay-105',
    candidateId: 'cand-verubecestat',
    candidateName: 'Verubecestat',
    targetId: 'target-bace1',
    assayType: 'Caco-2 Permeability',
    measuredValue: 18.2,
    unit: '10^-6 cm/s',
    outcome: 'Active',
    performedBy: 'ADME / DMPK Group',
    recordedAt: '2026-11-17T14:20:00Z',
    notes: 'High apical-to-basolateral flux with efflux ratio 1.3; favorable CNS penetration.',
  },
];

export const BATCH_PRESET_SMILES = `COc1cc2ncnc(Nc3cccc(C#C)c3)c2cc1OCCOC, Erlotinib
COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCCN1CCOCC1, Gefitinib
Cc1ccc(-c2cc(C(F)(F)F)nn2-c2ccc(S(N)(=O)=O)cc2)cc1, Celecoxib
CC(=O)Oc1ccccc1C(=O)O, Aspirin
Cn1cnc2c1c(=O)n(C)c(=O)n2C, Caffeine
CC(C)Cc1ccc(C(C)C(=O)O)cc1, Ibuprofen
Fc1ccc(C(=O)CCCN2CCC(O)(c3ccc(Cl)cc3)CC2)cc1, Haloperidol
O=C(Nc1ccc(Cl)cc1)Nc1ccc(C(F)(F)F)cc1, Urea-Analog-08`;
