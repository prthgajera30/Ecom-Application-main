import mongoose from 'mongoose';
import { Product, InventoryHistory } from '../db';
import { cache } from '../cache';

export interface StockAdjustment {
  productId: string;
  variantId?: string;
  change: number; // positive for stock in, negative for stock out
  reason: 'manual_adjustment' | 'order_fulfilled' | 'order_canceled' | 'order_refunded' | 'initial_stock';
  reference?: string; // order ID, adjustment note, etc.
  userId?: string; // admin user who made the change
  metadata?: Record<string, any>;
}

export interface InventoryStatus {
  productId: string;
  availableStock: number;
  reservedStock: number;
  totalStock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  variants?: Array<{
    variantId: string;
    availableStock: number;
    reservedStock?: number;
    totalStock: number;
    isLowStock: boolean;
  }>;
}

export class InventoryService {
  /**
   * Adjust stock for a product or variant
   */
  static async adjustStock(adjustment: StockAdjustment): Promise<InventoryStatus> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { productId, variantId, change, reason, reference, userId, metadata } = adjustment;

      // Find the product
      const product = await Product.findById(productId).session(session);
      if (!product) {
        throw new Error('Product not found');
      }

      if (!product.trackInventory) {
        throw new Error('Inventory tracking is disabled for this product');
      }

      if (!product.isActive) {
        throw new Error('Product is not active');
      }

      let previousStock: number;
      let newStock: number;
      let stockField: string;
      let stockPath: string;

      if (variantId) {
        // Adjust variant stock
        const variant = product.variants.find((v: any) => v.variantId === variantId);
        if (!variant) {
          throw new Error('Product variant not found');
        }

        previousStock = variant.stock || 0;
        newStock = Math.max(0, previousStock + change);
        variant.stock = newStock;
        stockField = 'variants.$.stock';
        stockPath = `variants.${variantId}.stock`;
      } else {
        // Adjust base product stock
        previousStock = product.stock || 0;
        newStock = Math.max(0, previousStock + change);
        product.stock = newStock;
        stockField = 'stock';
        stockPath = 'stock';
      }

      // Prevent negative stock unless it's a manual adjustment or special case
      if (newStock < 0 && !['manual_adjustment', 'initial_stock'].includes(reason)) {
        throw new Error('Insufficient stock available');
      }

      // Save the product
      await product.save({ session });

      // Create inventory history record
      await InventoryHistory.create([{
        productId,
        variantId,
        change,
        previousStock,
        newStock,
        reason,
        reference,
        userId,
        metadata: metadata || {}
      }], { session });

      await session.commitTransaction();

      // Invalidate cache for this product
      await cache.invalidateProduct(productId);

      // Return updated inventory status
      return await this.getInventoryStatus(productId);

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get inventory status for a product
   */
  static async getInventoryStatus(productId: string): Promise<InventoryStatus> {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const totalStock = product.stock || 0;
    const reservedStock = product.reservedStock || 0;
    const availableStock = Math.max(0, totalStock - reservedStock);
    const lowStockThreshold = product.lowStockThreshold || 10;
    const isLowStock = availableStock < lowStockThreshold;

    const result: InventoryStatus = {
      productId,
      availableStock,
      reservedStock,
      totalStock,
      lowStockThreshold,
      isLowStock
    };

    // Add variant information if they exist
    if (product.variants && product.variants.length > 0) {
      result.variants = product.variants.map((variant: any) => {
        const variantTotal = variant.stock || 0;
        const variantReserved = 0; // TODO: implement per-variant reservations if needed
        const variantAvailable = Math.max(0, variantTotal - variantReserved);
        const variantThreshold = product.lowStockThreshold || 10;
        const variantLowStock = variantAvailable < variantThreshold;

        return {
          variantId: variant.variantId,
          availableStock: variantAvailable,
          reservedStock: variantReserved,
          totalStock: variantTotal,
          isLowStock: variantLowStock
        };
      });
    }

    return result;
  }

  /**
   * Reserve stock for an order (temporary hold)
   */
  static async reserveStock(productId: string, variantId: string | undefined, quantity: number): Promise<void> {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.trackInventory) {
      return; // Skip reservation if not tracking inventory
    }

    const availableStock = variantId
      ? product.variants.find((v: any) => v.variantId === variantId)?.stock || 0
      : product.stock || 0;

    if (availableStock < quantity) {
      throw new Error('Insufficient stock available');
    }

    // Increment reserved stock
    if (variantId) {
      // TODO: implement per-variant reservation if needed
      // For now, we use the base product reserved stock
    } else {
      product.reservedStock = (product.reservedStock || 0) + quantity;
    }

    await product.save();

    // Invalidate cache
    await cache.invalidateProduct(productId);
  }

  /**
   * Release reserved stock (when order is canceled or refunded)
   */
  static async releaseStock(productId: string, variantId: string | undefined, quantity: number): Promise<void> {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    if (!product.trackInventory) {
      return; // Skip if not tracking inventory
    }

    if (variantId) {
      // TODO: implement per-variant reservation if needed
    } else {
      product.reservedStock = Math.max(0, (product.reservedStock || 0) - quantity);
    }

    await product.save();

    // Invalidate cache
    await cache.invalidateProduct(productId);
  }

  /**
   * Get products with low stock
   */
  static async getLowStockProducts(limit: number = 50): Promise<Array<{ productId: string; availableStock: number; threshold: number }>> {
    const products = await Product.find({
      trackInventory: true,
      isActive: true,
      $expr: {
        $lt: [
          { $subtract: ['$stock', { $ifNull: ['$reservedStock', 0] }] },
          { $ifNull: ['$lowStockThreshold', 10] }
        ]
      }
    })
    .select('_id stock reservedStock lowStockThreshold')
    .limit(limit);

    return products.map(product => ({
      productId: product._id.toString(),
      availableStock: Math.max(0, (product.stock || 0) - (product.reservedStock || 0)),
      threshold: product.lowStockThreshold || 10
    }));
  }

  /**
   * Get inventory history for a product
   */
  static async getInventoryHistory(productId: string, variantId?: string, limit: number = 100): Promise<any[]> {
    const query: any = { productId };
    if (variantId) {
      query.variantId = variantId;
    }

    return await InventoryHistory.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Check if sufficient stock is available for purchase
   */
  static async checkStockAvailability(items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>): Promise<{ available: boolean; insufficientStock: Array<{ productId: string; variantId?: string; requested: number; available: number }> }> {

    const insufficientStock: Array<{ productId: string; variantId?: string; requested: number; available: number }> = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.trackInventory || !product.isActive) {
        continue; // Skip inventory checks for inactive or non-tracked products
      }

      let availableStock: number;
      if (item.variantId) {
        const variant = product.variants.find((v: any) => v.variantId === item.variantId);
        availableStock = variant ? Math.max(0, (variant.stock || 0) - (product.reservedStock || 0)) : 0;
      } else {
        availableStock = Math.max(0, (product.stock || 0) - (product.reservedStock || 0));
      }

      if (availableStock < item.quantity) {
        insufficientStock.push({
          productId: item.productId,
          variantId: item.variantId,
          requested: item.quantity,
          available: availableStock
        });
      }
    }

    return {
      available: insufficientStock.length === 0,
      insufficientStock
    };
  }
}
