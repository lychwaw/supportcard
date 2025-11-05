# 🚀 Vercel Deployment - Step by Step

## Step 1: Go to Vercel Dashboard
1. Open: https://vercel.com
2. **Sign in** with your GitHub account

## Step 2: Create New Project

### Option A: If You Don't Have a Project Yet
1. Click **"Add New Project"** or **"Import Project"**
2. Find your repository: `lychwaw/bluebird-payments-pro`
3. Click **"Import"**

### Option B: If Project Already Exists
1. Go to your project dashboard
2. Click **"Settings"** → **"Deployments"**
3. Click **"Redeploy"** (or connect to GitHub if not connected)

## Step 3: Configure Project Settings

Vercel should auto-detect:
- ✅ **Framework Preset**: Vite (auto-detected)
- ✅ **Root Directory**: `./` (default)
- ✅ **Build Command**: `npm run build` (auto-detected)
- ✅ **Output Directory**: `dist` (auto-detected)

**If not auto-detected, set these manually**

## Step 4: Add Environment Variables ⚠️ CRITICAL

**BEFORE clicking Deploy, add these:**

1. Click **"Environment Variables"** section
2. Add these two variables:

### Variable 1:
- **Name**: `VITE_SUPABASE_URL`
- **Value**: `https://owwxfifduexcahsvtyzn.supabase.co`
- **Environments**: Check all (Production, Preview, Development)

### Variable 2:
- **Name**: `VITE_SUPABASE_PUBLISHABLE_KEY`
- **Value**: Your Supabase anon/public key
  - Get it from: https://app.supabase.com → Your Project → Settings → API
  - Copy the **anon public** key (starts with `eyJ...`)
- **Environments**: Check all (Production, Preview, Development)

**Important**: Make sure to check all three environment types (Production, Preview, Development)

## Step 5: Deploy

1. Click **"Deploy"** button
2. Wait 1-2 minutes for build to complete
3. Watch the build logs for any errors

## Step 6: Get Your Live URL

After deployment completes:
1. You'll see a success message
2. Your app URL will be shown (e.g., `https://bluebird-payments-pro.vercel.app`)
3. Click the URL to visit your live app

## Step 7: Test Your Deployment

1. **Visit your Vercel URL**
2. **Try signing up** - should work now!
3. **Test Google OAuth** - if configured
4. **Check browser console** for any errors

---

## Troubleshooting

### Build Fails?
- Check build logs in Vercel dashboard
- Make sure environment variables are set
- Verify `package.json` has all dependencies

### "Invalid API Key" on Vercel?
- Go to Vercel Dashboard → Settings → Environment Variables
- Verify `VITE_SUPABASE_PUBLISHABLE_KEY` is set correctly
- Make sure you used the **anon public** key (not service_role)
- Redeploy after adding variables

### App Loads But Auth Doesn't Work?
- Check Supabase project is active
- Verify API keys are correct
- Check browser console for errors

---

## Quick Checklist

- [ ] Signed in to Vercel
- [ ] Imported/connected GitHub repository
- [ ] Added `VITE_SUPABASE_URL` environment variable
- [ ] Added `VITE_SUPABASE_PUBLISHABLE_KEY` environment variable
- [ ] Clicked Deploy
- [ ] Waited for build to complete
- [ ] Tested sign up on live URL

---

**Your app will be live at**: `https://bluebird-payments-pro.vercel.app` (or your custom URL)

🎉 **Good luck with your deployment!**

