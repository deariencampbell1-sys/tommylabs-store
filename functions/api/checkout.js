// Tommy Labs store — Stripe Checkout Session creator (Cloudflare Pages Function)
// POST /api/checkout  body: { items: [ { id: 1, qty: 2 }, ... ] }
// Returns { url } — client redirects to Stripe Checkout.
//
// Product id -> Stripe Price id mapping (test mode).
// Flip STRIPE_MODE=live in Pages vars and the live price map to go live.

const PRICES = {
  test: {
    1: 'price_1U5AY54D2CG0L4S6DU0BRpOT', // Low-Poly Batman Bust $45
    2: 'price_1U5AY64D2CG0L4S6GxJD7Rmk', // Articulated Flexi Dragon $38
    3: 'price_1U5AY64D2CG0L4S6a9fuKfCo', // 3D Printed Wolf $36
    4: 'price_1U5AY74D2CG0L4S6d7U97sDw', // 3D Printed Tiger $40
  },
  live: {
    // TODO: fill after live products/prices are created
  },
};

export async function onRequestPost(context) {
  const { request, env } = context;

  const mode = (env.STRIPE_MODE || 'test').toLowerCase();
  const secretKey = mode === 'live' ? env.STRIPE_LIVE_SECRET_KEY : env.STRIPE_TEST_SECRET_KEY;
  if (!secretKey) {
    return json({ error: 'Stripe secret key not configured on server.' }, 500);
  }
  const prices = PRICES[mode] || PRICES.test;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return json({ error: 'Cart is empty.' }, 400);
  }

  const origin = new URL(request.url).origin;
  const lineItems = [];
  for (const it of items) {
    const price = prices[it.id];
    if (!price) return json({ error: `Unknown product id ${it.id}` }, 400);
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    lineItems.push({ price, quantity: qty });
  }

  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}/index.html#shop`);
  params.set('client_reference_id', `tommylabs-${Date.now()}`);
  params.set('allow_promotion_codes', 'true');
  lineItems.forEach((li, i) => {
    params.append(`line_items[${i}][price]`, li.price);
    params.append(`line_items[${i}][quantity]`, String(li.quantity));
  });

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await resp.json();
  if (!resp.ok) {
    return json({ error: data.error?.message || 'Stripe checkout failed.' }, 502);
  }
  return json({ url: data.url });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
