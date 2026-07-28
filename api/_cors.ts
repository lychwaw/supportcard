// Shared CORS helper for browser-facing API routes.
// Webhook handlers (dodo-webhook, korapay-webhook) are server-to-server and
// should NOT use this — they reject unexpected origins at the signature level.

const ALLOWED_ORIGINS = new Set([
  process.env.APP_BASE_URL || 'https://supportcard.vercel.app',
  'https://supportcarddemo.vercel.app',
  'http://localhost:8081',
  'http://localhost:3000',
]);

function resolveOrigin(req: any): string {
  const origin = req.headers?.origin ?? '';
  return ALLOWED_ORIGINS.has(origin) ? origin : [...ALLOWED_ORIGINS][0];
}

export function setCorsHeaders(req: any, res: any): void {
  res.setHeader('Access-Control-Allow-Origin', resolveOrigin(req));
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

// Returns true if the request was an OPTIONS preflight (caller should return immediately).
export function handleCors(req: any, res: any): boolean {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}
