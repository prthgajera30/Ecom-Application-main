import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../db';
import { z } from 'zod';

const router = Router();

const reorderSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

// Enhanced order fetching with items and tracking
router.get('/orders', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.userId as string;
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          select: {
            productId: true,
            title: true,
            price: true,
            qty: true,
            variantId: true,
            variantLabel: true,
            variantOptions: true,
          }
        },
        shippingOption: {
          select: {
            name: true,
            amount: true,
          }
        },
        trackingEvents: {
          orderBy: { timestamp: 'desc' },
          take: 3 // Just the most recent events for summary
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform for frontend with item and total calculations
    const enrichedOrders = orders.map((order) => ({
      id: order.id,
      status: order.status,
      total: order.total,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      shippingAmount: order.shippingAmount,
      currency: order.currency,
      createdAt: order.createdAt,
      shippingAddress: order.shippingAddress,
      shippingOption: order.shippingOption,
      items: order.items.map((item) => ({
        productId: item.productId,
        title: item.title,
        price: item.price,
        qty: item.qty,
        variantId: item.variantId,
        variantLabel: item.variantLabel,
        variantOptions: item.variantOptions,
      })),
      canReorder: order.status === 'paid', // Only allow reordering from paid orders
    }));

    res.json(enrichedOrders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/orders/:id', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.userId as string;
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, userId },
      include: {
        items: {
          select: {
            productId: true,
            title: true,
            price: true,
            qty: true,
            variantId: true,
            variantLabel: true,
            variantOptions: true,
          }
        },
        shippingOption: {
          select: {
            name: true,
            amount: true,
          }
        }
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Transform for frontend
    const enrichedOrder = {
      id: order.id,
      status: order.status,
      total: order.total,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      shippingAmount: order.shippingAmount,
      currency: order.currency,
      createdAt: order.createdAt,
      shippingAddress: order.shippingAddress,
      shippingOption: order.shippingOption,
      items: order.items.map((item) => ({
        productId: item.productId,
        title: item.title,
        price: item.price,
        qty: item.qty,
        variantId: item.variantId,
        variantLabel: item.variantLabel,
        variantOptions: item.variantOptions,
      })),
      canReorder: order.status === 'paid',
    };

    res.json(enrichedOrder);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// Quick reorder endpoint
router.post('/orders/:orderId/reorder', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.userId as string;
    const { orderId } = req.params;

    // Find the order and verify ownership
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: {
          select: {
            productId: true,
            qty: true,
            variantId: true,
            variantLabel: true,
            variantOptions: true,
          }
        }
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if order has items
    if (!order.items || order.items.length === 0) {
      return res.status(400).json({ error: 'Order has no items to reorder' });
    }

    if (order.status !== 'paid') {
      return res.status(400).json({ error: 'Can only reorder from completed orders' });
    }

    // Get cart session (simplified - in a real app you'd handle session management)
    // For now, we'll assume the cart is empty and we add all items

    // Transform order items to cart format
    const cartItems = order.items.map((item) => ({
      productId: item.productId,
      qty: item.qty,
      variantId: item.variantId || undefined,
      variantLabel: item.variantLabel || undefined,
      variantOptions: item.variantOptions ? item.variantOptions as Record<string, string> : undefined,
    }));

    // Note: In a real implementation, you'd need to:
    // 1. Get/create session ID for the user
    // 2. Clear existing cart or merge with existing items
    // 3. Add items to cart via existing cart endpoints
    // 4. Handle inventory validation

    res.json({
      success: true,
      message: 'Order items prepared for reordering',
      orderId: order.id,
      itemsPrepared: cartItems.length,
      cartItems,
      subtotal: order.subtotal,
      total: order.total,
      nextSteps: 'Redirect to cart or checkout with prepared items'
    });
  } catch (error) {
    console.error('Error preparing reorder:', error);
    res.status(500).json({ error: 'Failed to prepare reorder' });
  }
});

export default router;
