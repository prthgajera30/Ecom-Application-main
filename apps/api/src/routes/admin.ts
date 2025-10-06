import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { prisma, Product, Category } from '../db';
import { cache } from '../cache';
import { InventoryService } from '../services/inventory';
import { z } from 'zod';

// Helper for date range calculations
const getDateRange = (days: number) => {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
};

const router = Router();

// All admin routes require authentication
router.use(requireAuth);

// Dashboard analytics
router.get('/dashboard/stats', requireAdmin, async (req, res) => {
  try {
    // Revenue statistics
    const [totalRevenue, monthRevenue, weekRevenue, dayRevenue] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'paid' },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: 'paid',
          createdAt: { gte: getDateRange(30).start }
        },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: 'paid',
          createdAt: { gte: getDateRange(7).start }
        },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: {
          status: 'paid',
          createdAt: { gte: getDateRange(1).start }
        },
        _sum: { amount: true }
      }),
    ]);

    // Order statistics (using PostgreSQL)
    const [totalOrders, monthOrders, weekOrders, dayOrders] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: getDateRange(30).start } } }),
      prisma.order.count({ where: { createdAt: { gte: getDateRange(7).start } } }),
      prisma.order.count({ where: { createdAt: { gte: getDateRange(1).start } } }),
    ]);

    // Paid orders count
    const [paidOrders, monthPaidOrders, weekPaidOrders, dayPaidOrders] = await Promise.all([
      prisma.order.count({ where: { status: 'paid' } }),
      prisma.order.count({
        where: {
          status: 'paid',
          createdAt: { gte: getDateRange(30).start }
        }
      }),
      prisma.order.count({
        where: {
          status: 'paid',
          createdAt: { gte: getDateRange(7).start }
        }
      }),
      prisma.order.count({
        where: {
          status: 'paid',
          createdAt: { gte: getDateRange(1).start }
        }
      }),
    ]);

    // Customer statistics
    const totalCustomers = await prisma.user.count({ where: { role: 'customer' } });
    const monthCustomers = await prisma.user.count({
      where: {
        role: 'customer',
        createdAt: { gte: getDateRange(30).start }
      }
    });

    // Product statistics (using MongoDB)
    const totalProducts = await Product.countDocuments();
    const publishedProducts = await Product.countDocuments();

    // Inventory statistics
    const [totalInventoryProducts, lowStockCount, outOfStockCount, inventoryValue] = await Promise.all([
      Product.countDocuments({ trackInventory: true, isActive: true }),
      InventoryService.getLowStockProducts().then(products => products.length),
      Product.countDocuments({ trackInventory: true, isActive: true, stock: 0 }),
      Product.aggregate([
        { $match: { trackInventory: true, isActive: true } },
        { $group: { _id: null, totalValue: { $sum: { $multiply: ['$stock', '$price'] } } } }
      ]).then(result => result[0]?.totalValue || 0)
    ]);

    // Low stock alerts (using InventoryService)
    const lowStockProducts = await InventoryService.getLowStockProducts(5);
    // Get full product details for displaying alerts
    const productIds = lowStockProducts.map(p => p.productId);
    const alertProducts = productIds.length > 0 ? await Product.find({
      _id: { $in: productIds }
    }).select('title slug variants.variantId variants.stock').lean() : [];
  const productMap = new Map(alertProducts.map(p => [String((p as any)._id), p as any]));

    // Recent orders with item counts (PostgreSQL)
    const recentOrdersWithItems = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
      }
    });

    // Get item counts separately for recent orders
    const recentOrdersWithCounts = await Promise.all(
      recentOrdersWithItems.map(async (order) => {
        const itemCount = await prisma.orderItem.count({
          where: { orderId: order.id }
        });
        return {
          id: order.id,
          status: order.status,
          total: order.total,
          createdAt: order.createdAt,
          itemCount: itemCount,
        };
      })
    );

    const formatCurrency = (amount: number | null) => amount ? (amount / 100).toFixed(2) : '0.00';

    res.json({
      revenue: {
        total: formatCurrency(totalRevenue._sum.amount || 0),
        thisMonth: formatCurrency(monthRevenue._sum.amount || 0),
        thisWeek: formatCurrency(weekRevenue._sum.amount || 0),
        today: formatCurrency(dayRevenue._sum.amount || 0),
      },
      orders: {
        total: totalOrders,
        thisMonth: monthOrders,
        thisWeek: weekOrders,
        today: dayOrders,
        paid: paidOrders,
        pending: totalOrders - paidOrders,
      },
      customers: {
        total: totalCustomers,
        thisMonth: monthCustomers,
      },
      products: {
        total: totalProducts,
        published: publishedProducts,
      },
      inventory: {
        totalProducts: totalInventoryProducts,
        lowStockCount,
        outOfStockCount,
        totalValue: inventoryValue,
      },
      alerts: {
        lowStock: lowStockProducts.map(product => {
          const prod = productMap.get(product.productId);
          return {
            title: prod?.title || 'Unknown Product',
            lowStockVariants: prod?.variants?.filter((v: any) => v.stock < 10) || []
          };
        }).slice(0, 5)
      },
      recentOrders: recentOrdersWithCounts.map(order => ({
        id: order.id,
        status: order.status,
        total: formatCurrency(order.total),
        createdAt: order.createdAt,
        itemCount: order.itemCount,
      }))
    });
  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Revenue chart data
