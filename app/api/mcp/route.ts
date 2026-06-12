/**
 * MCP server endpoint (`/api/mcp`, Streamable HTTP via mcp-handler).
 *
 * Exposes the WebUntis calendar data as MCP tools (see src/lib/mcp/tools.ts).
 * Rate limit: 20 requests / minute / IP (in-memory fixed window). Clients with
 * the admin key (`MCP_ADMIN_KEY` env) bypass the limit via `?key=<uuid>` on
 * the MCP URL. No `runtime` export — must stay on the Node runtime.
 */
import { createMcpHandler } from 'mcp-handler';
import { registerTools } from '@/src/lib/mcp/tools';
import { getClientIp, isAdminKey, mcpRateLimiter } from '@/src/lib/mcp/rateLimiter';
import { recordMcpRequest } from '@/src/lib/mcp/requestStats';

export const dynamic = 'force-dynamic';

const handler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  { serverInfo: { name: 'unterrichtsausfall-bzz', version: '1.0.0' } },
  { basePath: '/api', verboseLogs: false, disableSse: true, maxDuration: 60 },
);

/** Returns a 429 response when the caller is rate-limited, or null to proceed. */
function guard(req: Request): Response | null {
  // Reads only URL + headers — the body must stay untouched for the handler.
  if (isAdminKey(new URL(req.url).searchParams.get('key'))) return null;
  const { allowed, retryAfterSec } = mcpRateLimiter.check(getClientIp(req));
  if (allowed) return null;
  return new Response(
    JSON.stringify({ error: 'Zu viele Anfragen. Bitte warte eine Minute und versuche es erneut.' }),
    {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(retryAfterSec) },
    },
  );
}

const guarded = (req: Request): Response | Promise<Response> => {
  recordMcpRequest();
  return guard(req) ?? handler(req);
};

export { guarded as GET, guarded as POST, guarded as DELETE };
