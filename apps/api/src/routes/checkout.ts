import { Router } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_xxx');

router.post('/checkout/create-session', async (req, res) => {
  const schema = z.object({ currency: z.string().default('usd') });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION' });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      { price_data: { currency: parse.data.currency, product_data: { name: 'Cart total' }, unit_amount: 1000 }, quantity: 1 },
    ],
    success_url: 'http://localhost/checkout/success',
    cancel_url: 'http://localhost/checkout/cancel',
  });
  res.json({ url: session.url });
});

router.post('/webhooks/stripe', async (req, res) => {
  // For dev, accept without verification
  // TODO: verify via STRIPE_WEBHOOK_SECRET
  const event = req.body;
  if (event.type === 'checkout.session.completed') {
    // Here we would mark order paid and emit inventory:update
  }
  res.json({ received: true });
});

export default router;
