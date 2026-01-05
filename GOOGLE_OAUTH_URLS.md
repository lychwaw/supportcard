# 🔐 Google OAuth URLs Configuration

## Complete URL Configuration Guide

### 📍 Where Each URL Goes

---

## 1. Google Cloud Console

**Location**: https://console.cloud.google.com → APIs & Services → Credentials → Your OAuth Client ID

**Add to "Authorized redirect URIs":**

```
https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback
```

**Optional (for localhost testing):**
```
http://localhost:54321/auth/v1/callback
```
*(Only if running Supabase locally)*

---

## 2. Supabase Dashboard

### A. URL Configuration (Redirect URLs)

**Location**: https://app.supabase.com → Authentication → URL Configuration → Redirect URLs

**Add these URLs:**

**Production:**
```
https://bluebird-payments-pro.vercel.app/auth/callback
```
*(Replace with your actual Vercel URL if different)*

**Localhost (optional):**
```
http://localhost:8080/auth/callback
```

### B. Google Provider Settings

**Location**: https://app.supabase.com → Authentication → Providers → Google

**Configure:**
- ✅ Enable Google provider (toggle ON)
- ✅ Client ID: (from Google Cloud Console)
- ✅ Client Secret: (from Google Cloud Console)
- ✅ Click **Save**

---

## 📋 Quick Reference Table

| Location | URL to Add | Purpose |
|----------|-----------|---------|
| **Google Cloud Console** | `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback` | Where Google redirects after auth |
| **Supabase Redirect URLs** | `https://bluebird-payments-pro.vercel.app/auth/callback` | Where Supabase redirects to your app |
| **Supabase Redirect URLs** (localhost) | `http://localhost:8080/auth/callback` | For local testing |

---

## 🔄 How the Flow Works

1. **User clicks "Sign in with Google"** → Your Vercel app
2. **Redirects to Google** → Google login page
3. **User authenticates** → Google
4. **Google redirects to Supabase** → `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback` ✅
5. **Supabase processes auth** → Creates session
6. **Supabase redirects to your app** → `https://bluebird-payments-pro.vercel.app/auth/callback` ✅

---

## ⚠️ Important Notes

✅ **Google Cloud Console** only needs the **Supabase callback URL** (not your Vercel URL)

✅ **Supabase Redirect URLs** needs your **Vercel app URL** (where users should land after auth)

✅ **These are different URLs** - one goes to Supabase, one goes to your app!

✅ **No trailing slashes** - use `/auth/callback` not `/auth/callback/`

---

## 🧪 Testing Checklist

After configuring:

- [ ] Google Cloud Console has Supabase callback URL
- [ ] Supabase has your Vercel URL in Redirect URLs
- [ ] Google provider is enabled in Supabase
- [ ] Client ID and Secret are correct in Supabase
- [ ] Test sign-in works on Vercel
- [ ] Test sign-in works on localhost (if configured)

---

## 🐛 Common Issues

### "redirect_uri_mismatch" Error
- **Fix**: Add `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback` to Google Cloud Console
- **Check**: No trailing slashes, exact match

### 404 Error After Google Auth
- **Fix**: Add your Vercel URL to Supabase → Authentication → URL Configuration → Redirect URLs
- **Check**: URL matches exactly (including `/auth/callback`)

### OAuth Not Working
- **Check**: Google provider is enabled in Supabase
- **Check**: Client ID and Secret are correct
- **Check**: Both URLs are configured correctly

---

**That's it! Configure these URLs and Google OAuth will work! 🎉**





