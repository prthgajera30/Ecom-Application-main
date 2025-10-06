import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';

export const prisma = new PrismaClient();

export async function connectMongo(uri: string) {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri);
}

// Mongoose schemas
const ProductVariantSchema = new mongoose.Schema({
  variantId: { type: String },
  sku: String,
  label: String,
  options: { type: mongoose.Schema.Types.Mixed, default: {} },
  price: Number,
  stock: Number,
  images: [String],
}, { _id: false });

const ProductSpecSchema = new mongoose.Schema({
  key: String,
  value: String,
}, { _id: false });

// Inventory history for auditing stock changes
const InventoryHistorySchema = new mongoose.Schema({
  productId: { type: String, required: true, index: true },
  variantId: { type: String }, // null for base product stock
  change: { type: Number, required: true }, // positive for stock in, negative for stock out
  previousStock: { type: Number, required: true },
  newStock: { type: Number, required: true },
  reason: {
    type: String,
    enum: ['manual_adjustment', 'order_fulfilled', 'order_canceled', 'order_refunded', 'initial_stock'],
    required: true
  },
  reference: String, // order ID, adjustment note, etc.
  userId: String, // admin user who made the change
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

const ProductSchema = new mongoose.Schema({
  title: String,
  slug: String,
  description: String,
  longDescription: String,
  brand: String,
  badges: [String],
  images: [String],
  price: Number,
  currency: { type: String, default: 'USD' },
  categoryId: String,
  stock: { type: Number, default: 0 },
  reservedStock: { type: Number, default: 0 }, // stock reserved for pending orders
  lowStockThreshold: { type: Number, default: 10 }, // alert when stock drops below this
  trackInventory: { type: Boolean, default: true }, // whether to track inventory for this product
  isActive: { type: Boolean, default: true }, // active products only
  attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
  variants: { type: [ProductVariantSchema], default: [] },
  defaultVariantId: String,
  specs: { type: [ProductSpecSchema], default: [] },
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
  },
}, { timestamps: true });

const CategorySchema = new mongoose.Schema({ name: String, slug: String }, { timestamps: true });

const CartItemSchema = new mongoose.Schema({
  productId: String,
  qty: Number,
  variantId: String,
  variantLabel: String,
  variantOptions: { type: mongoose.Schema.Types.Mixed, default: {} },
  unitPrice: Number,
}, { _id: false });

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  userId: String,
  cart: { items: { type: [CartItemSchema], default: [] } },
  updatedAt: { type: Date, default: Date.now },
});

export const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
export const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);
export const InventoryHistory = mongoose.models.InventoryHistory || mongoose.model('InventoryHistory', InventoryHistorySchema);
