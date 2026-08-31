import { createClient } from '@supabase/supabase-js';
import { handleCors } from './_cors.js';

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

  const { code } = req.body ?? {};
  if (!code || typeof code !== 'string' || code.trim().length === 0) {
    return res.status(400).json({ error: 'code is required' });
  }

  // Fetch the user's family_id for co-parent deduplication
  const { data: profile } = await supabase
    .from('profiles')
    .select('family_id')
    .eq('id', user.id)
    .maybeSingle();

  const familyId: string | null = (profile as any)?.family_id ?? null;

  const { data, error } = await supabase.rpc('capture_referral', {
    p_user_id: user.id,
    p_code: code.trim(),
    p_family_id: familyId,
  });

  if (error) {
    console.error('capture_referral error:', error.message);
    return res.status(500).json({ error: 'Failed to capture referral' });
  }

  const result = data as string;

  switch (result) {
    case 'ok':
      return res.status(200).json({ success: true });
    case 'invalid_code':
      return res.status(404).json({ error: 'Invalid referral code' });
    case 'expired':
      return res.status(410).json({ error: 'Referral code can only be entered within 7 days of signup' });
    case 'self_referral':
      return res.status(400).json({ error: 'You cannot use your own referral code' });
    case 'already_referred':
    case 'family_already_referred':
      return res.status(409).json({ error: 'A referral has already been applied to this account' });
    default:
      return res.status(500).json({ error: 'Unexpected result' });
  }
}
