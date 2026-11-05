import { tokenize } from './tokenize';

/** Lightweight deterministic reranker. It rewards exact query-term coverage while
 * preserving the RRF retrieval score. This avoids another LLM call in the hot path. */
export function rerank(query: string, candidates: Array<{ index: number; score: number; text: string }>) {
  const q = new Set(tokenize(query));
  return candidates.map(c => {
    const terms = new Set(tokenize(c.text));
    let overlap = 0;
    for (const term of q) if (terms.has(term)) overlap++;
    const coverage = q.size ? overlap / q.size : 0;
    return { ...c, rerankScore: c.score * 0.7 + coverage * 0.3 };
  }).sort((a,b) => b.rerankScore - a.rerankScore);
}
