import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
};

const extractPayload = (body: any) => body?.data || body?.payload || body;

const isSuccessEvent = (body: any) => {
  const status = body?.status || body?.data?.status || body?.payload?.status;
  const event = body?.event || body?.type;
  return ['successful', 'succeeded', 'paid'].includes(status) || ['payment.succeeded', 'checkout.succeeded'].includes(event);
};

const getMetadata = (payload: any) => payload?.metadata || payload?.reference || {};

const getPaymentReference = (payload: any) =>
  payload?.id ||
  payload?.payment?.id ||
  payload?.charge_id ||
  payload?.charge?.id ||
  payload?.data?.id ||
  null;

const verifySignature = (rawBody: string, signature: string, secret: string) => {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const signature =
      req.headers['x-yoco-signature'] ||
      req.headers['x-yoco-hmac-sha256'] ||
      req.headers['x-yoco-hmac'];

    const webhookSecret = process.env.YOCO_WEBHOOK_SECRET;
    if (webhookSecret && signature && !verifySignature(rawBody, signature, webhookSecret)) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!isSuccessEvent(body)) {
      res.status(200).json({ received: true });
      return;
    }

    const payload = extractPayload(body);
    const metadata = getMetadata(payload);
    const supabase = getSupabaseClient();

    if (metadata?.type === 'expense_approval') {
      const expenseId = metadata.expense_id;
      const approverId = metadata.approver_id;

      if (!expenseId || !approverId) {
        res.status(400).json({ error: 'Missing metadata expense_id or approver_id' });
        return;
      }

      const { data: expense, error: expenseError } = await supabase
        .from('expense_requests')
        .select('status, payment_status')
        .eq('id', expenseId)
        .single();

      if (expenseError || !expense) {
        console.error('Expense fetch error:', expenseError);
        res.status(500).json({ error: 'Failed to load expense request' });
        return;
      }

      if (expense.payment_status === 'paid') {
        res.status(200).json({ updated: true, type: 'expense_approval' });
        return;
      }

      if (expense.status === 'rejected') {
        console.warn('Expense payment received for rejected request:', expenseId);
        res.status(200).json({ updated: false, type: 'expense_approval', reason: 'rejected' });
        return;
      }

      if (expense.status === 'pending') {
        const { error: approveError } = await supabase.rpc('approve_expense_request', {
          p_request_id: expenseId,
          p_approver_id: approverId,
        });

        if (approveError) {
          console.error('Expense approval error:', approveError);
          res.status(500).json({ error: 'Failed to approve expense request' });
          return;
        }
      }

      const paymentReference = getPaymentReference(payload);
      const { error: paymentError } = await supabase
        .from('expense_requests')
        .update({
          payment_status: 'paid',
          paid_at: new Date().toISOString(),
          payment_reference: paymentReference,
        })
        .eq('id', expenseId);

      if (paymentError) {
        console.error('Expense payment update error:', paymentError);
        res.status(500).json({ error: 'Failed to mark expense as paid' });
        return;
      }

      res.status(200).json({ updated: true, type: 'expense_approval' });
      return;
    }

    if (metadata?.type === 'topup') {
      const cardId = metadata.card_id;
      const amountZar = Number(metadata.amount_zar);

      if (!cardId || !Number.isFinite(amountZar)) {
        res.status(400).json({ error: 'Missing metadata card_id or amount_zar' });
        return;
      }

      const { data: card, error: fetchError } = await supabase
        .from('virtual_cards')
        .select('balance')
        .eq('id', cardId)
        .single();

      if (fetchError || !card) {
        console.error('Card fetch error:', fetchError);
        res.status(500).json({ error: 'Failed to load card balance' });
        return;
      }

      const newBalance = Number(card.balance || 0) + amountZar;
      const { error: updateError } = await supabase
        .from('virtual_cards')
        .update({ balance: newBalance })
        .eq('id', cardId);

      if (updateError) {
        console.error('Topup update error:', updateError);
        res.status(500).json({ error: 'Failed to apply topup' });
        return;
      }

      res.status(200).json({ updated: true, type: 'topup' });
      return;
    }

    const userId = metadata.user_id;
    const tierId = metadata.tier_id;

    if (!userId || !tierId) {
      res.status(400).json({ error: 'Missing metadata user_id or tier_id' });
      return;
    }

    const nextExpiryDate = new Date();
    if (tierId === 'executive') {
      nextExpiryDate.setFullYear(nextExpiryDate.getFullYear() + 1);
    } else {
      nextExpiryDate.setMonth(nextExpiryDate.getMonth() + 1);
    }
    const nextExpiry = nextExpiryDate.toISOString();

    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_tier: tierId,
        subscription_status: 'active',
        expiry_date: nextExpiry,
      })
      .eq('id', userId);

    if (error) {
      console.error('Supabase update error:', error);
      res.status(500).json({ error: 'Failed to update subscription' });
      return;
    }

    res.status(200).json({ updated: true, type: 'subscription' });
  } catch (error) {
    console.error('Yoco webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

