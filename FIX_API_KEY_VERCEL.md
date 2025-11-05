# 🔧 Fix "Invalid API Key" Error - CRITICAL

## The Problem

You're getting **"Invalid API key"** when trying to set the OAuth session. This means:
- ✅ OAuth is working (tokens are being received)
- ❌ The API key in Vercel is **WRONG** or **doesn't match** your Supabase project

## Immediate Fix

### Step 1: Get the CORRECT API Key

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Select your project**: `owwxfifduexcahsvtyzn` (the one you're using)
3. **Go to**: Settings → API
4. **Copy the anon public key** (starts with `eyJ...`)
   - This is the **anon public** key (NOT the service_role key)
   - Make sure it's the FULL key (it's very long)

### Step 2: Update Vercel Environment Variables

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your project**: `supportcardtest1`
3. **Go to**: Settings → Environment Variables
4. **Find and UPDATE**: `VITE_SUPABASE_PUBLISHABLE_KEY`
   - **Delete the old value**
   - **Paste the NEW correct key** from Step 1
   - Make sure it's added to: **Production**, **Preview**, AND **Development**
5. **Verify**: `VITE_SUPABASE_URL` is set to:
   ```
   https://owwxfifduexcahsvtyzn.supabase.co
   ```

### Step 3: Redeploy

1. **Go to**: Deployments tab
2. **Click the three dots** on the latest deployment
3. **Click**: "Redeploy"
4. **Wait** for deployment to complete (1-2 minutes)

### Step 4: Test Again

1. **Clear browser cache** (or use incognito)
2. **Try Google OAuth** again
3. **Should work now!** ✅

## Common Mistakes

❌ **Wrong key type**: Using `service_role` key instead of `anon public` key
❌ **Wrong project**: Using API key from different Supabase project
❌ **Truncated key**: Key was cut off when copying
❌ **Extra characters**: Spaces or quotes in the key
❌ **Not redeployed**: Changed env vars but didn't redeploy

## About the Auto-filled Login Form

The email/password being pre-filled is likely **browser autofill** (not a code issue). To clear it:
- Clear browser saved passwords
- Use incognito/private window
- Or just ignore it - it's not affecting functionality

---

**The "Invalid API key" error is 100% an environment variable issue in Vercel!**

