/**
 * Backwards-compatible RAG entry point.
 * The production path now lives in lib/retrieval/* and performs
 * cached embeddings + hybrid semantic/keyword retrieval + RRF fusion.
 */
import { chunkDocument } from './retrieval/chunker';
import { hybridSearch } from './retrieval/hybrid';

export async function srchFromText(q: string, txtContent: string, k = 5) {
  if (!txtContent?.trim()) return [];
  const chunks = chunkDocument(txtContent);
  return (await hybridSearch(q, chunks, k)).map(x => x.text);
}
