# 🔒 Remaining Security Fixes (Before Launch)

## ✅ Already Fixed (via SQL Migration)
- ✅ RLS policies preventing requester status updates
- ✅ Database CHECK constraints for amounts
- ✅ Status enum constraints
- ✅ Atomic financial operations (Postgres functions)
- ✅ Race condition fixes

## 🚨 Still Need to Fix

### 1. **Remove Console.log Statements (PII Leakage)**
**Files to fix:** 36 files found with console.log/error/warn

**Quick Fix:**
```bash
# In VS Code, use Find & Replace (Ctrl+Shift+H)
# Find: console\.(log|error|warn)\(
# Replace with: if (import.meta.env.DEV) { console.$1(
# Then manually close the braces
```

**Or manually wrap each:**
```typescript
// BEFORE
console.log('User data:', user);

// AFTER
if (import.meta.env.DEV) {
  console.log('User data:', user);
}
```

**Critical files:**
- `src/components/AuthProvider.tsx` (Lines 71, 72, 89, 106, 125, 142)
- `src/pages/Expenses.tsx` (Lines 67, 82, 136, 144, 214, 284, 326)
- `src/pages/Settings.tsx` (Multiple locations)
- `src/hooks/use-realtime.ts` (Lines 40, 56)

### 2. **Create Secure Expense Approval Function**
**Current:** Direct UPDATE (bypassable)
**Fix:** Create RPC function

**Add to migration:**
```sql
CREATE OR REPLACE FUNCTION public.approve_expense_request(
  p_request_id UUID,
  p_approver_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request RECORD;
  v_is_parent BOOLEAN;
BEGIN
  -- Lock row and fetch request
  SELECT * INTO v_request
  FROM public.expense_requests
  WHERE id = p_request_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense request not found';
  END IF;
  
  -- Verify status is pending
  IF v_request.status != 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;
  
  -- Verify approver is parent of the child
  SELECT EXISTS (
    SELECT 1 FROM public.children c
    WHERE c.id = v_request.child_id
    AND (c.parent_id = p_approver_id OR c.co_parent_id = p_approver_id)
  ) INTO v_is_parent;
  
  IF NOT v_is_parent THEN
    RAISE EXCEPTION 'Only parents can approve expenses';
  END IF;
  
  -- Prevent self-approval
  IF v_request.requester_id = p_approver_id THEN
    RAISE EXCEPTION 'Cannot approve own expense request';
  END IF;
  
  -- Atomic update
  UPDATE public.expense_requests
  SET status = 'approved',
      updated_at = NOW()
  WHERE id = p_request_id;
  
  RETURN TRUE;
END;
$$;
```

**Update Expenses.tsx:**
```typescript
// BEFORE
const { error } = await supabase
  .from('expense_requests')
  .update({ status: 'approved' })
  .eq('id', expense.id);

// AFTER
const { error } = await supabase.rpc('approve_expense_request', {
  p_request_id: expense.id,
  p_approver_id: user.id
});
```

### 3. **Fix Card Number Generation (Predictable)**
**File:** `src/pages/Cards.tsx`

```typescript
// BEFORE
const generateCardNumber = () => {
  return Math.floor(Math.random() * 9000000000000000) + 1000000000000000;
};

// AFTER
const generateCardNumber = () => {
  const array = new Uint32Array(4);
  crypto.getRandomValues(array);
  // Combine to create 16-digit number
  const num = array.reduce((acc, val) => acc + val.toString(), '');
  return num.slice(0, 16).padStart(16, '0');
};
```

### 4. **Add Request Timeout**
**File:** `src/integrations/supabase/client.ts`

```typescript
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: (url, options) => {
      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });
    },
  },
});
```

### 5. **Add Zod Validation (Medium Priority)**
Already partially done, but add to all API calls:

```typescript
import { z } from 'zod';

const ExpenseRequestSchema = z.object({
  amount: z.number().positive().max(100000),
  category: z.enum(['Food', 'Clothing', 'School', 'Activities', 'Healthcare', 'Transportation']),
  description: z.string().min(1).max(1000),
  child_id: z.string().uuid(),
});

// Use before API calls
const validated = ExpenseRequestSchema.parse({ amount, category, description, child_id });
```

---

## 📋 Priority Order

1. **IMMEDIATE (Before Launch):**
   - Remove console.log statements
   - Create approve_expense_request() RPC function
   - Fix card number generation

2. **HIGH (Week 1):**
   - Add request timeout
   - Add Zod validation to all forms

3. **MEDIUM (Month 1):**
   - Server-side file validation
   - Rate limiting
   - Audit logging

