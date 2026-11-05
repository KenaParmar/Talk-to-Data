import { tokenize } from './tokenize';

export function bm25(query: string, docs: string[], k1 = 1.5, b = 0.75) {
  const q = [...new Set(tokenize(query))];
  const tokenized = docs.map(tokenize);
  const avgdl = tokenized.reduce((a, d) => a + d.length, 0) / Math.max(1, tokenized.length);
  const df = new Map<string, number>();
  for (const tokens of tokenized) for (const term of new Set(tokens)) df.set(term, (df.get(term) ?? 0) + 1);
  return docs.map((doc, i) => {
    const tokens = tokenized[i];
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    let score = 0;
    for (const term of q) {
      const freq = counts.get(term) ?? 0;
      if (!freq) continue;
      const n = df.get(term) ?? 0;
      const idf = Math.log(1 + (tokenized.length - n + 0.5) / (n + 0.5));
      score += idf * ((freq * (k1 + 1)) / (freq + k1 * (1 - b + b * (tokens.length / Math.max(1, avgdl)))));
    }
    return { index: i, score, doc };
  }).sort((a, b) => b.score - a.score);
}
