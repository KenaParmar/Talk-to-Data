import { embMod } from '../gemini';
import { bm25 } from './bm25';
import { tokenize } from './tokenize';
import { rerank } from './reranker';
import { LIMITS } from '../guardrails/limits';
import type { ChunkRecord } from './chunker';

interface IndexedChunk extends ChunkRecord { embedding: number[]; }
interface CacheEntry { key: string; chunks: IndexedChunk[]; createdAt: number; }
const cache = new Map<string, CacheEntry>();

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

async function embed(text: string) {
  return (await embMod.embedContent(text)).embedding.values;
}

function simpleKey(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${h >>> 0}:${text.length}`;
}

export async function buildIndex(key: string, chunks: ChunkRecord[]) {
  const existing = cache.get(key);
  if (existing) return existing.chunks;
  if (chunks.length > LIMITS.maxChunks) throw new Error('Document contains too many chunks. Reduce document size.');
  const indexed: IndexedChunk[] = [];
  for (const chunk of chunks) {
    indexed.push({ ...chunk, embedding: await embed(chunk.text) });
    await new Promise(r => setTimeout(r, 80));
  }
  cache.set(key, { key, chunks: indexed, createdAt: Date.now() });
  return indexed;
}

export async function hybridSearch(query: string, rawChunks: ChunkRecord[], k = LIMITS.maxEvidence) {
  const key = simpleKey(rawChunks.map(c => c.text).join('\n'));
  const indexed = await buildIndex(key, rawChunks);
  const qVec = await embed(query);
  const semantic = indexed.map((c, i) => ({ index: i, score: cosine(qVec, c.embedding) })).sort((a,b)=>b.score-a.score).slice(0, LIMITS.maxRetrievalCandidates);
  const keyword = bm25(query, indexed.map(c => c.text)).slice(0, LIMITS.maxRetrievalCandidates);
  const rank = new Map<number, number>();
  for (const [i, x] of semantic.entries()) rank.set(x.index, (rank.get(x.index) ?? 0) + 1 / (60 + i + 1));
  for (const [i, x] of keyword.entries()) rank.set(x.index, (rank.get(x.index) ?? 0) + 1 / (60 + i + 1));
  const fused = [...rank.entries()].sort((a,b)=>b[1]-a[1]).slice(0, LIMITS.maxRetrievalCandidates).map(([index, score]) => ({ index, score, text: indexed[index].text }));
  return rerank(query, fused).slice(0,k).map(({ index, rerankScore }) => ({ ...indexed[index], score: rerankScore, retrieval: 'hybrid' as const }));
}

export function clearRetrievalCache() { cache.clear(); }
