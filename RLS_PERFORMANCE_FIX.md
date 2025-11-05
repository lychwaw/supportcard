# 🔧 RLS Performance Fix - Migration Guide

## What This Fixes

Your Supabase database linter found **performance warnings** in your Row Level Security (RLS) policies. These are **not critical errors** - your app will work fine, but fixing them will improve query performance at scale.

## Issues Found

### 1. **auth_rls_initplan** Warnings
- **Problem**: RLS policies use `auth.uid()` directly, which gets re-evaluated for every row
- **Impact**: Slower queries when you have many rows
- **Fix**: Wrap in `(select auth.uid())` so it's evaluated once per query

### 2. **multiple_permissive_policies** Warnings
- **Problem**: `user_roles` table has duplicate policies (both "role" singular and "roles" plural)
- **Impact**: Extra policy checks on every query
- **Fix**: Remove duplicate policies, keep one consistent set

## How to Apply the Fix

### Step 1: Run the Migration

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Select your project: `owwxfifduexcahsvtyzn`

2. **Open SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Copy and Paste the Migration**
   - Open: `supabase/migrations/20250105000000_fix_rls_performance.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Run the Migration**
   - Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)
   - Wait for "Success" message

### Step 2: Verify the Fix

1. **Check Database Linter**
   - Go to **Database** → **Linter** in Supabase Dashboard
   - The warnings should be gone (or significantly reduced)

2. **Test Your App**
   - Visit your app URL
   - Test login, data viewing, creating records
   - Everything should work the same, but queries will be faster

## What Changed

### Before (Slow):
```sql
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);
```

### After (Fast):
```sql
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING ((select auth.uid()) = id);
```

## Tables Fixed

✅ All RLS policies optimized for:
- `profiles`
- `children`
- `virtual_cards`
- `transactions`
- `expense_requests`
- `budget_categories`
- `calendar_events`
- `emergency_contacts`
- `messages`
- `payment_methods`
- `user_roles` (also fixed duplicate policies)
- `permissions`

## Important Notes

- ⚠️ **This is a performance optimization** - your app works fine without it
- ✅ **Safe to run** - doesn't change functionality, only improves performance
- ✅ **Backward compatible** - all existing features continue to work
- 🚀 **Better performance** - especially noticeable with many rows

## If Something Goes Wrong

If you encounter any issues:

1. **Check SQL Editor for errors** - the migration will show specific error messages
2. **Verify policies still exist** - Go to **Database** → **Tables** → Select a table → **Policies** tab
3. **Rollback if needed** - You can restore from a backup in Supabase Dashboard

## Questions?

- The migration is **idempotent** - safe to run multiple times (uses `DROP POLICY IF EXISTS`)
- All policies are recreated with the same names and logic
- Only the performance optimization is added

---

**After running this migration, your database will be optimized and the linter warnings will be resolved!** ✅

