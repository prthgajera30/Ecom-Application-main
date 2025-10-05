
import { Router } from 'express';
import { z } from 'zod';
import Stripe from 'stripe';
import { prisma, Session, Product } from '../db';
import { AuthPayload } from '../middleware/auth';

const router = Router();
const secret = process.env.STRIPE_SECRET_KEY || 'sk_test_xxx';
const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_xxx');
const stripe = new Stripe(secret);

type SessionCartItem = {
  productId: string;
  qty: number;
  variantId?: string;
  variantLabel?: string;
  variantOptions?: Record<string, string>;
  unitPrice?: number;
};

const createSchema = z.object({
  currency: z.string().min(3).max(8).default('usd'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const finalizeSchema = z.object({
  checkoutSessionId: z.string().min(10),
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
    variantId: item.variantId ? String(item.variantId) : undefined,
    variantLabel: item.variantLabel ? String(item.variantLabel) : undefined,
    variantOptions: item.variantOptions && typeof item.variantOptions === 'object' ? item.variantOptions : undefined,
    unitPrice: Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : undefined,
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

function resolveVariantPricing(product: any, item: SessionCartItem) {
  const variant = item.variantId ? product?.variants?.find((v: any) => String(v.variantId) === String(item.variantId)) : undefined;
  const unitPrice = Number.isFinite(item.unitPrice) ? Number(item.unitPrice) : Number(variant?.price ?? product?.price ?? 0);
  const label = item.variantLabel || variant?.label || undefined;
  const options = item.variantOptions || variant?.options || undefined;
  const variantId = variant ? String(variant.variantId) : item.variantId;
  return { variant, variantId, unitPrice, label, options };
}

async function handleCheckoutCompleted(
  stripeSession: Stripe.Checkout.Session,
  req: any
): Promise<{ orderId?: string; cartCleared: boolean; status?: string } | null> {
  if (!isStripeConfigured) return null;
  const sessionId = (stripeSession.metadata?.sessionId as string) || (stripeSession.client_reference_id as string) || undefined;
  if (!sessionId) return null;

  const sessionDoc = await Session.findOne({ sessionId });
  const cartItems = getCartItems(sessionDoc);
  if (!cartItems.length) return null;

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

  if (!userId) return null;

  await ensureSessionUser(sessionDoc, userId);

  const paymentIntentId = typeof stripeSession.payment_intent === 'string'
    ? stripeSession.payment_intent
    : stripeSession.payment_intent?.id;

  const paymentStatus = stripeSession.payment_status || 'paid';
  const isPaid = paymentStatus === 'paid';

  if (paymentIntentId) {
    const existingPayment = await prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntentId },
      include: { order: { select: { id: true, status: true } } },
    });
    if (existingPayment) {
      if (isPaid) {
        await clearSessionCart(sessionDoc);
        const io = req.app.get('io');
        if (io) {
          io.to('inventory').emit('cart:updated', { sessionId, items: [] });
          io.to(`session:${sessionId}`).emit('cart:updated', { items: [] });
        }
      }
      return {
        orderId: existingPayment.orderId,
        cartCleared: isPaid,
        status: existingPayment.order?.status,
      };
    }
  }

  const productIds = Array.from(new Set(cartItems.map((item) => item.productId)));
  const products = await Product.find({ _id: { $in: productIds } }).exec();
  const productMap = new Map<string, any>();
  for (const doc of products) {
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    productMap.set(String(obj._id), obj);
  }

  const orderItems: {
    productId: string;
    title?: string;
    price: number;
    qty: number;
    variantId?: string | null;
    variantLabel?: string | null;
    variantOptions?: any;
  }[] = [];
  let total = 0;

  for (const item of cartItems) {
    const product = productMap.get(item.productId);
    if (!product) continue;
    const qty = Math.max(1, item.qty);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const { variantId, unitPrice, label, options } = resolveVariantPricing(product, item);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) continue;
    total += qty * unitPrice;
    orderItems.push({
      productId: String(product._id),
      title: product.title,
      price: Math.round(unitPrice),
      qty,
      variantId: variantId || null,
      variantLabel: label || null,
      variantOptions: options || null,
    });
  }

  if (!orderItems.length) return null;

  const currency = (stripeSession.currency || products[0]?.currency || 'usd').toLowerCase();

  const order = await prisma.$transaction(async (tx) => {
    const createdOrder = await tx.order.create({
      data: {
        userId,
        sessionId,
        total,
        currency,
        status: isPaid ? 'paid' : 'pending',
      },
    });

    // Create order items
    for (const item of orderItems) {
      await tx.orderItem.create({
        data: {
          orderId: createdOrder.id,
          productId: item.productId,
          title: item.title,
          price: item.price,
          qty: item.qty,
          variantId: item.variantId,
          variantLabel: item.variantLabel,
          variantOptions: item.variantOptions,
        },
      });
    }

    if (paymentIntentId) {
      await tx.payment.create({
        data: {
          orderId: createdOrder.id,
          stripePaymentIntentId: paymentIntentId,
          amount: stripeSession.amount_total ?? total,
          status: paymentStatus,
        },
      });
    }

    return createdOrder;
  });

  let cartCleared = false;
  if (isPaid) {
    await clearSessionCart(sessionDoc);
    cartCleared = true;
    const io = req.app.get('io');
    if (io) {
      io.to('inventory').emit('cart:updated', { sessionId, items: [] });
      io.to(`session:${sessionId}`).emit('cart:updated', { items: [] });
      io.to(`user:${userId}`).emit('order:paid', {
        orderId: order.id,
        total: order.total,
        currency: order.currency,
        status: order.status,
        items: orderItems,
      });
    }
  }

  return { orderId: order.id, cartCleared, status: order.status };
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

  const productIds = Array.from(new Set(cartItems.map((item) => item.productId)));
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
    const { variantId, unitPrice, label } = resolveVariantPricing(product, item);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) continue;
    const productName = label ? `${product.title || 'Product'} (${label})` : product.title || 'Product';
    const metadata: Record<string, string> = { productId: String(product._id) };
    if (variantId) metadata.variantId = variantId;
    lineItems.push({
      price_data: {
        currency: parse.data.currency,
        product_data: {
          name: productName,
          metadata,
        },
        unit_amount: Math.round(unitPrice),
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

router.post('/checkout/finalize', async (req, res) => {
  if (!isStripeConfigured) {
    return res.status(503).json({ error: 'STRIPE_NOT_CONFIGURED' });
  }
  const parse = finalizeSchema.safeParse(req.body || {});
  if (!parse.success) {
    return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  }

  try {
    const stripeSession = await stripe.checkout.sessions.retrieve(parse.data.checkoutSessionId, {
      expand: ['payment_intent'],
    });

    if (!stripeSession) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND' });
    }

    const metadataSessionId = (stripeSession.metadata?.sessionId as string) || (stripeSession.client_reference_id as string) || undefined;
    const requestSessionId = getSessionId(req);
    if (metadataSessionId && requestSessionId && metadataSessionId !== requestSessionId) {
      return res.status(403).json({ error: 'SESSION_MISMATCH' });
    }

    const result = await handleCheckoutCompleted(stripeSession, req);
    if (!result) {
      return res.status(202).json({ pending: true });
    }

    return res.json({ success: true, ...result, status: result.status ?? stripeSession.payment_status });
  } catch (err) {
    console.error('Failed to finalize checkout session', err);
    return res.status(500).json({ error: 'FINALIZE_FAILED' });
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
