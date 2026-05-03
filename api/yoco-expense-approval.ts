import { createClient } from '@supabase/supabase-js';

const DEFAULT_BASE_URL = 'https://supportcard.vercel.app';

const getBaseUrl = (req: any) => {
  return process.env.APP_BASE_URL || req.headers?.origin || DEFAULT_BASE_URL;
};

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Derive approver identity from the verified JWT — never trust the request body for this.
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : null;
    if (!token) {
      res.status(401).json({ error: 'Unauthorized: missing Bearer token' });
      return;
    }

    const supabaseForAuth = getSupabaseClient();
    const { data: { user: authUser }, error: authError } = await supabaseForAuth.auth.getUser(token);
    if (authError || !authUser) {
      res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
      return;
    }
    const approver_id = authUser.id;

    const { expense_id } = req.body || {};
    if (!expense_id) {
      res.status(400).json({ error: 'Missing expense_id' });
      return;
    }

    const secretKey = process.env.YOCO_SECRET_KEY;
    if (!secretKey) {
      res.status(500).json({ error: 'Missing YOCO_SECRET_KEY' });
      return;
    }

    const supabase = getSupabaseClient();
    const { data: expense, error: expenseError } = await supabase
      .from('expense_requests')
      .select('id, amount, status, requester_id, child_id, payment_status')
      .eq('id', expense_id)
      .single();

    if (expenseError || !expense) {
      res.status(404).json({ error: 'Expense request not found' });
      return;
    }

    if (expense.status !== 'pending') {
      res.status(409).json({ error: 'Expense request is not pending' });
      return;
    }

    if (expense.payment_status === 'paid') {
      res.status(409).json({ error: 'Expense request is already paid' });
      return;
    }

    if (expense.requester_id === approver_id) {
      res.status(403).json({ error: 'Cannot approve your own expense request' });
      return;
    }

    if (!expense.child_id) {
      res.status(400).json({ error: 'Expense request must be associated with a child' });
      return;
    }

    const { data: child, error: childError } = await supabase
      .from('children')
      .select('parent_id, co_parent_id')
      .eq('id', expense.child_id)
      .single();

    if (childError || !child) {
      res.status(400).json({ error: 'Child record not found' });
      return;
    }

    if (child.parent_id !== approver_id && child.co_parent_id !== approver_id) {
      res.status(403).json({ error: 'Only parents can approve expenses for their children' });
      return;
    }

    const { error: pendingError } = await supabase
      .from('expense_requests')
      .update({ payment_status: 'pending' })
      .eq('id', expense_id);

    if (pendingError) {
      res.status(500).json({ error: 'Failed to mark payment as pending' });
      return;
    }

    const amountZar = Number(expense.amount);
    if (!Number.isFinite(amountZar) || amountZar <= 0) {
      res.status(400).json({ error: 'Invalid expense amount' });
      return;
    }

    const amountCents = Math.round(amountZar * 100);
    const baseUrl = getBaseUrl(req);
    const successUrl = `${baseUrl}/expenses?payment=success`;
    const cancelUrl = `${baseUrl}/expenses?payment=cancel`;

    const response = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountCents,
        currency: 'ZAR',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          type: 'expense_approval',
          expense_id,
          approver_id,
          amount_zar: amountZar,
        },
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      await supabase
        .from('expense_requests')
        .update({ payment_status: 'failed' })
        .eq('id', expense_id);
      res.status(502).json({ error: 'Failed to create checkout session', details: message });
      return;
    }

    const data = await response.json();
    const checkoutUrl =
      data?.redirectUrl ||
      data?.redirect_url ||
      data?.url ||
      data?.checkout?.url;

    if (!checkoutUrl) {
      await supabase
        .from('expense_requests')
        .update({ payment_status: 'failed' })
        .eq('id', expense_id);
      res.status(502).json({ error: 'Checkout URL missing from Yoco response', details: JSON.stringify(data) });
      return;
    }

    res.status(200).json({ checkout_url: checkoutUrl });
  } catch (error) {
    console.error('Yoco expense approval error:', error);
    res.status(500).json({ error: 'Unexpected error creating expense approval checkout' });
  }
}

