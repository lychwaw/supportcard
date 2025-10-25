# SupportCard - Child Support Payment Management

## 🎉 Implemented Features

### ✅ Authentication & Security
- **Google & Apple OAuth** - Social login options for both login and signup
- **ID Verification** - Government-issued ID upload required during signup
- **Email/Password Authentication** - Traditional auth method
- **Secure Storage** - ID documents stored in Supabase Storage

### ✅ Subscription Management
Four-tier subscription model:

1. **Free (R0)**
   - Basic wallet
   - Transactions
   - Shared expenses
   - Basic notifications

2. **Premium (R99-R149)**
   - Advanced expense analytics & AI insights
   - Court-ready exportable reports
   - Smart notifications & category tracking
   - Goal-based saving pockets
   - Priority support & calendar sync
   - Custom virtual card designs

3. **Legal (R299-R499)**
   - Multi-client dashboard
   - Exportable client reports
   - Secure document storage
   - Legal portal integration
   - Digital signing of agreements
   - All Premium features

4. **Family+ (R199)**
   - Multiple child wallets
   - Guardian viewing access
   - International transfer discounts
   - Individual child insights
   - Advanced spending analytics
   - All Premium features

### ✅ Pages & Features
- **Dashboard** - Overview of finances and children
- **Transactions** - Transaction history
- **Budget** - Budget management
- **Expenses** - Expense tracking and requests
- **Cards** - Virtual card management
- **Calendar** - Event calendar
- **Messages** - Internal messaging
- **Contacts** - Emergency contacts
- **Settings** - Profile, subscription, and verification management

### ✅ Database Schema
- Profiles with ID verification tracking
- User roles (parent/child)
- Children management
- Virtual cards
- Transactions
- Expense requests
- Budget categories
- Calendar events
- Emergency contacts
- Messages
- Payment methods
- User roles table

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18+ installed
- Supabase account
- Google and Apple OAuth credentials (optional)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Supabase

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

### 3. Set Up Supabase Database

Run the migration file to create all tables:
```bash
# Navigate to Supabase dashboard
# Go to SQL Editor
# Copy and paste the contents of supabase/migrations/20251001212404_f4276a7c-ba5a-4fe1-b8fa-485b6d3ee14a.sql
# Run the migration
```

### 4. Configure Supabase Storage

In Supabase Dashboard:
1. Go to Storage
2. Create a new bucket called `id-verifications`
3. Set it to Private
4. Add RLS policies for authenticated users

### 5. Enable OAuth Providers (Optional)

In Supabase Dashboard:
1. Go to Authentication > Providers
2. Enable Google and/or Apple
3. Add your OAuth credentials

### 6. Run Development Server

```bash
npm run dev
```

## 📋 Next Steps

### To Complete Implementation:

1. **Payment Integration**
   - Integrate Stripe/Paystack for subscription payments
   - Add recurring billing logic
   - Handle subscription status updates

2. **Premium Features**
   - Implement advanced analytics
   - Export reports (PDF/Excel)
   - Digital document signing
   - Multi-client dashboard for Legal tier

3. **Additional Features**
   - Email notifications
   - SMS alerts for Premium users
   - Calendar sync (Google Calendar, iCal)
   - AI expense categorization
   - Budget recommendations

4. **Testing**
   - Unit tests for components
   - Integration tests
   - E2E tests with Playwright

5. **Deployment**
   - Deploy to Vercel/Netlify
   - Set up environment variables
   - Configure custom domain
   - Set up monitoring

## 🎨 Design System

The app uses:
- **UI Framework**: shadcn/ui components
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Colors**: Custom gradient primary theme
- **Typography**: Inter/System fonts

## 📱 Mobile Responsive

All pages are mobile-responsive and optimized for:
- Mobile phones (320px+)
- Tablets (768px+)
- Desktop (1024px+)

## 🔒 Security Features

- Row Level Security (RLS) on all tables
- Secure file uploads to Supabase Storage
- Email verification flow
- ID verification process
- Protected routes with authentication
- Role-based access control

## 📊 Database Tables

- `profiles` - User profiles with subscription info
- `user_roles` - Role management
- `children` - Child information
- `virtual_cards` - Virtual payment cards
- `transactions` - Transaction history
- `expense_requests` - Expense approval workflow
- `budget_categories` - Budget management
- `calendar_events` - Event calendar
- `emergency_contacts` - Emergency contact info
- `messages` - Internal messaging
- `payment_methods` - Payment options

## 🌐 API Endpoints

All data fetching uses Supabase client:
- Real-time subscriptions available
- Automatic caching with React Query
- Optimistic updates

## 🐛 Troubleshooting

### Auth issues
- Check Supabase credentials in `.env`
- Verify OAuth redirect URLs
- Ensure email confirmation is set up

### Storage issues
- Check bucket permissions
- Verify RLS policies
- Ensure user is authenticated

### Database errors
- Verify all migrations ran successfully
- Check RLS policies are enabled
- Confirm foreign key relationships

## 📞 Support

For issues or questions, refer to:
- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [React Router Docs](https://reactrouter.com)

