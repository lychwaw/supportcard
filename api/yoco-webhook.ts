import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
};

const extractPayload = (body: any) => body?.data || body?.payload || body;

const isSuccessEvent = (body: any) => {
  const status = body?.status || body?.data?.status || body?.payload?.status;
  const event = body?.event || body?.type;
  return ['successful', 'succeeded', 'paid'].includes(status) || ['payment.succeeded', 'checkout.succeeded'].includes(event);
};

const getMetadata = (payload: any) => payload?.metadata || payload?.reference || {};

const verifySignature = (rawBody: string, signature: string, secret: string) => {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const signature =
      req.headers['x-yoco-signature'] ||
      req.headers['x-yoco-hmac-sha256'] ||
      req.headers['x-yoco-hmac'];

    const webhookSecret = process.env.YOCO_WEBHOOK_SECRET;
    if (webhookSecret && signature && !verifySignature(rawBody, signature, webhookSecret)) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!isSuccessEvent(body)) {
      res.status(200).json({ received: true });
      return;
    }

    const payload = extractPayload(body);
    const metadata = getMetadata(payload);
    const userId = metadata.user_id;
    const tierId = metadata.tier_id;

    if (!userId || !tierId) {
      res.status(400).json({ error: 'Missing metadata user_id or tier_id' });
      return;
    }

    const supabase = getSupabaseClient();
    const nextExpiryDate = new Date();
    nextExpiryDate.setMonth(nextExpiryDate.getMonth() + 1);
    const nextExpiry = nextExpiryDate.toISOString();

    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_tier: tierId,
        subscription_status: 'active',
        expiry_date: nextExpiry,
      })
      .eq('id', userId);

    if (error) {
      console.error('Supabase update error:', error);
      res.status(500).json({ error: 'Failed to update subscription' });
      return;
    }

    res.status(200).json({ updated: true });
  } catch (error) {
    console.error('Yoco webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

