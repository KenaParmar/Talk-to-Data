export const runtime = 'nodejs';
export async function GET() { return Response.json({ status: 'ok', service: 'talk-to-data', timestamp: new Date().toISOString() }); }
