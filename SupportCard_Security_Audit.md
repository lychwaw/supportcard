# SupportCard Platform — Security Audit & Technical Review

**Classification:** Confidential — For External Security Reviewer  
**Date:** July 2026  
**Platform:** SupportCard (Co-Parenting Coordination Platform)  
**Repository:** github.com/lychwaw/bluebird-payments-pro  
**Prepared by:** Internal Engineering Team  

---

## 1. Executive Summary

SupportCard is a co-parenting coordination platform comprising a web application (Vite/React, deployed on Vercel) and a mobile application (Expo React Native SDK 57). The backend is Supabase (PostgreSQL + Auth + Row Level Security). The platform uses the Anthropic Claude API for three AI-powered features. **No money moves through the app** — it is record-keeping software only. Dodo Payments handles subscription billing as Merchant of Record.

An internal security review was conducted against the OWASP Secure Coding with AI Cheat Sheet (17 controls across 14 sections). 15 of 17 identified controls have been implemented. This document details current security posture, known gaps, and requirements for production readiness.

---

## 2. Architecture Overview

| Layer | Technology | Notes |
|---|---|---|
| Web Frontend | Vite + React + TypeScript + Tailwind + shadcn/ui | Deployed on Vercel |
| Mobile Frontend | Expo SDK 57, Expo Router, React Native | EAS Build required for production binary |
| Backend | Supabase (PostgreSQL + Auth + RLS + Storage) | Project ID: owwxfifduexcahsvtyzn |
| Serverless API | Vercel Functions (TypeScript, 8/12 Hobby slots used) | Edge functions in `api/` directory |
| AI Provider | Anthropic Claude API (claude-haiku-4-5-20251001) | Server-side ONLY — key never exposed to client |
| Payments | Dodo Payments (Merchant of Record) | Subscription billing only — no fund transfers |
| ID Verification | KoraPay | South African ID (SAID) number verification only |
| Push Notifications | Apple APNs | Via `api/apns.ts` handler |
| Maps | Apple MapKit JS (web) / expo-location GPS (mobile) | GPS used for custody handoff verification |

### No-Money-Movement Principle

Enforced architecturally. Dodo Payments is wired exclusively to `api/dodo-checkout.ts` and `api/dodo-webhook.ts`. The webhook only updates `profiles.subscription_tier`. There is no wallet, no balance, and no fund transfer between parents anywhere in the codebase. The settlement ledger displays a computed value only — settlement happens off-platform via EFT.

---

## 3. AI Security Review (OWASP AI Cheat Sheet)

### 3.1 Claude API Viability Assessment

**Question: Is using the Anthropic Claude API for My SCAI and AI features viable and secure?**

**Answer: YES — with the current server-side architecture.**

The implementation is architecturally correct:

- The `ANTHROPIC_API_KEY` lives **only** in Vercel environment variables (server-side)
- The mobile app calls `${EXPO_PUBLIC_API_BASE_URL}/api/ai` — it never contacts Anthropic directly
- The API key is never bundled into the mobile app binary or web JavaScript bundle
- All Supabase JWTs are verified server-side before any AI call proceeds
- **Rate limiting:** 150 AI calls per user per day, enforced via `ai_rate_limits` Postgres table + atomic `check_ai_rate_limit()` RPC (prevents abuse even if client bypasses the UI)
- **PII scrubbing:** Applied server-side to all user messages before they reach Anthropic

**My SCAI tool-use model:** Uses Anthropic's real function-calling API (not text-parsed JSON). Tools are hardcoded server-side. `user_id` is always injected from the verified JWT — the model cannot supply or override it. Tool writes use a user-scoped Supabase client (anon key + user JWT) so RLS is enforced for all AI-initiated database writes.

**AI Receipt Scanner:** Uses Claude vision API (base64 image → structured JSON extraction). Image size is capped server-side. Images are never stored by Anthropic beyond the request/response lifecycle (Anthropic does not train on API data by default per their usage policy).

**Current blocking issue:** `ANTHROPIC_API_KEY` is not set in Vercel production environment. All AI features are currently non-functional in production.

### 3.2 OWASP AI Controls Status

