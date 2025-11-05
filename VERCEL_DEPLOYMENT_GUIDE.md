# 🚀 Vercel Deployment & Troubleshooting Guide

## Quick Deployment Steps

### 1. **Deploy to Vercel (New Deployment)**

#### Option A: Via Vercel Dashboard (Easiest)
1. Go to https://vercel.com
2. Sign in with GitHub
3. Click **"Add New Project"**
4. Import your repository: `lychwaw/bluebird-payments-pro`
5. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. **Add Environment Variables** (see below)
7. Click **"Deploy"**

#### Option B: Via Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

---

## 🔐 Required Environment Variables

**IMPORTANT:** Add these in Vercel Dashboard → Settings → Environment Variables

### Supabase Configuration
```
VITE_SUPABASE_URL=https://owwxfifduexcahsvtyzn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key_here
```

**Where to find these:**
1. Go to https://app.supabase.com
2. Select project: `owwxfifduexcahsvtyzn`
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## ✅ Verification Checklist

After deployment, verify these:

### 1. **App is Live**
- [ ] Visit your Vercel URL (e.g., `https://bluebird-payments-pro.vercel.app`)
- [ ] App loads without errors
- [ ] No console errors in browser DevTools

### 2. **Google OAuth Setup** ⚠️
- [ ] Go to https://console.cloud.google.com
- [ ] Navigate to **APIs & Services** → **Credentials**
- [ ] Find your OAuth 2.0 Client ID
- [ ] Verify redirect URI is: `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback`
- [ ] Go to Supabase Dashboard → **Authentication** → **Providers** → **Google**
- [ ] Verify Google provider is **Enabled**
- [ ] Verify Client ID and Client Secret are entered correctly

### 3. **Email System Setup** ⚠️
- [ ] Go to Supabase Dashboard → **Settings** → **Authentication** → **SMTP Settings**
- [ ] Verify **Custom SMTP** is enabled
- [ ] Verify MailerSend credentials are correct:
  - Host: `smtp.mailersend.com`
  - Port: `587` (or `465`)
  - Username: Your MailerSend SMTP token
  - Password: Your MailerSend API key
  - Sender Email: Verified email in MailerSend

---

## 🔧 Troubleshooting

### ❌ Problem: Google OAuth Not Working

#### Symptoms:
- Clicking "Sign in with Google" shows error
- Redirect fails
- "redirect_uri_mismatch" error

#### Solutions:

**1. Check Google Cloud Console Redirect URI**
- Go to https://console.cloud.google.com
- **APIs & Services** → **Credentials**
- Click your OAuth 2.0 Client ID
- In **Authorized redirect URIs**, ensure you have:
  ```
  https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback
  ```
- **Important:** Use the Supabase URL, NOT your Vercel URL!

**2. Verify Supabase Google Provider Settings**
- Go to https://app.supabase.com
- Select project: `owwxfifduexcahsvtyzn`
- **Authentication** → **Providers** → **Google**
- Ensure:
  - ✅ Toggle is **ON** (enabled)
  - ✅ Client ID matches Google Cloud Console
  - ✅ Client Secret matches Google Cloud Console
  - ✅ Click **Save**

**3. Check Browser Console**
- Open DevTools (F12)
- Go to **Console** tab
- Try Google login again
- Look for error messages
- Common errors:
  - `redirect_uri_mismatch` → Fix redirect URI in Google Cloud
  - `invalid_client` → Check credentials in Supabase
  - `access_denied` → User cancelled OAuth

**4. Test OAuth Flow**
```
1. Click "Sign in with Google"
2. Should redirect to Google login
3. After login, should redirect back to app
4. User should be logged in
```

---

### ❌ Problem: Email Not Sending

#### Symptoms:
- Verification emails not received
- Password reset emails not received
- No email activity in MailerSend

#### Solutions:

**1. Check Supabase SMTP Configuration**
- Go to https://app.supabase.com
- **Settings** → **Authentication** → **SMTP Settings**
- Verify:
  - ✅ **Enable Custom SMTP** is ON
  - ✅ All fields are filled correctly
  - ✅ Click **Save**

