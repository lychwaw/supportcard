# SupportCard — App Completion Status Report

**Date:** July 2026  
**Web App:** Vite/React — deployed to Vercel (needs env vars configured)  
**Mobile App:** Expo SDK 57 — running on Expo Go (production EAS build not yet created)  
**Supabase Project:** owwxfifduexcahsvtyzn  

**Status key:** ✅ Complete | ⚠️ Partial / Blocked | ❌ Missing / Broken

---

## 1. Environment Variables Status

### Web App (.env / Vercel Production)

| Variable | Status | Required For |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ Set locally | Web frontend database connection |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ Set locally | Web frontend auth |
| `SUPABASE_URL` | ✅ Set locally | Server API routes |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ Leaked — needs rotation + Vercel | All API routes |
| `SUPABASE_ANON_KEY` | ❌ Not in Vercel | SCAI tool writes (RLS enforcement) |
| `ANTHROPIC_API_KEY` | ❌ NOT SET anywhere | My SCAI, Tone-Check, Receipt Scanner, Monthly Report — ALL broken |
| `DODO_PAYMENTS_API_KEY` | ❌ NOT SET | Subscription checkout |
| `DODO_PAYMENTS_WEBHOOK_SECRET` | ❌ NOT SET | Subscription activation webhooks |
| `DODO_PAYMENTS_ENVIRONMENT` | ❌ NOT SET | Must be `live_mode` for production |
| `DODO_PRODUCT_ID_ESSENTIAL` | ❌ NOT SET | Essential tier checkout |
| `DODO_PRODUCT_ID_PLUS` | ❌ NOT SET | Plus tier checkout |
| `DODO_PRODUCT_ID_PLUS_FOUNDER` | ❌ NOT SET | Founder Offer checkout |
| `DODO_PRODUCT_ID_PREMIUM` | ❌ NOT SET | Premium tier checkout |
| `KORAPAY_SECRET_KEY` | ❌ Leaked — needs rotation | SA ID verification |
| `APNS_KEY_ID` | ❌ NOT SET | Push notifications |
| `APNS_TEAM_ID` | ❌ NOT SET | Push notifications |
| `APNS_PRIVATE_KEY` | ❌ Leaked — needs rotation | Push notifications |
| `APPLE_TEAM_ID` | ❌ NOT SET | MapKit JS token signing |
| `APPLE_MAPKIT_KEY_ID` | ❌ NOT SET | MapKit JS token signing |
| `APPLE_MAPKIT_PRIVATE_KEY` | ❌ Leaked — needs rotation | MapKit JS token signing |
| `APP_BASE_URL` | ❌ NOT SET in Vercel | Dodo checkout success/cancel redirects |

### Mobile App (.env.local in mobile/)

| Variable | Status |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ Set |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ Set |
| `EXPO_PUBLIC_API_BASE_URL` | ✅ Set (points to Vercel deployment) |

---

## 2. Database Status

### Tables Required vs Existing

| Table | Status | Needed By |
|---|---|---|
| profiles | ✅ Exists | Auth, subscriptions, currency preference |
| children | ✅ Exists | Family management, Child Timeline |
| expense_requests | ✅ Exists | Receipt Ledger, Expenses |
| calendar_events | ✅ Exists | Calendar |
| messages | ✅ Exists | Messaging |
| emergency_contacts | ✅ Exists | Contacts screen |
| push_devices | ✅ Exists | Push notifications |
| legal_documents | ✅ Exists | Document Vault |
| custody_checkins | ⚠️ Migration file exists, not applied | Custody Clock screen |
| custody_zones | ⚠️ Migration file exists, not applied | Custody Clock zones |
| professional_links | ⚠️ Migration file exists, not applied | Professional Portal |
| child_goals | ⚠️ Migration file exists, not applied | Goals & Wishlist screen |
| goal_contributions | ⚠️ Migration file exists, not applied | Goals contributions |
| ai_rate_limits | ❌ Migration not applied — CRITICAL | AI rate limiting (app will crash on AI calls) |
| child_emergency_profiles | ❌ Table does not exist, no migration written | Emergency Child Profile screen |
| school_notices | ❌ Table does not exist, no migration written | School Hub → Notices tab |
| compliance_logs | ❌ Table does not exist, no migration written | Compliance screen |
| court_orders | ❌ Table does not exist, no migration written | Compliance screen |

