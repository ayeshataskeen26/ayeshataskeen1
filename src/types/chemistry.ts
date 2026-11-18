export type CandidateStatus = 'Screened' | 'Shortlisted' | 'In Assay' | 'Advancing' | 'Rejected';

export type RiskLevel = 'Low' | 'Moderate' | 'High';

export interface MolecularDescriptors {
  canonicalSmiles: string;
  formula: string;
  molecularWeight: number;
  exactMass: number;
  cLogP: number;
  cLogS: number;
  tpsa: number;
  hbd: number;
  hba: number;
  rotatableBonds: number;
  heavyAtomCount: number;
  atomCount: number;
  bondCount: number;
  ringCount: number;
  aromaticRingCount: number;
  stereoCenterCount: number;
  lipinskiViolations: number;
  lipinskiPass: boolean;
  veberPass: boolean;
  bbbPermeant: boolean;
  qedScore: number;
  svgMarkup: string;
}

export interface AnalogSuggestion {
  name: string;
  smiles: string;
  modificationSummary: string;
  expectedImprovement: string;
  validSmiles?: boolean;
  qedScore?: number;
  molecularWeight?: number;
  cLogP?: number;
}

export interface AiPredictionResult {
  summary: string;
  predictedActivity: {
    pIC50: number;
    ic50EstimateNm: number;
    bindingProbability: number;
    mechanismRationale: string;
    keyInteractions: string[];
  };
  toxicityProfile: {
    overallRisk: RiskLevel;
    hergRisk: RiskLevel;
    amesMutagenicity: 'Negative' | 'Equivocal' | 'Positive';
    hepatotoxicity: RiskLevel;
    cyp3a4Inhibition: RiskLevel;
    bbbPermeability: 'High' | 'Moderate' | 'Low';
    oralBioavailabilityPct: number;
    structuralAlerts: string[];
    toxicityRationale: string;
  };
  analogSuggestions: AnalogSuggestion[];
  analyzedAt: string;
  targetId: string;
}

export interface BiologicalTarget {
  id: string;
  name: string;
  uniprotId: string;
  pdbId: string;
  targetClass: string;
  therapeuticArea: string;
  projectTitle: string;
  bbbRequired: boolean;
  targetPic50Threshold: number;
  description: string;
}

export interface DrugCandidate {
  id: string;
  name: string;
  smiles: string;
  targetId: string;
  status: CandidateStatus;
  source: 'Reference Library' | 'Manual Entry' | 'Batch Screen' | 'AI Analog';
  addedAt: string;
  notes?: string;
  descriptors?: MolecularDescriptors;
  aiPrediction?: AiPredictionResult;
}

export interface AssayRecord {
  id: string;
  candidateId: string;
  candidateName: string;
  targetId: string;
  assayType: 'Biochemical IC50' | 'Cellular Viability' | 'hERG Patch-Clamp' | 'Caco-2 Permeability' | 'Microsomal Stability';
  measuredValue: number;
  unit: string;
  outcome: 'Active' | 'Borderline' | 'Inactive' | 'Toxic Flag';
  performedBy: string;
  recordedAt: string;
  notes: string;
}

export interface ScreeningThresholds {
  maxMw: number;
  minLogP: number;
  maxLogP: number;
  maxTpsa: number;
  maxHbd: number;
  maxHba: number;
  maxRotBonds: number;
  minQed: number;
}

export interface BatchScreenItem {
  id: string;
  name: string;
  smiles: string;
  valid: boolean;
  error?: string;
  descriptors?: MolecularDescriptors;
  passesFilter: boolean;
  filterReasons: string[];
  aiScore?: {
    predictedPic50: number;
    toxicityRisk: RiskLevel;
    recommendation: 'Advance' | 'Optimize' | 'Deprioritize';
    rationale: string;
  };
}
