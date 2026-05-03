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

const validateSAIdFormat = (id: string): string | null => {
  if (!/^\d{13}$/.test(id)) return 'SA ID must be exactly 13 digits';
  const month = parseInt(id.slice(2, 4), 10);
  const day   = parseInt(id.slice(4, 6), 10);
  if (month < 1 || month > 12) return 'Invalid birth month in ID number';
  if (day < 1 || day > 31)     return 'Invalid birth day in ID number';
  const citizenship = id[10];
  if (citizenship !== '0' && citizenship !== '1') return 'Invalid citizenship digit';
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    let digit = parseInt(id[i], 10);
    if (i % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  const expected = (10 - (sum % 10)) % 10;
  if (expected !== parseInt(id[12], 10)) return 'Invalid ID number (checksum failed)';
  return null;
};

async function handleCreateCard(req: any, res: any, supabase: any, authUser: any, korapaySecret: string) {
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', authUser.id)
    .maybeSingle();

  const customerEmail = profile?.email || authUser.email || `user-${authUser.id}@supportcard.app`;
  const customerName = name_on_card.trim();
  const reference = `SC-${authUser.id.slice(0, 8)}-${randomUUID().slice(0, 8)}`;

  const korapayBody: Record<string, unknown> = {
    name: customerName,
    currency: cardCurrency,
    reference,
    customer: { name: customerName, email: customerEmail },
  };

  if (amount > 0) korapayBody.amount = amount;

  const korapayResponse = await fetch(`${KORAPAY_API_BASE}/virtual-card/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${korapaySecret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(korapayBody),
  });

  if (!korapayResponse.ok) {
    const text = await korapayResponse.text();
    console.error('KoraPay create-card error:', text);
    res.status(502).json({ error: 'KoraPay card creation failed', details: text || `KoraPay responded with ${korapayResponse.status}` });
    return;
  }

  const korapayData = await korapayResponse.json();
  const card = korapayData?.data;

  if (!card?.id) {
    res.status(502).json({ error: 'KoraPay returned unexpected response', details: JSON.stringify(korapayData) });
    return;
  }

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
    res.status(207).json({
      warning: 'Card created at KoraPay but could not be saved locally',
      korapay_card_id: card.id,
      error: dbError.message,
    });
    return;
  }

  res.status(201).json({ card: inserted });
}

async function handleFundCard(req: any, res: any, supabase: any, authUser: any, korapaySecret: string) {
  const { card_id, amount } = req.body || {};

  if (!card_id || typeof card_id !== 'string') {
    res.status(400).json({ error: 'card_id is required' });
    return;
  }

  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: 'amount must be a positive number' });
    return;
  }

  const { data: card } = await supabase
    .from('korapay_cards')
    .select('id, korapay_card_id, user_id, status, currency')
    .eq('id', card_id)
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (!card) {
    res.status(403).json({ error: 'Forbidden: card not found or not owned by you' });
    return;
  }

  if (card.status === 'terminated') {
    res.status(409).json({ error: 'Cannot fund a terminated card' });
    return;
  }

  const korapayResponse = await fetch(`${KORAPAY_API_BASE}/virtual-card/fund`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${korapaySecret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_id: card.korapay_card_id, amount: amountNum, currency: card.currency }),
  });

  if (!korapayResponse.ok) {
    const text = await korapayResponse.text();
    console.error('KoraPay fund-card error:', text);
    res.status(502).json({ error: 'KoraPay card funding failed', details: text || `KoraPay responded with ${korapayResponse.status}` });
    return;
  }

  const korapayData = await korapayResponse.json();
  const newBalance = korapayData?.data?.balance ?? null;

  if (newBalance !== null && Number.isFinite(Number(newBalance))) {
    await supabase.from('korapay_cards').update({ balance: Number(newBalance) }).eq('id', card.id);
  }

  res.status(200).json({ funded: true, balance: newBalance });
}

async function handleFreezeCard(req: any, res: any, supabase: any, authUser: any, korapaySecret: string) {
  const { card_id, freeze_action } = req.body || {};

  if (!card_id || typeof card_id !== 'string') {
    res.status(400).json({ error: 'card_id is required' });
    return;
  }

  if (freeze_action !== 'freeze' && freeze_action !== 'unfreeze') {
    res.status(400).json({ error: 'freeze_action must be "freeze" or "unfreeze"' });
    return;
  }

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

  const korapayResponse = await fetch(`${KORAPAY_API_BASE}/virtual-card/${card.korapay_card_id}/${freeze_action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${korapaySecret}`, 'Content-Type': 'application/json' },
  });

  if (!korapayResponse.ok) {
    const text = await korapayResponse.text();
    console.error(`KoraPay ${freeze_action} error:`, text);
    res.status(502).json({ error: `KoraPay ${freeze_action} failed`, details: text || `KoraPay responded with ${korapayResponse.status}` });
    return;
  }

  const newStatus = freeze_action === 'freeze' ? 'blocked' : 'active';
  await supabase.from('korapay_cards').update({ status: newStatus }).eq('id', card.id);

  res.status(200).json({ success: true, status: newStatus });
}

async function handleVerifyId(req: any, res: any, supabase: any, authUser: any, korapaySecret: string) {
  const { id_number, first_name, last_name, verification_consent } = req.body || {};

  if (!verification_consent) {
    res.status(400).json({ error: 'verification_consent must be true — explicit consent is required' });
    return;
  }

  if (!id_number || typeof id_number !== 'string') {
    res.status(400).json({ error: 'id_number is required' });
    return;
  }

  const formatError = validateSAIdFormat(id_number.trim());
  if (formatError) {
    res.status(422).json({ error: formatError });
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id_verified')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profile?.id_verified) {
    res.status(409).json({ error: 'Identity is already verified for this account' });
    return;
  }

  const korapayBody: Record<string, unknown> = {
    id: id_number.trim(),
    verification_consent: true,
  };

  const firstName = typeof first_name === 'string' ? first_name.trim() : '';
  const lastName  = typeof last_name  === 'string' ? last_name.trim()  : '';
  if (firstName || lastName) {
    korapayBody.validation = {
      ...(firstName && { first_name: firstName }),
      ...(lastName  && { last_name:  lastName  }),
    };
  }

  const korapayResponse = await fetch(`${KORAPAY_API_BASE}/identities/za/said`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${korapaySecret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(korapayBody),
  });

  if (!korapayResponse.ok) {
    console.error('KoraPay SAID verification error:', korapayResponse.status);

    await supabase.from('id_verifications').insert({
      user_id: authUser.id,
      id_type: 'za_said',
      status: 'failed',
    });

    res.status(502).json({
      error: 'Verification failed',
      details: `KoraPay responded with ${korapayResponse.status}`,
    });
    return;
  }

  const korapayData = await korapayResponse.json();
  const data = korapayData?.data;

  if (!korapayData?.status || !data) {
    res.status(502).json({ error: 'Unexpected response from KoraPay' });
    return;
  }

  const isVerified = korapayData.status === true;
  const deceasedStatus = String(data.deceased_status ?? '').toLowerCase();
  const isAlive = deceasedStatus === 'alive' || !deceasedStatus;

  const verificationRecord = {
    user_id:           authUser.id,
    korapay_reference: data.reference ?? null,
    id_type:           'za_said',
    status:            isVerified && isAlive ? 'verified' : 'failed',
    first_name_match:  data.validation?.first_name?.match ?? null,
    last_name_match:   data.validation?.last_name?.match  ?? null,
    deceased_status:   data.deceased_status ?? null,
    country_of_birth:  data.country_of_birth ?? null,
    on_hanis:          data.on_hanis === 'yes' ? true : data.on_hanis === 'no' ? false : null,
    on_npr:            data.on_npr   === 'yes' ? true : data.on_npr   === 'no' ? false : null,
  };

  await supabase.from('id_verifications').insert(verificationRecord);

  if (verificationRecord.status === 'verified') {
    await supabase
      .from('profiles')
      .update({ id_verified: true, id_verified_at: new Date().toISOString() })
      .eq('id', authUser.id);
  }

  res.status(200).json({
    verified:             verificationRecord.status === 'verified',
    reference:            data.reference ?? null,
    deceased_status:      data.deceased_status ?? null,
    country_of_birth:     data.country_of_birth ?? null,
    on_hanis:             data.on_hanis ?? null,
    is_smart_card_issued: data.is_smart_card_issued ?? null,
    validation: {
      first_name: data.validation?.first_name ?? null,
      last_name:  data.validation?.last_name  ?? null,
    },
  });
}

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

  const { action } = req.body || {};

  try {
    if (action === 'create-card') {
      await handleCreateCard(req, res, supabase, authUser, korapaySecret);
    } else if (action === 'fund-card') {
      await handleFundCard(req, res, supabase, authUser, korapaySecret);
    } else if (action === 'freeze-card') {
      await handleFreezeCard(req, res, supabase, authUser, korapaySecret);
    } else if (action === 'verify-id') {
      await handleVerifyId(req, res, supabase, authUser, korapaySecret);
    } else {
      res.status(400).json({ error: 'Missing or invalid action' });
    }
  } catch (error) {
    console.error('korapay handler error:', error);
    res.status(500).json({ error: 'Unexpected server error' });
  }
}
