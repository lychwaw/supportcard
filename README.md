# SupportCard

A co-parenting coordination platform — schedules, expenses, communication, and legal records in one place. **No money moves through the app.** SupportCard is record-keeping and coordination software, not a payments product.

## ⚠️ Action required: rotate leaked secrets

`.env` was committed to this repo's git history before it was gitignored. It has since been removed from tracking (see commit history), but the old values are still present in earlier commits and on the remote. Rotate these before going further:

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase dashboard → Project Settings → API → reset service role key
- `YOCO_SECRET_KEY` / `YOCO_WEBHOOK_SECRET` — Yoco has been removed from this codebase (replaced by Dodo Payments), but the leaked keys were real — revoke them at the Yoco dashboard → Developer settings regardless
- `KORAPAY_SECRET_KEY` — KoraPay dashboard → API Keys
- `APNS_PRIVATE_KEY` — Apple Developer portal → Certificates, Identifiers & Profiles → revoke and re-issue the key
- `APPLE_MAPKIT_PRIVATE_KEY` — Apple Developer portal → MapKit JS key

If the repo has ever been public, or anyone outside your team has cloned it, also consider scrubbing history with `git filter-repo` and force-pushing — that's a separate, more invasive step.

## Stack

- **Frontend**: Vite + React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Postgres + Auth + Storage + Row Level Security)
- **Hosting**: Vercel (static frontend + serverless API routes)
- **Payments**: Dodo Payments (Merchant of Record) — subscription billing only
- **AI**: Claude API (Anthropic) for Tone-Check and the My SCAI assistant
- **PDF export**: jsPDF (client-side, no server round-trip)

## Local setup

```bash
npm install
cp .env.example .env   # then fill in real values — see below
npm run dev
```

The app runs at `http://localhost:8080`.

## Environment variables