router.get('/dashboard/revenue-chart', requireAdmin, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const { start } = getDateRange(days);

    const payments = await prisma.payment.groupBy({
      by: ['createdAt'],
      where: {
        status: 'paid',
        createdAt: { gte: start }
      },
      _sum: { amount: true },
      orderBy: { createdAt: 'asc' },
    });

    // Aggregate by date
    const dataByDate = new Map<string, number>();
    for (const payment of payments) {
      const date = payment.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
      dataByDate.set(date, (dataByDate.get(date) || 0) + (payment._sum.amount || 0));
    }

    const chartData = Array.from(dataByDate.entries())
      .map(([date, amount]) => ({
        date,
        revenue: parseFloat((amount / 100).toFixed(2))
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json(chartData);
  } catch (error) {
    console.error('Revenue chart error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue chart data' });
  }
});

// Recent orders for dashboard
router.get('/dashboard/recent-orders', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const orders = await prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true } },
        items: { select: { qty: true } },
      }
    });

    const formattedOrders = orders.map(order => ({
      id: order.id,
      customerEmail: order.user.email,
      status: order.status,
      total: (order.total / 100).toFixed(2),
      itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
      createdAt: order.createdAt,
    }));

    res.json(formattedOrders);
  } catch (error) {
    console.error('Recent orders error:', error);
    res.status(500).json({ error: 'Failed to fetch recent orders' });
  }
});

// ===== PRODUCT MANAGEMENT =====
router.get('/products', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;

    // Use MongoDB to fetch products
    const query: any = {};
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category', 'name slug')
      .sort({ createdAt: -1 });

    res.json({
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get single product by ID
router.get('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id).populate('category', 'name slug');

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Product fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ===== CATEGORY MANAGEMENT =====
router.get('/categories', requireAdmin, async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ===== CACHE MANAGEMENT =====
router.post('/cache/clear', requireAdmin, async (req, res) => {
  try {
    const { pattern } = req.body as { pattern?: string };

    if (pattern) {
      // Clear specific pattern
      await cache.delPattern(pattern);
      res.json({ success: true, message: `Cleared cache pattern: ${pattern}` });
    } else {
      // Clear all cache
      await cache.invalidateAllProducts();
      res.json({ success: true, message: 'Cleared all cache' });
    }
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

router.post('/cache/clear-products', requireAdmin, async (req, res) => {
  try {
    await cache.invalidateAllProducts();
    res.json({ success: true, message: 'Cleared product cache' });
  } catch (error) {
    console.error('Product cache clear error:', error);
    res.status(500).json({ error: 'Failed to clear product cache' });
  }
});

router.get('/cache/stats', requireAdmin, async (req, res) => {
  try {
    const isHealthy = await cache.ping();
    res.json({
      healthy: isHealthy,
      connected: cache instanceof Object && 'ping' in cache,
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

// ===== INVENTORY MANAGEMENT =====

// Get inventory overview/stats
router.get('/inventory/overview', requireAdmin, async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments({
      trackInventory: true,
      isActive: true
    });

    const lowStockProducts = await InventoryService.getLowStockProducts(100);

    const outOfStockProducts = await Product.countDocuments({
      trackInventory: true,
      isActive: true,
      stock: 0
    });

    const totalInventoryValue = await Product.aggregate([
      { $match: { trackInventory: true, isActive: true } },
      {
        $group: {
          _id: null,
          totalValue: { $sum: { $multiply: ['$stock', '$price'] } }
        }
      }
    ]);

    res.json({
      totalProducts,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts,
      totalValue: totalInventoryValue[0]?.totalValue || 0,
      lowStockProducts: lowStockProducts.slice(0, 10) // Top 10 low stock items
    });
  } catch (error) {
    console.error('Inventory overview error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory overview' });
  }
});

// Get inventory status for a specific product
router.get('/inventory/products/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const status = await InventoryService.getInventoryStatus(id);
    res.json(status);
  } catch (error) {
    console.error('Inventory status error:', error);
    const msg = (error as any)?.message;
    if (msg === 'Product not found') {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(500).json({ error: 'Failed to fetch inventory status' });
  }
});

// Adjust stock for a product
router.post('/inventory/products/:id/adjust', requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      change: z.number(),
      reason: z.enum(['manual_adjustment', 'order_fulfilled', 'order_canceled', 'order_refunded', 'initial_stock']),
      reference: z.string().optional(),
      note: z.string().optional(),
      variantId: z.string().optional()
    });

    const parse = schema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
    }

    const { id } = req.params;
    const { change, reason, reference, note, variantId } = parse.data;

    const adjustment = await InventoryService.adjustStock({
      productId: id,
      variantId,
      change,
      reason,
      reference,
      userId: (req as any).user?.userId,
      metadata: { note }
    });

    res.json({
      success: true,
      message: 'Stock adjusted successfully',
      status: adjustment
    });
  } catch (error) {
    console.error('Stock adjustment error:', error);
    const msg = (error as any)?.message;
    res.status(500).json({ error: msg || 'Failed to adjust stock' });
  }
});

// Get inventory history for a product
router.get('/inventory/history/:productId', requireAdmin, async (req, res) => {
  try {
    const { productId } = req.params;
    const variantId = req.query.variantId as string;
    const limit = parseInt(req.query.limit as string) || 100;

    const history = await InventoryService.getInventoryHistory(productId, variantId, limit);

    res.json(history);
  } catch (error) {
    console.error('Inventory history error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory history' });
  }
});

export default router;
