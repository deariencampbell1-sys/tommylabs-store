// Tommy Labs store — Stripe Checkout Session creator (Cloudflare Pages Function)
// POST /api/checkout  body: { items: [ { id: 1, qty: 2 }, ... ], shipping?: 'standard'|'express' }
// Returns { url } — client redirects to Stripe Checkout.
//
// Defaults to LIVE mode (STRIPE_LIVE_SECRET_KEY). Set STRIPE_MODE=test to use
// STRIPE_TEST_SECRET_KEY instead. Both modes charge the SAME amounts — the
// prices live here as inline price_data (unit_amount in cents), so a price
// change is a one-line edit + deploy, never a Stripe dashboard round-trip.
//
// Prices include STANDARD shipping (a 5% bump absorbs USPS Ground Advantage
// on standard boxes — we eat the loss on some, gain on others). EXPRESS is a
// flat $25 add-on at checkout reflecting USPS Priority Mail Express.
//
// Every session sets payment_intent_data.statement_descriptor = 'TOMMY LABS'
// so card statements read Tommy Labs, never the RHOBEAR account descriptor.

// unit_amount is in CENTS. These are the base prices (+5% over the pre-shipping
// list) — standard shipping is built in, so standard delivery is free.
const CATALOG = {
  1: { name: 'Low-Poly Batman Bust',   amount: 4725, img: 'img/product-batman.webp' },
  2: { name: 'Articulated Flexi Dragon', amount: 3990, img: 'img/product-dragon.webp' },
  3: { name: '3D Printed Wolf',         amount: 3780, img: 'img/product-wolf-v2.webp' },
  4: { name: '3D Printed Tiger',        amount: 4200, img: 'img/product-tiger-v2.webp' },
};

export async function onRequestPost(context) {
  const { request, env } = context;

  const mode = (env.STRIPE_MODE || 'live').toLowerCase();
  const secretKey = mode === 'live' ? env.STRIPE_LIVE_SECRET_KEY : env.STRIPE_TEST_SECRET_KEY;
  if (!secretKey) {
    return json({ error: 'Stripe secret key not configured on server.' }, 500);
  }

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
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('success_url', `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}/index.html#shop`);
  params.set('client_reference_id', `tommylabs-${Date.now()}`);
  params.set('allow_promotion_codes', 'true');
  params.set('metadata[store]', 'tommylabs');
  params.set('payment_intent_data[statement_descriptor]', 'TOMMY LABS');
  params.set('payment_intent_data[description]', 'Tommy Labs 3D printed creations');

  // Build line items from the server-side catalog. The client only ever sends
  // an id + qty — the price is NEVER trusted from the client, it is looked up
  // here, so the cart cannot be tampered into a cheaper charge.
  let i = 0;
  for (const it of items) {
    const product = CATALOG[it.id];
    if (!product) return json({ error: `Unknown product id ${it.id}` }, 400);
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    params.append(`line_items[${i}][price_data][currency]`, 'usd');
    params.append(`line_items[${i}][price_data][unit_amount]`, String(product.amount));
    params.append(`line_items[${i}][price_data][product_data][name]`, product.name);
    params.append(`line_items[${i}][price_data][product_data][images][0]`, `${origin}/${product.img}`);
    params.append(`line_items[${i}][quantity]`, String(qty));
    i++;
  }

  // Ship to the US; collect the address so USPS has somewhere to go.
  params.append('shipping_address_collection[allowed_countries][0]', 'US');

  // Standard shipping is FREE (absorbed by the price). Express is a flat $25
  // reflecting USPS Priority Mail Express. Customer picks on the Stripe page.
  params.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  params.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', '0');
  params.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd');
  params.append('shipping_options[0][shipping_rate_data][display_name]', 'Standard shipping — free');
  params.append('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]', 'business_day');
  params.append('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]', '4');
  params.append('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]', 'business_day');
  params.append('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]', '9');

  params.append('shipping_options[1][shipping_rate_data][type]', 'fixed_amount');
  params.append('shipping_options[1][shipping_rate_data][fixed_amount][amount]', '2500');
  params.append('shipping_options[1][shipping_rate_data][fixed_amount][currency]', 'usd');
  params.append('shipping_options[1][shipping_rate_data][display_name]', 'Express — USPS Priority Mail Express');
  params.append('shipping_options[1][shipping_rate_data][delivery_estimate][minimum][unit]', 'business_day');
  params.append('shipping_options[1][shipping_rate_data][delivery_estimate][minimum][value]', '2');
  params.append('shipping_options[1][shipping_rate_data][delivery_estimate][maximum][unit]', 'business_day');
  params.append('shipping_options[1][shipping_rate_data][delivery_estimate][maximum][value]', '4');

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
