// @ts-nocheck
import { prisma } from '../db';
import { shippingProviders } from './shipping-providers';

export interface OrderTrackingInfo {
  orderId: string;
  trackingNumber: string;
  carrier: string;
  carrierName: string;
  shippingStatus: string;
  trackingUrl: string;
  shippedAt?: Date;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  events: Array<{
    id: string;
    status: string;
    description: string;
    location?: string;
    timestamp: Date;
  }>;
}

export class OrderTrackingService {
  /**
   * Update order with shipping/tracking information
   */
  static async updateOrderShipping(
    orderId: string,
    updates: {
      trackingNumber?: string;
      carrier?: string;
      shippingStatus?: string;
      trackingUrl?: string;
      shippedAt?: Date;
      estimatedDelivery?: Date;
      actualDelivery?: Date;
      shippingNotes?: string;
      packageWeight?: number;
    },
    userId?: string
  ): Promise<OrderTrackingInfo> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: updates,
      include: {
        trackingEvents: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    // Generate tracking URL if we have tracking number and carrier
    if (order.trackingNumber && order.carrier) {
      const trackingUrl = shippingProviders.getTrackingUrl(order.carrier, order.trackingNumber);
      if (trackingUrl && !order.trackingUrl) {
        await prisma.order.update({
          where: { id: orderId },
          data: { trackingUrl }
        });
        order.trackingUrl = trackingUrl;
      }
    }

    return this.formatOrderTracking(order);
  }

  /**
   * Get detailed tracking information for an order
   */
  static async getOrderTracking(orderId: string): Promise<OrderTrackingInfo | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        trackingEvents: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!order || !order.trackingNumber) {
      return null;
    }

    return this.formatOrderTracking(order);
  }

  /**
   * Sync tracking information with shipping provider
   */
  static async syncTrackingInfo(orderId: string): Promise<OrderTrackingInfo> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        trackingEvents: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (!order.trackingNumber || !order.carrier) {
      throw new Error('Order does not have tracking information');
    }

    try {
      // Get latest tracking info from provider
      const providerInfo = await shippingProviders.getTrackingInfo(order.carrier, order.trackingNumber);

      // Update order with latest info
      const updates: any = {
        // providerInfo.status is a string; cast to any so Prisma enum typing is satisfied at runtime
        shippingStatus: providerInfo.status as any,
        estimatedDelivery: providerInfo.estimatedDelivery ?? undefined,
      };

      // Mark as delivered if status shows delivered and we haven't recorded it yet
      if (providerInfo.status === 'delivered' && !order.actualDelivery) {
        updates.actualDelivery = providerInfo.estimatedDelivery || new Date();
      }

      // Update order status
      await prisma.order.update({
        where: { id: orderId },
        data: updates
      });

      // Create new tracking events for any we don't have
      const existingEventIds = new Set(order.trackingEvents.map(e => `${e.carrier}-${e.status}-${e.timestamp.getTime()}`));

      for (const event of providerInfo.events) {
        const eventKey = `${event.status}-${event.timestamp.getTime()}`;

        if (!existingEventIds.has(eventKey)) {
          await prisma.trackingEvent.create({
            data: {
              orderId,
              carrier: order.carrier,
              status: event.status,
              description: event.description,
              location: event.location,
              timestamp: event.timestamp,
              details: event.details || {}
            }
          });
        }
      }

      // Fetch updated order
      const updatedOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          trackingEvents: {
            orderBy: { timestamp: 'desc' }
          }
        }
      });

      return this.formatOrderTracking(updatedOrder!);

    } catch (error) {
      console.error(`Failed to sync tracking for order ${orderId}:`, error);
      // Return existing tracking info on sync failure
      return this.formatOrderTracking(order);
    }
  }

  /**
   * Mark order as shipped with tracking information
   */
  static async markOrderAsShipped(
    orderId: string,
    trackingNumber: string,
    carrier: string,
    estimatedDelivery?: Date,
    shippingNotes?: string,
    packageWeight?: number,
    userId?: string
  ): Promise<OrderTrackingInfo> {
    const trackingUrl = shippingProviders.getTrackingUrl(carrier, trackingNumber);

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        trackingNumber,
        carrier,
        shippingStatus: 'shipped',
        trackingUrl,
        shippedAt: new Date(),
        estimatedDelivery,
        shippingNotes,
        packageWeight
      },
      include: {
        trackingEvents: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    // Create initial tracking event
    await prisma.trackingEvent.create({
      data: {
        orderId,
        carrier,
        status: 'shipped',
        description: 'Order shipped and tracking information provided',
        timestamp: new Date(),
        details: {
          manuallyShipped: true,
          shippingNotes,
          packageWeight,
          userId
        }
      }
    });

    return this.formatOrderTracking(order);
  }

  /**
   * Mark order as delivered
   */
  static async markOrderAsDelivered(orderId: string): Promise<OrderTrackingInfo> {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        shippingStatus: 'delivered',
        actualDelivery: new Date()
      },
      include: {
        trackingEvents: {
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    // Create delivery tracking event
    await prisma.trackingEvent.create({
      data: {
        orderId,
        carrier: order.carrier || 'unknown',
        status: 'delivered',
        description: 'Package delivered successfully',
        timestamp: new Date(),
        details: {
          manuallyDelivered: true
        }
      }
    });

    return this.formatOrderTracking(order);
  }

  /**
   * Get all orders with pending shipping status
   */
  static async getOrdersPendingShipment(limit: number = 50): Promise<Array<{
    id: string;
    userEmail: string;
    createdAt: Date;
    total: number;
    shippingAddress: any;
  }>> {
    const orders = await prisma.order.findMany({
      where: {
        status: 'paid',
        shippingStatus: null
      },
      include: {
        user: {
          select: { email: true }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    });

    return orders.map(order => ({
      id: order.id,
      userEmail: order.user.email,
      createdAt: order.createdAt,
      total: order.total,
      shippingAddress: order.shippingAddress
    }));
  }

  /**
   * Get orders currently in transit
   */
  static async getOrdersInTransit(limit: number = 50): Promise<Array<{
    id: string;
    userEmail: string;
    trackingNumber: string;
    carrier: string;
    estimatedDelivery?: Date;
    shippedAt?: Date;
  }>> {
    const orders = await prisma.order.findMany({
      where: {
        status: 'paid',
        shippingStatus: { in: ['shipped', 'in_transit', 'out_for_delivery'] }
      },
      include: {
        user: {
          select: { email: true }
        }
      },
      orderBy: { shippedAt: 'asc' },
      take: limit
    });

    return orders.map(order => ({
      id: order.id,
      userEmail: order.user.email,
      trackingNumber: order.trackingNumber!,
      carrier: order.carrier!,
      // ensure null is converted to undefined for compatibility with consumers
      estimatedDelivery: order.estimatedDelivery ?? undefined,
      shippedAt: order.shippedAt ?? undefined
    }));
  }

  private static formatOrderTracking(order: any): OrderTrackingInfo {
    const provider = shippingProviders.getProvider(order.carrier);
    const carrierName = provider?.carrierName || order.carrier || 'Unknown';

    return {
      orderId: order.id,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      carrierName,
      shippingStatus: order.shippingStatus || 'pending',
      trackingUrl: order.trackingUrl || '',
      shippedAt: order.shippedAt,
      estimatedDelivery: order.estimatedDelivery,
      actualDelivery: order.actualDelivery,
      events: order.trackingEvents.map((event: any) => ({
        id: event.id,
        status: event.status,
        description: event.description,
        location: event.location,
        timestamp: event.timestamp
      }))
    };
  }
}
