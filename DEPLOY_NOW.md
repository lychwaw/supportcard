# 🚀 Deploy Now - Step by Step

## Quick Deployment to Vercel

### Step 1: Prepare Your Code
Make sure your code is committed and pushed to GitHub:
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Deploy to Vercel

#### Via Vercel Dashboard (Recommended)
1. **Go to**: https://vercel.com
2. **Sign in** with GitHub
3. **Click**: "Add New Project" or "Import Project"
4. **Select**: Your repository `lychwaw/bluebird-payments-pro`
5. **Configure**:
   - Framework: **Vite**
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `dist` (auto-detected)
6. **Add Environment Variables** (Click "Add" for each):
   ```
   VITE_SUPABASE_URL=https://owwxfifduexcahsvtyzn.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   ```
7. **Click**: "Deploy"

### Step 3: Verify Deployment
- Wait 1-2 minutes for deployment
- Check deployment status in Vercel dashboard
- Visit your live URL (e.g., `https://bluebird-payments-pro.vercel.app`)

---

## 🔐 Setup Google OAuth (If Not Working)

### Quick Setup:
1. **Google Cloud Console**: https://console.cloud.google.com
2. **Create OAuth Credentials**:
   - APIs & Services → Credentials → Create OAuth Client ID
   - Add redirect URI: `https://owwxfifduexcahsvtyzn.supabase.co/auth/v1/callback`
3. **Supabase Dashboard**: https://app.supabase.com
   - Authentication → Providers → Google
   - Enable Google provider
   - Paste Client ID and Client Secret
   - Save

**See**: `GOOGLE_OAUTH_SETUP.md` for detailed instructions

---

## 📧 Setup Email (If Not Working)

### Quick Setup:
1. **Supabase Dashboard**: https://app.supabase.com
   - Settings → Authentication → SMTP Settings
   - Enable Custom SMTP
   - Enter MailerSend credentials:
     - Host: `smtp.mailersend.com`
     - Port: `587`
     - Username: Your MailerSend SMTP token
     - Password: Your MailerSend API key
     - Sender Email: Your verified email
   - Save

**See**: `EMAIL_SETUP_GUIDE.md` for detailed instructions

---

## ✅ After Deployment - Test These

### 1. Google OAuth
- Visit your Vercel URL
- Click "Sign in with Google"
- Should redirect to Google → Back to app → Logged in ✅

### 2. Email Sign Up
- Click "Sign Up"
- Enter email and password
- Check email inbox (and spam) for verification email
- Click verification link
- Should be able to log in ✅

### 3. Password Reset
- Click "Forgot Password"
- Enter email
- Check email for reset link
- Click link and set new password ✅

---

## 🆘 Troubleshooting

**Google OAuth not working?**
→ See `VERCEL_DEPLOYMENT_GUIDE.md` → "Google OAuth Not Working"

**Email not sending?**
→ See `VERCEL_DEPLOYMENT_GUIDE.md` → "Email Not Sending"

**App not deploying?**
→ See `VERCEL_DEPLOYMENT_GUIDE.md` → "App Not Deploying"

---

**Your app will be live at**: `https://bluebird-payments-pro.vercel.app` (or your custom URL)

🎉 **Good luck!**

