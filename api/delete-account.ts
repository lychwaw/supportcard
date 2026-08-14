import { createClient } from '@supabase/supabase-js';
import { handleCors } from './_cors.js';

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : null;
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }

  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error('Account deletion error:', deleteError.message);
      res.status(500).json({ error: 'Failed to delete account' });
      return;
    }

    res.status(200).json({ success: true });
  } catch (e: any) {
    console.error('Delete account error:', e?.message ?? e);
    res.status(500).json({ error: 'Internal server error' });
  }
}
