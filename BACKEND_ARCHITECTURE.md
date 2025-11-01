# Backend Architecture & Database Strategy

## 🏗️ **Current Architecture**

### **Frontend**
- **React + TypeScript** with Vite
- **Tailwind CSS + shadcn/ui** for styling
- **Supabase Client** for database and auth
- **Permission-based UI** with role management

### **Backend (Supabase)**
- **PostgreSQL Database** with Row Level Security (RLS)
- **Built-in Authentication** with role-based access
- **Real-time subscriptions** for live updates
- **Edge Functions** for custom business logic
- **Storage** for file uploads (avatars, receipts)

## 📊 **Database Schema**

### **Core Tables**

#### `profiles`
```sql
- id (UUID, Primary Key, references auth.users)
- full_name (TEXT)
- email (TEXT)
- phone (TEXT)
- avatar_url (TEXT)
- bio (TEXT)
- preferred_currency (TEXT, default 'ZAR')
- created_at, updated_at (TIMESTAMP)
```

#### `user_roles`
```sql
- id (UUID, Primary Key)
- user_id (UUID, references auth.users)
- role (TEXT: 'parent' | 'child')
- created_at (TIMESTAMP)
```

#### `children`
```sql
- id (UUID, Primary Key)
- parent_id (UUID, references profiles.id)
- user_id (UUID, references auth.users, nullable)
- name (TEXT)
- avatar_url (TEXT)
- target_amount (DECIMAL)
- current_amount (DECIMAL)
- created_at, updated_at (TIMESTAMP)
```

#### `virtual_cards`
```sql
- id (UUID, Primary Key)
- user_id (UUID, references profiles.id)
- child_id (UUID, references children.id, nullable)
- card_number (TEXT, encrypted)
- card_type (TEXT: 'VISA' | 'MASTERCARD')
- balance (DECIMAL)
- is_primary (BOOLEAN)
- created_at (TIMESTAMP)
```

#### `transactions`
```sql
- id (UUID, Primary Key)
- user_id (UUID, references profiles.id)
- card_id (UUID, references virtual_cards.id)
- merchant_name (TEXT)
- amount (DECIMAL)
- category (TEXT)
- location (TEXT)
- transaction_date (TIMESTAMP)
- created_at (TIMESTAMP)
```

#### `expense_requests`
```sql
- id (UUID, Primary Key)
- requester_id (UUID, references profiles.id)
- child_id (UUID, references children.id)
- amount (DECIMAL)
- category (TEXT)
- description (TEXT)
- receipt_url (TEXT)
- status (TEXT: 'pending' | 'approved' | 'denied')
- created_at, updated_at (TIMESTAMP)
```

#### `budget_categories`
```sql
- id (UUID, Primary Key)
- user_id (UUID, references profiles.id)
- child_id (UUID, references children.id, nullable)
- category (TEXT)
- monthly_limit (DECIMAL)
- current_spent (DECIMAL)
- created_at (TIMESTAMP)
```

#### `messages`
```sql
- id (UUID, Primary Key)
- sender_id (UUID, references profiles.id)
- receiver_id (UUID, references profiles.id)
- content (TEXT)
- read (BOOLEAN, default false)
- message_type (TEXT: 'text' | 'expense_request' | 'notification')
- created_at (TIMESTAMP)
```

#### `calendar_events`
```sql
- id (UUID, Primary Key)
- user_id (UUID, references profiles.id)
- child_id (UUID, references children.id, nullable)
- event_date (DATE)
- event_type (TEXT: 'payment_due' | 'school_event' | 'appointment')
- title (TEXT)
- description (TEXT)
- created_at (TIMESTAMP)
```

#### `emergency_contacts`
```sql
- id (UUID, Primary Key)
- user_id (UUID, references profiles.id)
- name (TEXT)
- relationship (TEXT)
- phone (TEXT)
- email (TEXT)
- created_at (TIMESTAMP)
```

## 🔐 **Security Implementation**

### **Row Level Security (RLS) Policies**

#### Parent Access:
- ✅ Full access to their own data
- ✅ Full access to their children's data
- ✅ Can manage virtual cards for children
- ✅ Can approve/deny expense requests
- ✅ Can view all family transactions

#### Child Access:
- ✅ View their own profile and data
- ✅ View their assigned virtual cards (read-only)
- ✅ View their transactions (read-only)
- ✅ Submit expense requests
- ✅ Send/receive messages with parent
- ❌ Cannot access other children's data
- ❌ Cannot manage virtual cards
- ❌ Cannot access emergency contacts

### **Authentication Flow**
1. **ID Number Validation** → Age verification
2. **Role Assignment** → Automatic based on age
3. **Profile Creation** → With appropriate permissions
4. **Session Management** → JWT tokens via Supabase

## 💬 **Private Messaging System**

