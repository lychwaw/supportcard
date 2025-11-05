# 🚨 URGENT: Run Database Migration to Fix Errors

## The Problem

You're seeing these errors because the database migration hasn't been run yet:
- ❌ 500 errors on all queries (RLS policies broken)
- ❌ 400 error on profiles?select=age (age column doesn't exist)
- ❌ 406 error on user_roles (missing role for user)

## The Solution

Run this migration in Supabase:

**File**: `supabase/migrations/20250106000000_fix_infinite_recursion.sql`

---

## Step-by-Step: Run the Migration

### Step 1: Open Supabase Dashboard
1. Go to: https://app.supabase.com
2. Sign in
3. Select project: `owwxfifduexcahsvtyzn`

### Step 2: Open SQL Editor
1. Click **SQL Editor** in the left sidebar
2. Click **New Query** (top right)

### Step 3: Copy Migration File
1. Open: `supabase/migrations/20250106000000_fix_infinite_recursion.sql`
2. **Copy the ENTIRE file** (all 161 lines)
3. Paste into SQL Editor

### Step 4: Run the Migration
1. Click **Run** button (or press Ctrl+Enter)
2. Wait for success message: ✅ "Success. No rows returned"
3. This should take 5-10 seconds

### Step 5: Verify It Worked
1. Check for any error messages
2. If you see errors, share them with me
3. If successful, refresh your app and test again

---

## What This Migration Does

1. ✅ **Removes infinite recursion** in RLS policies
2. ✅ **Adds `age` column** to profiles table
3. ✅ **Creates role assignment function** (age-based)
4. ✅ **Creates auto-role trigger** (assigns role on signup)
5. ✅ **Creates missing roles** for existing users
6. ✅ **Fixes children policies** (removes recursion)

---

## After Running Migration

1. **Refresh your browser** (hard refresh: Ctrl+Shift+R)
2. **Test again** - errors should be gone
3. **Profile completion modal** should work
4. **All queries** should work properly

---

## If You Still See Errors

Share the exact error message from Supabase SQL Editor, and I'll help fix it!

---

**This is the fix - run the migration and everything will work!** ✅

