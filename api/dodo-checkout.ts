import { createClient } from '@supabase/supabase-js';
import DodoPayments from 'dodopayments';
import { handleCors } from './_cors.js';

const DEFAULT_BASE_URL = 'https://supportcard.vercel.app';

const getBaseUrl = (req: any) => {
  return process.env.APP_BASE_URL || req.headers?.origin || DEFAULT_BASE_URL;
};

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
};

const extractBearer = (req: any): string | null => {
  const h = req.headers['authorization'] || req.headers['Authorization'];
  return typeof h === 'string' ? h.replace(/^Bearer\s+/i, '') : null;
};

// Subscription tiers only — there is no "Preview" product since it's free
// and never reaches checkout. Each maps to a real Dodo product created in
// the Dodo dashboard ahead of time.
const PRODUCT_IDS: Record<string, string | undefined> = {
  essential: process.env.DODO_PRODUCT_ID_ESSENTIAL,
  plus: process.env.DODO_PRODUCT_ID_PLUS,
  plus_founder: process.env.DODO_PRODUCT_ID_PLUS_FOUNDER,
  premium: process.env.DODO_PRODUCT_ID_PREMIUM,
};

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const token = extractBearer(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized: missing Bearer token' });
      return;
    }

    const supabase = getSupabaseClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authUser) {
      res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
      return;
    }

    const { tier, useFounderPrice } = req.body || {};
    if (!tier || typeof tier !== 'string') {
      res.status(400).json({ error: 'Missing tier' });
      return;
    }

    if (tier === 'preview') {
      res.status(400).json({ error: 'Preview tier does not require checkout' });
      return;
    }

    const productKey = tier === 'plus' && useFounderPrice ? 'plus_founder' : tier;
    const productId = PRODUCT_IDS[productKey];

    if (!productId) {
      res.status(400).json({ error: `Unknown or unconfigured tier: ${productKey}` });
      return;
    }

    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Dodo Payments is not configured on this server' });
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', authUser.id)
      .maybeSingle();

    const email = profile?.email || authUser.email;
    if (!email) {
      res.status(400).json({ error: 'No email on file for checkout' });
      return;
    }

    const client = new DodoPayments({
      bearerToken: apiKey,
      environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as 'test_mode' | 'live_mode') ?? 'test_mode',
    });

    const baseUrl = getBaseUrl(req);

    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: { email, name: profile?.full_name || undefined },
      metadata: {
        supabase_user_id: authUser.id,
        tier,
        founder: useFounderPrice ? 'true' : 'false',
      },
      return_url: `${baseUrl}/subscriptions?payment=success`,
      cancel_url: `${baseUrl}/subscriptions?payment=cancel`,
    });

    if (!session.checkout_url) {
      res.status(502).json({ error: 'Checkout URL missing from Dodo response' });
      return;
    }

    res.status(200).json({ payment_link: session.checkout_url });
  } catch (error) {
    console.error('Dodo checkout error:', error);
    res.status(500).json({ error: 'Unexpected error creating checkout session' });
  }
}
