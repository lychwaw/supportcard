# How to Apply Migrations to Production Supabase

Project ID: **owwxfifduexcahsvtyzn**

Go to: https://supabase.com/dashboard/project/owwxfifduexcahsvtyzn/sql/new

Paste and run each file below **in order**. Each one must succeed before running the next.

---

## Run in this order

### 1. Neutral Ledger & Custody Clock
File: `supabase/migrations/20260617_neutral_ledger_custody_clock.sql`

### 2. No Wallet Holding
File: `supabase/migrations/20260617_no_wallet_holding.sql`

### 3. Audit Security Fixes
File: `supabase/migrations/20260617_audit_security_fixes.sql`

### 4. Professional Role & Goals
File: `supabase/migrations/20260618_professional_role_and_goals.sql`

### 5. Dodo Payments & New Tiers
File: `supabase/migrations/20260629_dodo_payments_and_new_tiers.sql`

### 6. Security Hardening ← CRITICAL (run this before launch)
File: `supabase/migrations/20260701_security_hardening.sql`

---

## Then run the new migrations (also in order)

### 7. Child Emergency Profiles
File: `supabase/migrations/20260707_child_emergency_profiles.sql`

### 8. School Notices
File: `supabase/migrations/20260707_school_notices.sql`

### 9. Court Orders & Compliance Log
File: `supabase/migrations/20260707_court_orders_compliance.sql`

---

## After all migrations are applied

Run this to regenerate TypeScript types (needs Supabase CLI):

```bash
npx supabase gen types typescript \
  --project-id owwxfifduexcahsvtyzn \
  --schema public \
  > src/integrations/supabase/types.ts
```

If you don't have the Supabase CLI: `npm install -g supabase`

---

## What each migration unlocks

| Migration | Unlocks |
|---|---|
| 20260617_neutral_ledger_custody_clock | Custody Clock check-ins + zones |
| 20260617_no_wallet_holding | Removes old money-movement tables |
| 20260617_audit_security_fixes | Security hardening on existing tables |
| 20260618_professional_role_and_goals | Professional Portal + Goals & Wishlist |
| 20260629_dodo_payments | Subscription tier tracking |
| 20260701_security_hardening | **AI rate limiting (app crashes without this)** |
| 20260707_child_emergency_profiles | Emergency Child Profile saves |
| 20260707_school_notices | School Hub → Notices tab |
| 20260707_court_orders_compliance | Compliance screen + Log Event button |
