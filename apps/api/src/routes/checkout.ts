import { Router } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { prisma, Session, Product } from '../db';
import { AuthPayload } from '../middleware/auth';

const router = Router();
const secret = process.env.STRIPE_SECRET_KEY || 'sk_test_xxx';
const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_xxx');
const stripe = new Stripe(secret);

type SessionCartItem = { productId: string; qty: number };

const createSchema = z.object({
  currency: z.string().min(3).max(8).default('usd'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

function getSessionId(req: any) {
  return (req.headers['x-session-id'] as string) || undefined;
}

function resolveOrigin(req: any) {
  const headerOrigin = (req.headers['origin'] as string | undefined)?.replace(/\/$/, '');
  const envOrigin = process.env.APP_URL?.replace(/\/$/, '');
  return headerOrigin || envOrigin || 'http://localhost:3000';
}

function getCartItems(sessionDoc: any): SessionCartItem[] {
  if (!Array.isArray(sessionDoc?.cart?.items)) return [];
  return sessionDoc.cart.items.map((item: any) => ({
    productId: String(item.productId),
    qty: Number(item.qty || 0),
  }));
}

async function ensureSessionUser(sessionDoc: any, userId?: string) {
  if (!sessionDoc || !userId) return;
  if (sessionDoc.userId !== userId) {
    sessionDoc.userId = userId;
    sessionDoc.updatedAt = new Date();
    await sessionDoc.save();
  }
}

async function fetchUserEmail(userId?: string) {
  if (!userId) return undefined;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return user?.email || undefined;
}

async function clearSessionCart(sessionDoc: any | null) {
  if (!sessionDoc) return;
  sessionDoc.cart = { items: [] };
  sessionDoc.updatedAt = new Date();
  await sessionDoc.save();
}

async function handleCheckoutCompleted(stripeSession: Stripe.Checkout.Session, req: any) {
  if (!isStripeConfigured) return;
  const sessionId = (stripeSession.metadata?.sessionId as string) || (stripeSession.client_reference_id as string) || undefined;
  if (!sessionId) return;

  const sessionDoc = await Session.findOne({ sessionId });
  const cartItems = getCartItems(sessionDoc);
  if (!cartItems.length) return;

  let userId = sessionDoc?.userId || (stripeSession.metadata?.userId as string | undefined);
  let userEmail = stripeSession.metadata?.userEmail as string | undefined;

  if (!userId && stripeSession.customer_email) {
    const lookup = await prisma.user.findUnique({ where: { email: stripeSession.customer_email }, select: { id: true, email: true } });
    if (lookup) {
      userId = lookup.id;
      userEmail = lookup.email;
    }
  }

  if (!userId && userEmail) {
    const lookup = await prisma.user.findUnique({ where: { email: userEmail }, select: { id: true, email: true } });
    if (lookup) {
      userId = lookup.id;
      userEmail = lookup.email;
    }
  }

  if (!userId) return;

  await ensureSessionUser(sessionDoc, userId);

  const paymentIntentId = typeof stripeSession.payment_intent === 'string'
    ? stripeSession.payment_intent
    : stripeSession.payment_intent?.id;

  if (paymentIntentId) {
    const existingPayment = await prisma.payment.findFirst({ where: { stripePaymentIntentId: paymentIntentId } });
    if (existingPayment) {
      await clearSessionCart(sessionDoc);
      return;
    }
  }

  const productIds = cartItems.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } }).exec();
  const productMap = new Map<string, any>();
  for (const doc of products) {
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    productMap.set(String(obj._id), obj);
  }

  const orderItems: { productId: string; price: number; qty: number }[] = [];
  let total = 0;

  for (const item of cartItems) {
    const product = productMap.get(item.productId);
    if (!product) continue;
    const qty = Math.max(1, item.qty);
    const unitPrice = Math.max(0, Number(product.price) || 0);
    if (!unitPrice) continue;
    total += qty * unitPrice;
    orderItems.push({ productId: String(product._id), price: Math.round(unitPrice), qty });
  }

  if (!orderItems.length) return;

  const currency = (stripeSession.currency || products[0]?.currency || 'usd').toLowerCase();
  const paymentStatus = stripeSession.payment_status || 'paid';

  const order = await prisma.$transaction(async (tx) => {
    return tx.order.create({
      data: {
        userId,
        total,
        currency,
        status: paymentStatus === 'paid' ? 'paid' : 'pending',
        items: {
          create: orderItems,
        },
        ...(paymentIntentId
          ? {
              payment: {
                create: {
                  stripePaymentIntentId: paymentIntentId,
                  amount: stripeSession.amount_total ?? total,
                  status: paymentStatus,
                },
              },
            }
          : {}),
      },
      include: { items: true, payment: true },
    });
  });

  await clearSessionCart(sessionDoc);

  const io = req.app.get('io');
  if (io) {
    io.to('inventory').emit('cart:updated', { sessionId, items: [] });
    io.to(`session:${sessionId}`).emit('cart:updated', { items: [] });
    io.to(`user:${userId}`).emit('order:paid', {
      orderId: order.id,
      total: order.total,
      currency: order.currency,
      status: order.status,
      items: order.items,
    });
  }
}