| Control | Status | Notes |
|---|---|---|
| §1 Hallucinated Dependencies | ✅ Fixed | All packages verified; `npx expo install` used for SDK-compatible versions |
| §2 Outdated Dependencies/CVEs | ⚠️ Partial | 21 → 2 remaining (esbuild/vite dev-only; not in production bundle) |
| §3 Indirect Prompt Injection | ✅ Fixed | INJECTION_PATTERNS guard applied to full message history; system prompt includes anti-jailbreak directive |
| §4 MCP and Tool Security | ✅ Fixed | Tools hardcoded server-side; userId injected from JWT; model cannot supply ownership fields |
| §5 Agent Runtime Sandboxing | ✅ Fixed | Max 4 tool iterations per SCAI turn; expense cap R50,000 enforced server-side |
| §6 Rules Files | ✅ Fixed | `.agents/`, `.claude/`, `CLAUDE.md`, `AGENTS.md` added to `.gitignore`; CODEOWNERS created |
| §7 Out-of-Scope Edits | ✅ Fixed | CODEOWNERS gates `api/`, `supabase/migrations/`, `vercel.json`, `src/contexts/`, `usePermissions.ts` |
| §8 Test Fabrication | ⚠️ Partial | vitest + @testing-library/react installed; only 1 test file exists |
| §9 Prompt Context Leakage | ✅ Fixed | PII scrubbed server-side; disclosure shown in My SCAI UI; API key server-side only |
| §10 Supply Chain Risk | ✅ Fixed | GitHub Actions CI with `npm audit --audit-level=high` on every PR |
| §11 CI/CD Agents | ✅ Fixed | Workflow created; agent-rules-file change detection; secrets in GitHub Actions |
| §12 Unicode/Markdown Injection | ✅ Fixed | CSP `unsafe-eval` removed; SCAI output rendered as plain text (no `dangerouslySetInnerHTML`) |
| §13 Multi-Agent Propagation | ✅ Fixed | No multi-agent chaining; single Anthropic call per turn; tool results are server-generated JSON only |
| §14 Human Accountability | ✅ Fixed | `created_via TEXT DEFAULT 'manual'` on `expense_requests`, `calendar_events`, `custody_checkins`; SCAI-created records tagged `'scai'` |

---

## 4. Critical Security Issues

### 4.1 Secret Exposure in Git History — Immediate Action Required

The following secrets were committed to the git repository in commit `bfbe8cb` and remain in remote git history. They must be rotated immediately regardless of whether the old values still work:

| Secret | Rotation Location |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → Reset service role key |
| `KORAPAY_SECRET_KEY` | KoraPay Dashboard → API Keys → Revoke and reissue |
| `APNS_PRIVATE_KEY` | Apple Developer → Certificates → Revoke and re-issue the .p8 key |
| `APPLE_MAPKIT_PRIVATE_KEY` | Apple Developer → MapKit JS key → Revoke and re-issue |
| `YOCO_SECRET_KEY` / `YOCO_WEBHOOK_SECRET` | Yoco Dashboard → Developer Settings → Revoke (Yoco removed from codebase but leaked key is still valid) |

**Severity: CRITICAL.** These keys provide elevated access to production systems (Supabase service role bypasses all RLS).

If the repository was ever public or accessible to non-team members, run `git filter-repo` to scrub history and force-push to remove the exposed values permanently.

### 4.2 Missing ANTHROPIC_API_KEY

**Status:** NOT SET in Vercel production environment.

**Impact:** My SCAI, AI Tone-Check, AI Receipt Scanner, and Monthly Child Report are ALL non-functional. These are core differentiating features of the platform.

**Action:** Add `ANTHROPIC_API_KEY=sk-ant-api03-...` to Vercel project environment variables. Obtain from console.anthropic.com. Estimated cost: ~$0.25–$2 per 1,000 active users per day at haiku pricing.

### 4.3 Production Environment Variables — Not Configured in Vercel

All variables below are absent from the Vercel production environment:

| Variable | Impact if Missing |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | All API routes fail — auth verification, AI calls, webhooks, ID verification |
| `SUPABASE_ANON_KEY` | SCAI tool writes fall back to service-role (bypasses RLS) |
| `ANTHROPIC_API_KEY` | All AI features non-functional |
| `DODO_PAYMENTS_API_KEY` | Subscription checkout non-functional |
| `DODO_PAYMENTS_WEBHOOK_SECRET` | Webhook signature verification fails; subscriptions never activate |
| `DODO_PAYMENTS_ENVIRONMENT` | Must be `live_mode` for production |
| `DODO_PRODUCT_ID_ESSENTIAL` | Checkout cannot map tier to product |
| `DODO_PRODUCT_ID_PLUS` | Checkout cannot map tier to product |
| `DODO_PRODUCT_ID_PLUS_FOUNDER` | Checkout cannot map tier to product |
| `DODO_PRODUCT_ID_PREMIUM` | Checkout cannot map tier to product |
| `KORAPAY_SECRET_KEY` | SA ID verification non-functional |
| `APNS_KEY_ID` | Push notifications non-functional |
| `APNS_TEAM_ID` | Push notifications non-functional |
| `APNS_PRIVATE_KEY` | Push notifications non-functional |
| `APPLE_TEAM_ID` | MapKit JS token generation fails |
| `APPLE_MAPKIT_KEY_ID` | MapKit JS token generation fails |
| `APPLE_MAPKIT_PRIVATE_KEY` | MapKit JS token generation fails |
| `APP_BASE_URL` | Dodo checkout success/cancel redirects go to wrong URL |

---

## 5. Database Security

### 5.1 Row Level Security (RLS)

RLS is enabled on all Supabase tables. Key policies:

- `expense_requests`: `auth.uid() = requester_id` for INSERT/SELECT
- `calendar_events`: `auth.uid() = user_id`
- `custody_checkins`: `auth.uid() = user_id` OR co-parenting access
- `children`: `auth.uid() = parent_id` OR `auth.uid() = co_parent_id`
- `professional_links`: scoped to `parent_id` and `professional_id`
- `ai_rate_limits`: No direct client access — only via `SECURITY DEFINER` RPC function

**Review requested:** Confirm `professional_links` RLS prevents a professional from accessing data outside their linked families. Confirm SCAI tool writes to `custody_checkins` with `zone_id: null` are correct (zone lookup intentionally deferred).

### 5.2 Pending Migrations — NOT YET APPLIED TO PRODUCTION

All 6 migrations below must be applied to the production Supabase project (`owwxfifduexcahsvtyzn`) before launch:

| Migration File | Purpose | Priority |
|---|---|---|
| `20260617_neutral_ledger_custody_clock.sql` | custody_checkins, custody_zones, custody_exchange_logs tables | High |
| `20260617_no_wallet_holding.sql` | Removes money-movement tables, adds custody_split_pct | High |
| `20260617_audit_security_fixes.sql` | Security hardening on existing tables | High |
| `20260618_professional_role_and_goals.sql` | professional_links, child_goals, goal_contributions | High |
| `20260629_dodo_payments_and_new_tiers.sql` | dodo_subscription_id/customer_id on profiles, tier vocabulary | High |
| `20260701_security_hardening.sql` | **ai_rate_limits table + check_ai_rate_limit() RPC + created_via columns** | **CRITICAL** |

Additional migrations required (not yet written):
- `child_emergency_profiles` table (allergies, medications, blood_type, medical_aid, doctor/dentist info)
- `school_notices` table (school_name, notice_text, category, child_id, created_by, date)
- `court_orders` and `compliance_logs` tables (currently showing hardcoded placeholder data)

### 5.3 Stale TypeScript Types

`src/integrations/supabase/types.ts` is out of sync with the actual schema (many new tables added via migrations). This forces ~120 `as any` casts throughout the codebase, masking type-level RLS errors.

**Fix command:**
```bash
supabase gen types typescript \
  --project-id owwxfifduexcahsvtyzn \
  --schema public \
  > src/integrations/supabase/types.ts
```

---

## 6. Mobile App Security

### 6.1 Secret Handling

- `EXPO_PUBLIC_*` variables are bundled into the app binary (visible via decompilation) — only anon/publishable keys should use this prefix
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — **correct** (anon key is public by design, protected by RLS)
- `EXPO_PUBLIC_API_BASE_URL` — **correct** (just a URL, no secret)
- `ANTHROPIC_API_KEY` — **never exposed to mobile app** (server-side only ✅)
- `SUPABASE_SERVICE_ROLE_KEY` — **never exposed to mobile app** ✅

### 6.2 Authentication

- Supabase auth tokens stored in `expo-secure-store` (device encrypted keychain on iOS/Android)
- Web SSR fallback uses in-memory storage (no SecureStore on Node)
- Session refresh handled automatically by Supabase JS client
- JWT verified server-side on every API call via `supabase.auth.getUser(token)`

