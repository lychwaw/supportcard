import { importPKCS8, SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';
import { setCorsHeaders } from './_cors.js';

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
};

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

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Gate on a valid session — prevents unauthenticated MapKit token scraping.
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const bearerToken = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : null;
    if (!bearerToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const supabase = getSupabaseClient();
    const { error: authError } = await supabase.auth.getUser(bearerToken);
    if (authError) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const teamId = getEnv('APPLE_TEAM_ID');
    const keyId = getEnv('APPLE_MAPKIT_KEY_ID');
    const privateKeyRaw = getEnv('APPLE_MAPKIT_PRIVATE_KEY');
    const privateKey = await importPKCS8(normalizePrivateKey(privateKeyRaw), 'ES256');

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: keyId })
      .setIssuer(teamId)
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(privateKey);

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(token);
  } catch (error: any) {
    console.error('MapKit token error:', error);
    res.status(500).json({ error: 'Failed to generate MapKit token' });
  }
}

