import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function stripeGet(path: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!STRIPE_SECRET_KEY) throw new Error('Stripe no configurado');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const sessionId: string | undefined = body?.sessionId;

    let newStatus: 'active' | 'inactive' = 'inactive';
    let subscriptionId: string | null = null;
    let customerId: string | null = null;

    if (sessionId) {
      const session = await stripeGet(`/checkout/sessions/${sessionId}`);
      if (session?.metadata?.user_id && session.metadata.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Sesión no válida' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      customerId = session?.customer ?? null;
      subscriptionId = session?.subscription ?? null;
      if (subscriptionId) {
        const sub = await stripeGet(`/subscriptions/${subscriptionId}`);
        newStatus = ['active', 'trialing'].includes(sub?.status) ? 'active' : 'inactive';
      } else if (session?.payment_status === 'paid') {
        newStatus = 'active';
      }
    } else {
      // Fallback: look up existing customer/subscription
      const { data: profile } = await supabase.from('profiles').select('stripe_customer_id, stripe_subscription_id').eq('user_id', user.id).single();
      customerId = profile?.stripe_customer_id ?? null;
      subscriptionId = profile?.stripe_subscription_id ?? null;
      if (subscriptionId) {
        const sub = await stripeGet(`/subscriptions/${subscriptionId}`);
        newStatus = ['active', 'trialing'].includes(sub?.status) ? 'active' : 'inactive';
      } else if (customerId) {
        const list = await stripeGet(`/subscriptions?customer=${customerId}&status=all&limit=1`);
        const sub = list?.data?.[0];
        if (sub) {
          subscriptionId = sub.id;
          newStatus = ['active', 'trialing'].includes(sub.status) ? 'active' : 'inactive';
        }
      }
    }

    const patch: Record<string, unknown> = { status: newStatus };
    if (customerId) patch.stripe_customer_id = customerId;
    if (subscriptionId) patch.stripe_subscription_id = subscriptionId;
    await supabase.from('profiles').update(patch).eq('user_id', user.id);

    return new Response(JSON.stringify({ status: newStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('verify-checkout-session', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
