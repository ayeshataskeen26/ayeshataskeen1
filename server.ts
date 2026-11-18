import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import { Molecule, MoleculeProperties } from 'openchemlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw Object.assign(
      new Error('GEMINI_API_KEY is not configured. Add a valid key in Settings > Secrets.'),
      { statusCode: 400 }
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 600 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}

function validateSmiles(smiles: string): { valid: boolean; canonicalSmiles?: string; error?: string } {
  try {
    const trimmed = smiles.trim();
    if (!trimmed) {
      return { valid: false, error: 'SMILES string cannot be empty.' };
    }
    const mol = Molecule.fromSmiles(trimmed);
    if (mol.getAllAtoms() === 0) {
      return { valid: false, error: 'SMILES parsed to zero atoms.' };
    }
    return { valid: true, canonicalSmiles: mol.toSmiles() };
  } catch (err: unknown) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Invalid SMILES notation.',
    };
  }
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const anyErr = err as { status?: number; statusCode?: number; message?: string };
  const status = anyErr?.statusCode || anyErr?.status || 500;
  const rawMessage = anyErr?.message || 'Unexpected error communicating with Gemini API.';

  if (status === 403 || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'API permission denied. Please verify your GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (status === 400 && rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      message: 'Invalid GEMINI_API_KEY. Please check your key in Settings > Secrets.',
    };
  }
  if (status === 429 || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'API rate limit or quota exceeded. Please retry shortly or check quota in Settings > Secrets.',
    };
  }
  if (status === 404 || rawMessage.includes('NOT_FOUND')) {
    return {
      status: 404,
      message: 'Configured Gemini model was not found. Verify model availability.',
    };
  }
  return { status, message: rawMessage };
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/analyze-molecule', async (req, res) => {
    try {
      const { smiles, name, targetName, targetPdb, therapeuticArea, bbbRequired, descriptors } = req.body ?? {};
      if (!smiles || typeof smiles !== 'string') {
        return res.status(400).json({ error: 'A valid SMILES string is required.' });
      }

      const check = validateSmiles(smiles);
      if (!check.valid) {
        return res.status(400).json({ error: check.error || 'Invalid SMILES syntax.' });
      }

      const ai = getGeminiClient();

      const prompt = `Analyze the following small-molecule compound for pharmaceutical drug discovery and medicinal chemistry screening.

Compound Name: ${name || 'Unnamed Candidate'}
Canonical SMILES: ${check.canonicalSmiles}
Target Protein: ${targetName || 'General Small-Molecule Target'} (PDB: ${targetPdb || 'N/A'})
Therapeutic Area: ${therapeuticArea || 'General'}
Blood-Brain Barrier Penetration Required: ${bbbRequired ? 'Yes (CNS target)' : 'No (Peripheral target)'}

Computed Physicochemical Descriptors:
- Formula: ${descriptors?.formula ?? 'N/A'}
- Molecular Weight: ${descriptors?.molecularWeight?.toFixed(2) ?? 'N/A'} Da
- cLogP: ${descriptors?.cLogP?.toFixed(2) ?? 'N/A'}
- TPSA: ${descriptors?.tpsa?.toFixed(2) ?? 'N/A'} A^2
- H-Bond Donors (HBD): ${descriptors?.hbd ?? 'N/A'}
- H-Bond Acceptors (HBA): ${descriptors?.hba ?? 'N/A'}
- Rotatable Bonds: ${descriptors?.rotatableBonds ?? 'N/A'}
- Ring Count: ${descriptors?.ringCount ?? 'N/A'} (Aromatic: ${descriptors?.aromaticRingCount ?? 'N/A'})
- Lipinski Violations: ${descriptors?.lipinskiViolations ?? 'N/A'}

Provide:
1. Target-specific biological activity prediction (estimated pIC50, IC50 in nM, binding probability 0-1, key putative binding pocket interactions, and concise medicinal chemistry rationale).
2. ADMET & toxicity risk assessment (overall risk, hERG channel cardiotoxicity, Ames mutagenicity, hepatotoxicity / DILI, CYP3A4 inhibition, BBB permeability, estimated human oral bioavailability %, any structural alerts such as Michael acceptors, nitroaromatics, reactive halides, or PAINS motifs, and toxicity rationale).
3. Three concrete medicinal chemistry analog modifications with valid, chemically sound SMILES strings that directly modify the input scaffold to improve potency, selectivity, solubility, or safety.`;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'You are a principal computational medicinal chemist and toxicologist. Provide scientifically grounded, quantitative SAR and ADMET evaluations based strictly on the molecular scaffold, functional groups, physicochemical descriptors, and biological target. All suggested analog SMILES must be strictly valid standard SMILES strings.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                predictedActivity: {
                  type: Type.OBJECT,
                  properties: {
                    pIC50: { type: Type.NUMBER },
                    ic50EstimateNm: { type: Type.NUMBER },
                    bindingProbability: { type: Type.NUMBER },
                    mechanismRationale: { type: Type.STRING },
                    keyInteractions: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['pIC50', 'ic50EstimateNm', 'bindingProbability', 'mechanismRationale', 'keyInteractions'],
                },
                toxicityProfile: {
                  type: Type.OBJECT,
                  properties: {
                    overallRisk: { type: Type.STRING, enum: ['Low', 'Moderate', 'High'] },
                    hergRisk: { type: Type.STRING, enum: ['Low', 'Moderate', 'High'] },
                    amesMutagenicity: { type: Type.STRING, enum: ['Negative', 'Equivocal', 'Positive'] },
                    hepatotoxicity: { type: Type.STRING, enum: ['Low', 'Moderate', 'High'] },
                    cyp3a4Inhibition: { type: Type.STRING, enum: ['Low', 'Moderate', 'High'] },
                    bbbPermeability: { type: Type.STRING, enum: ['High', 'Moderate', 'Low'] },
                    oralBioavailabilityPct: { type: Type.NUMBER },
                    structuralAlerts: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    toxicityRationale: { type: Type.STRING },
                  },
                  required: [
                    'overallRisk',
                    'hergRisk',
                    'amesMutagenicity',
                    'hepatotoxicity',
                    'cyp3a4Inhibition',
                    'bbbPermeability',
                    'oralBioavailabilityPct',
                    'structuralAlerts',
                    'toxicityRationale',
                  ],
                },
                analogSuggestions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      smiles: { type: Type.STRING },
                      modificationSummary: { type: Type.STRING },
                      expectedImprovement: { type: Type.STRING },
                    },
                    required: ['name', 'smiles', 'modificationSummary', 'expectedImprovement'],
                  },
                },
              },
              required: ['summary', 'predictedActivity', 'toxicityProfile', 'analogSuggestions'],
            },
          },
        })
      );

      const rawText = (response.text ?? '{}').trim();
      const parsed = JSON.parse(rawText);

      // Verify each suggested analog SMILES with OpenChemLib
      if (Array.isArray(parsed.analogSuggestions)) {
        parsed.analogSuggestions = parsed.analogSuggestions.map(
          (analog: { name: string; smiles: string; modificationSummary: string; expectedImprovement: string }) => {
            const analogCheck = validateSmiles(analog.smiles || '');
            if (!analogCheck.valid) {
              return { ...analog, validSmiles: false };
            }
            const mol = Molecule.fromSmiles(analogCheck.canonicalSmiles!);
            const props = new MoleculeProperties(mol);
            return {
              ...analog,
              smiles: analogCheck.canonicalSmiles!,
              validSmiles: true,
              molecularWeight: Number(mol.getMolecularFormula().relativeWeight.toFixed(2)),
              cLogP: Number(props.logP.toFixed(2)),
            };
          }
        );
      }

      return res.json(parsed);
    } catch (err: unknown) {
      const formatted = formatGeminiError(err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/screen-batch', async (req, res) => {
    try {
      const { candidates, targetName, therapeuticArea, bbbRequired } = req.body ?? {};
      if (!Array.isArray(candidates) || candidates.length === 0) {
        return res.status(400).json({ error: 'Provide at least one valid molecule to screen.' });
      }

      const trimmedBatch = candidates.slice(0, 25);
      const ai = getGeminiClient();

      const batchSummary = trimmedBatch
        .map(
          (c: {
            id: string;
            name: string;
            smiles: string;
            descriptors?: { molecularWeight?: number; cLogP?: number; tpsa?: number; hbd?: number; hba?: number; qedScore?: number };
          }) =>
            `- ID: ${c.id} | Name: ${c.name} | SMILES: ${c.smiles} | MW: ${c.descriptors?.molecularWeight?.toFixed(1) ?? '?'} | cLogP: ${c.descriptors?.cLogP?.toFixed(2) ?? '?'} | TPSA: ${c.descriptors?.tpsa?.toFixed(1) ?? '?'} | QED: ${c.descriptors?.qedScore?.toFixed(2) ?? '?'}`
        )
        .join('\n');

      const prompt = `Perform virtual high-throughput triage for the following candidate molecules against:
Target: ${targetName || 'Small-Molecule Target'}
Therapeutic Area: ${therapeuticArea || 'General'}
BBB Penetration Required: ${bbbRequired ? 'Yes' : 'No'}

Candidates:
${batchSummary}

For each candidate ID, predict:
- predictedPic50 (number, typically 4.0 to 9.5)
- toxicityRisk ('Low' | 'Moderate' | 'High')
- recommendation ('Advance' | 'Optimize' | 'Deprioritize')
- rationale (1 concise sentence explaining SAR fit, selectivity, or toxicity liability)`;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction:
              'You are a computational screening pipeline triage specialist. Evaluate every submitted candidate ID quantitatively and conservatively based on scaffold structure, target compatibility, and ADMET risk.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                results: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      predictedPic50: { type: Type.NUMBER },
                      toxicityRisk: { type: Type.STRING, enum: ['Low', 'Moderate', 'High'] },
                      recommendation: { type: Type.STRING, enum: ['Advance', 'Optimize', 'Deprioritize'] },
                      rationale: { type: Type.STRING },
                    },
                    required: ['id', 'predictedPic50', 'toxicityRisk', 'recommendation', 'rationale'],
                  },
                },
              },
              required: ['results'],
            },
          },
        })
      );

      const rawText = (response.text ?? '{"results":[]}').trim();
      const parsed = JSON.parse(rawText);
      return res.json(parsed);
    } catch (err: unknown) {
      const formatted = formatGeminiError(err);
      return res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MolSpec Discovery server running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
