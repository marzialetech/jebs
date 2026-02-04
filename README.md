# Jeb's Restaurant of Lowville

Website for Jeb's Restaurant of Lowville, NY. A minimal, single-page site with menu, hours, and Stripe checkout.

## About

Family owned and operated by Emerson and Jennifer (Lehman) Metzler since November 4th, 2002.

**Address:** 5403 Shady Ave, Lowville, NY 13367  
**Phone:** (315) 376-6029  
**Facebook:** [JebsRestaurant](https://www.facebook.com/JebsRestaurant/)

## Local development

Open `index.html` in a browser or serve with any static file server.

## Stripe checkout

The Order page includes a full menu with add-to-cart and Stripe Checkout. To enable:

1. **Deploy the API worker** (see `api/DEPLOYMENT.md`):
   ```bash
   cd api && npm install && npx wrangler secret put STRIPE_SECRET_KEY
   ```
   Use your Stripe key from [dashboard.stripe.com](https://dashboard.stripe.com/apikeys).

2. **Deploy the worker:**
   ```bash
   npm run deploy
   ```

3. **Configure the API URL** in `index.html` if using a custom domain.

4. **Local testing:** Run `npm run dev` in the `api` folder. The frontend auto-uses `localhost:8787` when opened from localhost.

## Employment applications

The Apply page offers a PDF download or online form submission. To receive applications via email:

1. Create an account at [resend.com](https://resend.com) and get an API key.
2. Set secrets:
   ```bash
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put JEB_APPLICATION_EMAIL   # e.g. jebs@jebsrestaurant.com
   ```
3. Redeploy the API. Without these secrets, submissions are logged but not emailed.
