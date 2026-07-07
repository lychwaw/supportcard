import { createHmac, timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
};

// KoraPay signs ONLY the `data` object using the merchant secret key.
// Ref: https://developers.korapay.com/docs/webhooks
const verifySignature = (data: unknown, signature: string, secretKey: string): boolean => {
  try {
    const expected = createHmac('sha256', secretKey)
      .update(JSON.stringify(data))
      .digest('hex');
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

  // KoraPay uses the merchant secret key for HMAC — no separate webhook secret.
  const secretKey = process.env.KORAPAY_SECRET_KEY;
  if (!secretKey) {
    console.error('KORAPAY_SECRET_KEY is not configured — rejecting webhook');
    res.status(500).json({ error: 'Webhook endpoint not configured' });
    return;
  }

  let payload: any;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'Invalid JSON payload' });
    return;
  }

  const signature = req.headers['x-korapay-signature'] as string | undefined;
  const data = payload?.data;

  if (!signature || !data || !verifySignature(data, signature, secretKey)) {
    res.status(401).json({ error: 'Invalid or missing webhook signature' });
    return;
  }

  const event = payload?.event as string | undefined;
  if (!event) {
    res.status(400).json({ error: 'Missing event field' });
    return;
  }

  // Always acknowledge immediately — KoraPay retries on anything other than 200.
  res.status(200).json({ received: true, event });

  // Process asynchronously after responding so we never time out.
  try {
    const supabase = getSupabaseClient();

    if (event === 'charge.success' || event === 'charge.failed') {
      await handleCharge(supabase, event, data);
    }
    // virtualcard.* events removed — virtual cards no longer used.
  } catch (error) {
    console.error('korapay-webhook processing error:', error);
  }
}

async function handleCharge(supabase: any, event: string, data: any) {
  const reference = data?.reference;
  if (!reference) return;

  // Idempotency check on the transactions table using the KoraPay reference.
  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('payment_reference', String(reference))
    .maybeSingle();

  if (existing) return;

  if (event === 'charge.success') {
    await supabase.from('transactions').insert({
      user_id: null, // KoraPay charges are not user-scoped at webhook level
      amount: Number(data?.amount ?? 0),
      category: 'KoraPay Charge',
      merchant_name: 'KoraPay',
      transaction_date: new Date().toISOString(),
      payment_reference: String(reference),
    });
  }
}
