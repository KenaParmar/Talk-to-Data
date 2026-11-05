import { genMod } from '../gemini';
import { VERIFICATION_PROMPT } from '../ai/prompts/verification';

export interface VerificationResult { status: 'PASS'|'FAIL'|'UNCERTAIN'; issues: string[]; unsupportedClaims: string[]; attempts: number; }

function deterministicNumericCheck(answer: string, dbRows: any) {
  if (!Array.isArray(dbRows)) return [] as string[];
  const serialized = JSON.stringify(dbRows);
  const numbers = answer.match(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g) ?? [];
  const issues: string[] = [];
  for (const raw of numbers) {
    const normalized = raw.replace(/,/g, '');
    if (!serialized.includes(normalized) && !serialized.includes(raw)) {
      // Percentages and derived calculations can be legitimate; let the LLM verifier decide.
      if (!/%$/.test(raw)) issues.push(`Numerical claim ${raw} was not found verbatim in SQL evidence.`);
    }
  }
  return issues;
}

export async function verifyAnswer(answer: string, dbRows: any, evidence: any[], attempts = 1): Promise<VerificationResult> {
  const deterministicIssues = deterministicNumericCheck(answer, dbRows);
  const prompt = `${VERIFICATION_PROMPT}\n\nANSWER:\n${answer}\n\nSQL EVIDENCE:\n${JSON.stringify(dbRows ?? null)}\n\nDOCUMENT EVIDENCE:\n${JSON.stringify(evidence ?? [], null, 2)}`;
  const raw = (await genMod.generateContent(prompt)).response.text().trim().replace(/^```json|```$/g, '').trim();
  try {
    const parsed = JSON.parse(raw);
    const issues = [...deterministicIssues, ...(parsed.issues ?? [])];
    return { status: issues.length ? 'FAIL' : parsed.status ?? 'UNCERTAIN', issues, unsupportedClaims: parsed.unsupportedClaims ?? [], attempts };
  } catch {
    return { status: deterministicIssues.length ? 'FAIL' : 'UNCERTAIN', issues: deterministicIssues.concat('Verifier returned malformed JSON.'), unsupportedClaims: [], attempts };
  }
}
