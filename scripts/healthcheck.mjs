#!/usr/bin/env node
/**
 * Production health check.
 *
 *   node scripts/healthcheck.mjs
 *
 * Verifies every deployed API endpoint answers the way it does when healthy.
 * The case this exists for: on 2026-09-07 a TypeScript error failed every
 * Vercel build for ~13 hours. Vercel keeps serving the last good deployment
 * when a build fails, so the app appeared fine while two endpoints returned
 * 404. Nothing surfaced it. This would have caught it in about four seconds.
 *
 * A 401 or 405 means the route exists and is rejecting the request correctly —
 * that is a PASS. A 404 means the route was never deployed. A 500 means it
 * deployed and is broken.
 *
 * Exits non-zero on any failure, so it can be wired into CI or a cron later.
 */

const API = 'https://supportcard-prod.vercel.app';
const SITE = 'https://supportcard.co.za';
const TIMEOUT_MS = 20_000;

// Baseline captured 2026-09-11 against a known-good deployment.
const CHECKS = [
  // --- API: auth-gated endpoints -------------------------------------------
  { group: 'API', name: 'ai',                  url: `${API}/api/ai`,                  method: 'POST', expect: 401 },
  { group: 'API', name: 'apns',                url: `${API}/api/apns`,                method: 'POST', expect: 401 },
  { group: 'API', name: 'dodo-checkout',       url: `${API}/api/dodo-checkout`,       method: 'POST', expect: 401 },
  { group: 'API', name: 'dodo-webhook',        url: `${API}/api/dodo-webhook`,        method: 'POST', expect: 401 },
  { group: 'API', name: 'korapay',             url: `${API}/api/korapay`,             method: 'POST', expect: 401 },
  { group: 'API', name: 'professional-invite', url: `${API}/api/professional-invite`, method: 'POST', expect: 401 },
  { group: 'API', name: 'recurring-expenses',  url: `${API}/api/recurring-expenses`,  method: 'POST', expect: 401 },
  { group: 'API', name: 'referral-capture',    url: `${API}/api/referral-capture`,    method: 'POST', expect: 401 },
  { group: 'API', name: 'sync-tier',           url: `${API}/api/sync-tier`,           method: 'POST', expect: 401 },
  { group: 'API', name: 'mapkit-token',        url: `${API}/api/mapkit-token`,        method: 'GET',  expect: 401 },
  { group: 'API', name: 'delete-account',      url: `${API}/api/delete-account`,      method: 'POST', expect: 405 },

  // --- Security: the webhook must reject forged purchase events -------------
  {
    group: 'SECURITY',
    name: 'revenuecat-webhook rejects no-auth',
    url: `${API}/api/revenuecat-webhook`,
    method: 'POST',
    expect: 401,
    body: { event: { type: 'INITIAL_PURCHASE', app_user_id: '00000000-0000-0000-0000-000000000000', entitlement_ids: ['premium'] } },
    note: 'a 200 here means anyone can grant themselves Premium',
  },
  {
    group: 'SECURITY',
    name: 'revenuecat-webhook rejects bad secret',
    url: `${API}/api/revenuecat-webhook`,
    method: 'POST',
    expect: 401,
    headers: { Authorization: 'Bearer not-the-real-secret' },
    body: { event: { type: 'INITIAL_PURCHASE', app_user_id: '00000000-0000-0000-0000-000000000000', entitlement_ids: ['premium'] } },
  },

  // --- Public surfaces ------------------------------------------------------
  { group: 'WEB', name: 'marketing site',  url: SITE,             method: 'GET', expect: 200 },
  { group: 'WEB', name: 'privacy policy',  url: `${SITE}/privacy`, method: 'GET', expect: 200, note: 'App Store requires this to resolve' },
  { group: 'WEB', name: 'terms',           url: `${SITE}/terms`,   method: 'GET', expect: 200, note: 'linked from the paywall' },
];

async function probe(check) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(check.url, {
      method: check.method,
      headers: { 'Content-Type': 'application/json', ...(check.headers ?? {}) },
      body: check.method === 'POST' ? JSON.stringify(check.body ?? {}) : undefined,
      signal: ctrl.signal,
      redirect: 'follow',
    });
    return { status: res.status };
  } catch (err) {
    return { status: 0, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

function diagnose(check, got) {
  if (got === 404) return 'NOT DEPLOYED — the build failed and Vercel is serving an older deployment';
  if (got >= 500) return 'deployed but erroring — check Vercel logs';
  if (got === 0) return 'unreachable';
  return `expected ${check.expect}`;
}

const results = [];
for (const check of CHECKS) {
  const { status, error } = await probe(check);
  const ok = status === check.expect;
  results.push({ check, status, ok, error });

  const mark = ok ? 'PASS' : 'FAIL';
  const label = `${check.group}/${check.name}`.padEnd(44);
  const detail = ok
    ? String(status)
    : `${status || error}  <- ${diagnose(check, status)}`;
  console.log(`  ${mark}  ${label} ${detail}`);
  if (!ok && check.note) console.log(`        note: ${check.note}`);
}

const failed = results.filter(r => !r.ok);
console.log('');
if (failed.length === 0) {
  console.log(`All ${results.length} checks passed.`);
  process.exit(0);
}
console.log(`${failed.length} of ${results.length} checks FAILED:`);
for (const f of failed) console.log(`  - ${f.check.group}/${f.check.name}`);
process.exit(1);
