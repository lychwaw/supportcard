# SupportCard Pre-Launch Checklist

## 🚀 External Requirements for Launch

### 1. **Supabase Setup** ✅ Configure This First
- [ ] Create Supabase account at https://supabase.com
- [ ] Create new project
- [ ] Copy your Supabase URL and anon key
- [ ] Add environment variables to Vercel:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] Run database migration in Supabase SQL Editor
- [ ] Create Storage bucket `id-verifications` (set to Private)
- [ ] Configure RLS policies for the bucket

### 2. **Payment Integration** ⚠️ Critical for Revenue
- [ ] **Choose payment processor:**
  - Option A: Stripe (recommended for global)
  - Option B: Paystack (good for South Africa)
  - Option C: Flutterwave (good for Africa)
- [ ] Create merchant account
- [ ] Get API keys (publishable and secret)
- [ ] Add Stripe secret to Vercel environment variables
- [ ] Implement webhook endpoint for subscription updates
- [ ] Test payment flow with test cards
- [ ] Set up recurring billing for subscriptions

### 3. **Virtual Card Issuing** 💳 Required for Core Functionality
- [ ] **Choose card issuing provider:**
  - Option A: Stripe Issuing
  - Option B: Marqeta
  - Option C: Lithic
- [ ] Get card program approval
- [ ] Get API credentials
- [ ] Implement card creation API
- [ ] Set up card controls and limits
- [ ] Test card issuance and transactions
- [ ] Configure card design (if applicable)

### 4. **OAuth Setup** 🔐 Google & Apple Authentication
- [ ] **Google OAuth:**
  - Create Google Cloud Project
  - Enable Google+ API
  - Create OAuth credentials
  - Add authorized redirect URLs
  - Add credentials to Supabase Auth settings
- [ ] **Apple Sign-In:**
  - Enroll in Apple Developer Program ($99/year)
  - Create App ID in Apple Developer Portal
  - Configure Sign in with Apple service
  - Add credentials to Supabase Auth settings

### 5. **Email Service** 📧 User Communications
- [ ] **Choose email provider:**
  - SendGrid (recommended)
  - Resend
  - AWS SES
- [ ] Create account and verify domain
- [ ] Get API key
- [ ] Set up email templates:
  - Welcome email
  - Verification email
  - Transaction receipts
  - Expense approval notifications
- [ ] Add email API key to environment variables
- [ ] Test email delivery

### 6. **SMS Notifications** 📱 Optional but Recommended
- [ ] Choose SMS provider:
  - Twilio
  - AWS SNS
  - Vonage
- [ ] Get API credentials
- [ ] Set up SMS templates
- [ ] Add to environment variables
- [ ] Test SMS delivery

### 7. **Domain & SSL** 🌐 Professional Branding
- [ ] Purchase domain (e.g., supportcard.co or supportcard.com)
- [ ] Point DNS to Vercel
- [ ] Configure SSL certificate (auto with Vercel)
- [ ] Set up custom domain in Vercel project settings
- [ ] Update OAuth redirect URLs with new domain

### 8. **Legal & Compliance** ⚖️ Required for Launch
- [ ] Draft Terms of Service
- [ ] Draft Privacy Policy
- [ ] Create Cookie Policy
- [ ] Set up data processing agreement
- [ ] Create refund policy
- [ ] Legal review by attorney (recommended)
- [ ] GDPR compliance (if serving EU users)
- [ ] POPIA compliance (for South Africa)
- [ ] PCI DSS compliance documentation (for card processing)

### 9. **Security & Backup** 🔒 Data Protection
- [ ] Set up automated database backups
- [ ] Configure Supabase backup schedule
- [ ] Set up monitoring and alerts
- [ ] Implement rate limiting
- [ ] Set up DDoS protection (provided by Vercel)
- [ ] Configure CORS properly
- [ ] Security audit (optional but recommended)

### 10. **Analytics & Monitoring** 📊 Track Performance
- [ ] Set up Google Analytics or Plausible
- [ ] Add tracking code to app
- [ ] Set up Vercel Analytics
- [ ] Configure error tracking (Sentry recommended)
- [ ] Set up uptime monitoring (UptimeRobot or similar)
- [ ] Create dashboards for key metrics

### 11. **Customer Support** 💬 User Assistance
- [ ] Set up support email (support@supportcard.co)
- [ ] Set up help desk (Intercom, Zendesk, or Crisp)
- [ ] Create FAQ page
- [ ] Write user documentation
- [ ] Set up live chat widget
- [ ] Create support workflow

### 12. **Marketing Assets** 📢 Promotion
- [ ] Design logo and branding
- [ ] Create social media pages (Facebook, Twitter, LinkedIn)
- [ ] Write landing page copy
- [ ] Create demo video
- [ ] Prepare press kit
- [ ] Design app screenshots
- [ ] Create marketing materials

### 13. **Testing** 🧪 Quality Assurance
- [ ] Manual testing of all features
- [ ] Test on different devices (iOS, Android, Desktop)
- [ ] Test all user flows
- [ ] Load testing (if expecting traffic)
- [ ] Security testing
- [ ] User acceptance testing with beta users
- [ ] Fix identified bugs

### 14. **Financial Setup** 💰 Money Matters
- [ ] Set up business bank account
- [ ] Connect payment processor to bank
- [ ] Set up tax ID (if applicable)
- [ ] Configure payout schedule
- [ ] Set up accounting system
- [ ] Plan for transaction fees

### 15. **Launch Preparation** 🎯 Final Steps
- [ ] Create press release (optional)
- [ ] Plan launch announcement
- [ ] Prepare for customer inquiries
- [ ] Have backup plans ready
- [ ] Monitor system on launch day
- [ ] Have support staff ready

### 16. **Post-Launch** 📈 Growth & Maintenance
- [ ] Monitor user feedback
- [ ] Track key metrics
- [ ] Plan feature updates
- [ ] Regular security updates
- [ ] Marketing campaigns
- [ ] User acquisition strategy

## ⚠️ Critical Path Items (Must Do Before Launch)

1. **Supabase setup** - Core database and auth
2. **Payment integration** - Revenue generation
3. **Virtual card issuing** - Core functionality
4. **Legal documents** - Compliance and protection
5. **Domain & SSL** - Professional presence

## 📝 Internal Development Tasks (Already Done ✅)

- ✅ Role-based permissions system
- ✅ Permission hooks and checks
- ✅ Child vs Parent account restrictions
- ✅ Settings page restrictions
- ✅ Subscription management UI
- ✅ Placeholder messages for incomplete features
- ✅ No error messages for not-yet-implemented features

## 🎯 Minimum Viable Launch (MVP) Requirements

For a soft launch, you at minimum need:
1. Supabase configured ✅
2. OAuth working (Google at minimum) ✅
3. Domain configured ✅
4. Legal documents ready
5. Payment integration (even if just collecting signups)

Virtual cards can be added after initial user feedback!

## 📞 Need Help?

Refer to:
- Supabase Docs: https://supabase.com/docs
- Stripe Docs: https://stripe.com/docs
- Vercel Docs: https://vercel.com/docs

---

**Current Status**: Ready for infrastructure setup
**Next Priority**: Supabase configuration and deployment
**Timeline**: 2-4 weeks for all critical items if working full-time
