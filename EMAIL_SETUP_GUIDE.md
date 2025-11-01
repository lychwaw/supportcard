# 📧 Email Setup Guide

## Summary: You DO need MailerSend SMTP settings in Supabase!

---

## Why You Need Custom SMTP

Supabase includes a free SMTP service with these limits:
- ❌ Only sends to YOUR team's email addresses
- ❌ Max 2 emails per hour
- ❌ No delivery guarantee
- ❌ Not suitable for production

**For production, you MUST configure custom SMTP** ✅

---

## What You Already Have

✅ **MailerSend account** - good choice!
✅ **SMTP credentials** - host, port, username, password

---

## Where to Add SMTP Settings in Supabase

### Step-by-Step

1. **Go to Supabase Dashboard**
   - Visit: https://app.supabase.com
   - Select your project: `owwxfifduexcahsvtyzn`

2. **Navigate to SMTP Settings**
   - Click **Settings** (gear icon in left sidebar)
   - Click **Authentication** (under Project Settings)
   - Scroll down to **SMTP Settings**

3. **Enable Custom SMTP**
   - Toggle **Enable Custom SMTP** to ON
   - You'll see fields appear

4. **Enter Your MailerSend Credentials**
   ```
   Sender Email: [your verified email from MailerSend]
   Sender Name: Bluebird Payments (or your app name)
   SMTP Host: smtp.mailersend.com (or what MailerSend gave you)
   SMTP Port: 587 (for TLS) or 465 (for SSL)
   SMTP User: [your MailerSend username/SMTP token]
   SMTP Password: [your MailerSend API key]
   ```

5. **Save Settings**
   - Click **Save** at the bottom
   - Wait for confirmation

---

## What Emails Will Use This

Once configured, Supabase will automatically use your SMTP for:

### Authentication Emails ✅
- Email verification
- Password reset
- Magic link login
- OAuth account linking

### Future Custom Emails (When You Add Them)
- Welcome emails
- Transaction receipts
- Expense approval notifications
- Budget alerts
- Any custom emails you build

---

## Testing Your SMTP Setup

After saving:

1. **Test Password Reset**
   - Go to your app login page
   - Click "Forgot Password"
   - Enter a real email address
   - Check if you receive the email

2. **Check Supabase Logs**
   - Go to **Logs** → **Auth** in Supabase
   - Look for any SMTP errors

3. **Verify in MailerSend Dashboard**
   - Check MailerSend's dashboard for email activity
   - Confirm emails are being sent

---

## MailerSend Specific Information

### Common SMTP Settings for MailerSend:
- **Host**: `smtp.mailersend.com`
- **Port**: `587` (recommended for TLS)
- **Username**: Your SMTP token (from MailerSend)
- **Password**: Your SMTP API key

### Make Sure You Have:
- ✅ Verified sender email in MailerSend
- ✅ SMTP credentials from MailerSend dashboard
- ✅ MailerSend account with sending limits that meet your needs

---

## Important Notes

- **No code changes needed!** - Your app already calls `supabase.auth.signUp()` and `supabase.auth.resend()`
- **Once configured in Supabase**, all emails automatically use your SMTP
- **Works immediately** - no deployment needed after setup
- **Free tier limits** - Check MailerSend's pricing for volume limits

---

## Troubleshooting

### Emails Not Sending?

1. **Check MailerSend Account**
   - Verify you haven't hit sending limits
   - Check MailerSend dashboard for errors

2. **Check SMTP Credentials**
   - Double-check host, port, username, password
   - Try port 587 if 465 doesn't work

3. **Check Supabase Logs**
   - Go to **Logs** → **Auth**
   - Look for SMTP authentication errors

4. **Verify Email Domain**
   - Make sure your sender email is verified in MailerSend
   - Check MailerSend for domain verification requirements

---

## What About Your Code?

**Your code doesn't need any changes!** 

All your existing email calls will automatically use the new SMTP:

```typescript
// Already in your code - works automatically!
await supabase.auth.signUp({ ... })           // ✅ Uses your SMTP
await supabase.auth.resend({ ... })           // ✅ Uses your SMTP
await supabase.auth.resetPasswordForEmail(...) // ✅ Uses your SMTP
```

---

## Summary

✅ **YES** - Add MailerSend SMTP to Supabase  
✅ **NO** - Don't need to change any code  
✅ **WHERE** - Supabase Dashboard → Settings → Authentication → SMTP Settings  

Once configured, all auth emails will work properly in production! 🎉

