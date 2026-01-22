import { SignJWT, importPKCS8 } from 'jose';

const getEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
};

const normalizePrivateKey = (value: string) => {
  const decoded = value.includes('-----BEGIN')
    ? value
    : Buffer.from(value, 'base64').toString('utf8');
  return decoded.replace(/\\n/g, '\n');
};

const getApnsEndpoint = () => {
  const env = (process.env.APNS_ENV || 'development').toLowerCase();
  return env === 'production'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { device_token, title, body, data } = req.body || {};
    if (!device_token) {
      res.status(400).json({ error: 'Missing device_token' });
      return;
    }

    const teamId = getEnv('APNS_TEAM_ID');
    const keyId = getEnv('APNS_KEY_ID');
    const bundleId = getEnv('APNS_BUNDLE_ID');
    const privateKeyRaw = getEnv('APNS_PRIVATE_KEY');
    const privateKey = await importPKCS8(normalizePrivateKey(privateKeyRaw), 'ES256');

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuer(teamId)
      .setIssuedAt()
      .setExpirationTime('20m')
      .sign(privateKey);

    const payload = {
      aps: {
        alert: {
          title: title || 'SupportCard',
          body: body || 'Test notification',
        },
        sound: 'default',
      },
      ...(data ? { data } : {}),
    };

    const endpoint = `${getApnsEndpoint()}/3/device/${device_token}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `bearer ${token}`,
        'apns-topic': bundleId,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    if (!response.ok) {
      res.status(response.status).json({ error: 'APNs request failed', details: responseText });
      return;
    }

    res.status(200).json({ success: true, response: responseText });
  } catch (error: any) {
    console.error('APNs test error:', error);
    res.status(500).json({ error: 'Failed to send APNs notification', details: error?.message });
  }
}

