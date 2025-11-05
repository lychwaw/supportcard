# 🎯 Smart Role Assignment Guide

## Overview

You can automatically assign roles (parent/child) based on various criteria when users sign up.

## Available Criteria

### Option 1: Based on Google Account Age ⭐ (Recommended)
Determine if Google account is old enough to be a parent

### Option 2: Based on Email Domain
Assign child role for student/school emails

### Option 3: Based on Explicit Age/Birthdate
If you collect age during signup

### Option 4: Based on Signup Method
OAuth users = one role, Email signup = another role

### Option 5: Based on User Metadata
Check data from OAuth provider (Google/Apple)

---

## How to Implement

The migration file `20250106000000_fix_infinite_recursion.sql` has a `determine_user_role()` function that you can customize.

### Edit the Function

1. Go to Supabase Dashboard → SQL Editor
2. Run this to see the current function:
   ```sql
   SELECT pg_get_functiondef('public.determine_user_role'::regproc);
   ```
3. Modify the logic based on your needs (see examples below)

---

## Implementation Examples

### Example 1: Based on Google Account Creation Date

```sql
CREATE OR REPLACE FUNCTION public.determine_user_role(
  user_id UUID, 
  user_email TEXT, 
  user_created_at TIMESTAMPTZ
)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT := 'parent';
  account_age_years NUMERIC;
  google_account_age_years NUMERIC;
BEGIN
  -- Calculate account age in years
  account_age_years := EXTRACT(YEAR FROM AGE(NOW(), user_created_at));
  
  -- If account was created less than 18 years ago, might be a child
  -- But we can't know for sure, so default to parent
  -- You could also check if there's a parent invite, etc.
  
  -- For now, default to parent
  -- Add your logic here:
  -- IF account_age_years < 18 THEN
  --   user_role := 'child';
  -- END IF;
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Example 2: Based on Email Domain

```sql
CREATE OR REPLACE FUNCTION public.determine_user_role(
  user_id UUID, 
  user_email TEXT, 
  user_created_at TIMESTAMPTZ
)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT := 'parent';
BEGIN
  -- Check email domain patterns
  IF user_email LIKE '%@student.%' 
     OR user_email LIKE '%@school.%'
     OR user_email LIKE '%@edu.%'
     OR user_email LIKE '%@students.%' THEN
    user_role := 'child';
  END IF;
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Example 3: Based on Parent Invite

```sql
CREATE OR REPLACE FUNCTION public.determine_user_role(
  user_id UUID, 
  user_email TEXT, 
  user_created_at TIMESTAMPTZ
)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT := 'parent';
  has_invite BOOLEAN := FALSE;
BEGIN
  -- Check if user signed up via parent invite
  SELECT EXISTS (
    SELECT 1 FROM public.parent_invites 
    WHERE invited_email = user_email 
    AND status = 'pending'
  ) INTO has_invite;
  
  -- If they have an invite, they might be a co-parent
  -- (Could also be a child, depending on your logic)
  IF has_invite THEN
    user_role := 'parent'; -- Co-parent
  END IF;
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Example 4: Based on Age in User Metadata

```sql
CREATE OR REPLACE FUNCTION public.determine_user_role(
  user_id UUID, 
  user_email TEXT, 
  user_created_at TIMESTAMPTZ
)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT := 'parent';
  user_age INTEGER;
  user_meta JSONB;
BEGIN
  -- Get user metadata from auth.users
  SELECT raw_user_meta_data INTO user_meta
  FROM auth.users
  WHERE id = user_id;
  
  -- Extract age if available (from OAuth or form)
  IF user_meta IS NOT NULL THEN
    user_age := (user_meta->>'age')::INTEGER;
    
    -- If age is less than 18, assign child role
    IF user_age IS NOT NULL AND user_age < 18 THEN
      user_role := 'child';
    END IF;
  END IF;
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Quick Setup

### Step 1: Choose Your Criteria

Decide which criteria you want to use:
- [ ] Google account age
- [ ] Email domain patterns
- [ ] Age from signup form
- [ ] Parent invite status
- [ ] Other criteria

### Step 2: Update the Function

1. Go to Supabase Dashboard → SQL Editor
2. Copy the example function that matches your needs
3. Customize it for your logic
4. Run it

### Step 3: Test

1. Create a new test user
2. Check if role is assigned correctly
3. Verify in `user_roles` table

---

## Current Default Behavior

Right now, **all users default to 'parent'** role. The function is ready for you to customize!

---

## Need Help?

Tell me which criteria you want to use, and I'll help you write the exact function! 🎯

