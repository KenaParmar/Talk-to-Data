export interface ChunkRecord {
  id: string;
  text: string;
  page?: number;
  section?: string;
}

export function chunkDocument(text: string, opts: { maxChars?: number; overlapChars?: number } = {}): ChunkRecord[] {
  const maxChars = opts.maxChars ?? 1800;
  const overlapChars = opts.overlapChars ?? 250;
  const cleaned = text.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
  if (!cleaned) return [];
  const paragraphs = cleaned.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks: ChunkRecord[] = [];
  let current = '';
  let index = 0;
  for (const paragraph of paragraphs) {
    if ((current + ' ' + paragraph).trim().length <= maxChars) {
      current = `${current} ${paragraph}`.trim();
    } else {
      if (current) chunks.push({ id: `chunk-${index++}`, text: current });
      const overlap = current.slice(Math.max(0, current.length - overlapChars));
      current = `${overlap} ${paragraph}`.trim();
      while (current.length > maxChars) {
        chunks.push({ id: `chunk-${index++}`, text: current.slice(0, maxChars) });
        current = current.slice(Math.max(1, maxChars - overlapChars));
      }
    }
  }
  if (current) chunks.push({ id: `chunk-${index++}`, text: current });
  return chunks;
}
