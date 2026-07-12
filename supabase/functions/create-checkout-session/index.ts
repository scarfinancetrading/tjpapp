import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_PRICE_ID = Deno.env.get('STRIPE_PRICE_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function form(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function stripe(path: string, body?: Record<string, string>, method = 'POST'): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? form(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe error ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
      return new Response(JSON.stringify({ error: 'Stripe no configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'No autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const user = userData.user;

    const { origin } = await req.json().catch(() => ({ origin: '' }));
    const appOrigin: string = Deno.env.get('NEXT_PUBLIC_APP_URL') || origin || req.headers.get('origin') || '';

    // Reuse or create Stripe customer
    const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('user_id', user.id).single();
    let customerId = profile?.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe('/customers', { email: user.email ?? '', 'metadata[user_id]': user.id });
      customerId = customer.id;
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('user_id', user.id);
    }

    const session = await stripe('/checkout/sessions', {
      mode: 'subscription',
      customer: customerId!,
      'payment_method_types[0]': 'card',
      'line_items[0][price]': STRIPE_PRICE_ID,
      'line_items[0][quantity]': '1',
      success_url: `${appOrigin}/app?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appOrigin}/?checkout=cancel`,
      'metadata[user_id]': user.id,
      'subscription_data[metadata][user_id]': user.id,
      allow_promotion_codes: 'true',
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('create-checkout-session', err);
    return new Response(JSON.stringify({ error: err?.message ?? 'Error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
