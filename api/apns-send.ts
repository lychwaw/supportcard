import { createClient } from '@supabase/supabase-js';
import { sendApnsToToken } from './_apns.js';

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { user_id, title, body, data } = req.body || {};
    if (!user_id || !title || !body) {
      res.status(400).json({ error: 'Missing user_id, title, or body' });
      return;
    }

    const supabase = getSupabaseClient();
    const { data: devices, error } = await supabase
      .from('push_devices')
      .select('device_token')
      .eq('user_id', user_id);

    if (error) {
      console.error('APNs fetch devices error:', error);
      res.status(500).json({ error: 'Failed to load device tokens' });
      return;
    }

    const tokens = (devices || []).map((d) => d.device_token).filter(Boolean);
    if (tokens.length === 0) {
      res.status(200).json({ sent: 0, message: 'No device tokens registered' });
      return;
    }

    await Promise.all(tokens.map((token) => sendApnsToToken(token, { title, body, data })));
    res.status(200).json({ sent: tokens.length });
  } catch (error) {
    console.error('APNs send error:', error);
    res.status(500).json({ error: 'Failed to send APNs notification' });
  }
}

