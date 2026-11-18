import { Molecule, MoleculeProperties } from 'openchemlib';
import type { MolecularDescriptors, ScreeningThresholds } from '../types/chemistry';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function gaussianDesirability(value: number, mean: number, sigma: number): number {
  const diff = (value - mean) / sigma;
  return Math.exp(-0.5 * diff * diff);
}

/**
 * Computes a deterministic QED-inspired drug-likeness desirability score (0.00 - 1.00)
 * using weighted Gaussian desirability curves across core oral-drug physicochemical windows.
 */
function computeDrugLikenessScore(params: {
  mw: number;
  logP: number;
  tpsa: number;
  hbd: number;
  hba: number;
  rotBonds: number;
  aromaticRings: number;
}): number {
  const dMw = gaussianDesirability(params.mw, 330, 125);
  const dLogP = gaussianDesirability(params.logP, 2.5, 1.8);
  const dTpsa = gaussianDesirability(params.tpsa, 72, 45);
  const dHbd = params.hbd <= 5 ? gaussianDesirability(params.hbd, 1.5, 2.0) : 0.15;
  const dHba = params.hba <= 10 ? gaussianDesirability(params.hba, 4.5, 3.0) : 0.15;
  const dRot = params.rotBonds <= 10 ? gaussianDesirability(params.rotBonds, 4.0, 3.5) : 0.2;
  const dArom = gaussianDesirability(params.aromaticRings, 2.0, 1.4);

  const weighted =
    Math.pow(clamp(dMw, 0.05, 1), 0.20) *
    Math.pow(clamp(dLogP, 0.05, 1), 0.20) *
    Math.pow(clamp(dTpsa, 0.05, 1), 0.16) *
    Math.pow(clamp(dHbd, 0.05, 1), 0.13) *
    Math.pow(clamp(dHba, 0.05, 1), 0.11) *
    Math.pow(clamp(dRot, 0.05, 1), 0.10) *
    Math.pow(clamp(dArom, 0.05, 1), 0.10);

  return Number(clamp(weighted, 0.01, 0.99).toFixed(3));
}

export interface SmilesParseResult {
  valid: boolean;
  error?: string;
  descriptors?: MolecularDescriptors;
}

export function analyzeSmiles(
  rawSmiles: string,
  options?: { showAtomNumbers?: boolean }
): SmilesParseResult {
  const trimmed = rawSmiles.trim();
  if (!trimmed) {
    return { valid: false, error: 'Enter a SMILES notation string to inspect.' };
  }

  try {
    const mol = Molecule.fromSmiles(trimmed);
    const atomCount = mol.getAllAtoms();
    if (atomCount === 0) {
      return { valid: false, error: 'SMILES parsed to an empty molecular graph.' };
    }

    mol.ensureHelperArrays(Molecule.cHelperRings);
    const props = new MoleculeProperties(mol);
    const formulaObj = mol.getMolecularFormula();
    const ringSet = mol.getRingSet();

    let aromaticRingCount = 0;
    const totalRings = ringSet.getSize();
    for (let i = 0; i < totalRings; i++) {
      if (ringSet.isAromatic(i)) {
        aromaticRingCount++;
      }
    }

    let heavyAtomCount = 0;
    for (let a = 0; a < atomCount; a++) {
      if (mol.getAtomicNo(a) > 1) {
        heavyAtomCount++;
      }
    }

    const mw = Number(formulaObj.relativeWeight.toFixed(2));
    const exactMass = Number(formulaObj.absoluteWeight.toFixed(4));
    const cLogP = Number(props.logP.toFixed(2));
    const cLogS = Number(props.logS.toFixed(2));
    const tpsa = Number(props.polarSurfaceArea.toFixed(2));
    const hbd = props.donorCount;
    const hba = props.acceptorCount;
    const rotatableBonds = props.rotatableBondCount;
    const stereoCenterCount = mol.getStereoCenterCount();

    let lipinskiViolations = 0;
    if (mw > 500) lipinskiViolations++;
    if (cLogP > 5) lipinskiViolations++;
    if (hbd > 5) lipinskiViolations++;
    if (hba > 10) lipinskiViolations++;

    const lipinskiPass = lipinskiViolations <= 1;
    const veberPass = tpsa <= 140 && rotatableBonds <= 10;
    const bbbPermeant = tpsa <= 90 && cLogP >= 0.4 && cLogP <= 5.2 && mw <= 450;

    const qedScore = computeDrugLikenessScore({
      mw,
      logP: cLogP,
      tpsa,
      hbd,
      hba,
      rotBonds: rotatableBonds,
      aromaticRings: aromaticRingCount,
    });

    const svgMarkup = mol.toSVG(460, 320, 'mol-viewport-svg', {
      strokeWidth: 1.75,
      fontWeight: '600',
      autoCrop: true,
      autoCropMargin: 26,
      suppressChiralText: false,
      showAtomNumber: Boolean(options?.showAtomNumbers),
    });

    return {
      valid: true,
      descriptors: {
        canonicalSmiles: mol.toSmiles(),
        formula: formulaObj.formula,
        molecularWeight: mw,
        exactMass,
        cLogP,
        cLogS,
        tpsa,
        hbd,
        hba,
        rotatableBonds,
        heavyAtomCount,
        atomCount,
        bondCount: mol.getAllBonds(),
        ringCount: totalRings,
        aromaticRingCount,
        stereoCenterCount,
        lipinskiViolations,
        lipinskiPass,
        veberPass,
        bbbPermeant,
        qedScore,
        svgMarkup,
      },
    };
  } catch (err: unknown) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Unable to parse SMILES notation.',
    };
  }
}

export function evaluateThresholds(
  descriptors: MolecularDescriptors,
  thresholds: ScreeningThresholds
): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (descriptors.molecularWeight > thresholds.maxMw) {
    reasons.push(`MW ${descriptors.molecularWeight} > ${thresholds.maxMw}`);
  }
  if (descriptors.cLogP < thresholds.minLogP || descriptors.cLogP > thresholds.maxLogP) {
    reasons.push(`cLogP ${descriptors.cLogP} outside [${thresholds.minLogP}, ${thresholds.maxLogP}]`);
  }
  if (descriptors.tpsa > thresholds.maxTpsa) {
    reasons.push(`TPSA ${descriptors.tpsa} > ${thresholds.maxTpsa}`);
  }
  if (descriptors.hbd > thresholds.maxHbd) {
    reasons.push(`HBD ${descriptors.hbd} > ${thresholds.maxHbd}`);
  }
  if (descriptors.hba > thresholds.maxHba) {
    reasons.push(`HBA ${descriptors.hba} > ${thresholds.maxHba}`);
  }
  if (descriptors.rotatableBonds > thresholds.maxRotBonds) {
    reasons.push(`RotBonds ${descriptors.rotatableBonds} > ${thresholds.maxRotBonds}`);
  }
  if (descriptors.qedScore < thresholds.minQed) {
    reasons.push(`QED ${descriptors.qedScore.toFixed(2)} < ${thresholds.minQed.toFixed(2)}`);
  }

  return {
    pass: reasons.length === 0,
    reasons,
  };
}

export function formatFormulaParts(formula: string): Array<{ text: string; isSub: boolean }> {
  const parts: Array<{ text: string; isSub: boolean }> = [];
  const regex = /([A-Za-z]+)|(\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(formula)) !== null) {
    if (match[1]) {
      parts.push({ text: match[1], isSub: false });
    } else if (match[2]) {
      parts.push({ text: match[2], isSub: true });
    }
  }
  return parts;
}
