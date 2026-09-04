import { createClient } from '@supabase/supabase-js';
import { handleCors } from './_cors.js';

const getSupabase = () => createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const extractBearer = (req: any): string | null => {
  const h = req.headers['authorization'] ?? '';
  return typeof h === 'string' ? h.replace(/^Bearer\s+/i, '') : null;
};

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion
  let token = '';
  for (let i = 0; i < 8; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

async function handleCreate(req: any, res: any, supabase: any, userId: string) {
  const { professional_email } = req.body ?? {};
  if (!professional_email || typeof professional_email !== 'string' || !professional_email.includes('@')) {
    return res.status(400).json({ error: 'A valid professional email is required' });
  }

  const email = professional_email.trim().toLowerCase();

  // Check caller is a parent (not a professional inviting themselves)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if ((profile as any)?.role === 'professional') {
    return res.status(403).json({ error: 'Professionals cannot send invites — ask the parent to invite you' });
  }

  // Prevent duplicate pending invite for same email + parent
  const { data: existing } = await supabase
    .from('professional_links')
    .select('id, token, status')
    .eq('parent_id', userId)
    .eq('invited_email', email)
    .maybeSingle();

  if (existing) {
    if ((existing as any).status === 'active') {
      return res.status(409).json({ error: 'This professional is already linked to your account' });
    }
    // Return the existing pending token so parent can reshare it
    return res.status(200).json({ token: (existing as any).token, reused: true });
  }

  // Generate a unique token (retry on collision)
  let token = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    token = generateToken();
    const { data: clash } = await supabase
      .from('professional_links')
      .select('id')
      .eq('token', token)
      .maybeSingle();
    if (!clash) break;
  }

  const { error } = await supabase.from('professional_links').insert({
    parent_id: userId,
    invited_email: email,
    token,
    status: 'pending',
  });

  if (error) {
    console.error('professional-invite create error:', error.message);
    return res.status(500).json({ error: 'Could not create invite' });
  }

  return res.status(200).json({ token });
}

async function handleClaim(req: any, res: any, supabase: any, userId: string) {
  const { token } = req.body ?? {};
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return res.status(400).json({ error: 'Invite token is required' });
  }

  // Caller must be a professional
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email')
    .eq('id', userId)
    .maybeSingle();

  if ((profile as any)?.role !== 'professional') {
    return res.status(403).json({ error: 'Only professional accounts can claim invites' });
  }

  const { data: link } = await supabase
    .from('professional_links')
    .select('id, status, invited_email, parent_id')
    .eq('token', token.trim().toUpperCase())
    .maybeSingle();

  if (!link) return res.status(404).json({ error: 'Invalid invite code' });
  if ((link as any).status === 'active') return res.status(409).json({ error: 'This invite has already been claimed' });
  if ((link as any).status === 'revoked') return res.status(410).json({ error: 'This invite has been revoked' });

  // Prevent a professional from linking to their own parent account
  if ((link as any).parent_id === userId) {
    return res.status(400).json({ error: 'You cannot claim your own invite' });
  }

  const { error } = await supabase
    .from('professional_links')
    .update({
      professional_id: userId,
      status: 'active',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', (link as any).id);

  if (error) {
    console.error('professional-invite claim error:', error.message);
    return res.status(500).json({ error: 'Could not claim invite' });
  }

  return res.status(200).json({ success: true });
}

async function handleList(req: any, res: any, supabase: any, userId: string) {
  const { data } = await supabase
    .from('professional_links')
    .select('id, invited_email, status, token, notes, created_at, accepted_at')
    .eq('parent_id', userId)
    .order('created_at', { ascending: false });

  return res.status(200).json({ links: data ?? [] });
}

async function handleUpdateNotes(req: any, res: any, supabase: any, userId: string) {
  const { link_id, notes } = req.body ?? {};
  if (!link_id) return res.status(400).json({ error: 'link_id required' });
  if (typeof notes !== 'string') return res.status(400).json({ error: 'notes must be a string' });

  // Only the professional on this link can write notes.
  // .select() matters: without it a filter that matches zero rows still returns
  // error: null, so an unauthorised or inactive link would report success and
  // silently save nothing.
  const { data, error } = await supabase
    .from('professional_links')
    .update({ notes: notes.trim().slice(0, 2000) || null })
    .eq('id', link_id)
    .eq('professional_id', userId)
    .eq('status', 'active')
    .select('id');

  if (error) return res.status(500).json({ error: 'Could not save notes' });
  if (!data || data.length === 0) {
    return res.status(404).json({ error: 'This link is no longer active, or you do not have access to it.' });
  }
  return res.status(200).json({ success: true });
}

async function handleRevoke(req: any, res: any, supabase: any, userId: string) {
  const { link_id } = req.body ?? {};
  if (!link_id) return res.status(400).json({ error: 'link_id required' });

  const { error } = await supabase
    .from('professional_links')
    .update({ status: 'revoked' })
    .eq('id', link_id)
    .eq('parent_id', userId); // ensures caller owns this link

  if (error) return res.status(500).json({ error: 'Could not revoke invite' });
  return res.status(200).json({ success: true });
}

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = extractBearer(req);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { action } = req.body ?? {};

  try {
    if (action === 'create') return await handleCreate(req, res, supabase, user.id);
    if (action === 'claim') return await handleClaim(req, res, supabase, user.id);
    if (action === 'list') return await handleList(req, res, supabase, user.id);
    if (action === 'revoke') return await handleRevoke(req, res, supabase, user.id);
    if (action === 'update_notes') return await handleUpdateNotes(req, res, supabase, user.id);
    return res.status(400).json({ error: 'Invalid action' });
  } catch (err: any) {
    console.error('professional-invite error:', err?.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
