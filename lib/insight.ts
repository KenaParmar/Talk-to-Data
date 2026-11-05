import { genMod } from './gemini';
import { SYNTHESIS_PROMPT } from './ai/prompts/synthesis';
import { verifyAnswer, type VerificationResult } from './verification/factual';
import { rateLimit } from './guardrails/rateLimit';
import { validateUserQuery } from './guardrails/safety';

export interface Message { role: 'user' | 'assistant'; content: string; }
export interface SynthesisResult { ans: string; verification: VerificationResult; }

function stripCodeFences(text: string) { return text.replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```$/i, '').trim(); }

async function generate(q: string, dbRes: any, evidence: any[], history: Message[]) {
  const historyBlock = history.slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');
  const prompt = `${SYNTHESIS_PROMPT}\n\nHISTORY:\n${historyBlock}\n\nCURRENT QUESTION:\n${q}\n\nSQL RESULTS:\n${JSON.stringify(dbRes ?? null, null, 2)}\n\nDOCUMENT EVIDENCE:\n${JSON.stringify(evidence ?? [], null, 2)}`;
  return stripCodeFences((await genMod.generateContent(prompt)).response.text().trim());
}

export async function genIns(q: string, dbRes: any, docRes: any[] | null, history: Message[] = [], clientKey = 'anonymous'): Promise<SynthesisResult> {
  validateUserQuery(q);
  if (!rateLimit(`synth:${clientKey}`, 30).allowed) throw new Error('Synthesis rate limit exceeded.');
  if (dbRes == null && (!docRes || !docRes.length)) return { ans: 'No evidence was available to answer this question reliably.', verification: { status: 'UNCERTAIN', issues: ['No evidence'], unsupportedClaims: [], attempts: 0 } };
  let evidence = docRes ?? [];
  let attempts = 0;
  let answer = '';
  let verification: VerificationResult = { status: 'UNCERTAIN', issues: [], unsupportedClaims: [], attempts: 0 };
  while (attempts < 3) {
    attempts++;
    answer = await generate(q, dbRes, evidence, history);
    verification = await verifyAnswer(answer, dbRes, evidence, attempts);
    if (verification.status === 'PASS') break;
    if (verification.status === 'UNCERTAIN' && attempts >= 2) break;
    if (verification.unsupportedClaims.length && evidence.length > 1) evidence = evidence.slice(0, Math.max(1, evidence.length - 1));
  }
  if (verification.status === 'FAIL' && attempts >= 3) {
    answer = `${answer}\n\n> **Verification note:** Some claims could not be fully grounded in the uploaded evidence. Please narrow the question or provide a more specific source.`;
  }
  return { ans: answer, verification: { ...verification, attempts } };
}
