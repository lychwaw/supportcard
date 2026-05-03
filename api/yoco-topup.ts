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

const extractBearer = (req: any): string | null => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  return typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : null;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Verify caller identity from JWT — never trust user_id from the body.
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

    const { card_id, amount, currency } = req.body || {};
    if (!card_id || !amount) {
      res.status(400).json({ error: 'Missing card_id or amount' });
      return;
    }

    // Verify the card belongs to the authenticated user.
    const { data: card, error: cardError } = await supabase
      .from('virtual_cards')
      .select('id, user_id')
      .eq('id', card_id)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (cardError || !card) {
      res.status(403).json({ error: 'Forbidden: card not found or not owned by you' });
      return;
    }

    const secretKey = process.env.YOCO_SECRET_KEY;
    if (!secretKey) {
      res.status(500).json({ error: 'Missing YOCO_SECRET_KEY' });
      return;
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    const normalizedCurrency = String(currency || 'ZAR').toUpperCase();
    if (normalizedCurrency !== 'ZAR') {
      // Only ZAR accepted. Other currencies must be converted server-side with a live rate.
      res.status(400).json({ error: 'Only ZAR is accepted for topups at this time' });
      return;
    }

    const amountCents = Math.round(amountNum * 100);
    const baseUrl = getBaseUrl(req);
    const successUrl = `${baseUrl}/balance-budget?topup=success`;
    const cancelUrl  = `${baseUrl}/balance-budget?topup=cancel`;

    const apiBase = process.env.YOCO_API_BASE || 'https://payments.yoco.com/api';
    const response = await fetch(`${apiBase}/checkouts`, {
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
          type: 'topup',
          user_id: authUser.id,
          card_id,
          amount_zar: amountNum,
        },
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      console.error('Yoco topup error:', message);
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
      res.status(502).json({ error: 'Checkout URL missing from Yoco response', details: JSON.stringify(data) });
      return;
    }

    res.status(200).json({ checkout_url: checkoutUrl });
  } catch (error) {
    console.error('Yoco topup error:', error);
    res.status(500).json({ error: 'Unexpected error creating topup checkout' });
  }
}
