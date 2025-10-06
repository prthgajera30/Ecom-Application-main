import express from 'express';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';
import Stripe from 'stripe';

const router = express.Router();
const secret = process.env.STRIPE_SECRET_KEY || 'sk_test_xxx';
const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_xxx');
const stripe = new Stripe(secret);

// Create payment method schema
const createPaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method ID is required'),
});

// Update payment method schema (for setting as default)
const updatePaymentMethodSchema = z.object({
  isDefault: z.boolean().optional(),
});

// Get user's payment methods
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const paymentMethods = await (prisma as any).paymentMethod.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Return card details safely (mask sensitive info but keep what's needed)
    const safePaymentMethods = paymentMethods.map((pm: any) => ({
      id: pm.id,
      stripePaymentMethodId: pm.stripePaymentMethodId,
      cardBrand: pm.cardBrand,
      last4: pm.last4,
      expiryMonth: pm.expiryMonth,
      expiryYear: pm.expiryYear,
      isDefault: pm.isDefault,
      createdAt: pm.createdAt,
    }));

    res.json(safePaymentMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

// Create payment method
router.post('/', requireAuth, async (req, res) => {
  if (!isStripeConfigured) {
    return res.status(503).json({
      error: 'STRIPE_NOT_CONFIGURED',
      message: 'Stripe test keys are not configured.'
    });
  }

  try {
    const userId = (req as any).user.userId;
    const validatedData = createPaymentMethodSchema.parse(req.body);
    const { paymentMethodId } = validatedData;

    // Retrieve payment method details from Stripe
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Verify it's a valid card
    if (paymentMethod.type !== 'card' || !paymentMethod.card) {
      return res.status(400).json({ error: 'Only card payment methods are supported' });
    }

    const card = paymentMethod.card;
    const { brand, last4, exp_month, exp_year } = card;

    // If this is set as default, remove default from other payment methods
    if (req.body.isDefault) {
      await (prisma as any).paymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    // Check if this payment method is already saved
    const existing = await (prisma as any).paymentMethod.findUnique({
      where: { stripePaymentMethodId: paymentMethodId }
    });

    if (existing) {
      return res.status(409).json({ error: 'Payment method already saved' });
    }

    // Create the payment method record
    const paymentMethodRecord = await (prisma as any).paymentMethod.create({
      data: {
        userId,
        stripePaymentMethodId: paymentMethodId,
        cardBrand: brand,
        last4,
        expiryMonth: exp_month,
        expiryYear: exp_year,
        isDefault: req.body.isDefault || false,
      }
    });

    // Return safe data
    const safeResponse = {
      id: paymentMethodRecord.id,
      stripePaymentMethodId: paymentMethodRecord.stripePaymentMethodId,
      cardBrand: paymentMethodRecord.cardBrand,
      last4: paymentMethodRecord.last4,
      expiryMonth: paymentMethodRecord.expiryMonth,
      expiryYear: paymentMethodRecord.expiryYear,
      isDefault: paymentMethodRecord.isDefault,
      createdAt: paymentMethodRecord.createdAt,
    };

    res.status(201).json(safeResponse);
  } catch (error) {
    console.error('Error creating payment method:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      const msg = (error as any)?.message;
      if (msg) return res.status(400).json({ error: msg });
      res.status(500).json({ error: 'Failed to create payment method' });
    }
  }
});

// Update payment method (mainly for setting/clearing default)
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const validatedData = updatePaymentMethodSchema.parse(req.body);

    // Find the payment method
    const existingPaymentMethod = await prisma.paymentMethod.findFirst({
      where: { id, userId }
    });

    if (!existingPaymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // If setting as default, remove default from other payment methods
    if (validatedData.isDefault) {
      await prisma.paymentMethod.updateMany({
        where: {
          userId,
          id: { not: id }
        },
        data: { isDefault: false }
      });
    }

    const updatedPaymentMethod = await prisma.paymentMethod.update({
      where: { id },
      data: validatedData
    });

    // Return safe data
    const safeResponse = {
      id: updatedPaymentMethod.id,
      stripePaymentMethodId: updatedPaymentMethod.stripePaymentMethodId,
      cardBrand: updatedPaymentMethod.cardBrand,
      last4: updatedPaymentMethod.last4,
      expiryMonth: updatedPaymentMethod.expiryMonth,
      expiryYear: updatedPaymentMethod.expiryYear,
      isDefault: updatedPaymentMethod.isDefault,
      createdAt: updatedPaymentMethod.createdAt,
    };

    res.json(safeResponse);
  } catch (error) {
    console.error('Error updating payment method:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update payment method' });
    }
  }
});

// Delete payment method
router.delete('/:id', requireAuth, async (req, res) => {
  if (!isStripeConfigured) {
    return res.status(503).json({
      error: 'STRIPE_NOT_CONFIGURED',
      message: 'Stripe test keys are not configured.'
    });
  }

  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Find the payment method
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id, userId }
    });

    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Try to detach from Stripe (optional, but good practice)
    try {
      if (paymentMethod.stripePaymentMethodId) {
        await stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);
      }
    } catch (stripeError) {
      console.warn('Failed to detach payment method from Stripe:', stripeError);
      // Don't fail the operation if Stripe detach fails
    }

    // Delete from database
    await prisma.paymentMethod.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Payment method deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

// Set payment method as default
router.patch('/:id/default', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Find the payment method
    const existingPaymentMethod = await prisma.paymentMethod.findFirst({
      where: { id, userId }
    });

    if (!existingPaymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Remove default from all payment methods for this user
    await prisma.paymentMethod.updateMany({
      where: { userId },
      data: { isDefault: false }
    });

    // Set this payment method as default
    const paymentMethod = await prisma.paymentMethod.update({
      where: { id },
      data: { isDefault: true }
    });

    // Return safe data
    const safeResponse = {
      id: paymentMethod.id,
      stripePaymentMethodId: paymentMethod.stripePaymentMethodId,
      cardBrand: paymentMethod.cardBrand,
      last4: paymentMethod.last4,
      expiryMonth: paymentMethod.expiryMonth,
      expiryYear: paymentMethod.expiryYear,
      isDefault: paymentMethod.isDefault,
      createdAt: paymentMethod.createdAt,
    };

    res.json(safeResponse);
  } catch (error) {
    console.error('Error setting default payment method:', error);
    res.status(500).json({ error: 'Failed to set default payment method' });
  }
});

export default router;
