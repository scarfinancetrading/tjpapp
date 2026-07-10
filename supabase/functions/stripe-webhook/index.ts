// Stripe webhook - verifies signature and syncs subscription state to profiles.
// Deployed with verify_jwt = false (Stripe calls it directly, no user JWT).
import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function addDays(date: Date, days: number): string {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

async function resolveUserId(customerId: string | null, metadataUserId?: string): Promise<string | null> {
  if (metadataUserId) return metadataUserId;
  if (!customerId) return null;
  const { data } = await supabase.from('profiles').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
  return data?.user_id ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });
  if (!STRIPE_WEBHOOK_SECRET) return new Response('Webhook secret not configured', { status: 500 });

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err?.message);
    return new Response(`Webhook Error: ${err?.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id ?? null;
        const userId = await resolveUserId(customerId, (invoice.metadata as any)?.user_id);
        if (!userId) break;
        const paidAt = invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : new Date();
        await supabase.from('profiles').update({
          status: 'active',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          current_period_end: addDays(paidAt, 30),
        }).eq('user_id', userId);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const userId = await resolveUserId(customerId, (sub.metadata as any)?.user_id);
        if (!userId) break;
        const isActive = ['active', 'trialing'].includes(sub.status);
        const periodEnd = isActive
          ? addDays(new Date(), 30)
          : (sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null);
        await supabase.from('profiles').update({
          status: isActive ? 'active' : 'inactive',
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          current_period_end: periodEnd,
        }).eq('user_id', userId);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
        const userId = await resolveUserId(customerId, (sub.metadata as any)?.user_id);
        if (!userId) break;
        await supabase.from('profiles').update({
          status: 'inactive',
          current_period_end: new Date().toISOString(),
        }).eq('user_id', userId);
        break;
      }
      default:
        break;
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Webhook handler error:', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Handler error' }), { status: 500 });
  }
});
