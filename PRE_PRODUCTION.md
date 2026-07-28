# SupportCard — Pre-Production Checklist

Supabase project: **owwxfifduexcahsvtyzn**  
Vercel project: **supportcard.vercel.app**  
Mobile bundle ID: **co.za.supportcard.app**

---

## 1. Rotate Leaked Secrets (CRITICAL — do this first)

These keys were exposed in git commit `bfbe8cb`. Rotate them regardless of whether the old values still work — the git history is public.

| Secret | Where to rotate |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → Reset service role key |
| `KORAPAY_SECRET_KEY` | dashboard.korapay.com → API Keys → Revoke & reissue |
| `APNS_PRIVATE_KEY` | developer.apple.com → Certificates → Revoke & re-download .p8 |
| `APPLE_MAPKIT_PRIVATE_KEY` | developer.apple.com → MapKit JS key → Revoke & re-issue |
| Yoco keys | Yoco dashboard → Developer Settings → Revoke (removed from code but leaked) |

After rotation, update `.env` locally and add all values to Vercel (Settings → Environment Variables).

---

## 2. Vercel Production Environment Variables

Add every variable below to Vercel (Settings → Environment Variables → Production).

| Variable | Value / Source |
|---|---|
| `SUPABASE_URL` | `https://owwxfifduexcahsvtyzn.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase after rotation above |
| `SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon/public key |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `DODO_PAYMENTS_API_KEY` | Dodo dashboard → API Keys → **live mode** key |
| `DODO_PAYMENTS_WEBHOOK_SECRET` | Dodo dashboard → Webhooks → secret |
| `DODO_PAYMENTS_ENVIRONMENT` | `live_mode` |
| `DODO_PRODUCT_ID_ESSENTIAL` | Dodo dashboard → Products (live mode) |
| `DODO_PRODUCT_ID_PLUS` | Dodo dashboard → Products (live mode) |
| `DODO_PRODUCT_ID_PLUS_FOUNDER` | Dodo dashboard → Products (live mode) |
| `DODO_PRODUCT_ID_PREMIUM` | Dodo dashboard → Products (live mode) |
| `KORAPAY_PUBLIC_KEY` | KoraPay dashboard → production key |
| `KORAPAY_SECRET_KEY` | KoraPay dashboard → production key (after rotation) |
| `APNS_KEY_ID` | `DN87GS89S8` (or updated if re-issued) |
| `APNS_TEAM_ID` | `28FLFDM932` |
| `APNS_BUNDLE_ID` | `co.za.supportcard.app` |
| `APNS_ENV` | `production` |
| `APNS_PRIVATE_KEY` | Rotated .p8 file, single-line base64, no PEM headers |
| `APPLE_TEAM_ID` | `28FLFDM932` |
| `APPLE_MAPKIT_KEY_ID` | `FKCX8P9Z77` (or updated if re-issued) |
| `APPLE_MAPKIT_PRIVATE_KEY` | Rotated key, single-line base64, no PEM headers |
| `APP_BASE_URL` | `https://supportcard.vercel.app` (or custom domain) |
| `VITE_SUPABASE_URL` | `https://owwxfifduexcahsvtyzn.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_SUPABASE_PROJECT_ID` | `owwxfifduexcahsvtyzn` |

Register the Dodo webhook URL in the Dodo dashboard: `https://supportcard.vercel.app/api/dodo-webhook`

---

## 3. Revert Dev-Only Loopholes

In `mobile/hooks/use-permissions.ts`, revert the TEMP flags before deploying:

```ts
// Change these back:
canUseMyScai: atLeast('plus'),       // was: true
canUseAIToneCheck: atLeast('plus'),  // was: true
```

---

## 4. Apply Database Migrations

Run each file **in order** at: https://supabase.com/dashboard/project/owwxfifduexcahsvtyzn/sql/new

