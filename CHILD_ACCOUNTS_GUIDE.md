# Child Accounts & Permissions Guide

## Overview

Your Bluebird Payments Pro app now supports child accounts with differentiated permissions, avatar support, and independent login capabilities.

## New Features

### 1. Avatar Support
- Children can now have profile pictures/avatars
- Avatars are displayed throughout the app (child management, account switcher, etc.)
- Fallback to initials when no avatar is provided

### 2. Child User Accounts
- Children can have their own login credentials
- Each child can independently access the app with limited permissions
- Parents control whether to create login accounts during child setup

### 3. Permission System
- **Parent Permissions**: Full access to all features
  - Manage children accounts
  - View all transactions, budgets, cards
  - Create and manage virtual cards
  - Approve/deny expense requests
  - Access emergency contacts
  - Full settings access

- **Child Permissions**: Limited access for safety
  - View their own transactions (read-only)
  - View their assigned budget (read-only)  
  - View their assigned virtual cards (read-only)
  - Submit expense requests (create only)
  - Send/receive messages
  - View calendar events (read-only)
  - Limited settings (profile updates only)
  - **Cannot access**: Emergency contacts, other children's data

## Database Changes

### New Tables
- `user_roles`: Stores user role assignments (parent/child)
- `permissions`: Defines what each role can do with each resource

### Updated Tables
- `children`: Added `avatar_url` and `user_id` columns
- Enhanced RLS policies for multi-user access

## Usage

### Creating Child Accounts
1. Navigate to Dashboard as a parent
2. Use "Child Management" component
3. Fill in child details including optional avatar URL
4. Toggle "Create login account for child" to enable independent access
5. Provide email and password for child login

### Child Login Flow
1. Child uses the same login page
2. System automatically determines role after authentication
3. UI adapts to show only permitted features
4. Navigation menu filters based on permissions

### Permission Checks
Components use the new permission system:
```tsx
// Check specific permission
<ProtectedComponent resource="transactions" action="create">
  <CreateButton />
</ProtectedComponent>

// Role-based rendering
<ParentOnly>
  <AdminFeature />
</ParentOnly>

// Convenience components
<CanCreate resource="expenses">
  <NewExpenseButton />
</CanCreate>
```

## Security Features

- **Row Level Security (RLS)**: Database-level access control
- **Permission-based UI**: Components only render if user has permission
- **Role isolation**: Children cannot access parent-only features
- **Data segregation**: Children only see their own data

## Technical Implementation

### Key Files
- `src/hooks/use-permissions.ts`: Permission management hook
- `src/components/PermissionProvider.tsx`: Permission context provider
- `src/components/ProtectedComponent.tsx`: Permission-based rendering components
- `supabase/migrations/20251002120000_add_avatar_and_permissions.sql`: Database schema updates

### Permission Resources
- `dashboard`, `children`, `transactions`, `budget`, `cards`, `expenses`, `settings`, `messages`, `calendar`, `contacts`

### Permission Actions
- `create`, `read`, `update`, `delete`

## Future Enhancements

Potential improvements:
- File upload for avatars
- More granular permissions
- Child-to-child messaging restrictions
- Spending limits per child
- Notification system for parents
- Child activity logging
