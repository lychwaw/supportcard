# 🎯 Age-Based Role Assignment & ID Verification Guide

## How It Works

### 1. **Age-Based Role Assignment**

Roles are automatically assigned based on age:
- **Age < 18** → `'child'` role
- **Age ≥ 18** → `'parent'` role

### 2. **Priority Order**

1. **Explicit Age** (from signup form) - Highest priority
2. **Google Account Age** (fallback) - Less reliable, used only if no explicit age

### 3. **ID Verification**

ID verification is **separate** from role assignment:
- ✅ **Role is assigned immediately** based on age
- ✅ **ID verification is for security/compliance** - doesn't affect role
- ✅ Users can use the app even with pending ID verification
- ⚠️ **However**, you can restrict certain features based on ID verification status

---

## Implementation Details

### Email Signup Flow

1. User fills out signup form with:
   - Name, email, password
   - **Age** (required, 13-120)
   - Parent role (payer/receiver/both)
   - ID verification document

2. On signup:
   - Profile is created with age
   - Role is automatically assigned (< 18 = child, ≥ 18 = parent)
   - ID is uploaded (status: pending)

3. User can use app immediately
   - Role is set
   - ID verification can happen later

### Google OAuth Flow

1. User clicks "Sign in with Google"
2. OAuth redirects back to app
3. Profile is auto-created by trigger (no age yet)
4. **Role assignment**:
   - If no age → defaults to `'parent'` (safe default)
   - If age is added later → role updates automatically

5. **After OAuth, you should prompt for age**:
   - Check if profile has `age` field set
   - If not, show a modal or redirect to profile completion
   - Update profile with age → role updates automatically

---

## ID Verification Status

### Current Implementation

ID verification has **3 states**:

1. **Not Uploaded** (Blue Alert)
   - User hasn't uploaded ID yet
   - Can upload at any time

2. **Pending Verification** (Yellow Alert)
   - ID uploaded, waiting for admin review
   - Usually takes 24-48 hours
   - User can still use the app

3. **Verified** (Green Alert)
   - ID reviewed and approved
   - Full access to all features

### Should ID Verification Affect Role Assignment?

**Recommendation**: Keep them separate for now:

- ✅ **Role assignment** = Based on age (immediate)
- ✅ **ID verification** = Security/compliance (can happen later)

**Future enhancement**: You could restrict certain features based on ID verification:
- Large transactions require verified ID
- Payment methods require verified ID
- Admin features require verified ID

### If You Want ID Verification to Affect Role

If you want to require ID verification before role assignment:

1. **Modify the trigger function** to check `id_verified` status
2. **Only assign role when ID is verified**
3. **Show pending state** until ID is verified

**But this is NOT recommended** because:
- Users can't use the app until ID is manually reviewed
- Creates friction in the signup flow
- Role is based on age, not ID verification

---

## Database Schema

### Profiles Table
```sql
profiles:
  - age: INTEGER (13-120, can be NULL)
  - id_verified: BOOLEAN (false = pending/not verified)
  - id_verification_url: TEXT (URL to uploaded document)
```

### Role Assignment Logic

```sql
-- Automatic role assignment based on age
IF age < 18 THEN
  role = 'child'
ELSE
  role = 'parent'
END IF
```

---

## After OAuth Signup

### What Happens

1. User signs in with Google
2. Profile is auto-created (via trigger)
3. Role defaults to `'parent'` (if no age provided)
4. User should be prompted to complete profile

### How to Handle OAuth Age Prompt

You have two options:

#### Option 1: Modal After OAuth (Recommended)
- After successful OAuth, check if `profile.age` is NULL
- If NULL, show a modal asking for age
- Update profile with age → role updates automatically

#### Option 2: Settings Page
- User completes profile in Settings → Profile
- When age is added, role updates automatically

#### Option 3: Redirect to Profile Completion
- After OAuth, redirect to `/complete-profile`
- Show form with age and ID upload
- Once complete, redirect to dashboard

---

## Next Steps

### For OAuth Users

1. **Check if age is missing** after OAuth signup
2. **Prompt user to enter age** (modal or redirect)
3. **Update profile** → role updates automatically

### For ID Verification

Current system is fine:
- ✅ Upload ID during signup (optional but recommended)
- ✅ Upload ID later in Settings
- ✅ Admin reviews and approves
- ✅ Doesn't block app usage

---

## Testing

### Test Email Signup
1. Sign up with age < 18 → Should get `'child'` role
2. Sign up with age ≥ 18 → Should get `'parent'` role

### Test OAuth
1. Sign in with Google
2. Check profile → age should be NULL
3. Add age in Settings → role should update
4. Age < 18 → role changes to `'child'`
5. Age ≥ 18 → role changes to `'parent'`

---

## Summary

- ✅ **Age-based role assignment** is implemented
- ✅ **ID verification** is separate and doesn't affect role
- ✅ **OAuth users** need age prompt (to be implemented)
- ✅ **Email signup** includes age field
- ✅ **Role updates automatically** when age is added/changed

**ID Verification**: Keep it separate - it's for security, not role assignment! 🛡️

