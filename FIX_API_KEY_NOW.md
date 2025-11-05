# 🚨 URGENT: Fix API Key - Extra Character Found!

## The Problem

Your API key in `.env` file has an **extra 'e' at the beginning**:
- ❌ **WRONG**: `eeyJhbGciOiJIUzI1NiIs...` (starts with `eeyJ`)
- ✅ **CORRECT**: `eyJhbGciOiJIUzI1NiIs...` (starts with `eyJ`)

This is why you're getting "Invalid API key" errors!

## IMMEDIATE FIX

### Step 1: Get the CORRECT API Key

1. **Go to**: https://app.supabase.com
2. **Select project**: `owwxfifduexcahsvtyzn`
3. **Go to**: Settings → API
4. **Copy the anon public key** (starts with `eyJ...` - ONE 'e')
   - Make sure you copy the ENTIRE key
   - It should start with `eyJ` NOT `eeyJ`

### Step 2: Fix Your Local .env File

1. **Open**: `.env` file in your project root
2. **Find**: `VITE_SUPABASE_PUBLISHABLE_KEY`
3. **Replace** the value with the CORRECT key from Step 1
4. **Make sure** it starts with `eyJ` (not `eeyJ`)

### Step 3: Fix Vercel Environment Variables

1. **Go to**: https://vercel.com/dashboard
2. **Select project**: `supportcardtest1`
3. **Go to**: Settings → Environment Variables
4. **Find**: `VITE_SUPABASE_PUBLISHABLE_KEY`
5. **Delete** the old value
6. **Paste** the CORRECT key from Step 1
7. **Make sure** it's added to Production, Preview, AND Development

### Step 4: Restart Everything

**Local:**
1. Stop your dev server (Ctrl+C)
2. Restart: `npm run dev`

**Vercel:**
1. Go to Deployments
2. Click "Redeploy" on latest deployment
3. Wait 1-2 minutes

## How to Verify the Key is Correct

The key should:
- ✅ Start with `eyJ` (one 'e')
- ✅ Be very long (hundreds of characters)
- ✅ Come from Settings → API → anon public key
- ✅ Match the project `owwxfifduexcahsvtyzn`

---

**This is 100% the issue - fix this and everything will work!** ✅

