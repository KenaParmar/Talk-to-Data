import { NextRequest } from 'next/server';
import { genIns, Message } from '@/lib/insight';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const q = String(body?.q ?? '');
    const result = await genIns(q, body?.dbRows ?? null, body?.evidence ?? body?.docChunks ?? null, (body?.history as Message[]) ?? [], req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous');
    return Response.json(result);
  } catch (err: any) { return Response.json({ error: err.message }, { status: 400 }); }
}
