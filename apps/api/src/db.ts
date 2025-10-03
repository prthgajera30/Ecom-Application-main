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
  stock: Number,
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
