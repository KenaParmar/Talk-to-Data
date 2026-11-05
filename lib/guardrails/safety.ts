import { detectPromptInjection } from './promptInjection';
import { detectSecrets, validateTextSize } from './privacy';

export function validateUserQuery(query: string) {
  const q = query.trim();
  validateTextSize(q, 'query');
  if (!q) throw new Error('Query is required.');
  if (detectPromptInjection(q)) throw new Error('The request was blocked by the prompt-injection safety guardrail.');
  if (detectSecrets(q)) throw new Error('The request appears to contain a secret or credential. Remove it before continuing.');
}
