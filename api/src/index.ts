import Stripe from 'stripe';

export interface Env {
  STRIPE_SECRET_KEY: string;
  RESEND_API_KEY?: string;
  JEB_APPLICATION_EMAIL?: string;
  CORS_ORIGIN?: string;
}

interface LineItemInput {
  id: string;
  name: string;
  priceCents: number;
  quantity: number;
}

interface CreateCheckoutBody {
  lineItems: LineItemInput[];
  successUrl: string;
  cancelUrl: string;
}

interface EmploymentApplication {
  [key: string]: string | boolean | undefined;
}

function corsHeaders(env: Env): HeadersInit {
  return {
    'Access-Control-Allow-Origin': env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data: unknown, env: Env, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(env),
    },
  });
}

function errorResponse(message: string, env: Env, status = 500): Response {
  return jsonResponse({ error: message }, env, status);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (method === 'POST' && path === '/api/create-checkout-session') {
      try {
        if (!env.STRIPE_SECRET_KEY) {
          return errorResponse('Stripe not configured', env, 500);
        }

        const body = (await request.json()) as CreateCheckoutBody;
        if (!body.lineItems || !Array.isArray(body.lineItems) || body.lineItems.length === 0) {
          return errorResponse('lineItems required', env, 400);
        }
        if (!body.successUrl || !body.cancelUrl) {
          return errorResponse('successUrl and cancelUrl required', env, 400);
        }

        const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });

        const lineItems = body.lineItems.map((item) => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name,
            },
            unit_amount: item.priceCents,
          },
          quantity: item.quantity,
        }));

        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: lineItems,
          success_url: body.successUrl,
          cancel_url: body.cancelUrl,
        });

        return jsonResponse({ url: session.url }, env);
      } catch (err) {
        console.error('Stripe error:', err);
        const msg = err instanceof Error ? err.message : 'Checkout failed';
        return errorResponse(msg, env, 500);
      }
    }

    if (method === 'POST' && path === '/api/submit-application') {
      try {
        const body = (await request.json()) as EmploymentApplication;
        const toEmail = env.JEB_APPLICATION_EMAIL || 'jebs@marziale.tech';
        const apiKey = env.RESEND_API_KEY;

        const bodyText = Object.entries(body)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');

        if (apiKey) {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              from: 'Jeb\'s Website <noreply@resend.dev>',
              to: [toEmail],
              subject: 'Employment Application - ' + (body.firstName || '') + ' ' + (body.lastName || ''),
              text: 'New employment application submitted:\n\n' + bodyText,
            }),
          });
          if (!res.ok) {
            const err = await res.text();
            throw new Error(err || 'Email send failed');
          }
        } else {
          console.log('Application received (no RESEND_API_KEY):', bodyText);
        }

        return jsonResponse({ success: true }, env);
      } catch (err) {
        console.error('Application submit error:', err);
        const msg = err instanceof Error ? err.message : 'Submission failed';
        return errorResponse(msg, env, 500);
      }
    }

    if (method === 'GET' && (path === '/api/health' || path === '/')) {
      return jsonResponse({ status: 'ok', service: 'jebs-api' }, env);
    }

    return errorResponse('Not found', env, 404);
  },
};