### **Real-time Messaging**
```typescript
// Subscribe to messages
const subscription = supabase
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `receiver_id=eq.${user.id}`
  }, (payload) => {
    // Handle new message
    setMessages(prev => [...prev, payload.new])
  })
  .subscribe()
```

### **Message Types**
- **Text Messages**: Direct communication
- **Expense Notifications**: Auto-generated when expense submitted
- **System Notifications**: Payment reminders, budget alerts
- **File Attachments**: Receipts, photos via Supabase Storage

### **Privacy Features**
- End-to-end encryption for sensitive messages
- Message retention policies (auto-delete after 90 days)
- Parental controls for child messaging

## 📱 **Real-time Features**

### **Live Updates**
- **Transaction notifications** when cards are used
- **Budget alerts** when limits are approached
- **Expense request status** changes
- **Message delivery** and read receipts
- **Balance updates** across all devices

### **Supabase Realtime Implementation**
```typescript
// Real-time transaction monitoring
useEffect(() => {
  const channel = supabase
    .channel('transactions')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'transactions',
      filter: `user_id=eq.${user.id}`
    }, handleTransactionUpdate)
    .subscribe()

  return () => supabase.removeChannel(channel)
}, [user.id])
```

## 🌍 **South African Specific Features**

### **Payment Integration**
- **PayFast** integration for South African payments
- **EFT** and **Instant Pay** support
- **South African bank** account verification
- **FICA compliance** for financial regulations

### **Localization**
- **11 Official languages** support
- **ZAR currency** as default with proper formatting
- **South African ID** validation and verification
- **Local time zones** and date formats
- **South African banks** integration

### **Compliance**
- **POPIA** (Protection of Personal Information Act) compliance
- **Financial sector** regulations adherence
- **Minor protection** laws compliance
- **Data residency** requirements (South African servers)

## 🚀 **Deployment Strategy**

### **Production Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Vercel CDN    │    │   Supabase      │    │   Edge Functions│
│   (Frontend)    │◄──►│   (Database)    │◄──►│   (Business)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   PostgreSQL    │    │   Custom APIs   │
│   (TypeScript)  │    │   (RLS Enabled) │    │   (Deno/Node)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **Development Workflow**
1. **Local Development** → Supabase local instance
2. **Staging** → Supabase staging project
3. **Production** → Supabase production with backups

### **Environment Setup**
```bash
# Local development
supabase start
supabase db reset
npm run dev

# Deploy to production
supabase db push --linked
vercel deploy --prod
```

## 📊 **Monitoring & Analytics**

### **Performance Monitoring**
- **Supabase Dashboard** for database metrics
- **Vercel Analytics** for frontend performance
- **Sentry** for error tracking
- **LogRocket** for user session replay

### **Business Analytics**
- **Transaction volume** and patterns
- **User engagement** metrics
- **Feature adoption** rates
- **Support request** tracking

## 🔧 **Development Roadmap**

### **Phase 1: MVP** (Current)
- ✅ User authentication with ID verification
- ✅ Basic child management
- ✅ Permission system
- ✅ Settings and profiles

### **Phase 2: Core Features**
- 🔄 Virtual card management
- 🔄 Transaction tracking
- 🔄 Budget management
- 🔄 Expense requests

### **Phase 3: Advanced Features**
- ⏳ Real-time messaging
- ⏳ Payment integration
- ⏳ Mobile app (React Native)
- ⏳ Advanced analytics

### **Phase 4: Scale**
- ⏳ Multi-tenant architecture
- ⏳ API for third-party integrations
- ⏳ Advanced security features
- ⏳ International expansion

## 💰 **Cost Estimation**

### **Monthly Costs (Production)**
- **Supabase Pro**: ~$25/month (includes database, auth, storage)
- **Vercel Pro**: ~$20/month (frontend hosting, edge functions)
- **Domain & SSL**: ~$2/month
- **Monitoring Tools**: ~$15/month
- **SMS/Email Services**: ~$10/month (for notifications)

**Total**: ~$72/month for up to 100,000 users

### **Scaling Costs**
- **Database**: Scales with usage (pay-per-compute)
- **Storage**: ~$0.021/GB/month
- **Bandwidth**: ~$0.09/GB
- **Edge Functions**: ~$2/1M invocations

## 🎯 **Business Model Integration**

### **Revenue Streams**
1. **Transaction Fees**: Small percentage on card transactions
2. **Premium Features**: Advanced analytics, unlimited children
3. **Bank Partnerships**: Referral fees for account openings
4. **Enterprise**: White-label solutions for organizations

### **Data Monetization** (POPIA Compliant)
- **Anonymized spending insights** for financial institutions
- **Market research data** (with explicit consent)
- **Financial education content** partnerships

This architecture provides a solid foundation for a scalable, secure, and compliant South African child support payment platform! 🚀
