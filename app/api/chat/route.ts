import { NextRequest } from 'next/server';
import { getRt } from '@/lib/route';
import { genSql } from '@/lib/sqlgen';
import { chunkDocument } from '@/lib/retrieval/chunker';
import { hybridSearch } from '@/lib/retrieval/hybrid';
import { privacyScan } from '@/lib/guardrails/privacy';
import { validateUserQuery } from '@/lib/guardrails/safety';
import { rateLimit } from '@/lib/guardrails/rateLimit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
  const rl = rateLimit(`chat:${key}`);
  if (!rl.allowed) return Response.json({ error: 'Rate limit exceeded. Please try again shortly.' }, { status: 429 });
  try {
    const body = await req.json();
    const q = String(body?.q ?? '').trim();
    const schema = body?.schema ? String(body.schema) : null;
    const txtContent = body?.txtContent ? String(body.txtContent) : null;
    validateUserQuery(q);
    if (txtContent) {
      const scan = privacyScan(txtContent);
      if (scan.containsSecrets) return Response.json({ error: 'Document appears to contain credentials or secrets. Remove them before uploading.' }, { status: 400 });
    }
    const rt = await getRt(q, !!schema, !!txtContent);
    if (rt === 'UNSAFE') return Response.json({ error: 'Request blocked by safety guardrails.' }, { status: 400 });
    let sql: string | null = null;
    let evidence: any[] = [];
    if ((rt === 'DATA' || rt === 'BOTH') && schema) sql = await genSql(q, schema);
    if ((rt === 'DOCS' || rt === 'BOTH') && txtContent) {
      const chunks = chunkDocument(txtContent);
      evidence = await hybridSearch(q, chunks);
    }
    return Response.json({ rt, sql, doc: evidence.map(e => e.text), evidence, meta: { rateLimitRemaining: rl.remaining, route: rt } });
  } catch (err: any) {
    console.error('[API/chat]', err.message);
    return Response.json({ error: err.message || 'Internal server error' }, { status: 400 });
  }
}
