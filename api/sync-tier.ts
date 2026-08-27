import { createClient } from '@supabase/supabase-js';
import { handleCors } from './_cors.js';

const TIER_PRIORITY: Record<string, number> = { essential: 1, plus: 2, premium: 3 };

const getSupabase = () => createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers['authorization'] ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  const rcKey = process.env.REVENUECAT_SECRET_KEY;
  if (!rcKey) return res.status(500).json({ error: 'Subscription service not configured' });

  try {
    const rcRes = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
      { headers: { Authorization: `Bearer ${rcKey}` } },
    );
    if (!rcRes.ok) return res.status(502).json({ error: 'Could not verify subscription' });

    const { subscriber } = await rcRes.json();
    const entitlements: Record<string, any> = subscriber?.entitlements ?? {};

    let tier = 'preview';
    let best = 0;
    const now = new Date();
    for (const [id, ent] of Object.entries(entitlements)) {
      const expires = ent.expires_date ? new Date(ent.expires_date as string) : null;
      const active = expires === null || expires > now;
      const rank = TIER_PRIORITY[id] ?? 0;
      if (active && rank > best) { best = rank; tier = id; }
    }

    await supabase.from('profiles').update({
      subscription_tier: tier,
      subscription_status: tier === 'preview' ? 'cancelled' : 'active',
    }).eq('id', user.id);

    return res.status(200).json({ tier });
  } catch (err: any) {
    console.error('sync-tier error:', err?.message);
    return res.status(500).json({ error: 'Sync failed' });
  }
}