**2. Verify MailerSend Credentials**
- Log in to MailerSend dashboard
- Go to **SMTP** section
- Verify:
  - SMTP token (username)
  - API key (password)
  - Sender email is verified
  - Domain is verified (if using custom domain)

**3. Test Email Delivery**
- In your app, try:
  - **Sign up** with a new email → Should receive verification email
  - **Forgot password** → Should receive reset email
- Check MailerSend dashboard for email activity
- Check Supabase logs: **Logs** → **Auth** for SMTP errors

**4. Common SMTP Errors**

**Error: "SMTP authentication failed"**
- Check username (SMTP token) and password (API key)
- Verify they're from MailerSend, not regular API credentials

**Error: "Connection timeout"**
- Try port `587` instead of `465` (or vice versa)
- Verify host is `smtp.mailersend.com`

**Error: "Sender email not verified"**
- In MailerSend, verify the sender email address
- Check MailerSend dashboard for verification status

**5. Check Supabase Logs**
- Go to Supabase Dashboard → **Logs** → **Auth**
- Look for SMTP-related errors
- Common log entries:
  - `SMTP connection failed` → Check credentials
  - `Authentication failed` → Wrong username/password
  - `Email sent successfully` → Working! Check spam folder

---

### ❌ Problem: App Not Deploying

#### Symptoms:
- Build fails
- Deployment stuck
- Environment variables not found

#### Solutions:

**1. Check Build Logs**
- Go to Vercel Dashboard → Your Project → **Deployments**
- Click on failed deployment
- Check **Build Logs** for errors

**Common Build Errors:**

**Error: "VITE_SUPABASE_URL is not defined"**
- Go to Vercel Dashboard → Settings → Environment Variables
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
- Redeploy

**Error: "Module not found"**
- Run `npm install` locally
- Check `package.json` for missing dependencies
- Push changes and redeploy

**2. Verify Environment Variables**
- Vercel Dashboard → Settings → Environment Variables
- Ensure these are set:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- Make sure they're added to **Production**, **Preview**, and **Development**

**3. Clear Build Cache**
- Vercel Dashboard → Settings → General
- Scroll to **Build & Development Settings**
- Click **Clear Build Cache**
- Redeploy

---

## 🧪 Testing After Deployment

### Test Checklist:

#### 1. **Basic Functionality**
- [ ] App loads at Vercel URL
- [ ] No console errors
- [ ] Navigation works

#### 2. **Google OAuth**
- [ ] Click "Sign in with Google"
- [ ] Redirects to Google login
- [ ] After login, redirects back to app
- [ ] User is logged in
- [ ] Can access protected routes

#### 3. **Email Verification**
- [ ] Sign up with email/password
- [ ] Verification email is received (check spam)
- [ ] Click verification link
- [ ] Email is verified
- [ ] Can log in

#### 4. **Password Reset**
- [ ] Click "Forgot Password"
- [ ] Enter email
- [ ] Reset email is received
- [ ] Click reset link
- [ ] Can set new password
- [ ] Can log in with new password

---

## 📋 Quick Reference

### Important URLs
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.com
- **Google Cloud Console**: https://console.cloud.google.com
- **MailerSend Dashboard**: https://app.mailersend.com

### Supabase Project
- **Project URL**: `https://owwxfifduexcahsvtyzn.supabase.co`
- **Project ID**: `owwxfifduexcahsvtyzn`
- **Redirect URI**: `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback`

### Vercel Project
- **Repository**: `lychwaw/bluebird-payments-pro`
- **URL**: `https://bluebird-payments-pro.vercel.app` (or your custom domain)

---

## 🆘 Still Having Issues?

### For Google OAuth:
1. Double-check redirect URI in Google Cloud Console
2. Verify credentials in Supabase match Google Cloud
3. Check browser console for specific error messages
4. Try incognito/private window (clears cache)

### For Email:
1. Check MailerSend dashboard for sending limits
2. Verify sender email is verified in MailerSend
3. Check Supabase logs for SMTP errors
4. Try test email from Supabase dashboard

### For Deployment:
1. Check Vercel build logs
2. Verify all environment variables are set
3. Try clearing build cache
4. Check GitHub repository for latest code

---

**Good luck with your deployment! 🚀**