| Order | File | Unlocks |
|---|---|---|
| 1 | `supabase/migrations/20260617_neutral_ledger_custody_clock.sql` | Custody Clock check-ins + zones |
| 2 | `supabase/migrations/20260617_no_wallet_holding.sql` | Removes old money-movement tables |
| 3 | `supabase/migrations/20260617_audit_security_fixes.sql` | Security hardening on existing tables |
| 4 | `supabase/migrations/20260618_professional_role_and_goals.sql` | Professional Portal + Goals |
| 5 | `supabase/migrations/20260629_dodo_payments_and_new_tiers.sql` | Subscription tier tracking |
| 6 | `supabase/migrations/20260701_security_hardening.sql` | **AI rate limiting — app crashes without this** |
| 7 | `supabase/migrations/20260707_child_emergency_profiles.sql` | Emergency Child Profile saves |
| 8 | `supabase/migrations/20260707_school_notices.sql` | School Hub notices |
| 9 | `supabase/migrations/20260707_court_orders_compliance.sql` | Compliance court orders + logs |
| 10 | `supabase/migrations/20260708_coparent_rls_fixes.sql` | **Co-parent can see expenses, calendar, approve/reject** |

After running all 10, regenerate TypeScript types:
```bash
npx supabase gen types typescript \
  --project-id owwxfifduexcahsvtyzn \
  --schema public \
  > src/integrations/supabase/types.ts
```

---

## 5. Missing Migrations (now written, need to be applied)

All migration files exist in `supabase/migrations/` — apply them via the Supabase SQL editor in order (see section 4).

| Migration | Table | Screen |
|---|---|---|
| `20260707_child_emergency_profiles.sql` | `child_emergency_profiles` | Emergency Child Profile |
| `20260707_school_notices.sql` | `school_notices` | School Hub → Notices |
| `20260707_court_orders_compliance.sql` | `court_orders`, `compliance_logs` | Compliance Dashboard |
| `20260708_coparent_rls_fixes.sql` | (RLS policies) | Expenses approval + shared calendar |

---

## 6. Push Code + Deploy

```bash
git add -A
git commit -m "feat: local dev server, NativeTabs, Dodo checkout fix, SCAI error surfacing"
git push origin main
```

Vercel auto-deploys on push. Confirm the deployment succeeds in the Vercel dashboard.

---

## 7. EAS Mobile Production Build

```bash
npm install -g eas-cli
cd mobile
eas init                          # links project, fills projectId in app.json
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <value>
eas build --platform all --profile production
eas submit --platform ios
eas submit --platform android
```

Prerequisites:
- Expo account at expo.dev
- App Store Connect app record (bundleId: `co.za.supportcard.app`)
- Google Play Console app record
- Fill `eas.json` submit section: `appleId`, `ascAppId`, `appleTeamId`

---

## 8. POPIA Compliance (before real users)

- [ ] Add AI processing consent disclosure to onboarding (user messages sent to Anthropic US API after PII scrub)
- [ ] Implement account data deletion endpoint (POPIA right to erasure)
- [ ] Implement data export endpoint (POPIA portability right)
- [ ] Review POPIA Section 35 — platform processes data about minors

---

## 9. Remaining Known Issues

| Issue | Severity | Fix |
|---|---|---|
| In-app map tiles (Custody Clock) | Medium | Requires EAS development build with `react-native-maps` |
| Hardcoded exchange rate (16.16 ZAR/USD) | Low | Fetch from exchange rate API on app start; update quarterly |
| Settings → Billing History | Low | Placeholder alert — build Dodo billing history endpoint |
| Settings → Edit Profile | Low | Placeholder alert — build profile edit screen |
| `unsafe-inline` in CSP | Low | Harden with nonce-based CSP once Vite upgraded |
| 2 npm audit vulns (esbuild/vite) | Low | Dev-only; fix requires Vite 5→8 major upgrade |
| Test coverage: 1 test file | Low | Expand to cover auth flows, RLS, webhooks |
