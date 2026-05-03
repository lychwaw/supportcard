import { createClient } from '@supabase/supabase-js';

const DEFAULT_BASE_URL = 'https://supportcard.vercel.app';

const getBaseUrl = (req: any) => {
  return process.env.APP_BASE_URL || req.headers?.origin || DEFAULT_BASE_URL;
};

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
};

const TIER_PRICE_CENTS: Record<string, number> = {
  premium:     9900,   // R99.00
  family_plus: 17900,  // R179.00
  legal:       54900,  // R549.00
};

const getAmountInCents = (tierId: string) => TIER_PRICE_CENTS[tierId] ?? 0;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Verify caller identity from JWT — never trust user_id from the body.
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : null;
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

    const { tier_id } = req.body || {};
    if (!tier_id) {
      res.status(400).json({ error: 'Missing tier_id' });
      return;
    }

    const user_id = authUser.id;

    if (tier_id === 'free') {
      res.status(400).json({ error: 'Free tier does not require checkout' });
      return;
    }

    const secretKey = process.env.YOCO_SECRET_KEY;
    const paymentLink = process.env.YOCO_PAYMENT_LINK_URL;
    if (!secretKey && !paymentLink) {
      res.status(500).json({ error: 'Missing YOCO_SECRET_KEY or YOCO_PAYMENT_LINK_URL' });
      return;
    }

    const amount = getAmountInCents(String(tier_id));
    if (!amount) {
      res.status(400).json({ error: 'Invalid tier_id' });
      return;
    }

    const baseUrl = getBaseUrl(req);
    const successUrl = `${baseUrl}/subscriptions?checkout=success`;
    const cancelUrl = `${baseUrl}/subscriptions?checkout=cancel`;

    if (!secretKey && paymentLink) {
      res.status(200).json({ checkout_url: paymentLink });
      return;
    }

    const apiBase = process.env.YOCO_API_BASE || 'https://payments.yoco.com/api';
    const response = await fetch(`${apiBase}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: 'ZAR',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          user_id,
          tier_id,
        },
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      console.error('Yoco checkout error:', message);
      res.status(502).json({
        error: 'Failed to create checkout session',
        details: message || `Yoco responded with ${response.status}`,
      });
      return;
    }

    const data = await response.json();
    const checkoutUrl =
      data?.redirectUrl ||
      data?.redirect_url ||
      data?.url ||
      data?.checkout?.url;

    if (!checkoutUrl) {
      res.status(502).json({
        error: 'Checkout URL missing from Yoco response',
        details: JSON.stringify(data),
      });
      return;
    }

    res.status(200).json({ checkout_url: checkoutUrl });
  } catch (error) {
    console.error('Yoco checkout unexpected error:', error);
    res.status(500).json({
      error: 'Unexpected error creating checkout',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

