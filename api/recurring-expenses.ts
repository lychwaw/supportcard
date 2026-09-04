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

const VALID_CATEGORIES = ['School', 'Food', 'Clothing', 'Activities', 'Healthcare', 'Transportation', 'Other'];
const VALID_FREQUENCIES = ['weekly', 'monthly'];
const VALID_CURRENCIES = ['ZAR', 'USD'];

function advanceDueDate(current: string, frequency: string): string {
  const d = new Date(current + 'T00:00:00Z');
  if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: any, res: any) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const bearerToken = extractBearer(req);
  if (!bearerToken) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = getSupabase();
  const { data: { user }, error: authErr } = await supabase.auth.getUser(bearerToken);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { action } = req.body ?? {};

  try {
    // ── create ──────────────────────────────────────────────────────────────
    if (action === 'create') {
      const { amount, currency, category, description, frequency, next_due_date, child_id } = req.body ?? {};
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
      if (!VALID_CURRENCIES.includes(currency)) return res.status(400).json({ error: 'invalid currency' });
      if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'invalid category' });
      if (!VALID_FREQUENCIES.includes(frequency)) return res.status(400).json({ error: 'frequency must be weekly or monthly' });
      if (!next_due_date || !/^\d{4}-\d{2}-\d{2}$/.test(next_due_date)) return res.status(400).json({ error: 'next_due_date must be YYYY-MM-DD' });

      const { data, error } = await supabase.from('recurring_expense_templates').insert({
        user_id: user.id,
        child_id: child_id ?? null,
        amount: n,
        currency,
        category,
        description: description?.trim().slice(0, 500) || null,
        frequency,
        next_due_date,
      }).select('id').single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ id: data.id });
    }

    // ── list ─────────────────────────────────────────────────────────────────
    if (action === 'list') {
      const { data } = await supabase
        .from('recurring_expense_templates')
        .select('*, child:child_id(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      return res.status(200).json({ templates: data ?? [] });
    }

    // ── toggle ───────────────────────────────────────────────────────────────
    if (action === 'toggle') {
      const { template_id, active } = req.body ?? {};
      if (!template_id || typeof active !== 'boolean') return res.status(400).json({ error: 'template_id and active required' });
      await supabase.from('recurring_expense_templates').update({ active }).eq('id', template_id).eq('user_id', user.id);
      return res.status(200).json({ success: true });
    }

    // ── delete ───────────────────────────────────────────────────────────────
    if (action === 'delete') {
      const { template_id } = req.body ?? {};
      if (!template_id) return res.status(400).json({ error: 'template_id required' });
      await supabase.from('recurring_expense_templates').delete().eq('id', template_id).eq('user_id', user.id);
      return res.status(200).json({ success: true });
    }

    // ── check (called on app launch — creates due expense requests) ───────────
    if (action === 'check') {
      const today = new Date().toISOString().slice(0, 10);
      const { data: due } = await supabase
        .from('recurring_expense_templates')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .lte('next_due_date', today);

      if (!due || due.length === 0) return res.status(200).json({ created: 0 });

      let created = 0;
      for (const tpl of due) {
        // Insert the expense request
        const { error: insertErr } = await supabase.from('expense_requests').insert({
          requester_id: user.id,
          child_id: tpl.child_id,
          amount: tpl.amount,
          currency: tpl.currency,
          category: tpl.category,
          description: tpl.description,
          status: 'pending',
          created_via: 'recurring',
        });

        if (!insertErr) {
          // Advance next_due_date
          await supabase.from('recurring_expense_templates')
            .update({ next_due_date: advanceDueDate(tpl.next_due_date, tpl.frequency) })
            .eq('id', tpl.id);
          created++;
        }
      }

      return res.status(200).json({ created });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err: any) {
    console.error('recurring-expenses error:', err?.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
