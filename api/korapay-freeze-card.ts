import { createClient } from '@supabase/supabase-js';

const KORAPAY_API_BASE = 'https://api.korapay.com/merchant/api/v1';

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
};

const extractBearer = (req: any): string | null => {
  const h = req.headers['authorization'] || req.headers['Authorization'];
  return typeof h === 'string' ? h.replace(/^Bearer\s+/i, '') : null;
};

// Handles both freeze and unfreeze via the `action` body field.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const korapaySecret = process.env.KORAPAY_SECRET_KEY;
  if (!korapaySecret) {
    res.status(500).json({ error: 'KoraPay is not configured on this server' });
    return;
  }

  try {
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

    const { card_id, action } = req.body || {};

    if (!card_id || typeof card_id !== 'string') {
      res.status(400).json({ error: 'card_id is required' });
      return;
    }

    if (action !== 'freeze' && action !== 'unfreeze') {
      res.status(400).json({ error: 'action must be "freeze" or "unfreeze"' });
      return;
    }

    // Verify card ownership.
    const { data: card } = await supabase
      .from('korapay_cards')
      .select('id, korapay_card_id, user_id, status')
      .eq('id', card_id)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (!card) {
      res.status(403).json({ error: 'Forbidden: card not found or not owned by you' });
      return;
    }

    if (card.status === 'terminated') {
      res.status(409).json({ error: 'Cannot change the state of a terminated card' });
      return;
    }

    const endpoint = `${KORAPAY_API_BASE}/virtual-card/${card.korapay_card_id}/${action}`;
    const korapayResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${korapaySecret}`,
        'Content-Type': 'application/json',
      },
    });

    if (!korapayResponse.ok) {
      const text = await korapayResponse.text();
      console.error(`KoraPay ${action} error:`, text);
      res.status(502).json({
        error: `KoraPay ${action} failed`,
        details: text || `KoraPay responded with ${korapayResponse.status}`,
      });
      return;
    }

    // Map KoraPay freeze state to our status column.
    const newStatus = action === 'freeze' ? 'blocked' : 'active';
    await supabase
      .from('korapay_cards')
      .update({ status: newStatus })
      .eq('id', card.id);

    res.status(200).json({ success: true, status: newStatus });
  } catch (error) {
    console.error('korapay-freeze-card error:', error);
    res.status(500).json({ error: 'Unexpected error updating card state' });
  }
}
