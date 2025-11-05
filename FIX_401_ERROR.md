# 🔧 Fix 401 Unauthorized Error

## The Problem

You're getting **401 (Unauthorized)** errors because:
1. **Wrong Supabase project** - Your Vercel deployment is using `qaabpphkdcfarjsvzdsm` but your `.env` uses `owwxfifduexcahsvtyzn`
2. **API key mismatch** - The API key in Vercel doesn't match the project being used

## Quick Fix

### Step 1: Determine Which Project You're Using

You have two Supabase projects:
- `qaabpphkdcfarjsvzdsm` (what Vercel is trying to use)
- `owwxfifduexcahsvtyzn` (what your .env file has)

**Check which one has your database/migrations:**
1. Go to https://app.supabase.com
2. Check both projects
3. See which one has:
   - Your tables (profiles, children, etc.)
   - Your migrations applied
   - Your RLS policies

### Step 2: Update Vercel Environment Variables

**Option A: If `owwxfifduexcahsvtyzn` is correct** (matches your .env):

1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Select your project: `supportcardtest1`
3. Go to **Settings** → **Environment Variables**
4. Update `VITE_SUPABASE_URL` to:
   ```
   https://owwxfifduexcahsvtyzn.supabase.co
   ```
5. Get the correct API key:
   - Go to https://app.supabase.com
   - Select project: `owwxfifduexcahsvtyzn`
   - **Settings** → **API**
   - Copy the **anon public** key
6. Update `VITE_SUPABASE_PUBLISHABLE_KEY` with the correct key
7. **Redeploy** your project

**Option B: If `qaabpphkdcfarjsvzdsm` is correct** (what Vercel is using):

1. Go to Vercel Dashboard
2. Get the API key from `qaabpphkdcfarjsvzdsm` project:
   - Go to https://app.supabase.com
   - Select project: `qaabpphkdcfarjsvzdsm`
   - **Settings** → **API**
   - Copy the **anon public** key
3. Update `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel
4. Make sure `VITE_SUPABASE_URL` is:
   ```
   https://qaabpphkdcfarjsvzdsm.supabase.co
   ```
5. **Redeploy**

## Step 3: Verify Environment Variables

In Vercel Dashboard → Settings → Environment Variables, make sure:

✅ `VITE_SUPABASE_URL` matches your actual project
✅ `VITE_SUPABASE_PUBLISHABLE_KEY` is the **anon public** key (not service_role)
✅ Both are added to **Production**, **Preview**, and **Development**

## Step 4: Test After Redeploy

1. Wait for Vercel to finish redeploying
2. Clear browser cache (or use incognito)
3. Try signing up again
4. Should work now! ✅

## Common Mistakes

❌ **Using service_role key** - Don't use the secret key, use the anon/public key
❌ **Wrong project URL** - Make sure URL matches the project with your database
❌ **Missing environment variables** - Make sure they're set in Vercel, not just locally
❌ **Not redeploying** - After changing env vars, you must redeploy

---

**After fixing, the 401 errors should be gone!** 🎉

