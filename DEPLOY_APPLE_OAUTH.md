# 🚀 Deploy Apple OAuth to Vercel

## Quick Deployment Steps

### 1. Commit Your Changes (Optional but Recommended)
```bash
git add .
git commit -m "Add Apple OAuth sign-in support"
git push
```

### 2. Deploy to Vercel

#### Option A: Via Vercel Dashboard
1. Go to https://vercel.com
2. Sign in with GitHub
3. If project exists: Go to Deployments → Redeploy
4. If new project: Add New Project → Import `lychwaw/bluebird-payments-pro`

#### Option B: Via Vercel CLI
```bash
# Install Vercel CLI (if not installed)
npm i -g vercel

# Login
vercel login

# Deploy to production
vercel --prod
```

### 3. Verify Environment Variables

In Vercel Dashboard → Settings → Environment Variables, ensure:

- ✅ `VITE_SUPABASE_URL` = `https://owwxfifduexcahsvtyzn.supabase.co`
- ✅ `VITE_SUPABASE_PUBLISHABLE_KEY` = (your anon key from Supabase)

**Important:** Make sure both are enabled for:
- Production ✅
- Preview ✅
- Development ✅

### 4. Test Apple Sign-In

After deployment:

1. Visit your Vercel URL (e.g., `https://bluebird-payments-pro.vercel.app`)
2. Click "Sign in with Apple"
3. Complete Apple authentication
4. Should redirect back to your app
5. New users: Age modal should appear
6. Existing users: Should go straight to dashboard

---

## ⚠️ Important: Apple Developer Portal Configuration

**For production, make sure in Apple Developer Portal:**

1. Go to Services ID configuration
2. **Return URLs** should include:
   - ✅ `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback` (REQUIRED)
   - ✅ `http://localhost:8080/auth/callback` (for local testing only)

**Note:** The Return URL goes to Supabase, NOT directly to your Vercel URL. Supabase handles the redirect to your app.

---

## Troubleshooting

### Apple Sign-In Not Working on Vercel?

1. **Check Supabase Apple Provider:**
   - Go to Supabase Dashboard → Authentication → Providers → Apple
   - Verify it's **Enabled**
   - Verify Services ID, Key ID, Team ID, and .p8 key are correct

2. **Check Apple Developer Portal:**
   - Verify Return URL: `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback`
   - Verify domain: `owwxfifduexcahsvtyzn.supabase.co`

3. **Check Browser Console:**
   - Open DevTools (F12)
   - Look for OAuth errors
   - Common errors:
     - `redirect_uri_mismatch` → Fix Return URL in Apple Developer Portal
     - `invalid_client` → Check credentials in Supabase

4. **Verify Environment Variables:**
   - Make sure Vercel has correct Supabase URL and API key
   - Redeploy after changing environment variables

---

## Testing Checklist

After deployment:

- [ ] App loads on Vercel URL
- [ ] "Sign in with Apple" button appears
- [ ] Clicking button redirects to Apple login
- [ ] After Apple auth, redirects back to app
- [ ] New users see age modal
- [ ] Existing users go to dashboard
- [ ] No console errors

---

**Your app will be live at:** `https://bluebird-payments-pro.vercel.app` (or your custom URL)

🎉 **Ready to deploy!**

