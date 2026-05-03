const DEFAULT_BASE_URL = 'https://supportcard.vercel.app';

const getBaseUrl = (req: any) => {
  return process.env.APP_BASE_URL || req.headers?.origin || DEFAULT_BASE_URL;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Gate with ADMIN_SECRET so only operators can register/update the webhook URL.
  // Set ADMIN_SECRET in your Vercel/server environment variables.
  const adminSecret = process.env.ADMIN_SECRET;
  if (adminSecret) {
    const provided = req.headers['x-admin-secret'];
    if (provided !== adminSecret) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

  try {
    const secretKey = process.env.YOCO_SECRET_KEY;
    if (!secretKey) {
      res.status(500).json({ error: 'Missing YOCO_SECRET_KEY' });
      return;
    }

    const baseUrl = getBaseUrl(req);
    const webhookUrl = `${baseUrl}/api/yoco-webhook`;

    const response = await fetch('https://payments.yoco.com/api/webhooks', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'supportcard-webhook',
        url: webhookUrl,
      }),
    });

    if (!response.ok) {
      const message = await response.text();
      console.error('Yoco register webhook error:', message);
      res.status(502).json({ error: 'Failed to register webhook' });
      return;
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Yoco register webhook unexpected error:', error);
    res.status(500).json({ error: 'Unexpected error registering webhook' });
  }
}


