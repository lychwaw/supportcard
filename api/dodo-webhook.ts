import { createClient } from '@supabase/supabase-js';
import { Webhook } from 'standardwebhooks';

export const config = {
  api: {
    bodyParser: false, // signature verification needs the exact raw bytes
  },
};

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
};

const getRawBody = (req: any): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

// Subscription tiers that grant access. 'preview' is intentionally absent —
// it's the default free state, never something Dodo bills for.
const VALID_TIERS = new Set(['essential', 'plus', 'premium']);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('DODO_PAYMENTS_WEBHOOK_SECRET is not configured — rejecting all webhook requests');
    res.status(500).json({ error: 'Webhook endpoint not configured' });
    return;
  }

  let rawBody: string;
  try {
    rawBody = await getRawBody(req);
  } catch (error) {
    console.error('Error reading webhook body:', error);
    res.status(400).json({ error: 'Failed to read request body' });
    return;
  }

  const webhookId = req.headers['webhook-id'];
  const webhookTimestamp = req.headers['webhook-timestamp'];
  const webhookSignature = req.headers['webhook-signature'];

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    res.status(401).json({ error: 'Missing webhook signature headers' });
    return;
  }

  const wh = new Webhook(webhookSecret);
  let event: any;
  try {
    event = wh.verify(rawBody, {
      'webhook-id': String(webhookId),
      'webhook-timestamp': String(webhookTimestamp),
      'webhook-signature': String(webhookSignature),
    });
  } catch (error) {
    console.error('Dodo webhook signature verification failed:', error);
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  // Always acknowledge immediately — Dodo retries on anything other than 2xx.
  res.status(200).json({ received: true });

  try {
    const { type, data } = event as { type: string; data: any };
    const metadata = data?.metadata || {};
    const userId = metadata.supabase_user_id;
    const tier = metadata.tier;

    if (!userId) {
      console.warn('Dodo webhook event with no supabase_user_id in metadata:', type);
      return;
    }

    const supabase = getSupabaseClient();

    switch (type) {
      case 'subscription.active':
      case 'subscription.renewed': {
        if (!tier || !VALID_TIERS.has(tier)) {
          console.error('Dodo webhook: invalid or missing tier in metadata', tier);
          return;
        }
        await supabase
          .from('profiles')
          .update({
            subscription_tier: tier,
            subscription_status: 'active',
            dodo_subscription_id: data.subscription_id ?? null,
            dodo_customer_id: data.customer?.customer_id ?? null,
          } as any)
          .eq('id', userId);
        break;
      }

      case 'subscription.cancelled':
      case 'subscription.expired': {
        await supabase
          .from('profiles')
          .update({
            subscription_tier: 'preview',
            subscription_status: 'cancelled',
          } as any)
          .eq('id', userId);
        break;
      }

      case 'subscription.on_hold':
      case 'subscription.failed': {
        await supabase
          .from('profiles')
          .update({
            subscription_status: 'past_due',
          } as any)
          .eq('id', userId);
        break;
      }

      default:
        // Other event types (payments, disputes, etc.) aren't relevant to
        // subscription state — ignored.
        break;
    }
  } catch (error) {
    console.error('Dodo webhook processing error:', error);
  }
}
