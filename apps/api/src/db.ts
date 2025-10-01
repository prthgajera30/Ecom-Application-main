import { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';

export const prisma = new PrismaClient();

export async function connectMongo(uri: string) {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri);
}

// Mongoose schemas
const ProductSchema = new mongoose.Schema({
  title: String,
  slug: String,
  description: String,
  images: [String],
  price: Number,
  currency: String,
  categoryId: String,
  stock: Number,
  attributes: Object,
}, { timestamps: true });

const CategorySchema = new mongoose.Schema({ name: String, slug: String }, { timestamps: true });

const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  userId: String,
  cart: { items: [{ productId: String, qty: Number }] },
  updatedAt: { type: Date, default: Date.now },
});

export const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
export const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);
