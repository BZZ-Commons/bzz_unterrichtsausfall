import { NextResponse } from 'next/server';
import { getMcpRequestCount } from '@/src/lib/mcp/requestStats';

export const dynamic = 'force-dynamic';

/** Number of MCP requests in the last 15 minutes — consumed by the footer badge. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { count: getMcpRequestCount(), windowMinutes: 15 },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