router.post('/checkout/create-session', async (req, res) => {
  if (!isStripeConfigured) {
    return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED', message: 'Stripe test keys are not configured. Set STRIPE_SECRET_KEY before attempting checkout.' });
  }
  const parse = createSchema.safeParse(req.body || {});
  if (!parse.success) return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });

  const sessionId = getSessionId(req);
  if (!sessionId) return res.status(400).json({ error: 'SESSION_REQUIRED' });

  const sessionDoc = await Session.findOne({ sessionId });
  const cartItems = getCartItems(sessionDoc);
  if (!cartItems.length) return res.status(400).json({ error: 'EMPTY_CART' });

  const authUser = (req as any).user as AuthPayload | undefined;
  let userId = authUser?.userId || sessionDoc?.userId;
  const userEmail = await fetchUserEmail(userId);
  await ensureSessionUser(sessionDoc, userId);

  const productIds = cartItems.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: productIds } }).exec();
  const productMap = new Map<string, any>();
  for (const doc of products) {
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    productMap.set(String(obj._id), obj);
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  for (const item of cartItems) {
    const product = productMap.get(item.productId);
    if (!product) continue;
    const quantity = Math.max(1, item.qty);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const amount = Math.max(0, Number(product.price) || 0);
    if (amount <= 0) continue;
    lineItems.push({
      price_data: {
        currency: parse.data.currency,
        product_data: {
          name: product.title || 'Product',
          metadata: { productId: String(product._id) },
        },
        unit_amount: Math.round(amount),
      },
      quantity,
    });
  }

  if (!lineItems.length) return res.status(400).json({ error: 'INVALID_CART' });

  const origin = resolveOrigin(req);
  const successUrl = parse.data.successUrl || `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = parse.data.cancelUrl || `${origin}/checkout/cancel`;

  const metadata: Record<string, string> = { sessionId };
  if (userId) metadata.userId = userId;
  if (userEmail) metadata.userEmail = userEmail;

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: sessionId,
      customer_email: userEmail,
      metadata,
    });

    return res.json({ url: checkoutSession.url });
  } catch (err: any) {
    console.error('Failed to create checkout session', err);
    return res.status(500).json({ error: 'CHECKOUT_FAILED' });
  }
});

router.post('/webhooks/stripe', async (req, res) => {
  if (!isStripeConfigured) {
    return res.json({ received: true, skipped: true });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'] as string | undefined;

  let stripeEvent: Stripe.Event = req.body;
  if (secret && signature && (req as any).rawBody) {
    try {
      stripeEvent = stripe.webhooks.constructEvent((req as any).rawBody, signature, secret);
    } catch (err) {
      console.error('Invalid Stripe webhook signature', err);
      return res.status(400).json({ error: 'INVALID_SIGNATURE' });
    }
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const stripeSession = stripeEvent.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(stripeSession, req);
    }
  } catch (err) {
    console.error('Failed to process Stripe webhook', err);
  }

  res.json({ received: true });
});

export default router;
