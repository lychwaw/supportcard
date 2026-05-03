import { createClient } from '@supabase/supabase-js';
import { sendApnsToToken } from './_apns.js';

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
};

const extractBearer = (req: any): string | null => {
  const h = req.headers['authorization'] || req.headers['Authorization'];
  return typeof h === 'string' ? h.replace(/^Bearer\s+/i, '') : null;
};

const formatZar = (amount: number) => `R${amount.toFixed(2)}`;

async function handleRegister(req: any, res: any, supabase: any, authUser: any) {
  const { device_token, platform, environment } = req.body || {};
  if (!device_token) {
    res.status(400).json({ error: 'Missing device_token' });
    return;
  }

  const { error } = await supabase
    .from('push_devices')
    .upsert({
      user_id: authUser.id,
      device_token,
      platform: platform || 'ios',
      environment: environment || (process.env.APNS_ENV || 'development'),
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'device_token' });

  if (error) {
    console.error('APNs register error:', error);
    res.status(500).json({ error: 'Failed to register device token' });
    return;
  }

  res.status(200).json({ registered: true });
}

async function handleSend(req: any, res: any, supabase: any) {
  const { user_id, title, body, data } = req.body || {};
  if (!user_id || !title || !body) {
    res.status(400).json({ error: 'Missing user_id, title, or body' });
    return;
  }

  const { data: devices, error } = await supabase
    .from('push_devices')
    .select('device_token')
    .eq('user_id', user_id);

  if (error) {
    console.error('APNs fetch devices error:', error);
    res.status(500).json({ error: 'Failed to load device tokens' });
    return;
  }

  const tokens = (devices || []).map((d: any) => d.device_token).filter(Boolean);
  if (tokens.length === 0) {
    res.status(200).json({ sent: 0, message: 'No device tokens registered' });
    return;
  }

  await Promise.all(tokens.map((token: string) => sendApnsToToken(token, { title, body, data })));
  res.status(200).json({ sent: tokens.length });
}

async function handleNotifyExpense(req: any, res: any, supabase: any) {
  const { expense_id } = req.body || {};
  if (!expense_id) {
    res.status(400).json({ error: 'Missing expense_id' });
    return;
  }

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
    .filter((id: any) => !!id && id !== expense.requester_id);

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
  const tokens = (devices || []).map((d: any) => d.device_token).filter(Boolean);

  if (tokens.length === 0) {
    res.status(200).json({ sent: 0, message: 'No device tokens registered' });
    return;
  }

  await Promise.all(tokens.map((token: string) => sendApnsToToken(token, {
    title,
    body,
    data: { type: 'expense_request', expense_id: expense.id },
  })));

  res.status(200).json({ sent: tokens.length });
}

async function handleTest(req: any, res: any) {
  const { device_token, title, body, data } = req.body || {};
  if (!device_token) {
    res.status(400).json({ error: 'Missing device_token' });
    return;
  }

  await sendApnsToToken(device_token, {
    title: title || 'SupportCard',
    body: body || 'Test notification',
    data,
  });

  res.status(200).json({ success: true });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { action } = req.body || {};

  try {
    if (action === 'register') {
      const supabase = getSupabaseClient();
      const token = extractBearer(req);
      if (!token) {
        res.status(401).json({ error: 'Unauthorized: missing Bearer token' });
        return;
      }
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !authUser) {
        res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
        return;
      }
      await handleRegister(req, res, supabase, authUser);
    } else if (action === 'send') {
      await handleSend(req, res, getSupabaseClient());
    } else if (action === 'notify-expense') {
      await handleNotifyExpense(req, res, getSupabaseClient());
    } else if (action === 'test') {
      await handleTest(req, res);
    } else {
      res.status(400).json({ error: 'Missing or invalid action' });
    }
  } catch (error) {
    console.error('apns handler error:', error);
    res.status(500).json({ error: 'Unexpected server error' });
  }
}
