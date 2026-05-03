import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
};

const verifySignature = (rawBody: string, signature: string, secret: string): boolean => {
  try {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const webhookSecret = process.env.KORAPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('KORAPAY_WEBHOOK_SECRET is not configured — rejecting all webhook requests');
    res.status(500).json({ error: 'Webhook endpoint not configured' });
    return;
  }

  // Collect raw body for signature verification.
  let rawBody = '';
  try {
    if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString('utf8');
    } else {
      rawBody = JSON.stringify(req.body);
    }
  } catch {
    res.status(400).json({ error: 'Failed to read request body' });
    return;
  }

  const signature = req.headers['x-korapay-signature'] as string | undefined;
  if (!signature || !verifySignature(rawBody, signature, webhookSecret)) {
    res.status(401).json({ error: 'Invalid or missing webhook signature' });
    return;
  }

  let payload: any;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(rawBody) : req.body;
  } catch {
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }

  const event = payload?.event as string | undefined;
  const data = payload?.data;

  if (!event || !data) {
    res.status(400).json({ error: 'Malformed webhook payload' });
    return;
  }

  try {
    const supabase = getSupabaseClient();

    if (event === 'virtualcard.transaction') {
      await handleCardTransaction(supabase, data);
    } else if (event === 'virtualcard.status_change') {
      await handleStatusChange(supabase, data);
    }
    // Unknown events are acknowledged and ignored.

    res.status(200).json({ received: true, event });
  } catch (error) {
    console.error('korapay-webhook processing error:', error);
    // Return 200 to prevent KoraPay from retrying a server-side error we've already logged.
    res.status(200).json({ received: true, error: 'Internal processing error' });
  }
}

async function handleCardTransaction(supabase: any, data: any) {
  const korapayCardId = data?.card_id ?? data?.virtual_card_id;
  const transactionId = data?.id ?? data?.transaction_id;

  if (!korapayCardId || !transactionId) return;

  // Idempotency: skip if we've already processed this transaction.
  const { data: existing } = await supabase
    .from('korapay_card_transactions')
    .select('id')
    .eq('korapay_transaction_id', String(transactionId))
    .maybeSingle();

  if (existing) return;

  const type = String(data?.type ?? 'debit').toLowerCase();
  const normalizedType = type === 'credit' ? 'credit' : type === 'reversal' ? 'reversal' : 'debit';
  const status = String(data?.status ?? 'success').toLowerCase();
  const normalizedStatus = ['pending', 'success', 'failed'].includes(status) ? status : 'success';

  await supabase.from('korapay_card_transactions').insert({
    korapay_card_id: String(korapayCardId),
    korapay_transaction_id: String(transactionId),
    amount: Number(data?.amount ?? 0),
    currency: String(data?.currency ?? 'USD'),
    type: normalizedType,
    status: normalizedStatus,
    merchant_name: data?.merchant?.name ?? data?.narration ?? null,
    narration: data?.narration ?? null,
    transaction_date: data?.created_at ?? data?.transaction_date ?? new Date().toISOString(),
  });

  // Sync balance if KoraPay includes the updated card balance.
  const newBalance = data?.card_balance ?? data?.balance;
  if (newBalance !== undefined && Number.isFinite(Number(newBalance))) {
    await supabase
      .from('korapay_cards')
      .update({ balance: Number(newBalance) })
      .eq('korapay_card_id', String(korapayCardId));
  }
}

async function handleStatusChange(supabase: any, data: any) {
  const korapayCardId = data?.card_id ?? data?.virtual_card_id ?? data?.id;
  if (!korapayCardId) return;

  const rawStatus = String(data?.status ?? '').toLowerCase();
  // Map KoraPay status values to our local enum.
  let localStatus: string;
  if (rawStatus === 'terminated' || rawStatus === 'deactivated') {
    localStatus = 'terminated';
  } else if (rawStatus === 'blocked' || rawStatus === 'frozen') {
    localStatus = 'blocked';
  } else if (rawStatus === 'active') {
    localStatus = 'active';
  } else {
    return; // Unknown status — do not overwrite.
  }

  await supabase
    .from('korapay_cards')
    .update({ status: localStatus })
    .eq('korapay_card_id', String(korapayCardId));
}
