const DEFAULT_BASE_URL = 'https://supportcard.vercel.app';

const getBaseUrl = (req: any) => {
  return process.env.APP_BASE_URL || req.headers?.origin || DEFAULT_BASE_URL;
};

const ZAR_PER_UNIT: Record<string, number> = {
  ZAR: 1,
  USD: 16.16,
};

const convertToZar = (amount: number, currency: string) => {
  const rate = ZAR_PER_UNIT[currency] || 1;
  return amount * rate;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { user_id, card_id, amount, currency } = req.body || {};
    if (!user_id || !card_id || !amount) {
      res.status(400).json({ error: 'Missing user_id, card_id, or amount' });
      return;
    }

    const secretKey = process.env.YOCO_SECRET_KEY;
    if (!secretKey) {
      res.status(500).json({ error: 'Missing YOCO_SECRET_KEY' });
      return;
    }

    const normalizedCurrency = String(currency || 'ZAR').toUpperCase();
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }

    const amountZar = convertToZar(amountNum, normalizedCurrency);
    const amountCents = Math.round(amountZar * 100);

    const baseUrl = getBaseUrl(req);
    const successUrl = `${baseUrl}/cards?topup=success`;
    const cancelUrl = `${baseUrl}/cards?topup=cancel`;

    const response = await fetch('https://payments.yoco.com/api/checkouts', {
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
          user_id,
          card_id,
          amount_zar: amountZar,
        },
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      res.status(502).json({ error: 'Failed to create checkout session', details: message });
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

