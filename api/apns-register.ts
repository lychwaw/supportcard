import { createClient } from '@supabase/supabase-js';

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
    const { user_id, device_token, platform, environment } = req.body || {};
    if (!user_id || !device_token) {
      res.status(400).json({ error: 'Missing user_id or device_token' });
      return;
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('push_devices')
      .upsert({
        user_id,
        device_token,
        platform: platform || 'ios',
        environment: environment || (process.env.APNS_ENV || 'development'),
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'device_token' });

    if (error) {
      console.error('APNs register error:', error);
      res.status(500).json({ error: 'Failed to register device token' });
      return;
    }

    res.status(200).json({ registered: true });
  } catch (error) {
    console.error('APNs register error:', error);
    res.status(500).json({ error: 'Unexpected error registering device token' });
  }
}

