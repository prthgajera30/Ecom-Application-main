import express from 'express';
import { prisma } from '../db';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

const router = express.Router();

// Address validation schema
const addressSchema = z.object({
  label: z.string().optional(),
  fullName: z.string().min(1, 'Full name is required'),
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().optional(),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
  phone: z.string().optional(),
  isDefault: z.boolean().optional()
});

// Get user's addresses
router.get('/addresses', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(addresses);
  } catch (error) {
    console.error('Error fetching addresses:', error);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
});

// Get specific address
router.get('/addresses/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const address = await prisma.address.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!address) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json(address);
  } catch (error) {
    console.error('Error fetching address:', error);
    res.status(500).json({ error: 'Failed to fetch address' });
  }
});

// Create new address
router.post('/addresses', requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const validatedData = addressSchema.parse(req.body);

    // If this is set as default, remove default from other addresses
    if (validatedData.isDefault) {
      await prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.create({
      data: {
        ...validatedData,
        userId
      }
    });

    res.status(201).json(address);
  } catch (error) {
    console.error('Error creating address:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to create address' });
    }
  }
});

// Update address
router.put('/addresses/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const validatedData = addressSchema.parse(req.body);

    // Verify address exists and belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: { id, userId }
    });

    if (!existingAddress) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // If this is set as default, remove default from other addresses
    if (validatedData.isDefault) {
      await prisma.address.updateMany({
        where: {
          userId,
          id: { not: id }
        },
        data: { isDefault: false }
      });
    }

    const address = await prisma.address.update({
      where: { id },
      data: validatedData
    });

    res.json(address);
  } catch (error) {
    console.error('Error updating address:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to update address' });
    }
  }
});

// Delete address
router.delete('/addresses/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Verify address exists and belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: { id, userId }
    });

    if (!existingAddress) {
      return res.status(404).json({ error: 'Address not found' });
    }

    await prisma.address.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// Set address as default
router.patch('/addresses/:id/default', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Verify address exists and belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: { id, userId }
    });

    if (!existingAddress) {
      return res.status(404).json({ error: 'Address not found' });
    }

    // Remove default from all addresses for this user
    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false }
    });

    // Set this address as default
    const address = await prisma.address.update({
      where: { id },
      data: { isDefault: true }
    });

    res.json(address);
  } catch (error) {
    console.error('Error setting default address:', error);
    res.status(500).json({ error: 'Failed to set default address' });
  }
});

export default router;
