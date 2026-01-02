# 🍎 Apple Sign-In Setup Instructions

## Quick Setup Guide

### Your Supabase Project URL
```
https://owwxfifduexcahsvtyzn.supabase.co
```

### Redirect URIs for Apple Developer Portal

**Production:**
```
https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback
```

**Localhost (for testing):**
```
http://localhost:8080/auth/callback
```

---

## Step-by-Step Instructions

### 1. Prerequisites
- **Apple Developer Account** (requires enrollment in Apple Developer Program - $99/year)
- Access to your Supabase project dashboard

### 2. Create App ID in Apple Developer Portal

1. Go to https://developer.apple.com/account
2. Sign in with your Apple Developer account
3. Navigate to **Certificates, Identifiers & Profiles**
4. Click **Identifiers** in the left sidebar
5. Click the **+** button to create a new identifier
6. Select **App IDs** and click **Continue**
7. Select **App** and click **Continue**
8. Fill in:
   - **Description**: Bluebird Payments Pro (or your app name)
   - **Bundle ID**: `com.bluebird.payments` (or your unique bundle ID)
     - ⚠️ **Important**: Use reverse domain notation (e.g., `com.yourcompany.appname`)
9. Under **Capabilities**, check:
   - ✅ **Sign In with Apple**
10. Click **Continue** and then **Register**

---

### 3. Create Services ID (for Web Authentication)

1. Still in **Identifiers**, click **+** again
2. Select **Services IDs** and click **Continue**
3. Fill in:
   - **Description**: Bluebird Payments Pro Web
   - **Identifier**: `com.bluebird.payments.web` (or your service ID)
4. Click **Continue** and then **Register**
5. **Edit** the newly created Services ID
6. Check ✅ **Sign In with Apple**
7. Click **Configure** next to "Sign In with Apple"
8. In the configuration:
   - **Primary App ID**: Select the App ID you created in step 2
   - **Website URLs**:
     - **Domains and Subdomains**: 
       - `owwxfifduexcahsvtyzn.supabase.co` (production)
       - `localhost` (for local testing)
     - **Return URLs**: 
       - `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback` (production - REQUIRED)
       - `http://localhost:8080/auth/callback` (for local testing - OPTIONAL)
       
   **⚠️ Important for localhost testing:**
   - Make sure your dev server is running on port 8080
   - The Return URL must match exactly: `http://localhost:8080/auth/callback`
   - If you're using a different port, update the URL accordingly
   - Click **Save**
9. Click **Continue** and then **Save**

---

### 4. Create a Key for Sign In with Apple

1. In Apple Developer Portal, go to **Keys**
2. Click the **+** button to create a new key
3. Fill in:
   - **Key Name**: Bluebird Payments - Sign In with Apple
4. Check ✅ **Sign In with Apple**
5. Click **Configure** next to "Sign In with Apple"
6. Select your **Primary App ID** (the one from step 2)
7. Click **Save**
8. Click **Continue** and then **Register**
9. **⚠️ IMPORTANT**: Download the key file (`.p8` file)
   - You can only download this ONCE - save it securely!
   - Note the **Key ID** shown on the page (you'll need this)

---

### 5. Get Your Team ID

1. In Apple Developer Portal, look at the top right corner
2. You'll see your **Team ID** (looks like: `ABC123DEF4`)
3. Copy this - you'll need it for Supabase

---

### 6. Configure Apple Provider in Supabase

1. Go to your Supabase dashboard: https://app.supabase.com
2. Select your project: `owwxfifduexcahsvtyzn`
3. Navigate to **Authentication** → **Providers**
4. Click on **Apple**
5. Enable Apple provider (toggle switch)
6. Fill in the following fields:

   **Required Information:**
   - **Services ID**: `com.bluebird.payments.web` (the Services ID from step 3)
   - **Secret Key**: Upload the `.p8` key file you downloaded in step 4
   - **Key ID**: The Key ID from step 4 (e.g., `ABC123DEF4`)
   - **Team ID**: Your Team ID from step 5 (e.g., `ABC123DEF4`)

7. Click **Save**

---

## 📋 Credentials Checklist

Before configuring in Supabase, make sure you have:

- [ ] **Services ID**: `com.bluebird.payments.web` (or your custom one)
- [ ] **Key ID**: From the Keys section (e.g., `ABC123DEF4`)
- [ ] **Team ID**: From top right of Apple Developer Portal (e.g., `ABC123DEF4`)
- [ ] **Private Key (.p8 file)**: Downloaded from Keys section
- [ ] **App ID**: `com.bluebird.payments` (or your custom one) - for reference

---

## Testing

1. Visit your app URL: `https://bluebird-payments-pro.vercel.app` (or your Vercel URL)
2. Click "Sign in with Apple" button
3. You should be redirected to Apple's login page
4. After signing in, you should be redirected back to your app
5. User should be created in Supabase automatically

---

## Troubleshooting

### ❌ "Invalid client" Error
- Verify Services ID matches exactly in Supabase
- Check that Services ID has "Sign In with Apple" enabled
- Ensure Return URL is correctly configured in Apple Developer Portal

### ❌ "Invalid key" Error
- Verify the `.p8` key file was uploaded correctly
- Check Key ID matches the key you downloaded
- Ensure Team ID is correct

### ❌ Redirect Not Working
- Verify Return URL in Apple Developer Portal matches: `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback`
- Check domain is added correctly: `owwxfifduexcahsvtyzn.supabase.co`
- Ensure no trailing slashes in URLs

### ❌ "Sign In with Apple" Not Showing in Capabilities
- Make sure you're using an App ID (not Services ID) when enabling capabilities
- Verify you have an active Apple Developer Program membership

---

## Important Notes

✅ **Services ID** is used in Supabase (NOT the App ID)
✅ **Return URL** must match exactly: `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback`
✅ **Domain** must be added: `owwxfifduexcahsvtyzn.supabase.co`
✅ **Private Key (.p8)** can only be downloaded once - save it securely!
✅ **HTTPS is required** for production URLs
✅ **Apple Developer Program** membership ($99/year) is required

---

## Quick Reference

| Service | Value |
|---------|-------|
| **Supabase Project** | `https://owwxfifduexcahsvtyzn.supabase.co` |
| **Apple Return URL** | `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback` |
| **Supabase Dashboard** | https://app.supabase.com |
| **Apple Developer Portal** | https://developer.apple.com/account |

---

## What You Need to Provide

To complete the setup, you'll need to provide:

1. **Services ID** (e.g., `com.bluebird.payments.web`)
2. **Key ID** (from the Keys section)
3. **Team ID** (from top right of Apple Developer Portal)
4. **Private Key file** (`.p8` file - download from Keys section)

Once you have these, add them to Supabase Dashboard → Authentication → Providers → Apple

---

**That's it! You're all set! 🎉**

