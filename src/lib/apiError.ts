import { NextResponse } from 'next/server';

/**
 * Log a route failure server-side and return a generic 500 to the client.
 *
 * Centralizes the "never leak `error.message`" policy: the raw error can carry
 * WebUntis/env internals (e.g. the missing-env-var list), so only `message` —
 * the route's user-facing German text — ever reaches the client.
 */
export function errorResponse(message: string, error: unknown): NextResponse {
  console.error(message, error);
  return NextResponse.json({ error: message }, { status: 500 });
}