Create `.env` in the project root (never commit it — it's gitignored).

### Client-side (bundled into the JS — must never contain secrets)

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (safe for the browser) |

### Server-side only (Vercel serverless functions — never prefix with `VITE_`)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Same Supabase project URL, used server-side |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS — required for webhook handlers and admin operations. **Never expose to the client.** |
| `ANTHROPIC_API_KEY` | Claude API key for AI Tone-Check and My SCAI (`api/ai.ts`). Get one at [console.anthropic.com](https://console.anthropic.com). Without it, Tone-Check silently falls back to local keyword heuristics and My SCAI is unavailable. |
| `ANTHROPIC_TONE_MODEL` | Optional. Defaults to `claude-haiku-4-5-20251001` — fast and cheap, appropriate for a per-message classification call. |
| `ANTHROPIC_SCAI_MODEL` | Optional. Defaults to `claude-haiku-4-5-20251001` — model used for the My SCAI assistant's tool-use chat. |
| `DODO_PAYMENTS_API_KEY` | Dodo Payments secret/bearer key — **subscription billing only**. Never used for fund transfers between users. |
| `DODO_PAYMENTS_WEBHOOK_SECRET` | Verifies Dodo webhook signatures (Standard Webhooks / `standardwebhooks` package) |
| `DODO_PAYMENTS_ENVIRONMENT` | `test_mode` or `live_mode` |
| `DODO_PRODUCT_ID_ESSENTIAL`, `DODO_PRODUCT_ID_PLUS`, `DODO_PRODUCT_ID_PLUS_FOUNDER`, `DODO_PRODUCT_ID_PREMIUM` | Product IDs created in the Dodo dashboard, one per paid tier (Plus has a second product for the Founder Offer price) |
| `KORAPAY_SECRET_KEY` | KoraPay secret key — used only for South African ID (SAID) identity verification, not payments |
| `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_ENV` | Apple Push Notification credentials |
| `APPLE_TEAM_ID`, `APPLE_MAPKIT_KEY_ID`, `APPLE_MAPKIT_PRIVATE_KEY` | MapKit JS server-side token signing |
| `APP_BASE_URL` | Public base URL used to build Dodo checkout success/cancel redirect links |

## Architecture notes

### No money movement, by design

Dodo Payments (Merchant of Record) is wired to exactly one thing: subscription billing (`api/dodo-checkout.ts`, `api/dodo-webhook.ts`). The webhook only ever updates `profiles.subscription_tier` / `subscription_status` in response to `subscription.*` events. There is no wallet, no balance, no fund transfer between parents anywhere in the codebase. The "Settlement Ledger" in Receipt Ledger is a computed display value (`Parent A owes Parent B RX`) — nothing is held or moved. Settlement happens off-platform via EFT/bank transfer, by design.

### Subscription tiers

Defined in `src/lib/subscriptions.ts`. Prices are USD-canonical (`priceUsd`); other currencies, including ZAR, are derived automatically via `formatCurrencyFromUsd` (`src/lib/currency.ts`) so a South African user sees a Rand-equivalent price, not a separately maintained number.

| Tier | Price (USD) | Unlocks |
|---|---|---|
| Preview | $0 | 1 child, 5 calendar events, 3 expense requests/mo, drop-off & pickup logs |
| Essential | $4.99/mo | 40 calendar events/mo, 20 expense requests/mo, 25 stored documents |
| Plus | $9.99/mo | Up to 3 children, My SCAI assistant, AI Tone-Check, 5 PDF exports/mo |
| Premium | $14.99/mo | Unlimited children/events/expenses, court-admissible record exports (25/mo), Verified Handoffs (GPS), invite a Professional |

A **Founder Offer** (`FOUNDER_OFFER` in `subscriptions.ts`) locks the Plus tier at $6.99/mo for 12 months for the first 5,000 subscribers.

### Roles

- **Parent / Co-Parent**: full read/write access to their own family's data
- **Child**: read-only — sees an "Activity Feed" of what's been logged for their care, never a balance or wallet figure
- **Professional**: lawyer/mediator role, linked to parents via invite (`professional_links` table), scoped read-only access to logs/messages/documents across every family that's invited them. Only a Premium-tier parent can send the invite (`canInviteProfessional` in `src/hooks/usePermissions.ts`); the professional's own portal access is gated by role alone, not a separate subscription.

### AI Tone-Check

`api/ai.ts` calls the Claude API to classify outgoing co-parent messages (`positive` / `neutral` / `negative` / `hostile`) and, for negative/hostile messages, generates a calmer rewrite. The client (`src/hooks/useToneAnalysis.ts`) shows an instant local keyword-based heuristic while the API call is in flight, and degrades gracefully to that heuristic alone if the API key isn't configured or the call fails. Hostile messages trigger a confirmation modal ("This seems heated. Want to rephrase?") in `src/components/TonePolice.tsx` with a non-editable suggested rewrite and a "Send Anyway" override — nothing is ever silently blocked.

### My SCAI

`api/ai.ts`'s `scai-chat` action is a Plus-tier assistant built on Anthropic's real tool-use (function-calling) API — not text-parsed JSON blocks. It's grounded to exactly 3 tools, each scoped server-side to the authenticated user's own family (`create_expense_request`, `add_calendar_event`, `log_custody_checkin`); the model can describe an action but the server only executes it via an actual Supabase insert, and `requester_id`/`user_id` are always injected from the verified JWT, never taken from the model's tool input. The client (`src/hooks/useMyScai.ts`, `src/pages/MyScai.tsx`) sends the running conversation on every turn and renders any actions taken as badges under the assistant's reply. Deliberately out of scope for this pass: updating child info, saving documents, and generating reports — these would need additional confirmation/safety design before being exposed to a model.

### Court-admissible export

`src/lib/courtExport.ts` gathers receipts, messages, and custody logs into a PDF (via jsPDF) and computes a SHA-256 hash (Web Crypto API) of the full text content, printed on every page. Re-hashing the content should always reproduce the printed hash — if it doesn't, the document was altered after export. Available from Premium tier up, and to Professional users for bulk export across their linked families.

### Database migrations

Run in order from `supabase/migrations/`. Recent additions relevant to this feature set:

- `20260618_professional_role_and_goals.sql` — `professional_links` table + RLS, `child_goals` / `goal_contributions` append-only contribution ledger (no balance column — progress is always `SUM(contributions)` computed at read time)
- `20260629_dodo_payments_and_new_tiers.sql` — `dodo_subscription_id` / `dodo_customer_id` columns on `profiles`, migrates `subscription_tier`/`subscription_status` to the Preview/Essential/Plus/Premium vocabulary

## Deferred / not yet built

These were scoped out of the current pass to keep it shippable — they're straightforward extensions of what exists:

- `.ics` calendar feed endpoint (Apple/Google/Outlook subscription)
- School Hub (notices, report cards, sports fixtures)
- Emergency Child Profile (medical aid, allergies, emergency contacts — distinct from the existing general Emergency Contacts page)
- Monthly AI-generated child report
- Unified "Child Timeline" feed combining school/medical/expense/milestone events in one view

## Vercel function budget

The Hobby plan caps serverless functions at 12. Current count lives under `api/` — keep new server-side logic inside existing action-based handlers (e.g. add a new `action` to `api/ai.ts`) rather than creating new files where reasonable.
