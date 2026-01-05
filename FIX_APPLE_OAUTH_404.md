# 🔧 Fix Apple OAuth 404 Error

## The Problem

After clicking "Continue" on Apple sign-in, you get:
```
404: NOT_FOUND
Code: DEPLOYMENT_NOT_FOUND
```

This happens because **Supabase doesn't have your Vercel URL in the allowed redirect URLs list**.

---

## Quick Fix

### Step 1: Add Your Vercel URL to Supabase

1. **Go to Supabase Dashboard**: https://app.supabase.com
2. **Select your project**: `owwxfifduexcahsvtyzn`
3. **Go to**: **Authentication** → **URL Configuration**
4. **Find**: **Redirect URLs** section
5. **Add your Vercel URL**:
   ```
   https://bluebird-payments-pro.vercel.app/auth/callback
   ```
   (Replace with your actual Vercel URL if different)

6. **Also add** (if you want localhost testing):
   ```
   http://localhost:8080/auth/callback
   ```

7. **Click**: **Save**

---

### Step 2: Verify Apple Provider Settings

While you're in Supabase:

1. **Go to**: **Authentication** → **Providers** → **Apple**
2. **Verify**:
   - ✅ Apple provider is **Enabled**
   - ✅ Services ID is correct
   - ✅ Key ID is correct
   - ✅ Team ID is correct
   - ✅ Private key (.p8) is uploaded
3. **Click**: **Save**

---

### Step 3: Test Again

1. **Visit your Vercel URL**
2. **Click**: "Sign in with Apple"
3. **Complete Apple authentication**
4. **Should redirect back to your app** ✅

---

## Why This Happens

The OAuth flow works like this:

1. **User clicks "Sign in with Apple"** → Your app
2. **Redirects to Apple** → Apple login page
3. **User authenticates** → Apple
4. **Apple redirects to Supabase** → `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback`
5. **Supabase processes auth** → Creates session
6. **Supabase redirects to your app** → `https://your-vercel-url.vercel.app/auth/callback` ⚠️

**Step 6 fails** if your Vercel URL isn't in Supabase's allowed redirect URLs list!

---

## Important Notes

✅ **The Return URL in Apple Developer Portal** should be:
- `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback` (Supabase callback)

✅ **The Redirect URL in Supabase** should be:
- `https://bluebird-payments-pro.vercel.app/auth/callback` (Your Vercel app)

✅ **These are different URLs** - one goes to Supabase, one goes to your app!

---

## Troubleshooting

### Still Getting 404?

1. **Check the exact URL** in the error message
2. **Verify it matches** what you added in Supabase
3. **Make sure there's no trailing slash** (e.g., `/auth/callback` not `/auth/callback/`)
4. **Check if you're using the correct Vercel URL** (might be a preview deployment URL)

### Check Browser Console

1. **Open DevTools** (F12)
2. **Go to Console tab**
3. **Look for redirect errors**
4. **Check Network tab** for failed requests

---

**After adding the redirect URL in Supabase, it should work! 🎉**





