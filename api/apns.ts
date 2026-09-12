import { createClient } from '@supabase/supabase-js';
import { sendApnsToToken, type ApnsPayload } from './_apns.js';
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

const formatZar = (amount: number) => `R${amount.toFixed(2)}`;

/**
 * Send to every token, and forget the ones Apple says are gone.
 *
 * Each reinstall issues a new device token and leaves the old row behind, so
 * dead tokens pile up. Promise.all also meant one dead token rejected the whole
 * send. allSettled delivers to the live ones regardless.
 *
 * Only 410 removes a row. Apple sends 410 when a token is no longer active, which
 * is definitive. 400 BadDeviceToken is deliberately left alone: it is also what a
 * sandbox/production mismatch looks like, and treating that as dead would wipe
 * every token in the table after one misconfigured deploy.
 */
async function deliver(supabase: any, tokens: string[], payload: ApnsPayload): Promise<number> {
  const results = await Promise.allSettled(tokens.map(t => sendApnsToToken(t, payload)));
  const dead = tokens.filter((_, i) => {
    const r = results[i];
    return r.status === 'rejected' && (r.reason as any)?.status === 410;
  });
  if (dead.length > 0) {
    const { error } = await supabase.from('push_devices').delete().in('device_token', dead);
    if (error) console.error('push_devices cleanup failed:', error.message);
  }
  return results.filter(r => r.status === 'fulfilled').length;
}