### Migrations Pending Application (run in this order against owwxfifduexcahsvtyzn)

```
1. supabase/migrations/20260617_neutral_ledger_custody_clock.sql
2. supabase/migrations/20260617_no_wallet_holding.sql
3. supabase/migrations/20260617_audit_security_fixes.sql
4. supabase/migrations/20260618_professional_role_and_goals.sql
5. supabase/migrations/20260629_dodo_payments_and_new_tiers.sql
6. supabase/migrations/20260701_security_hardening.sql  ← CRITICAL (ai_rate_limits)
```

### Additional Migrations Still Needed (not yet written)

- `child_emergency_profiles` — fields: blood_type, allergies (array), medications (array), medical_aid_name, medical_aid_number, doctor_name, doctor_phone, dentist_name, dentist_phone, child_id FK, updated_at
- `school_notices` — fields: id, school_name, notice_text, category, child_id FK, created_by, notice_date, created_at
- `court_orders` — fields: id, title, issued_date, expiry_date, order_type, document_url, child_id FK, user_id FK, created_at
- `compliance_logs` — fields: id, event_type, event_date, description, child_id FK, logged_by, created_at

---

## 3. Mobile App Screens — Completion Status

### Tab Screens (bottom navigation)

| Screen | Status | Notes |
|---|---|---|
| Home / Activity Feed | ✅ Complete | Real Supabase data, pull-to-refresh, SCAI upgrade nudge |
| Calendar | ✅ Complete | Add events, conflict detection, long-press delete |
| Expenses | ✅ Complete | AI Receipt Scanner (camera → Claude vision → auto-fill) |
| Documents | ✅ Complete | Upload, view, basic category filter |
| More (hub) | ✅ Complete | 7 sections, 15 destinations |

### Navigation / Stack Screens

| Screen | Status | Issues |
|---|---|---|
| Login | ✅ Complete | |
| Signup | ✅ Complete | Currency picker ZAR/USD, role selector, password strength |
| Professional Invite (ptoken deep link) | ✅ Complete | Handles `supportcard://auth?ptoken=xxx` |
| My SCAI | ⚠️ UI complete, broken | Requires `ANTHROPIC_API_KEY` — API calls fail silently |
| Pricing | ✅ Complete | Dynamic ZAR/USD toggle, all 4 tiers + Founder Offer |
| Messages | ⚠️ Realtime works, AI broken | Tone-Check requires `ANTHROPIC_API_KEY` |
| Family | ✅ Complete | Children, co-parent display, custody split bars |
| Goals & Wishlist | ⚠️ UI complete, DB missing | Requires `child_goals` migration |
| Custody Clock | ⚠️ GPS works, map broken | GPS check-ins work; in-app map requires custom EAS build |
| Compliance | ⚠️ Partial | Shows hardcoded placeholder data; `court_orders`/`compliance_logs` tables do not exist |
| Professional Portal | ⚠️ UI complete, DB missing | Requires `professional_links` migration |
| Emergency Contacts | ✅ Complete | Phone call via native dialer |
| Transactions | ✅ Complete | Expense history grouped by month |
| Settings | ✅ Complete | Currency toggle, reads tier from profiles |
| Child Timeline | ✅ Complete | Chronological feed, month grouping, dot timeline |
| Parenting Scoreboard | ✅ Complete | Monthly coordination score, 4 stat cards, streak |
| School Hub | ⚠️ Partial | Report Cards + Events tabs work; Notices tab requires `school_notices` table |
| Emergency Child Profile | ⚠️ UI complete, crashes on save | `child_emergency_profiles` table does not exist in DB |
| Monthly Report | ⚠️ UI complete, broken | Requires `ANTHROPIC_API_KEY` — generate button returns error |

---

## 4. Currently Broken Features

### Broken — All blocked by missing ANTHROPIC_API_KEY

| Feature | Screen | Symptom |
|---|---|---|
| My SCAI chat | My SCAI | UI shows, API call returns 500 error |
| AI Tone-Check | Messages | No warning shown when message is hostile |
| AI Receipt Scanner | Expenses | Camera opens, scan attempt returns error |
| Monthly Child Report | Monthly Report | Generate button fires, AI call fails |

### Broken — Blocked by missing Dodo Payments setup

