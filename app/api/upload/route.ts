import { NextRequest, NextResponse } from 'next/server';

// Legacy upload endpoint — kept for backward compatibility.
// In the current architecture, all file processing happens client-side
// via DuckDB WASM and PDF.js in the browser. This route is a no-op stub.

export async function POST(req: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Upload is handled client-side. No server processing needed.',
  });
}