### 6.3 Deep Linking

- Professional invite deep links use custom scheme: `supportcard://auth?ptoken=xxx`
- Token verified against `professional_links` table before routing to signup
- Tokens are single-use — marked used on professional account creation

---

## 7. Content Security Policy

Current CSP configured in `vercel.json`:

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://cdn.apple-mapkit.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co
            https://api.korapay.com https://*.apple-mapkit.com
            https://cdn.apple-mapkit.com;
worker-src 'self' blob:;
frame-ancestors 'none';
```

| Item | Status |
|---|---|
| `unsafe-eval` removed | ✅ Fixed (previously present, breaks XSS protection) |
| `api.anthropic.com` excluded from connect-src | ✅ Correct (AI calls are server-side, never browser-direct) |
| `unsafe-inline` in script-src | ⚠️ Remains — required by Vite's inline scripts and MapKit JS; harden with nonce-based CSP |

---

## 8. POPIA / GDPR Compliance Notes

| Item | Status |
|---|---|
| Cross-border AI data transfer | ⚠️ User messages + expense descriptions sent to Anthropic's US API (after PII scrubbing). POPIA requires lawful basis for cross-border transfer, especially data relating to minors. |
| Data subject deletion rights | ❌ No formal deletion endpoint beyond UI placeholder alert |
| Child data processing | ⚠️ Platform processes data about minors. POPIA Section 35 applies. |
| AI processing consent | ❌ No explicit consent disclosure in onboarding about AI feature usage |
| Data export (portability) | ❌ Not implemented |

**Recommendations:**
1. Add explicit POPIA consent disclosure in onboarding (AI processing, cross-border transfer)
2. Implement account data deletion endpoint (deletes profile, children, all linked records)
3. Implement data export endpoint (POPIA portability right)

---

## 9. Remaining Vulnerabilities

| Issue | Severity | Context |
|---|---|---|
| esbuild ≤0.24.2 (via Vite dev dependency) | Moderate | Dev-only, not in production build |
| vite ≤6.4.2 (dev dependency) | High | Dev-only; fix requires Vite 5→8 major upgrade |
| `unsafe-inline` in CSP script-src | Medium | Required for current Vite/MapKit setup; harden with nonce-based CSP |
| Test coverage: 1 test file | Medium | vitest installed but only Auth.test.tsx exists |
| No rate limiting on `dodo-checkout` / `korapay` routes | Low | Only `/api/ai` has rate limiting; other routes rely on Dodo/KoraPay's own limits |
| Hardcoded exchange rate 1 USD = 16.16 ZAR | Low | Will become inaccurate; consider periodic fetch from exchange rate API |

---

## 10. Recommendations for External Reviewer

### Immediate (must complete before any real user can access the app)

1. Rotate all 5 leaked secrets and add rotated values to Vercel (§4.1)
2. Set all missing Vercel production environment variables (§4.3)
3. Apply all 6 DB migrations to production Supabase in order (§5.2)
4. Add `ANTHROPIC_API_KEY` to Vercel — AI features are the platform's core differentiator (§4.2)

### Short-term

5. Regenerate Supabase TypeScript types after migrations applied (§5.3)
6. Add data deletion + export API endpoints (POPIA compliance)
7. Add POPIA/AI processing consent to onboarding
8. Upgrade Vite to v8 to resolve last 2 npm audit vulnerabilities
9. Expand test suite (auth flows, RLS enforcement, payment webhooks)
10. Write and apply missing DB migrations (`child_emergency_profiles`, `school_notices`, `court_orders`, `compliance_logs`)

### Architecture Review Items

- Confirm RLS policies are correctly scoped across all tables, especially for the `professional_links` access pattern
- Review `check_ai_rate_limit()` RPC for parameterization safety (currently uses `$1` placeholders — should be safe, verify)
- Review SCAI tool injection to `custody_checkins` — `zone_id: null` is hardcoded; confirm this is correct vs. allowing zone lookup
- Confirm Dodo webhook `standardwebhooks` signature verification is resistant to replay attacks (timestamp tolerance window)
- Consider nonce-based CSP to eliminate `unsafe-inline` in script-src

---

*End of Security Audit Document*