async function handleRegister(req: any, res: any, supabase: any, authUser: any) {
  const { device_token, platform, environment } = req.body || {};
  if (!device_token) {
    res.status(400).json({ error: 'Missing device_token' });
    return;
  }

  const { error } = await supabase
    .from('push_devices')
    .upsert({
      user_id: authUser.id,
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
}

async function handleSend(req: any, res: any, supabase: any) {
  const { user_id, title, body, data } = req.body || {};
  if (!user_id || !title || !body) {
    res.status(400).json({ error: 'Missing user_id, title, or body' });
    return;
  }

  const { data: devices, error } = await supabase
    .from('push_devices')
    .select('device_token')
    .eq('user_id', user_id);

  if (error) {
    console.error('APNs fetch devices error:', error);
    res.status(500).json({ error: 'Failed to load device tokens' });
    return;
  }

  const tokens = (devices || []).map((d: any) => d.device_token).filter(Boolean);
  if (tokens.length === 0) {
    res.status(200).json({ sent: 0, message: 'No device tokens registered' });
    return;
  }

  const sent = await deliver(supabase, tokens, { title, body, data });
  res.status(200).json({ sent });
}

async function handleNotifyExpense(req: any, res: any, supabase: any, authUser: any) {
  const { expense_id } = req.body || {};
  if (!expense_id) {
    res.status(400).json({ error: 'Missing expense_id' });
    return;
  }

  const { data: expense, error: expenseError } = await supabase
    .from('expense_requests')
    .select('id, amount, category, requester_id, child_id')
    .eq('id', expense_id)
    .single();

  if (expenseError || !expense) {
    res.status(404).json({ error: 'Expense request not found' });
    return;
  }

  // Only the approving co-parent (not the requester themselves) can trigger this.
  // The child RLS check below further verifies the caller is a family member.
  if (expense.requester_id === authUser.id) {
    res.status(403).json({ error: 'Forbidden: requester cannot trigger their own approval notification' });
    return;
  }

  if (!expense.child_id) {
    res.status(400).json({ error: 'Expense request has no child_id' });
    return;
  }

  const { data: child, error: childError } = await supabase
    .from('children')
    .select('parent_id, co_parent_id, name')
    .eq('id', expense.child_id)
    .single();

  if (childError || !child) {
    res.status(400).json({ error: 'Child record not found' });
    return;
  }

  // Notify the person who submitted the expense that it was actioned.
  // The caller is the approver/rejector, so we send to the requester.
  const recipientIds = [expense.requester_id].filter(Boolean);

  if (recipientIds.length === 0) {
    res.status(200).json({ sent: 0, message: 'No recipients for this expense' });
    return;
  }

  const { data: devices, error: devicesError } = await supabase
    .from('push_devices')
    .select('device_token, user_id')
    .in('user_id', recipientIds as string[]);

  if (devicesError) {
    res.status(500).json({ error: 'Failed to load device tokens' });
    return;
  }

  // Fetch the current status so the notification body is accurate
  const { data: expenseUpdated } = await supabase
    .from('expense_requests')
    .select('status')
    .eq('id', expense_id)
    .single();
  const status = expenseUpdated?.status ?? 'actioned';
  const title = status === 'approved' ? 'Expense approved ✓' : status === 'rejected' ? 'Expense declined' : 'Expense updated';
  const body = `${formatZar(Number(expense.amount))} for ${expense.category} (${child.name || 'child'})`;
  const tokens = (devices || []).map((d: any) => d.device_token).filter(Boolean);

  if (tokens.length === 0) {
    res.status(200).json({ sent: 0, message: 'No device tokens registered' });
    return;
  }

  const sent = await deliver(supabase, tokens, {
    title,
    body,
    data: { type: 'expense_request', expense_id: expense.id },
  });

  res.status(200).json({ sent });
}

async function handleNotifyLinked(req: any, res: any, supabase: any, authUser: any) {
  const { co_parent_id } = req.body || {};
  if (!co_parent_id) {
    res.status(400).json({ error: 'Missing co_parent_id' });
    return;
  }

  // Verify the caller actually has a child linking them to co_parent_id before
  // sending — prevents authenticated users from spamming arbitrary accounts.
  const { data: child } = await supabase
    .from('children')
    .select('id, name')
    .eq('parent_id', authUser.id)
    .eq('co_parent_id', co_parent_id)
    .limit(1)
    .maybeSingle();

  if (!child) {
    res.status(403).json({ error: 'No linked child found for this co-parent relationship' });
    return;
  }

  const { data: devices } = await supabase
    .from('push_devices')
    .select('device_token')
    .eq('user_id', co_parent_id);

  const tokens = (devices || []).map((d: any) => d.device_token).filter(Boolean);
  if (tokens.length === 0) {
    res.status(200).json({ sent: 0, message: 'Co-parent has no registered devices' });
    return;
  }

  const sent = await deliver(supabase, tokens, {
    title: "You've been added as a co-parent",
    body: 'You can now message and collaborate with your co-parent on SupportCard.',
    data: { type: 'coparent-linked' },
  });

  res.status(200).json({ sent });
}

/**
 * Notify the co-parent this is about, and nobody if that is unclear.
 *
 * This used to take whichever child the query returned first and notify that
 * child's other parent. A family can have two co-parents from two
 * relationships, and these notifications carry child names, document names and
 * event dates, so the wrong pick put one family's details on an unrelated
 * parent's lock screen.
 *
 * With a child name, only that child's other parent is eligible. Without one,
 * the notification goes out only when there is exactly one co-parent. Several
 * means we cannot know which family it belongs to, and saying nothing is the
 * only answer that cannot leak.
 */
async function sendToCoParent(
  supabase: any, authUserId: string, title: string, body: string, data: Record<string, any>,
  childName?: string,
): Promise<number> {
  const { data: rows } = await supabase
    .from('children')
    .select('name, parent_id, co_parent_id')
    .or(`parent_id.eq.${authUserId},co_parent_id.eq.${authUserId}`);
  let children = (rows || []) as { name: string | null; parent_id: string; co_parent_id: string | null }[];

  if (childName) {
    const wanted = childName.trim().toLowerCase();
    children = children.filter(c => (c.name ?? '').trim().toLowerCase() === wanted);
  }

  const others = Array.from(new Set(
    children
      .map(c => (c.parent_id === authUserId ? c.co_parent_id : c.parent_id))
      .filter((id): id is string => !!id && id !== authUserId),
  ));
  if (others.length !== 1) return 0;

  const { data: devices } = await supabase.from('push_devices').select('device_token').eq('user_id', others[0]);
  const tokens = ((devices || []) as any[]).map((d: any) => d.device_token).filter(Boolean);
  if (tokens.length === 0) return 0;
  return deliver(supabase, tokens, { title, body, data });
}

async function handleNotifyDocument(req: any, res: any, supabase: any, authUser: any) {
  const { doc_type, doc_name } = req.body || {};
  const type = typeof doc_type === 'string' ? doc_type.slice(0, 30) : 'document';
  const name = typeof doc_name === 'string' ? doc_name.slice(0, 60) : '';
  const body = name ? `${type}: ${name}` : `A new ${type} document was shared`;
  const sent = await sendToCoParent(supabase, authUser.id, 'New document shared', body, { type: 'document' });
  res.status(200).json({ sent });
}

async function handleNotifyCalendar(req: any, res: any, supabase: any, authUser: any) {
  const { event_type, event_date } = req.body || {};
  const evType = typeof event_type === 'string' ? event_type.slice(0, 40) : 'Event';
  const date = typeof event_date === 'string' ? event_date.slice(0, 10) : '';
  const body = date ? `${evType} on ${date}` : evType;
  const sent = await sendToCoParent(supabase, authUser.id, 'New calendar event', body, { type: 'calendar' });
  res.status(200).json({ sent });
}

async function handleNotifySchool(req: any, res: any, supabase: any, authUser: any) {
  const { notice_text, school_name } = req.body || {};
  const school = typeof school_name === 'string' && school_name ? school_name.slice(0, 40) : null;
  const title = school ? `School notice — ${school}` : 'New school notice';
  const preview = typeof notice_text === 'string' ? notice_text.slice(0, 100) : 'A new notice was added';
  const sent = await sendToCoParent(supabase, authUser.id, title, preview, { type: 'school' });
  res.status(200).json({ sent });
}

async function handleNotifyEmergency(req: any, res: any, supabase: any, authUser: any) {
  const { child_name } = req.body || {};
  const name = typeof child_name === 'string' && child_name ? child_name.slice(0, 40) : 'your child';
  const sent = await sendToCoParent(
    supabase, authUser.id,
    'Emergency profile updated',
    `The emergency profile for ${name} was updated`,
    { type: 'emergency' },
    typeof child_name === 'string' && child_name ? child_name : undefined,
  );
  res.status(200).json({ sent });
}

async function handleNotifyMessage(req: any, res: any, supabase: any, authUser: any) {
  const { recipient_id, sender_name, message_preview } = req.body || {};
  if (!recipient_id) {
    res.status(400).json({ error: 'Missing recipient_id' });
    return;
  }

  // Verify the caller and recipient share at least one child — blocks spamming arbitrary users.
  const { data: child } = await supabase
    .from('children')
    .select('id')
    .or(`and(parent_id.eq.${authUser.id},co_parent_id.eq.${recipient_id}),and(parent_id.eq.${recipient_id},co_parent_id.eq.${authUser.id})`)
    .limit(1)
    .maybeSingle();

  if (!child) {
    res.status(403).json({ error: 'No co-parent relationship found' });
    return;
  }

  const { data: devices } = await supabase
    .from('push_devices')
    .select('device_token')
    .eq('user_id', recipient_id);

  const tokens = (devices || []).map((d: any) => d.device_token).filter(Boolean);
  if (tokens.length === 0) {
    res.status(200).json({ sent: 0, message: 'Recipient has no registered devices' });
    return;
  }

  const name = typeof sender_name === 'string' ? sender_name.slice(0, 60) : 'Co-parent';
  const preview = typeof message_preview === 'string' ? message_preview.slice(0, 100) : 'New message';

  const sent = await deliver(supabase, tokens, {
    title: name,
    body: preview,
    data: { type: 'message' },
  });

  res.status(200).json({ sent });
}

async function handleTest(req: any, res: any) {
  const { device_token, title, body, data } = req.body || {};
  if (!device_token) {
    res.status(400).json({ error: 'Missing device_token' });
    return;
  }

  await sendApnsToToken(device_token, {
    title: title || 'SupportCard',
    body: body || 'Test notification',
    data,
  });

  res.status(200).json({ success: true });
}

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // All actions require a valid session — auth is enforced here once for all branches.
  const supabase = getSupabaseClient();
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: missing Bearer token' });
    return;
  }
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) {
    res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
    return;
  }

  const { action } = req.body || {};

  try {
    if (action === 'register') {
      await handleRegister(req, res, supabase, authUser);
    } else if (action === 'send') {
      // Restrict send to the authenticated user's own devices only.
      // Callers cannot supply an arbitrary user_id — it is always the requester.
      const body = req.body || {};
      await handleSend(
        { ...req, body: { ...body, user_id: authUser.id } },
        res,
        supabase,
      );
    } else if (action === 'notify-expense') {
      await handleNotifyExpense(req, res, supabase, authUser);
    } else if (action === 'notify-linked') {
      await handleNotifyLinked(req, res, supabase, authUser);
    } else if (action === 'notify-document') {
      await handleNotifyDocument(req, res, supabase, authUser);
    } else if (action === 'notify-calendar') {
      await handleNotifyCalendar(req, res, supabase, authUser);
    } else if (action === 'notify-school') {
      await handleNotifySchool(req, res, supabase, authUser);
    } else if (action === 'notify-emergency') {
      await handleNotifyEmergency(req, res, supabase, authUser);
    } else if (action === 'notify-message') {
      await handleNotifyMessage(req, res, supabase, authUser);
    } else if (action === 'test') {
      // Only allow in non-production environments.
      if (process.env.VERCEL_ENV === 'production') {
        res.status(403).json({ error: 'Test action is disabled in production' });
        return;
      }
      await handleTest(req, res);
    } else {
      res.status(400).json({ error: 'Missing or invalid action' });
    }
  } catch (error) {
    console.error('apns handler error:', error);
    res.status(500).json({ error: 'Unexpected server error' });
  }
}
