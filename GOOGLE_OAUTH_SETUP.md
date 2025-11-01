# 🔐 Google OAuth Setup Instructions

## Quick Setup Guide

### Your Supabase Project URL
```
https://owwxfifduexcahsvtyzn.supabase.co
```

### Redirect URI for Google Cloud Console
```
https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback
```

---

## Step-by-Step Instructions

### 1. Go to Google Cloud Console
- Visit: https://console.cloud.google.com
- Select your project (or create a new one)

### 2. Enable Google+ API
- Go to **APIs & Services** → **Library**
- Search for "Google+ API"
- Click **Enable**

### 3. Configure OAuth Consent Screen
- Go to **APIs & Services** → **OAuth consent screen**
- Fill in:
  - App name: Bluebird Payments Pro (or your app name)
  - User support email: Your email
  - Developer contact: Your email
- Click **Save and Continue**

### 4. Create OAuth 2.0 Credentials
- Go to **APIs & Services** → **Credentials**
- Click **+ CREATE CREDENTIALS** → **OAuth client ID**
- Choose **Web application**
- Give it a name: "Bluebird Payments - Supabase"

### 5. Add Authorized Redirect URI ⭐
**This is the important part!**

In the **Authorized redirect URIs** section, click **+ ADD URI** and add:

```
https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback
```

Click **CREATE**

### 6. Copy Your Credentials
You'll get a popup with:
- **Client ID** (looks like: `1234567890-abc123def456.apps.googleusercontent.com`)
- **Client Secret** (looks like: `GOCSPX-abc123def456...`)

**Save these securely!**

### 7. Add Credentials to Supabase
1. Go to your Supabase dashboard: https://app.supabase.com
2. Select your project: `owwxfifduexcahsvtyzn`
3. Navigate to **Authentication** → **Providers**
4. Click on **Google**
5. Enable Google provider (toggle switch)
6. Paste your **Client ID** and **Client Secret** from Google Cloud
7. Click **Save**

---

## Testing

1. Visit your app URL: `https://bluebird-payments-pro.vercel.app` (or your Vercel URL)
2. Click "Sign in with Google"
3. You should be redirected to Google's login page
4. After signing in, you should be redirected back to your app

---

## Additional URLs (Optional)

If you also want to test locally, add this to Google Cloud Console as well:

```
http://localhost:54321/auth/v1/callback
```

**Note:** You only need this if you're running Supabase locally for development.

---

## Troubleshooting

### "redirect_uri_mismatch" Error
- Make sure the redirect URI in Google Cloud matches EXACTLY
- It must be: `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback`
- No trailing slashes, no extra characters

### OAuth Not Working
1. Verify Google+ API is enabled
2. Check credentials are correctly entered in Supabase
3. Make sure you're using the production Supabase URL (not localhost)
4. Check browser console for any error messages

---

## Important Notes

✅ **Your Vercel URL** (`https://bluebird-payments-pro.vercel.app`) is NOT used in Google Cloud Console
✅ **Only Supabase callback URL** goes in Google Cloud
✅ **One redirect URI** is all you need for production
✅ **HTTPS is required** for production URLs

---

## Quick Reference

| Service | URL |
|---------|-----|
| **Supabase Project** | `https://owwxfifduexcahsvtyzn.supabase.co` |
| **Google Redirect URI** | `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback` |
| **Supabase Dashboard** | https://app.supabase.com |
| **Google Cloud Console** | https://console.cloud.google.com |

---

**That's it! You're all set! 🎉**

