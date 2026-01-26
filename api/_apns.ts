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

const buildJwtToken = async () => {
  const teamId = getEnv('APNS_TEAM_ID');
  const keyId = getEnv('APNS_KEY_ID');
  const privateKeyRaw = getEnv('APNS_PRIVATE_KEY');
  const privateKey = await importPKCS8(normalizePrivateKey(privateKeyRaw), 'ES256');

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime('20m')
    .sign(privateKey);
};

export type ApnsPayload = {
  title: string;
  body: string;
  data?: Record<string, any>;
};

export const sendApnsToToken = async (deviceToken: string, payload: ApnsPayload) => {
  const bundleId = getEnv('APNS_BUNDLE_ID');
  const jwt = await buildJwtToken();
  const endpoint = `${getApnsEndpoint()}/3/device/${deviceToken}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: 'default',
      },
      ...(payload.data ? { data: payload.data } : {}),
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`APNs request failed: ${response.status} ${responseText}`);
  }

  return responseText;
};

