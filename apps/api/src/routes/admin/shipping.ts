import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/admin';
import { OrderTrackingService } from '../../services/order-tracking';
import { z } from 'zod';

const router = Router();

function getErrorMessage(e: unknown): string | undefined {
  if (!e) return undefined;
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  return undefined;
}

// All routes require authentication and admin access
router.use(requireAuth);
router.use(requireAdmin);

// Get orders pending shipment (ready for shipping)
router.get('/pending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const orders = await OrderTrackingService.getOrdersPendingShipment(limit);

    res.json({
      orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders pending shipment' });
  }
});

// Get orders currently in transit
router.get('/in-transit', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const orders = await OrderTrackingService.getOrdersInTransit(limit);

    res.json({
      orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Error fetching in-transit orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders in transit' });
  }
});

// Mark order as shipped with tracking info
router.post('/:orderId/ship', async (req, res) => {
  try {
    const schema = z.object({
      trackingNumber: z.string().min(1, 'Tracking number is required'),
      carrier: z.enum(['fedex', 'ups', 'usps', 'dhl'], {
        errorMap: () => ({ message: 'Carrier must be fedex, ups, usps, or dhl' })
      }),
      estimatedDelivery: z.string().datetime().optional(),
      shippingNotes: z.string().optional(),
      packageWeight: z.number().positive().optional()
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parse.error.flatten()
      });
    }

    const { orderId } = req.params;
    const { trackingNumber, carrier, estimatedDelivery, shippingNotes, packageWeight } = parse.data;

    const trackingInfo = await OrderTrackingService.markOrderAsShipped(
      orderId,
      trackingNumber,
      carrier,
      estimatedDelivery ? new Date(estimatedDelivery) : undefined,
      shippingNotes,
      packageWeight,
        (req as any).user?.userId
    );

    res.json({
      success: true,
      message: `Order ${orderId} marked as shipped with tracking`,
      tracking: trackingInfo
    });
  } catch (error) {
    console.error('Error marking order as shipped:', error);
      const msg = getErrorMessage(error);
      if (msg && msg.includes('not found')) {
        return res.status(404).json({ error: msg });
      }
      res.status(500).json({ error: msg || 'Failed to mark order as shipped' });
  }
});

// Update order tracking information
router.put('/:orderId/tracking', async (req, res) => {
  try {
    const schema = z.object({
      trackingNumber: z.string().optional(),
      carrier: z.enum(['fedex', 'ups', 'usps', 'dhl']).optional(),
      shippingStatus: z.enum(['pending', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'failed_delivery', 'returned']).optional(),
      estimatedDelivery: z.string().datetime().optional(),
      shippingNotes: z.string().optional(),
      packageWeight: z.number().positive().optional()
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parse.error.flatten()
      });
    }

    const { orderId } = req.params;
    const updates = parse.data;

    // Convert estimatedDelivery string to Date if provided
    const updateData: any = { ...updates };
    if (updates.estimatedDelivery) {
      updateData.estimatedDelivery = new Date(updates.estimatedDelivery);
    }

    const trackingInfo = await OrderTrackingService.updateOrderShipping(
      orderId,
      updateData,
        (req as any).user?.userId
    );

    res.json({
      success: true,
      message: 'Tracking information updated',
      tracking: trackingInfo
    });
  } catch (error) {
    console.error('Error updating tracking:', error);
      const msg = getErrorMessage(error);
      if (msg && msg.includes('not found')) {
        return res.status(404).json({ error: msg });
      }
      res.status(500).json({ error: msg || 'Failed to update tracking' });
  }
});

// Mark order as delivered
router.post('/:orderId/deliver', async (req, res) => {
  try {
    const { orderId } = req.params;

    const trackingInfo = await OrderTrackingService.markOrderAsDelivered(orderId);

    res.json({
      success: true,
      message: `Order ${orderId} marked as delivered`,
      tracking: trackingInfo
    });
  } catch (error) {
    console.error('Error marking order as delivered:', error);
      const msg = getErrorMessage(error);
      if (msg && msg.includes('not found')) {
        return res.status(404).json({ error: msg });
      }
      res.status(500).json({ error: msg || 'Failed to mark order as delivered' });
  }
});

// Get detailed tracking information
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const trackingInfo = await OrderTrackingService.getOrderTracking(orderId);
    if (!trackingInfo) {
      return res.status(404).json({ error: 'No tracking information found for this order' });
    }

    res.json({ tracking: trackingInfo });
  } catch (error) {
    console.error('Error fetching tracking info:', error);
      const msg = getErrorMessage(error);
      if (msg && msg.includes('not found')) {
        return res.status(404).json({ error: msg });
      }
      res.status(500).json({ error: 'Failed to fetch tracking information' });
  }
});

// Sync tracking information with carrier
router.post('/:orderId/sync', async (req, res) => {
  try {
    const { orderId } = req.params;

    const trackingInfo = await OrderTrackingService.syncTrackingInfo(orderId);

    res.json({
      success: true,
      message: 'Tracking information synced with carrier',
      tracking: trackingInfo
    });
  } catch (error) {
    console.error('Error syncing tracking:', error);
      const msg = getErrorMessage(error);
      if (msg && msg.includes('not found')) {
        return res.status(404).json({ error: msg });
      }
      res.status(500).json({ error: msg || 'Failed to sync tracking' });
  }
});

export default router;
