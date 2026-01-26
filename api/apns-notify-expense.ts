import { createClient } from '@supabase/supabase-js';
import { sendApnsToToken } from './_apns';

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
};

const formatZar = (amount: number) => {
  return `R${amount.toFixed(2)}`;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { expense_id } = req.body || {};
    if (!expense_id) {
      res.status(400).json({ error: 'Missing expense_id' });
      return;
    }

    const supabase = getSupabaseClient();
    const { data: expense, error: expenseError } = await supabase
      .from('expense_requests')
      .select('id, amount, category, requester_id, child_id')
      .eq('id', expense_id)
      .single();

    if (expenseError || !expense) {
      res.status(404).json({ error: 'Expense request not found' });
      return;
    }

    if (!expense.child_id) {
      res.status(400).json({ error: 'Expense request has no child_id' });
      return;
    }

    const { data: child, error: childError } = await supabase
      .from('children')
      .select('parent_id, co_parent_id, name')
      .eq('id', expense.child_id)
      .single();

    if (childError || !child) {
      res.status(400).json({ error: 'Child record not found' });
      return;
    }

    const recipientIds = [child.parent_id, child.co_parent_id]
      .filter((id) => !!id && id !== expense.requester_id);

    if (recipientIds.length === 0) {
      res.status(200).json({ sent: 0, message: 'No recipients for this expense' });
      return;
    }

    const { data: devices, error: devicesError } = await supabase
      .from('push_devices')
      .select('device_token, user_id')
      .in('user_id', recipientIds as string[]);

    if (devicesError) {
      res.status(500).json({ error: 'Failed to load device tokens' });
      return;
    }

    const title = 'New expense request';
    const body = `${formatZar(Number(expense.amount))} for ${expense.category} (${child.name || 'child'})`;

    const tokens = (devices || []).map((d) => d.device_token).filter(Boolean);
    if (tokens.length === 0) {
      res.status(200).json({ sent: 0, message: 'No device tokens registered' });
      return;
    }

    await Promise.all(tokens.map((token) => sendApnsToToken(token, {
      title,
      body,
      data: { type: 'expense_request', expense_id: expense.id },
    })));

    res.status(200).json({ sent: tokens.length });
  } catch (error) {
    console.error('APNs expense notify error:', error);
    res.status(500).json({ error: 'Failed to send APNs notification' });
  }
}