| Feature | Symptom |
|---|---|
| Subscription checkout | CTA on pricing page fires, checkout session cannot be created |
| Subscription activation | Dodo webhook cannot verify signature; tier never updates |
| Tier upgrades | Users stuck on Preview; cannot upgrade to any paid tier |

### Broken — In-app Map Display

The Custody Clock screen shows GPS coordinates and an "Open in Maps" button (opens native Apple Maps / Google Maps) — this works correctly.

**What is broken:** Rendering a map tile *inside* the app requires `react-native-maps`, which is installed but is a native module that **cannot run inside Expo Go**. It requires a custom EAS development build.

**Fix:**
```bash
cd mobile
eas build --platform ios --profile development
# Then install the resulting build on device and scan QR from Metro
```

This is a fundamental Expo Go sandbox limitation, not a code bug.

### Broken — Missing Database Tables (saves fail silently or crash)

| Screen | What breaks | Missing table |
|---|---|---|
| Emergency Child Profile | Save button fails — table does not exist | child_emergency_profiles |
| School Hub → Notices tab | Cannot load or save notices | school_notices |
| Compliance screen | Shows hardcoded sample data, cannot write | court_orders, compliance_logs |

---

## 5. Pages / Sections with Placeholder Content ("Coming Soon")

| Location | Issue |
|---|---|
| Settings → Billing History | `Alert.alert('Coming soon')` placeholder |
| Settings → Edit Profile | `Alert.alert('Coming soon')` placeholder |
| Settings → Language | `Alert.alert('Coming soon')` placeholder |
| Professional Portal → Record Access | `Alert.alert('Read only')` placeholder — no actual data viewer |
| Professional Portal → Bulk Export | `Alert.alert('Coming soon')` — should require Premium |
| Monthly Report → Share Report | `Alert.alert('Premium feature coming soon')` |
| Compliance → Court Orders | Hardcoded sample data in UI |
| Compliance → Compliance Log | Empty state (table missing) |

---

## 6. Production Build Status

| Step | Status | Command / Action |
|---|---|---|
| Expo Go preview (development) | ✅ Working | Scan QR from `npx expo start --tunnel` |
| EAS CLI installed | ❌ Not done | `npm install -g eas-cli` |
| Expo account created | ❌ Unknown | Create at expo.dev |
| EAS project linked | ❌ Not done | `cd mobile && eas init` — fills `projectId` in `app.json` |
| eas.json submit section | ❌ Incomplete | Add `appleId`, `ascAppId`, `appleTeamId` |
| App Store Connect app record | ❌ Not created | Create at appstoreconnect.apple.com |
| Google Play Console app record | ❌ Not created | Create at play.google.com/console |
| iOS production build | ❌ Not run | `eas build --platform ios --profile production` |
| Android production build | ❌ Not run | `eas build --platform android --profile production` |
| TestFlight upload | ❌ Not done | `eas submit --platform ios` |
| App Store review submission | ❌ Not done | After TestFlight testing |
| Google Play submission | ❌ Not done | `eas submit --platform android` |

---

## 7. Web App Status

| Feature | Status | Notes |
|---|---|---|
| Auth (login/signup/role selection) | ✅ Complete | |
| Dashboard (Activity Feed) | ✅ Complete | |
| Receipt Ledger (expenses) | ✅ Complete | |
| Calendar | ✅ Complete | |
| Messages + AI Tone-Check | ⚠️ Blocked | Requires ANTHROPIC_API_KEY |
| Document Vault | ✅ Complete | |
| Family + Professional Invite | ✅ Complete | |
| My SCAI | ⚠️ Blocked | Requires ANTHROPIC_API_KEY |
| Pricing page | ✅ Complete | ZAR/USD dynamic |
| Subscription Checkout (Dodo) | ⚠️ Blocked | Requires Dodo Payments setup + all env vars |
| Custody Clock | ✅ Complete | |
| Compliance Dashboard | ⚠️ Partial | Some tables don't exist |
| Goals & Wishlist | ⚠️ Blocked | Requires child_goals migration |
| Emergency Contacts | ✅ Complete | |
| Professional Portal | ⚠️ Blocked | Requires professional_links migration |
| Court-admissible PDF export | ✅ Complete (Premium) | |
| SA ID Verification (KoraPay) | ⚠️ Blocked | Requires KoraPay key rotation |
| All session changes committed | ❌ Nothing committed | `git add -A && git commit` not run |

