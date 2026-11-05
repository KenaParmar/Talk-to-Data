import { genMod } from './gemini';
import { ROUTER_PROMPT } from './ai/prompts/router';
import type { Route } from './agent/state';

export async function getRt(q: string, hasDb: boolean, hasDocs: boolean): Promise<Route> {
  if (!hasDb && !hasDocs) return 'UNSAFE';
  const prompt = `${ROUTER_PROMPT}\n\nAvailable structured data: ${hasDb}\nAvailable documents: ${hasDocs}\n\nUser query:\n${q}`;
  const label = (await genMod.generateContent(prompt)).response.text().trim().toUpperCase().match(/DATA|DOCS|BOTH|UNSAFE/)?.[0] as Route | undefined;
  if (label === 'DATA' && hasDb) return label;
  if (label === 'DOCS' && hasDocs) return label;
  if (label === 'BOTH' && hasDb && hasDocs) return label;
  if (label === 'UNSAFE') return 'UNSAFE';
  return hasDb && hasDocs ? 'BOTH' : hasDb ? 'DATA' : 'DOCS';
}
