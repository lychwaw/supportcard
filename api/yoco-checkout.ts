const DEFAULT_BASE_URL = 'https://supportcard.vercel.app';

const getBaseUrl = (req: any) => {
  return process.env.APP_BASE_URL || req.headers?.origin || DEFAULT_BASE_URL;
};

const ZAR_PER_USD = 16.16;

const getAmountInCents = (tierId: string, currency: string) => {
  switch (tierId) {
    case 'premium':
      return 10000;
    case 'family_plus':
      return 15000;
    case 'legal':
      return 50000;
    case 'executive':
      if (currency === 'USD') {
        return Math.round(100 * ZAR_PER_USD * 100);
      }
      return Math.round(1616 * 100);
    default:
      return 0;
  }
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { tier_id, user_id } = req.body || {};
    if (!tier_id || !user_id) {
      res.status(400).json({ error: 'Missing tier_id or user_id' });
      return;
    }

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

    const amount = getAmountInCents(tier_id, String(req.body?.currency || 'ZAR'));
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
      res.status(502).json({ error: 'Failed to create checkout session' });
      return;
    }

    const data = await response.json();
    const checkoutUrl = data?.redirect_url || data?.url || data?.checkout?.url;

    if (!checkoutUrl) {
      res.status(502).json({ error: 'Checkout URL missing from Yoco response' });
      return;
    }

    res.status(200).json({ checkout_url: checkoutUrl });
  } catch (error) {
    console.error('Yoco checkout unexpected error:', error);
    res.status(500).json({ error: 'Unexpected error creating checkout' });
  }
}