---

## 8. Supabase Type Safety

The generated TypeScript types file (`src/integrations/supabase/types.ts`) is severely out of sync with the actual database schema. This causes ~120+ TypeScript `as any` casts throughout the codebase, masking type-level errors on Supabase queries.

**Fix (run after all migrations applied):**
```bash
npx supabase gen types typescript \
  --project-id owwxfifduexcahsvtyzn \
  --schema public \
  > src/integrations/supabase/types.ts
```

---

## 9. Currency System Note

- ZAR is the default (South African users); USD is the alternative (international users)
- Exchange rate is **hardcoded at 1 USD = 16.16 ZAR** in `mobile/lib/currency.ts` and `src/lib/currency.ts`
- This rate will become inaccurate as time passes
- **Recommendation:** Fetch from a free exchange rate API (e.g., exchangerate-api.com) on app start and cache in Supabase, OR accept the static rate and update manually each quarter

---

## 10. Complete Launch Checklist

### Before any real user can use the app

- [ ] Rotate `SUPABASE_SERVICE_ROLE_KEY` → add rotated value to Vercel
- [ ] Rotate `KORAPAY_SECRET_KEY` → add rotated value to Vercel
- [ ] Rotate `APNS_PRIVATE_KEY` → add to Vercel (+ `APNS_KEY_ID`, `APNS_TEAM_ID`)
- [ ] Rotate `APPLE_MAPKIT_PRIVATE_KEY` → add to Vercel (+ `APPLE_TEAM_ID`, `APPLE_MAPKIT_KEY_ID`)
- [ ] Revoke old Yoco keys (removed from codebase, still leaked in git history)
- [ ] Get `ANTHROPIC_API_KEY` from console.anthropic.com → add to `.env` and Vercel
- [ ] Set `APP_BASE_URL` in Vercel (actual production domain)
- [ ] Set `SUPABASE_ANON_KEY` in Vercel
- [ ] Sign up for Dodo Payments, create 4 products → add all `DODO_*` env vars to Vercel
- [ ] Register Dodo webhook URL in Dodo dashboard (`https://[domain]/api/dodo-webhook`)
- [ ] Set `DODO_PAYMENTS_ENVIRONMENT=live_mode` in Vercel
- [ ] Apply all 6 existing DB migrations to production Supabase (in order)
- [ ] Write + apply `child_emergency_profiles` migration
- [ ] Write + apply `school_notices` migration
- [ ] Write + apply `court_orders` and `compliance_logs` migrations
- [ ] Commit all uncommitted changes: `git add -A && git commit -m "feat: complete platform v1"`
- [ ] Push to remote: `git push`
- [ ] Verify Vercel auto-deploys successfully

### For mobile production build

- [ ] `npm install -g eas-cli`
- [ ] Create Expo account at expo.dev
- [ ] `cd mobile && eas init` (links project, fills `projectId` in `app.json`)
- [ ] Fill `eas.json` submit section: `appleId`, `ascAppId`, `appleTeamId`
- [ ] Add `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS secret (`eas secret:create`)
- [ ] Create app record in App Store Connect (bundleId: `co.za.supportcard.app`)
- [ ] Create app record in Google Play Console (package: `co.za.supportcard.app`)
- [ ] `eas build --platform all --profile production`
- [ ] `eas submit --platform ios`
- [ ] `eas submit --platform android`

### For full feature completeness

- [ ] Build in-app map tiles via EAS development build (enables `react-native-maps`)
- [ ] Implement live exchange rate fetching (currently hardcoded 16.16 ZAR/USD)
- [ ] Build billing history endpoint (Dodo API)
- [ ] Build profile edit screen in Settings
- [ ] Build Professional Portal → Record Access viewer
- [ ] Add data deletion endpoint (POPIA compliance)
- [ ] Add data export endpoint (POPIA portability)
- [ ] Add AI processing consent disclosure to onboarding
- [ ] Regenerate Supabase TypeScript types after all migrations applied
- [ ] Upgrade Vite to v8 (fixes last 2 npm audit vulnerabilities)
- [ ] Expand test suite beyond 1 test file (auth, RLS, webhooks)

---

*End of Completion Status Document*
