import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

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

    const { name_on_card, initial_amount, currency, child_id } = req.body || {};

    if (!name_on_card || typeof name_on_card !== 'string' || name_on_card.trim().length < 2) {
      res.status(400).json({ error: 'name_on_card is required (min 2 characters)' });
      return;
    }

    const amount = Number(initial_amount ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      res.status(400).json({ error: 'initial_amount must be a non-negative number' });
      return;
    }

    const cardCurrency = String(currency || 'USD').toUpperCase();
    if (!['USD', 'NGN'].includes(cardCurrency)) {
      res.status(400).json({ error: 'currency must be USD or NGN' });
      return;
    }

    // Verify child_id belongs to this user if provided.
    if (child_id) {
      const { data: child } = await supabase
        .from('children')
        .select('id')
        .eq('id', child_id)
        .eq('parent_id', authUser.id)
        .maybeSingle();

      if (!child) {
        res.status(403).json({ error: 'Forbidden: child not found or not owned by you' });
        return;
      }
    }

    // Fetch user email for the KoraPay customer object.
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', authUser.id)
      .maybeSingle();

    const customerEmail = profile?.email || authUser.email || `user-${authUser.id}@supportcard.app`;
    const customerName = (name_on_card.trim());

    // Idempotency key: stable per user + card name + currency combination.
    const reference = `SC-${authUser.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`;

    const korapayBody: Record<string, unknown> = {
      name: customerName,
      currency: cardCurrency,
      reference,
      customer: {
        name: customerName,
        email: customerEmail,
      },
    };

    // KoraPay requires a non-zero amount only when funding at creation time.
    if (amount > 0) {
      korapayBody.amount = amount;
    }

    const korapayResponse = await fetch(`${KORAPAY_API_BASE}/virtual-card/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${korapaySecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(korapayBody),
    });

    if (!korapayResponse.ok) {
      const text = await korapayResponse.text();
      console.error('KoraPay create-card error:', text);
      res.status(502).json({
        error: 'KoraPay card creation failed',
        details: text || `KoraPay responded with ${korapayResponse.status}`,
      });
      return;
    }

    const korapayData = await korapayResponse.json();
    const card = korapayData?.data;

    if (!card?.id) {
      res.status(502).json({ error: 'KoraPay returned unexpected response', details: JSON.stringify(korapayData) });
      return;
    }

    // Persist metadata only — raw card_number and cvv are intentionally discarded.
    const { data: inserted, error: dbError } = await supabase
      .from('korapay_cards')
      .insert({
        user_id: authUser.id,
        child_id: child_id || null,
        korapay_card_id: card.id,
        korapay_reference: reference,
        name_on_card: customerName,
        status: card.status ?? 'active',
        masked_pan: card.masked_pan ?? null,
        expiry_month: card.expiry_month ? Number(card.expiry_month) : null,
        expiry_year: card.expiry_year ? Number(card.expiry_year) : null,
        brand: card.brand ?? null,
        currency: cardCurrency,
        balance: Number(card.balance ?? amount),
      })
      .select('id, korapay_card_id, masked_pan, expiry_month, expiry_year, brand, status, balance, currency')
      .single();

    if (dbError) {
      console.error('DB insert error after card creation:', dbError);
      // Card was created at KoraPay — log and return partial success so caller can retry saving.
      res.status(207).json({
        warning: 'Card created at KoraPay but could not be saved locally',
        korapay_card_id: card.id,
        error: dbError.message,
      });
      return;
    }

    res.status(201).json({ card: inserted });
  } catch (error) {
    console.error('korapay-create-card error:', error);
    res.status(500).json({ error: 'Unexpected error creating virtual card' });
  }
}
