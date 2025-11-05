# 🔧 Fix "Invalid API Key" Error

## The Problem

You're getting "invalid api key" when trying to sign up. This means your Supabase environment variables are incorrect or missing.

## Quick Fix

### Step 1: Get Your Supabase Credentials

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Sign in to your account

2. **Select Your Project**
   - Check which project you're using:
     - Project ID: `qaabpphkdcfarjsvzdsm` (from your .env file)
     - OR Project ID: `owwxfifduexcahsvtyzn` (from documentation)

3. **Get API Keys**
   - Click **Settings** (gear icon in left sidebar)
   - Click **API** (under Project Settings)
   - You'll see:
     - **Project URL** (e.g., `https://xxxxx.supabase.co`)
     - **anon public** key (starts with `eyJ...`)

### Step 2: Update Your .env File

1. **Open your `.env` file** in the project root
2. **Update these values**:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_public_key_here
```

**Important:**
- Use the **Project URL** for `VITE_SUPABASE_URL`
- Use the **anon public** key (NOT the service_role key) for `VITE_SUPABASE_PUBLISHABLE_KEY`
- Make sure there are no extra spaces or quotes

### Step 3: Restart Your Dev Server

After updating `.env`:

1. **Stop the dev server** (Ctrl+C in terminal)
2. **Restart it**:
   ```bash
   npm run dev
   ```
3. **Try signing up again**

## Common Issues

### ❌ Wrong Key Type
- **Don't use** `service_role` key (secret key)
- **Use** `anon public` key (publishable key)

### ❌ Wrong Project
- Make sure you're using the correct project ID
- Check your Supabase dashboard to see which projects you have

### ❌ Environment Variables Not Loading
- Make sure `.env` is in the project root (same folder as `package.json`)
- Restart dev server after changing `.env`
- Vite requires `VITE_` prefix for environment variables (which you have ✅)

### ❌ API Key Format
Your key should look like:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhYWJwcGhrZGNmYXJqc3Z6ZHNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMjc1NTIsImV4cCI6MjA3NDkwMzU1Mn0.K0FkBk7sUrAG7WI1kKAZ8oboIlq6Ka668pPZjnsSFfI
```

## Verify It's Working

After updating:

1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Check for any errors about Supabase
4. Try signing up again
5. The error should be gone ✅

## If Still Not Working

1. **Check Supabase Project Status**
   - Go to Supabase Dashboard
   - Make sure your project is active (not paused)

2. **Verify API Keys**
   - Double-check you copied the keys correctly
   - No extra spaces or characters

3. **Check Browser Console**
   - Look for specific error messages
   - Might give more details about what's wrong

4. **Test with a Simple Query**
   - Try a basic Supabase query in browser console
   - Should help identify if it's a key issue or something else

---

**Need help?** Check your Supabase dashboard to make sure:
- ✅ Project is active
- ✅ API keys are visible
- ✅ You're using the correct project

