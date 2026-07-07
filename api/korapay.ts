import { createClient } from '@supabase/supabase-js';
import { handleCors } from './_cors.js';

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL;
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

async function handleVerifyId(req: any, res: any, supabase: any, authUser: any) {
  const KORAPAY_API_BASE = 'https://api.korapay.com/merchant/api/v1';
  const korapaySecret = process.env.KORAPAY_SECRET_KEY;
  if (!korapaySecret) {
    res.status(500).json({ error: 'KoraPay is not configured on this server' });
    return;
  }

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

  const firstName = typeof first_name === 'string' ? first_name.trim().slice(0, 100) : '';
  const lastName  = typeof last_name  === 'string' ? last_name.trim().slice(0, 100)  : '';
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
    await supabase.from('id_verifications').insert({ user_id: authUser.id, id_type: 'za_said', status: 'failed' });
    res.status(502).json({ error: 'Verification failed', details: `KoraPay responded with ${korapayResponse.status}` });
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
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
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
    if (action === 'verify-id') {
      await handleVerifyId(req, res, supabase, authUser);
    } else {
      res.status(400).json({ error: 'Missing or invalid action' });
    }
  } catch (error) {
    console.error('korapay handler error:', error);
    res.status(500).json({ error: 'Unexpected server error' });
  }
}
