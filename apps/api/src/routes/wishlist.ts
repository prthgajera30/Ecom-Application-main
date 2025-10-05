import express from 'express';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// Get user's wishlist
router.get('/wishlist', requireAuth, async (req, res) => {
  try {
    const wishlists = await prisma.wishlist.findMany({
      where: { userId: (req as any).user.userId },
      orderBy: { createdAt: 'desc' }
    });

    // Extract product IDs for easier frontend consumption
    const productIds = wishlists.map((w: any) => w.productId);

    res.json({
      wishlist: productIds,
      items: wishlists
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// Add product to wishlist
router.post('/wishlist/:productId', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = (req as any).user.userId;

    // Check if product exists
    // Note: We'll assume product ID validation happens elsewhere
    // You might want to add a check here if using a Product model

    const wishlistItem = await prisma.wishlist.upsert({
      where: {
        userId_productId: {
          userId,
          productId
        }
      },
      update: {
        // Item exists, no update needed
      },
      create: {
        userId,
        productId
      }
    });

    res.json({
      success: true,
      wishlistItem,
      message: 'Product added to wishlist'
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    if (error instanceof Error && error.message.includes('prisma')) {
      res.status(400).json({ error: 'Invalid product or already in wishlist' });
    } else {
      res.status(500).json({ error: 'Failed to add product to wishlist' });
    }
  }
});

// Remove product from wishlist
router.delete('/wishlist/:productId', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = (req as any).user.userId;

    const deletedItem = await prisma.wishlist.deleteMany({
      where: {
        userId,
        productId
      }
    });

    if (deletedItem.count === 0) {
      return res.status(404).json({ error: 'Product not found in wishlist' });
    }

    res.json({
      success: true,
      message: 'Product removed from wishlist'
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ error: 'Failed to remove product from wishlist' });
  }
});

// Check if product is in wishlist
router.get('/wishlist/:productId/check', requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = (req as any).user.userId;

    const wishlistItem = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId,
          productId
        }
      }
    });

    res.json({
      inWishlist: !!wishlistItem
    });
  } catch (error) {
    console.error('Error checking wishlist:', error);
    res.status(500).json({ error: 'Failed to check wishlist status' });
  }
});

export default router;
