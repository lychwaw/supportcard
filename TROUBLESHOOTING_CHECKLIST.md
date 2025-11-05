# 🔧 Quick Troubleshooting Checklist

## Before You Start
- [ ] Code is pushed to GitHub
- [ ] Environment variables are set in Vercel
- [ ] Deployment is complete

---

## Google OAuth Issues

### ❌ Not Working? Check These:

1. **Google Cloud Console**
   - [ ] Redirect URI is: `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback`
   - [ ] OAuth Client ID exists
   - [ ] Google+ API is enabled

2. **Supabase Dashboard**
   - [ ] Go to: Authentication → Providers → Google
   - [ ] Google provider is **Enabled** (toggle ON)
   - [ ] Client ID matches Google Cloud
   - [ ] Client Secret matches Google Cloud
   - [ ] Clicked **Save**

3. **Browser Console**
   - [ ] Open DevTools (F12)
   - [ ] Check Console tab for errors
   - [ ] Try in incognito window (clears cache)

**Common Error**: `redirect_uri_mismatch`
→ Fix: Add exact redirect URI in Google Cloud Console

---

## Email Issues

### ❌ Not Sending? Check These:

1. **Supabase SMTP Settings**
   - [ ] Go to: Settings → Authentication → SMTP Settings
   - [ ] **Enable Custom SMTP** is ON
   - [ ] Host: `smtp.mailersend.com`
   - [ ] Port: `587` (or `465`)
   - [ ] Username: Your MailerSend SMTP token
   - [ ] Password: Your MailerSend API key
   - [ ] Sender Email: Verified email in MailerSend
   - [ ] Clicked **Save**

2. **MailerSend Dashboard**
   - [ ] Log in to https://app.mailersend.com
   - [ ] Verify sender email is verified
   - [ ] Check sending limits (not exceeded)
   - [ ] Check email activity/analytics

3. **Supabase Logs**
   - [ ] Go to: Logs → Auth
   - [ ] Look for SMTP errors
   - [ ] Check for "Email sent successfully" messages

**Common Error**: `SMTP authentication failed`
→ Fix: Double-check username and password in Supabase

---

## Deployment Issues

### ❌ Build Failed? Check These:

1. **Environment Variables**
   - [ ] Vercel Dashboard → Settings → Environment Variables
   - [ ] `VITE_SUPABASE_URL` is set
   - [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` is set
   - [ ] Added to Production, Preview, and Development

2. **Build Logs**
   - [ ] Vercel Dashboard → Deployments → Failed deployment
   - [ ] Check Build Logs for specific errors
   - [ ] Common errors:
     - Missing env vars → Add them
     - Module not found → Run `npm install` locally
     - Build command error → Check `package.json` scripts

3. **Clear Cache & Redeploy**
   - [ ] Vercel Dashboard → Settings → General
   - [ ] Clear Build Cache
   - [ ] Redeploy

---

## Quick Test After Fix

### Test Google OAuth:
1. Visit your Vercel URL
2. Click "Sign in with Google"
3. Should redirect → Login → Back to app → Logged in ✅

### Test Email:
1. Sign up with email/password
2. Check inbox (and spam) for verification email
3. Click link → Verified ✅

---

## Still Not Working?

1. **Check Documentation**:
   - `GOOGLE_OAUTH_SETUP.md` - Detailed Google setup
   - `EMAIL_SETUP_GUIDE.md` - Detailed email setup
   - `VERCEL_DEPLOYMENT_GUIDE.md` - Full troubleshooting guide

2. **Check Logs**:
   - Browser Console (F12)
   - Vercel Build Logs
   - Supabase Auth Logs

3. **Verify URLs**:
   - Vercel URL is accessible
   - Supabase project is active
   - Google Cloud project is active

---

**Quick Links:**
- Vercel: https://vercel.com/dashboard
- Supabase: https://app.supabase.com
- Google Cloud: https://console.cloud.google.com
- MailerSend: https://app.mailersend.com

