import { NextRequest } from 'next/server';
import { fixSql } from '@/lib/sqlgen';
import { rateLimit } from '@/lib/guardrails/rateLimit';
import { validateUserQuery } from '@/lib/guardrails/safety';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
  if (!rateLimit(`fix:${key}`, 10).allowed) return Response.json({ error: 'SQL repair rate limit exceeded.' }, { status: 429 });
  try {
    const { q, schema, badSql, errMsg } = await req.json();
    validateUserQuery(String(q || ''));
    const sql = await fixSql(String(q), String(schema), String(badSql), String(errMsg));
    return Response.json({ sql });
  } catch (err: any) { return Response.json({ error: err.message }, { status: 400 }); }
}
