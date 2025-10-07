import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import http from 'http';
import https from 'https';
import { URL } from 'url';

import { prisma, Product, Category, connectMongo } from './db';
import fs from 'fs';
import path from 'path';

const DEFAULT_MONGO_URL = 'mongodb://localhost:27017/shop';

const ADMIN_EMAIL = 'admin@example.com';
const CUSTOMER_EMAIL = 'user@example.com';

type SeedVariant = {
  variantId?: string;
  label: string;
  sku: string;
  price: number;
  stock: number;
  options: Record<string, string>;
  images: string[];
};

type SeedProduct = {
  slug: string;
  title: string;
  description: string;
  longDescription: string;
  brand: string;
  categorySlug: string;
  badges?: string[];
  images: string[];
  currency?: string;
  price: number;
  variants: SeedVariant[];
  specs?: { key: string; value: string }[];
  rating?: { average: number; count: number };
  attributes?: Record<string, string>;
};

const categoriesData = [
  { name: 'Footwear', slug: 'footwear' },
  { name: 'Clothing', slug: 'clothing' },
  { name: 'Outerwear & Jackets', slug: 'outerwear' },
  { name: 'Bags & Luggage', slug: 'bags-luggage' },
  { name: 'Home & Kitchen', slug: 'home-kitchen' },
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Sports & Outdoors', slug: 'sports-outdoors' },
  { name: 'Beauty & Personal Care', slug: 'beauty-personal-care' },
  { name: 'Accessories', slug: 'accessories' },
  { name: 'Jewelry', slug: 'jewelry' },
];

// Image mapping and validation functions...
let seedImageMap: Record<string, string> | null = null;
try {
  const mapPath = path.resolve(__dirname, '..', 'seed-image-map.json');
  if (fs.existsSync(mapPath)) {
    seedImageMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  }
} catch (e) {
  seedImageMap = null;
}

function mapImage(url: string) {
  if (!url) return url;
  if (seedImageMap && seedImageMap[url]) return seedImageMap[url];

  try {
    const u = new URL(url);
    const host = u.hostname;
    if (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1') return url;
    if (host.includes('picsum.photos') || host.includes('placehold.co')) return url;
  } catch (e) {
    // non-URL strings fall through
  }

  try {
    const seed = createHash('md5').update(url).digest('hex').slice(0, 10);
    return `https://picsum.photos/seed/${seed}/1200/800`;
  } catch (e) {
    return url;
  }
}

const PLACEHOLDER_IMAGE = 'https://picsum.photos/id/152/1200/800';

const productCatalog: SeedProduct[] = [
  // Original products with corrected category slugs
  {
    slug: 'aurora-running-sneaker',
    title: 'Aurora Running Sneaker',
    brand: 'StrideLab',
    categorySlug: 'footwear',
    description: 'Lightweight daily trainer with responsive cushioning for runners logging serious miles.',
    longDescription: 'Aurora blends a recycled engineered mesh upper with a pebax energy core midsole to deliver breathable comfort and serious rebound. The secure heel cradle and articulated outsole flex naturally with your stride, making it the go-to shoe for tempo sessions and long runs alike.',
    badges: ['Bestseller'],
    images: [
      'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg',
      'https://images.pexels.com/photos/279906/pexels-photo-279906.jpeg',
      'https://images.pexels.com/photos/1018911/pexels-photo-1018911.jpeg',
      'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg',
    ],
    price: 13900,
    currency: 'USD',
    variants: [
      {
        variantId: 'aurora-running-sneaker-onyx-7',
        label: 'Onyx Black / US 7',
        sku: 'SL-AUR-ONX-7',
        price: 13900,
        stock: 12,
        options: { color: 'Onyx Black', size: 'US 7' },
        images: [
          'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg',
          'https://images.pexels.com/photos/279906/pexels-photo-279906.jpeg',
        ],
      },
      {
        variantId: 'aurora-running-sneaker-onyx-8',
        label: 'Onyx Black / US 8',
        sku: 'SL-AUR-ONX-8',
        price: 13900,
        stock: 16,
        options: { color: 'Onyx Black', size: 'US 8' },
        images: [
          'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg',
          'https://images.pexels.com/photos/279906/pexels-photo-279906.jpeg',
        ],
      },
      {
        variantId: 'aurora-running-sneaker-onyx-9',
        label: 'Onyx Black / US 9',
        sku: 'SL-AUR-ONX-9',
        price: 13900,
        stock: 20,
        options: { color: 'Onyx Black', size: 'US 9' },
        images: [
          'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg',
          'https://images.pexels.com/photos/279906/pexels-photo-279906.jpeg',
        ],
      },
      {
        variantId: 'aurora-running-sneaker-onyx-10',
        label: 'Onyx Black / US 10',
        sku: 'SL-AUR-ONX-10',
        price: 13900,
        stock: 15,
        options: { color: 'Onyx Black', size: 'US 10' },
        images: [
          'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg',
          'https://images.pexels.com/photos/279906/pexels-photo-279906.jpeg',
        ],
      },
      {
        variantId: 'aurora-running-sneaker-white-8',
        label: 'Cloud White / US 8',
        sku: 'SL-AUR-WHT-8',
        price: 13900,
        stock: 14,
        options: { color: 'Cloud White', size: 'US 8' },
        images: [
          'https://images.pexels.com/photos/2929984/pexels-photo-2929984.jpeg',
          'https://images.pexels.com/photos/1018911/pexels-photo-1018911.jpeg',
        ],
      },
      {
        variantId: 'aurora-running-sneaker-white-9',
        label: 'Cloud White / US 9',
        sku: 'SL-AUR-WHT-9',
        price: 13900,
        stock: 18,
        options: { color: 'Cloud White', size: 'US 9' },
        images: [
          'https://images.pexels.com/photos/2929984/pexels-photo-2929984.jpeg',
          'https://images.pexels.com/photos/1018911/pexels-photo-1018911.jpeg',
        ],
      },
    ],
    specs: [
      { key: 'Upper', value: 'Recycled engineered mesh with TPU overlays' },
      { key: 'Midsole', value: 'Pebax energy core with EVA carrier' },
      { key: 'Drop', value: '8 mm' },
    ],
    rating: { average: 4.6, count: 182 },
    attributes: {
      material: 'Engineered mesh',
      color: 'Onyx Black',
    },
  },
  // Add more products here as needed...
  {
    slug: 'lumen-active-tee',
    title: 'Lumen Active Tee',
    brand: 'Aether Athletics',
    categorySlug: 'clothing', // Fixed from 'apparel'
    description: 'Moisture-wicking training tee with cooling minerals and bonded seams.',
    longDescription: 'The Lumen Active Tee is your go-to layer for high-output sessions.',
    badges: ['New Arrival'],
    images: [
      'https://images.pexels.com/photos/994234/pexels-photo-994234.jpeg',
      'https://images.pexels.com/photos/434918/pexels-photo-434918.jpeg',
      'https://images.pexels.com/photos/1571019/pexels-photo-1571019.jpeg',
    ],
    price: 7800,
    variants: [
      {
        variantId: 'lumen-tee-storm-s',
        label: 'Storm Grey / Small',
        sku: 'AT-LUM-STR-S',
        price: 7800,
        stock: 20,
        options: { color: 'Storm Grey', size: 'Small' },
        images: [
          'https://images.pexels.com/photos/994234/pexels-photo-994234.jpeg',
          'https://images.pexels.com/photos/434918/pexels-photo-434918.jpeg',
        ],
      },
    ],
    specs: [{ key: 'Fabric', value: '52% recycled polyester, 48% phase-change nylon' }],
    rating: { average: 4.4, count: 63 },
    attributes: { material: 'Recycled performance knit', color: 'Storm Grey' },
  },
  {
    slug: 'nova-wireless-headphones',
    title: 'Nova Wireless Headphones',
    brand: 'SoundWave',
    categorySlug: 'electronics',
    description: 'Premium wireless headphones with active noise cancellation and 30-hour battery life.',
    longDescription: 'Experience studio-quality sound with Nova wireless headphones. Featuring advanced active noise cancellation, customizable EQ, and premium materials for all-day comfort.',
    badges: ['Premium'],
    images: [
      'https://images.pexels.com/photos/164977/pexels-photo-164977.jpeg',
      'https://images.pexels.com/photos/711544/pexels-photo-711544.jpeg',
      'https://images.pexels.com/photos/162409/pexels-photo-162409.jpeg',
      'https://images.pexels.com/photos/205926/pexels-photo-205926.jpeg',
    ],
    price: 24900,
    variants: [
      {
        variantId: 'nova-headphones-black',
        label: 'Midnight Black',
        sku: 'SW-NOVA-BLK',
        price: 24900,
        stock: 25,
        options: { color: 'Midnight Black' },
        images: [
          'https://images.pexels.com/photos/164977/pexels-photo-164977.jpeg',
          'https://images.pexels.com/photos/205926/pexels-photo-205926.jpeg',
        ],
      },
      {
        variantId: 'nova-headphones-white',
        label: 'Pearl White',
        sku: 'SW-NOVA-WHT',
        price: 24900,
        stock: 18,
        options: { color: 'Pearl White' },
        images: [
          'https://images.pexels.com/photos/711544/pexels-photo-711544.jpeg',
          'https://images.pexels.com/photos/162409/pexels-photo-162409.jpeg',
        ],
      },
    ],
    specs: [
      { key: 'Battery Life', value: '30 hours' },
      { key: 'Connectivity', value: 'Bluetooth 5.2' },
      { key: 'Noise Cancellation', value: 'Active' },
    ],
    rating: { average: 4.7, count: 143 },
    attributes: { material: 'Premium leather', color: 'Midnight Black' },
  },

  // FOOTWEAR
  {
    slug: 'hike-pro-boot',
    title: 'Hike Pro Trail Boot',
    brand: 'TrailMaster',
    categorySlug: 'footwear',
    description: 'Rugged hiking boot with waterproof membrane and ankle support.',
    longDescription: 'Designed for serious trail enthusiasts, the Hike Pro provides superior ankle stability and weather protection for multi-day hikes.',
    badges: ['Sale'],
    images: [
      'https://images.pexels.com/photos/318236/pexels-photo-318236.jpeg',
      'https://images.pexels.com/photos/24252/pexels-photo.jpg',
      'https://images.pexels.com/photos/1598501/pexels-photo-1598501.jpeg',
      'https://images.pexels.com/photos/46253/pexels-photo.jpg'
    ],
    price: 18900,
    variants: [
      {
        variantId: 'hike-boot-brown-9',
        label: 'Rich Brown / US 9',
        sku: 'TM-HIKE-BRN-9',
        price: 18900,
        stock: 22,
        options: { color: 'Rich Brown', size: 'US 9' },
        images: [
          'https://images.pexels.com/photos/318236/pexels-photo-318236.jpeg',
          'https://images.pexels.com/photos/24252/pexels-photo.jpg'
        ],
      },
      {
        variantId: 'hike-boot-brown-10',
        label: 'Rich Brown / US 10',
        sku: 'TM-HIKE-BRN-10',
        price: 18900,
        stock: 28,
        options: { color: 'Rich Brown', size: 'US 10' },
        images: [
          'https://images.pexels.com/photos/318236/pexels-photo-318236.jpeg',
          'https://images.pexels.com/photos/24252/pexels-photo.jpg'
        ],
      },
      {
        variantId: 'hike-boot-black-9',
        label: 'Onyx Black / US 9',
        sku: 'TM-HIKE-BLK-9',
        price: 18900,
        stock: 15,
        options: { color: 'Onyx Black', size: 'US 9' },
        images: [
          'https://images.pexels.com/photos/1598501/pexels-photo-1598501.jpeg',
          'https://images.pexels.com/photos/46253/pexels-photo.jpg'
        ],
      },
    ],
    specs: [
      { key: 'Upper', value: 'Full-grain leather' },
      { key: 'Midsole', value: 'PU foam with EVA' },
      { key: 'Weight', value: '14 oz per shoe' },
    ],
    rating: { average: 4.5, count: 89 },
    attributes: { material: 'Full-grain leather', color: 'Rich Brown' },
  },

  // CLOTHING
  {
    slug: 'zen-yoga-leggings',
    title: 'Zen Yoga Leggings',
    brand: 'Mindful Movement',
    categorySlug: 'clothing',
    description: 'High-performance yoga leggings with moisture-wicking fabric and four-way stretch.',
    longDescription: 'Our Zen collection combines the perfect blend of comfort and performance for your yoga practice, with fabric that moves with you.',
    badges: [],
    images: [
      'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg',
      'https://images.pexels.com/photos/3984103/pexels-photo-3984103.jpeg',
      'https://images.pexels.com/photos/1858476/pexels-photo-1858476.jpeg',
    ],
    price: 8900,
    variants: [
      {
        variantId: 'zen-leggings-black-s',
        label: 'Cosmic Black / Small',
        sku: 'MM-ZEN-BLK-S',
        price: 8900,
        stock: 45,
        options: { color: 'Cosmic Black', size: 'Small' },
        images: [
          'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg',
          'https://images.pexels.com/photos/1858476/pexels-photo-1858476.jpeg',
        ],
      },
      {
        variantId: 'zen-leggings-black-m',
        label: 'Cosmic Black / Medium',
        sku: 'MM-ZEN-BLK-M',
        price: 8900,
        stock: 52,
        options: { color: 'Cosmic Black', size: 'Medium' },
        images: [
          'https://images.pexels.com/photos/3731256/pexels-photo-3731256.jpeg',
          'https://images.pexels.com/photos/1858476/pexels-photo-1858476.jpeg',
        ],
      },
      {
        variantId: 'zen-leggings-grey-m',
        label: 'Sage Grey / Medium',
        sku: 'MM-ZEN-GRY-M',
        price: 8900,
        stock: 38,
        options: { color: 'Sage Grey', size: 'Medium' },
        images: [
          'https://images.pexels.com/photos/3984103/pexels-photo-3984103.jpeg',
          'https://images.pexels.com/photos/1858476/pexels-photo-1858476.jpeg',
        ],
      },
      {
        variantId: 'zen-leggings-grey-l',
        label: 'Sage Grey / Large',
        sku: 'MM-ZEN-GRY-L',
        price: 8900,
        stock: 41,
        options: { color: 'Sage Grey', size: 'Large' },
        images: [
          'https://images.pexels.com/photos/3984103/pexels-photo-3984103.jpeg',
          'https://images.pexels.com/photos/1858476/pexels-photo-1858476.jpeg',
        ],
      },
    ],
    specs: [
      { key: 'Fabric', value: '83% recycled polyester, 17% spandex' },
      { key: 'Rise', value: 'High-rise with wide waistband' },
      { key: 'Length', value: '7/8 length' },
    ],
    rating: { average: 4.3, count: 156 },
    attributes: { material: 'Performance stretch fabric', color: 'Cosmic Black' },
  },

  // OUTERWEAR
  {
    slug: 'summit-down-jacket',
    title: 'Summit Down Jacket',
    brand: 'Peak Performance',
    categorySlug: 'outerwear',
    description: 'Ultra-lightweight down jacket with 800-fill power and DWR treatment.',
    longDescription: 'Conquer cold weather with our premium down jacket that provides exceptional warmth without bulk.',
    badges: ['Best Seller'],
    images: [
      'https://images.pexels.com/photos/603022/pexels-photo-603022.jpeg',
      'https://images.pexels.com/photos/163036/pexels-photo-163036.jpeg',
      'https://images.pexels.com/photos/3651597/pexels-photo-3651597.jpeg',
      'https://images.pexels.com/photos/2897848/pexels-photo-2897848.jpeg',
    ],
    price: 29900,
    variants: [
      {
        variantId: 'summit-jacket-black-m',
        label: 'Obsidian Black / Medium',
        sku: 'PP-SUM-BLK-M',
        price: 29900,
        stock: 18,
        options: { color: 'Obsidian Black', size: 'Medium' },
        images: [
          'https://images.pexels.com/photos/603022/pexels-photo-603022.jpeg',
          'https://images.pexels.com/photos/2897848/pexels-photo-2897848.jpeg',
        ],
      },
      {
        variantId: 'summit-jacket-black-l',
        label: 'Obsidian Black / Large',
        sku: 'PP-SUM-BLK-L',
        price: 29900,
        stock: 22,
        options: { color: 'Obsidian Black', size: 'Large' },
        images: [
          'https://images.pexels.com/photos/603022/pexels-photo-603022.jpeg',
          'https://images.pexels.com/photos/2897848/pexels-photo-2897848.jpeg',
        ],
      },
      {
        variantId: 'summit-jacket-blue-m',
        label: 'Alpine Blue / Medium',
        sku: 'PP-SUM-BLU-M',
        price: 29900,
        stock: 12,
        options: { color: 'Alpine Blue', size: 'Medium' },
        images: [
          'https://images.pexels.com/photos/163036/pexels-photo-163036.jpeg',
          'https://images.pexels.com/photos/3651597/pexels-photo-3651597.jpeg',
        ],
      },
    ],
    specs: [
      { key: 'Fill Power', value: '800+' },
      { key: 'Fill', value: 'Responsible down standard' },
      { key: 'Water Resistance', value: 'DWR coating' },
    ],
    rating: { average: 4.8, count: 97 },
    attributes: { material: 'Nylon shell with down fill', color: 'Obsidian Black' },
  },

  {
    slug: 'alpine-rain-jacket',
    title: 'Alpine Rain Jacket',
    brand: 'WeatherTech',
    categorySlug: 'outerwear',
    description: 'Fully waterproof hiking jacket with taped seams and breathable membrane.',
    longDescription: 'Stay dry and comfortable in any weather with our advanced rain jacket technology.',
    badges: [],
    images: [
      'https://images.pexels.com/photos/1835416/pexels-photo-1835416.jpeg',
      'https://images.pexels.com/photos/954782/pexels-photo-954782.jpeg',
      'https://images.pexels.com/photos/1309557/pexels-photo-1309557.jpeg',
    ],
    price: 15900,
    variants: [
      {
        variantId: 'alpine-rain-yellow-m',
        label: 'Safety Yellow / Medium',
        sku: 'WT-ALP-YEL-M',
        price: 15900,
        stock: 35,
        options: { color: 'Safety Yellow', size: 'Medium' },
        images: [
          'https://images.pexels.com/photos/1835416/pexels-photo-1835416.jpeg',
          'https://images.pexels.com/photos/954782/pexels-photo-954782.jpeg',
        ],
      },
      {
        variantId: 'alpine-rain-yellow-l',
        label: 'Safety Yellow / Large',
        sku: 'WT-ALP-YEL-L',
        price: 15900,
        stock: 28,
        options: { color: 'Safety Yellow', size: 'Large' },
        images: [
          'https://images.pexels.com/photos/1835416/pexels-photo-1835416.jpeg',
          'https://images.pexels.com/photos/1309557/pexels-photo-1309557.jpeg',
        ],
      },
    ],
    specs: [
      { key: 'Waterproof Rating', value: '20,000mm' },
      { key: 'Breathability', value: '15,000g/m²/day' },
      { key: 'Seams', value: 'Taped seams' },
    ],
    rating: { average: 4.2, count: 43 },
    attributes: { material: 'Polyester with polyurethane membrane', color: 'Safety Yellow' },
  },

  // BAGS & LUGGAGE
  {
    slug: 'wander-messenger-bag',
    title: 'Wander Messenger Bag',
    brand: 'Urban Carry',
    categorySlug: 'bags-luggage',
    description: 'Classic leather messenger bag with laptop compartment and organizational pockets.',
    longDescription: 'The perfect urban companion for work or travel, combining classic style with modern functionality.',
    badges: ['New'],
    images: [
      'https://images.pexels.com/photos/1204469/pexels-photo-1204469.jpeg',
      'https://images.pexels.com/photos/3907507/pexels-photo-3907507.jpeg',
      'https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg',
      'https://images.pexels.com/photos/468685/pexels-photo-468685.jpeg',
    ],
    price: 12900,
    variants: [
      {
        variantId: 'wander-messenger-brown',
        label: 'Vintage Brown',
        sku: 'UC-WAN-BRN',
        price: 12900,
        stock: 32,
        options: { color: 'Vintage Brown' },
        images: [
          'https://images.pexels.com/photos/1204469/pexels-photo-1204469.jpeg',
          'https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg',
        ],
      },
      {
        variantId: 'wander-messenger-black',
        label: 'Midnight Black',
        sku: 'UC-WAN-BLK',
        price: 12900,
        stock: 28,
        options: { color: 'Midnight Black' },
        images: [
          'https://images.pexels.com/photos/3907507/pexels-photo-3907507.jpeg',
          'https://images.pexels.com/photos/468685/pexels-photo-468685.jpeg',
        ],
      },
    ],
    specs: [
      { key: 'Dimensions', value: '16" x 12" x 4"' },
      { key: 'Material', value: 'Full-grain leather' },
      { key: 'Capacity', value: '15L' },
    ],
    rating: { average: 4.4, count: 67 },
    attributes: { material: 'Full-grain leather', color: 'Vintage Brown' },
  },

  {
    slug: 'globe-trotter-wheelie',
    title: 'Globe Trotter Wheelie Suitcase',
    brand: 'Voyage',
    categorySlug: 'bags-luggage',
    description: 'Expandable hard-shell suitcase with 360° spinner wheels and TSA lock.',
    longDescription: 'Built for frequent travelers who demand durability and reliability in their luggage.',
    badges: [],
    images: [
      'https://images.pexels.com/photos/2258685/pexels-photo-2258685.jpeg',
      'https://images.pexels.com/photos/1603829/pexels-photo-1603829.jpeg',
    ],
    price: 18900,
    variants: [
      {
        variantId: 'globe-wheelie-blue-28',
        label: 'Ocean Blue / 28"',
        sku: 'VY-GLO-BLU-28',
        price: 18900,
        stock: 24,
        options: { color: 'Ocean Blue', size: '28"' },
        images: [
          'https://images.pexels.com/photos/2258685/pexels-photo-2258685.jpeg',
        ],
      },
      {
        variantId: 'globe-wheelie-grey-28',
        label: 'Charcoal Grey / 28"',
        sku: 'VY-GLO-GRY-28',
        price: 18900,
        stock: 19,
        options: { color: 'Charcoal Grey', size: '28"' },
        images: [
          'https://images.pexels.com/photos/1603829/pexels-photo-1603829.jpeg',
        ],
      },
      {
        variantId: 'globe-wheelie-blue-22',
        label: 'Ocean Blue / 22"',
        sku: 'VY-GLO-BLU-22',
        price: 15900,
        stock: 31,
        options: { color: 'Ocean Blue', size: '22"' },
        images: [
          'https://images.pexels.com/photos/1603829/pexels-photo-1603829.jpeg',
        ],
      },
    ],
    specs: [
      { key: 'Material', value: 'Polycarbonate shell' },
      { key: 'Weight', value: '8.5 lbs (empty)' },
      { key: 'Wheels', value: '360° spinner' },
    ],
    rating: { average: 4.6, count: 123 },
    attributes: { material: 'Polycarbonate', color: 'Ocean Blue' },
  },

  // HOME & KITCHEN
  {
    slug: 'aerial-coffee-grinder',
    title: 'Aerial Coffee Grinder',
    brand: 'Brew Masters',
    categorySlug: 'home-kitchen',
    description: 'Burr coffee grinder with 65 grind settings for perfect extraction.',
    longDescription: 'Elevate your brewing with precision grinding technology that ensures consistent particle size.',
    badges: ['Premium'],
    images: [
      'https://images.pexels.com/photos/2959286/pexels-photo-2959286.jpeg',
      'https://images.pexels.com/photos/4187779/pexels-photo-4187779.jpeg',
    ],
    price: 22900,
    variants: [
      {
        variantId: 'aerial-grinder-black',
        label: 'Matte Black',
        sku: 'BM-AER-BLK',
        price: 22900,
        stock: 16,
        options: { color: 'Matte Black' },
        images: [
          'https://images.pexels.com/photos/2959286/pexels-photo-2959286.jpeg',
        ],
      },
      {
        variantId: 'aerial-grinder-silver',
        label: 'Bristled Stainless',
        sku: 'BM-AER-SS',
        price: 22900,
        stock: 12,
        options: { color: 'Stainless Steel' },
        images: [
          'https://images.pexels.com/photos/4187779/pexels-photo-4187779.jpeg',
        ],
      },
    ],
    specs: [
      { key: 'Grind Settings', value: '65 steps' },
      { key: 'Burr Diameter', value: '64mm' },
      { key: 'Capacity', value: '8oz bean hopper' },
    ],
    rating: { average: 4.5, count: 89 },
    attributes: { material: 'Stainless steel burrs', color: 'Matte Black' },
  },

  // ELECTRONICS
  {
    slug: 'voyage-wireless-router',
    title: 'Voyage Mesh WiFi Router',
    brand: 'NetWorks',
    categorySlug: 'electronics',
    description: 'Whole-home mesh WiFi system with 6Gbps speeds and parental controls.',
    longDescription: 'Eliminate dead zones with intelligent mesh technology that learns your home layout.',
    badges: [],
    images: [
      'https://images.pexels.com/photos/2820884/pexels-photo-2820884.jpeg',
      'https://images.pexels.com/photos/3187088/pexels-photo-3187088.jpeg',
    ],
    price: 39900,
    variants: [
      {
        variantId: 'voyage-router-2pack',
        label: '2-Pack System',
        sku: 'NW-VOY-2PK',
        price: 39900,
        stock: 14,
        options: { pack: '2-Pack' },
        images: [
          'https://images.pexels.com/photos/2820884/pexels-photo-2820884.jpeg',
        ],
      },
      {
        variantId: 'voyage-router-3pack',
        label: '3-Pack System',
        sku: 'NW-VOY-3PK',
        price: 54900,
        stock: 8,
        options: { pack: '3-Pack' },
        images: [
          'https://images.pexels.com/photos/3187088/pexels-photo-3187088.jpeg',
        ],
      },
    ],
    specs: [
      { key: 'Speed', value: 'Up to 6Gbps' },
      { key: 'WiFi Standard', value: 'WiFi 6' },
      { key: 'Coverage', value: 'Up to 6,000 sq ft' },
    ],
    rating: { average: 4.3, count: 76 },
    attributes: { type: 'Mesh WiFi System', connectivity: 'WiFi 6' },
  },

  // SPORTS & OUTDOORS
  {
    slug: 'apex-trekking-pole',
    title: 'Apex Carbon Trekking Pole',
    brand: 'Trail Gear',
    categorySlug: 'sports-outdoors',
    description: 'Ultralight carbon fiber trekking poles with flick-lock adjustment.',
    longDescription: 'Designed for thru-hikers and backpackers who demand the lightest possible gear.',
    badges: [],
    images: [
      'https://images.pexels.com/photos/4185960/pexels-photo-4185960.jpeg',
      'https://images.pexels.com/photos/260854/pexels-photo-260854.jpeg',
    ],
    price: 14900,
    variants: [
      {
        variantId: 'apex-pole-pair',
        label: 'Pair of Poles',
        sku: 'TG-APX-PAIR',
        price: 14900,
        stock: 42,
        options: { quantity: 'Pair' },
        images: [
          'https://images.pexels.com/photos/4185960/pexels-photo-4185960.jpeg',
        ],
      },
    ],
    specs: [
      { key: 'Material', value: '100% carbon fiber' },
      { key: 'Weight', value: '16oz per pair (collapsed)' },
      { key: 'Length', value: '24" - 55" adjustable' },
    ],
    rating: { average: 4.7, count: 134 },
    attributes: { material: 'Carbon fiber', type: 'Adjustable trekking poles' },
  },

  {
    slug: 'summit-sleeping-bag',
    title: 'Summit 15° Sleeping Bag',
    brand: 'Alpine Gear',
    categorySlug: 'sports-outdoors',
    description: 'Mummy-style sleeping bag rated to 15°F with water-resistant shell.',
    longDescription: 'Premium down construction provides exceptional warmth-to-weight ratio for backpacking.',
    badges: ['Sale'],
    images: [
      'https://images.pexels.com/photos/4185960/pexels-photo-4185960.jpeg',
      'https://images.pexels.com/photos/260854/pexels-photo-260854.jpeg',
    ],
    price: 19900,
    variants: [
      {
        variantId: 'summit-bag-regular-green',
        label: 'Regular Length / Forest Green',
        sku: 'AG-SUM-REG-GRN',
        price: 19900,
        stock: 28,
        options: { length: 'Regular', color: 'Forest Green' },
        images: [
          'https://images.pexels.com/photos/4185960/pexels-photo-4185960.jpeg',
        ],
      },
      {
        variantId: 'summit-bag-long-green',
        label: 'Long Length / Forest Green',
        sku: 'AG-SUM-LNG-GRN',
        price: 21900,
        stock: 16,
        options: { length: 'Long', color: 'Forest Green' },
        images: [
          'https://images.pexels.com/photos/4185960/pexels-photo-4185960.jpeg',
        ],
      },
      {
        variantId: 'summit-bag-regular-grey',
        label: 'Regular Length / Storm Grey',
        sku: 'AG-SUM-REG-GRY',
        price: 19900,
        stock: 22,
        options: { length: 'Regular', color: 'Storm Grey' },
        images: [
          'https://images.pexels.com/photos/260854/pexels-photo-260854.jpeg',
        ],
      },
    ],
    specs: [
      { key: 'Shape', value: 'Mummy' },
      { key: 'Temperature Rating', value: '15°F / -9°C' },
      { key: 'Fill', value: '800+ fill power down' },
    ],
    rating: { average: 4.5, count: 91 },
    attributes: { material: 'Nylon shell with down fill', shape: 'Mummy' },
  },

  // BEAUTY & PERSONAL CARE
  {
    slug: 'serenity-skincare-set',
    title: 'Serenity Complete Skincare Set',
    brand: 'Glow',
    categorySlug: 'beauty-personal-care',
    description: 'Complete 5-piece skincare routine with natural ingredients.',
    longDescription: 'Achieve radiant, healthy skin with our curated set of premium skincare products.',
    badges: ['Bundle'],
    images: [
      'https://images.pexels.com/photos/8616540/pexels-photo-8616540.jpeg',
      'https://images.pexels.com/photos/6976082/pexels-photo-6976082.jpeg',
    ],
    price: 8900,
    variants: [
      {
        variantId: 'serenity-set-complete',
        label: 'Complete 5-Piece Set',
        sku: 'GL-SER-5PC',
        price: 8900,
        stock: 35,
        options: { type: 'Complete Set' },
        images: ['https://images.pexels.com/photos/8616540/pexels-photo-8616540.jpeg'],
      },
    ],
    specs: [
      { key: 'Products Included', value: 'Cleanser, Toner, Serum, Moisturizer, SPF' },
      { key: 'Skin Type', value: 'All skin types' },
      { key: 'Origin', value: 'Natural ingredients' },
    ],
    rating: { average: 4.4, count: 203 },
    attributes: { category: 'Skincare', type: 'Complete routine set' },
  },

  // ACCESSORIES
  {
    slug: 'chronos-smartwatch',
    title: 'Chronos Pro Smartwatch',
    brand: 'TimeTech',
    categorySlug: 'accessories',
    description: 'Advanced fitness tracking smartwatch with ECG and 7-day battery.',
    longDescription: 'Stay connected and monitor your health with our most advanced wearable technology.',
    badges: ['New'],
    images: [
      'https://images.pexels.com/photos/1697214/pexels-photo-1697214.jpeg',
      'https://images.pexels.com/photos/277390/pexels-photo-277390.jpeg',
    ],
    price: 34900,
    variants: [
      {
        variantId: 'chronos-black-sport',
        label: 'Midnight Black / Sport Band',
        sku: 'TT-CHR-BLK-SPT',
        price: 34900,
        stock: 23,
        options: { color: 'Midnight Black', band: 'Sport' },
        images: ['https://images.pexels.com/photos/1697214/pexels-photo-1697214.jpeg'],
      },
      {
        variantId: 'chronos-silver-leather',
        label: 'Silver / Leather Band',
        sku: 'TT-CHR-SLV-LTH',
        price: 34900,
        stock: 18,
        options: { color: 'Silver', band: 'Leather' },
        images: ['https://images.pexels.com/photos/277390/pexels-photo-277390.jpeg'],
      },
    ],
    specs: [
      { key: 'Display', value: '1.4" AMOLED' },
      { key: 'Battery Life', value: '7 days' },
      { key: 'Sensors', value: 'ECG, heart rate, SpO2' },
    ],
    rating: { average: 4.6, count: 156 },
    attributes: { type: 'Smartwatch', connectivity: 'Bluetooth 5.1' },
  },

  // JEWELRY
  {
    slug: 'eternal-heart-necklace',
    title: 'Eternal Heart Necklace',
    brand: 'Elegance',
    categorySlug: 'jewelry',
    description: 'Sterling silver heart pendant with 18k gold vermeil and cubic zirconia.',
    longDescription: 'A timeless symbol of love, crafted with meticulous attention to detail.',
    badges: [],
    images: [
      'https://images.pexels.com/photos/277390/pexels-photo-277390.jpeg',
      'https://images.pexels.com/photos/1697214/pexels-photo-1697214.jpeg',
    ],
    price: 12900,
    variants: [
      {
        variantId: 'eternal-heart-silver',
        label: 'Sterling Silver',
        sku: 'EL-ETR-SS',
        price: 12900,
        stock: 45,
        options: { material: 'Sterling Silver' },
        images: ['https://images.pexels.com/photos/1697214/pexels-photo-1697214.jpeg'],
      },
      {
        variantId: 'eternal-heart-gold',
        label: 'Gold Vermeil',
        sku: 'EL-ETR-GV',
        price: 15900,
        stock: 28,
        options: { material: 'Gold Vermeil' },
        images: ['https://images.pexels.com/photos/277390/pexels-photo-277390.jpeg'],
      },
    ],
    specs: [
      { key: 'Metal', value: 'Sterling silver, 18k gold vermeil' },
      { key: 'Gemstone', value: 'Cubic zirconia' },
      { key: 'Chain Length', value: '18" adjustable' },
    ],
    rating: { average: 4.8, count: 89 },
    attributes: { material: 'Sterling silver', style: 'Heart pendant' },
  },

  // Continuing with more products...
  {
    slug: 'urban-cycling-jersey',
    title: 'Urban Cycling Jersey',
    brand: 'Velocity',
    categorySlug: 'clothing',
    description: 'Aero-fit cycling jersey with moisture management and reflective details.',
    longDescription: 'Designed for urban cycling with features that keep you comfortable and visible.',
    badges: [],
    images: [
      'https://images.unsplash.com/photo-1579762593175-20226054cad0?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1544717297-fa95b6ee9643?auto=format&fit=crop&w=1200&q=80'
    ],
    price: 7900,
    variants: [
      {
        variantId: 'urban-jersey-blue-m',
        label: 'Electric Blue / Medium',
        sku: 'VL-URB-BLU-M',
        price: 7900,
        stock: 42,
        options: { color: 'Electric Blue', size: 'Medium' },
        images: ['https://images.pexels.com/photos/994234/pexels-photo-994234.jpeg'],
      },
      {
        variantId: 'urban-jersey-red-m',
        label: 'Flame Red / Medium',
        sku: 'VL-URB-RED-M',
        price: 7900,
        stock: 38,
        options: { color: 'Flame Red', size: 'Medium' },
        images: ['https://images.pexels.com/photos/434918/pexels-photo-434918.jpeg'],
      },
    ],
    specs: [
      { key: 'Fabric', value: 'Synthetic performance blend' },
      { key: 'Fit', value: 'Aero-fit' },
      { key: 'Features', value: 'Reflective details, rear zip pockets' },
    ],
    rating: { average: 4.1, count: 64 },
    attributes: { material: 'Performance synthetic', color: 'Electric Blue', style: 'Cycling' },
  },

  {
    slug: 'arctic-explorer-vest',
    title: 'Arctic Explorer Vest',
    brand: 'Cold Front',
    categorySlug: 'outerwear',
    description: 'Synthetic puffer vest with 650-fill power and water-resistant treatment.',
    longDescription: 'Essential layering piece for variable weather conditions without bulk.',
    badges: [],
    images: [
      'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg',
      'https://images.pexels.com/photos/603022/pexels-photo-603022.jpeg'
    ],
    price: 11900,
    variants: [
      {
        variantId: 'arctic-vest-black-l',
        label: 'Obsidian Black / Large',
        sku: 'CF-ARC-BLK-L',
        price: 11900,
        stock: 29,
        options: { color: 'Obsidian Black', size: 'Large' },
        images: ['https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg'],
      },
      {
        variantId: 'arctic-vest-navy-l',
        label: 'Navy Blue / Large',
        sku: 'CF-ARC-NAV-L',
        price: 11900,
        stock: 24,
        options: { color: 'Navy Blue', size: 'Large' },
        images: ['https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1200&q=80'],
      },
    ],
    specs: [
      { key: 'Fill Power', value: '650 fill power' },
      { key: 'Water Resistance', value: 'DWR treatment' },
      { key: 'Packability', value: 'Stuffs into pocket' },
    ],
    rating: { average: 4.4, count: 78 },
    attributes: { material: 'Nylon with synthetic fill', color: 'Obsidian Black', style: 'Vest' },
  },

  {
    slug: 'travel-daypack',
    title: 'Travel Daypack',
    brand: 'Urban Nomad',
    categorySlug: 'bags-luggage',
    description: '15L anti-theft daypack with USB charging port and laptop sleeve.',
    longDescription: 'Perfect for commuting or travel with smart security features and organization.',
    badges: [],
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80',
      'https://picsum.photos/id/140/1200/800'
    ],
    price: 6900,
    variants: [
      {
        variantId: 'travel-daypack-grey',
        label: 'Charcoal Grey',
        sku: 'UN-TRV-GRY',
        price: 6900,
        stock: 51,
        options: { color: 'Charcoal Grey' },
        images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        variantId: 'travel-daypack-navy',
        label: 'Navy Blue',
        sku: 'UN-TRV-NAV',
        price: 6900,
        stock: 43,
        options: { color: 'Navy Blue' },
        images: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80'],
      },
    ],
    specs: [
      { key: 'Capacity', value: '15L' },
      { key: 'Laptop Sleeve', value: 'Up to 15"' },
      { key: 'Features', value: 'USB charging port, anti-theft pockets' },
    ],
    rating: { average: 4.3, count: 112 },
    attributes: { material: 'Water-resistant nylon', capacity: '15L', style: 'Daypack' },
  },

  {
    slug: 'artisan-blender',
    title: 'Artisan Professional Blender',
    brand: 'Kitchen Pro',
    categorySlug: 'home-kitchen',
    description: 'Professional-grade blender with 1400W motor and variable speed control.',
    longDescription: 'Achieve restaurant-quality results at home with powerful motor and durable blades.',
    badges: ['Premium'],
    images: [
      'https://picsum.photos/id/141/1200/800',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=80'
    ],
    price: 17900,
    variants: [
      {
        variantId: 'artisan-blender-black',
        label: 'Matte Black',
        sku: 'KP-ART-BLK',
        price: 17900,
        stock: 22,
        options: { color: 'Matte Black' },
        images: ['https://picsum.photos/id/155/1200/800'],
      },
      {
        variantId: 'artisan-blender-silver',
        label: 'Bristled Stainless',
        sku: 'KP-ART-SS',
        price: 17900,
        stock: 18,
        options: { color: 'Stainless Steel' },
        images: ['https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&q=80'],
      },
    ],
    specs: [
      { key: 'Power', value: '1400W' },
      { key: 'Capacity', value: '72oz pitcher' },
      { key: 'Controls', value: '10-speed + pulse' },
    ],
    rating: { average: 4.5, count: 87 },
    attributes: { power: '1400W', material: 'Stainless steel blades', color: 'Matte Black' },
  },

  {
    slug: 'titan-mechanical-keyboard',
    title: 'Titan Mechanical Gaming Keyboard',
    brand: 'GameForge',
    categorySlug: 'electronics',
    description: 'RGB mechanical keyboard with cherry MX switches and aluminum chassis.',
    longDescription: 'Professional gaming keyboard built for tournament-level performance.',
    badges: [],
    images: [
      'https://images.unsplash.com/photo-1541140532154-b024d705b90a?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1200&q=80'
    ],
    price: 15900,
    variants: [
      {
        variantId: 'titan-keyboard-rgb-red',
        label: 'RGB Red Switches',
        sku: 'GF-TIT-RGB-RED',
        price: 15900,
        stock: 31,
        options: { switch: 'Cherry MX Red' },
        images: ['https://images.unsplash.com/photo-1541140532154-b024d705b90a?auto=format&fit=crop&w=1200&q=80'],
      },
      {
        variantId: 'titan-keyboard-rgb-blue',
        label: 'RGB Blue Switches',
        sku: 'GF-TIT-RGB-BLU',
        price: 15900,
        stock: 25,
        options: { switch: 'Cherry MX Blue' },
        images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1200&q=80'],
      },
    ],
    specs: [
      { key: 'Switches', value: 'Cherry MX mechanical' },
      { key: 'Backlighting', value: 'Per-key RGB' },
      { key: 'Construction', value: 'Aluminum chassis' },
    ],
    rating: { average: 4.7, count: 198 },
    attributes: { type: 'Mechanical keyboard', switches: 'Cherry MX', lighting: 'RGB' },
  },

  {
    slug: 'horizon-binoculars-10x42',
    title: 'Horizon 10x42 Binoculars',
    brand: 'Optics Pro',
    categorySlug: 'sports-outdoors',
    description: 'High-definition binoculars with phase-corrected roof prisms and 10x magnification.',
    longDescription: 'Crystal clear optics for wildlife observation and birdwatching.',
    badges: [],
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80'
    ],
    price: 29900,
    variants: [
      {
        variantId: 'horizon-binoculars-10x42',
        label: '10x42 with Harness',
        sku: 'OP-HRZ-10X42',
        price: 29900,
        stock: 24,
        options: { magnification: '10x42' },
        images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80'],
      },
    ],
    specs: [
      { key: 'Magnification', value: '10x' },
      { key: 'Objective Lens', value: '42mm' },
      { key: 'Field of View', value: '314 ft at 1000 yards' },
    ],
    rating: { average: 4.6, count: 178 },
    attributes: { type: 'Binoculars', magnification: '10x', lens: '42mm' },
  },
];

function objectIdFor(seed: string) {
  const hex = createHash('md5').update(seed).digest('hex').slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

export async function seedMongo(mongoUrl = process.env.MONGO_URL ?? DEFAULT_MONGO_URL) {
  await connectMongo(mongoUrl);

  const now = new Date();
  const categorySeeds = categoriesData.map((cat, index) => ({
    ...cat,
    _id: objectIdFor(`category:${cat.slug}`),
    createdAt: new Date(now.getTime() + index),
    updatedAt: new Date(now.getTime() + index),
  }));

  await Category.deleteMany({});
  if (categorySeeds.length) {
    await Category.insertMany(categorySeeds, { ordered: true });
  }

  const categoryLookup = new Map(categorySeeds.map((cat) => [cat.slug, cat]));

  // Simplified image validation for this fix
  const categoryFallbacks: Record<string, string> = {
    footwear: 'https://picsum.photos/id/142/1200/800',
    clothing: 'https://picsum.photos/id/143/1200/800',
    outerwear: 'https://picsum.photos/id/144/1200/800',
    'bags-luggage': 'https://picsum.photos/id/145/1200/800',
    'home-kitchen': 'https://picsum.photos/id/146/1200/800',
    electronics: 'https://picsum.photos/id/147/1200/800',
    'sports-outdoors': 'https://picsum.photos/id/148/1200/800',
    'beauty-personal-care': 'https://picsum.photos/id/149/1200/800',
    accessories: 'https://picsum.photos/id/150/1200/800',
    jewelry: 'https://picsum.photos/id/151/1200/800',
  };

  // Simplified resolveImages
  async function resolveImages(urls?: string[], categorySlug?: string, productSlug?: string, variantId?: string) {
    const fallback = categoryFallbacks[categorySlug || ''] || categoryFallbacks.footwear;
    return urls && urls.length > 0 ? urls : [
      `https://picsum.photos/seed/${productSlug || 'product'}-0/1200/800`,
      `https://picsum.photos/seed/${productSlug || 'product'}-1/1200/800`,
      `https://picsum.photos/seed/${productSlug || 'product'}-2/1200/800`
    ].slice(0, 3);
  }

  const productDocuments = [];
  for (const [index, product] of productCatalog.entries()) {
    const category = categoryLookup.get(product.categorySlug);
    if (!category) {
      throw new Error(`Seed configuration error: category ${product.categorySlug} not found for product ${product.slug}`);
    }

    const resolvedProductImages = await resolveImages(product.images, product.categorySlug, product.slug);

    const variants = [];
    for (const variant of product.variants) {
      const resolvedId = variant.variantId || `${product.slug}-${Object.values(variant.options).join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const resolvedVariantImages = await resolveImages(variant.images, product.categorySlug, product.slug, variant.variantId);

      variants.push({
        variantId: resolvedId,
        sku: variant.sku,
        label: variant.label,
        options: variant.options,
        price: variant.price,
        stock: variant.stock,
        images: resolvedVariantImages,
      });
    }

    const totalStock = variants.reduce((sum, entry) => sum + (entry.stock || 0), 0);
    const defaultVariantId = variants[0]?.variantId;

    const baseAttributes = {
      brand: product.brand,
      ...product.attributes,
      ...(variants[0]?.options?.color ? { color: variants[0].options.color } : {}),
      ...(variants[0]?.options?.size ? { size: variants[0].options.size } : {}),
    };
    const attributes = Object.fromEntries(
      Object.entries(baseAttributes).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );

    productDocuments.push({
      _id: objectIdFor(`product:${product.slug}`),
      title: product.title,
      slug: product.slug,
      description: product.description,
      longDescription: product.longDescription,
      brand: product.brand,
      badges: product.badges ?? [],
      images: resolvedProductImages,
      price: variants[0]?.price ?? product.price,
      currency: product.currency ?? 'USD',
      categoryId: category._id.toString(),
      stock: totalStock || 12,
      attributes,
      variants,
      defaultVariantId,
      specs: product.specs ?? [],
      rating: product.rating ?? { average: 4.4, count: 24 },
    });
  }

  await Product.deleteMany({});
  if (productDocuments.length) {
    await Product.insertMany(
      productDocuments.map((product, index) => ({
        ...product,
        createdAt: new Date(now.getTime() + index),
        updatedAt: new Date(now.getTime() + index),
      })),
      { ordered: true }
    );
  }

  console.log(`[seed] Upserted ${categoriesData.length} categories and ${productDocuments.length} products in MongoDB.`);
  return productDocuments.map((product) => String(product._id));
}

export async function seedPostgres(productIds: string[]) {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  // Check for existing admin user instead of upsert
  let existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  let admin;
  if (existingAdmin) {
    admin = await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: {
        passwordHash: adminPassword,
        role: 'admin',
        name: existingAdmin.name || 'Admin User' // ensure name is set
      }
    });
  } else {
    admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        passwordHash: adminPassword,
        role: 'admin',
        name: 'Admin User',
      },
    });
  }

  // Check for existing customer user instead of upsert
  let existingCustomer = await prisma.user.findUnique({ where: { email: CUSTOMER_EMAIL } });
  let customer;
  if (existingCustomer) {
    customer = await prisma.user.update({
      where: { email: CUSTOMER_EMAIL },
      data: {
        passwordHash: userPassword,
        role: 'customer',
        name: existingCustomer.name || 'Demo Customer' // ensure name is set
      }
    });
  } else {
    customer = await prisma.user.create({
      data: {
        email: CUSTOMER_EMAIL,
        passwordHash: userPassword,
        role: 'customer',
        name: 'Demo Customer',
      },
    });
  }

  if (productIds.length >= 3) {
    await prisma.event.upsert({
      where: { id: 'seed-event-view' },
      update: { userId: customer.id, payload: { productId: productIds[0] }, type: 'view' },
      create: { id: 'seed-event-view', userId: customer.id, payload: { productId: productIds[0] }, type: 'view' },
    });

    await prisma.event.upsert({
      where: { id: 'seed-event-cart' },
      update: { userId: customer.id, payload: { productId: productIds[1] }, type: 'add_to_cart' },
      create: { id: 'seed-event-cart', userId: customer.id, payload: { productId: productIds[1] }, type: 'add_to_cart' },
    });

    await prisma.event.upsert({
      where: { id: 'seed-event-purchase' },
      update: { userId: customer.id, payload: { productId: productIds[2] }, type: 'purchase' },
      create: { id: 'seed-event-purchase', userId: customer.id, payload: { productId: productIds[2] }, type: 'purchase' },
    });
  }

  // Create sample completed orders for admin dashboard
  if (productIds.length >= 3) {
    // Create sample order items and orders
    for (let i = 0; i < 5; i++) {
      const orderDate = new Date(Date.now() - (i * 86400000)); // One order per day for past 5 days

      await prisma.$transaction(async (tx) => {
        // Create order
        const order = await tx.order.create({
          data: {
            userId: customer.id,
            sessionId: `session-${i}`,
            subtotal: 14000 + i * 1000,
            taxAmount: Math.round((14000 + i * 1000) * 0.08),
            shippingAmount: 0, // Free shipping
            discountAmount: 0,
            total: 14000 + i * 1000 + Math.round((14000 + i * 1000) * 0.08),
            currency: 'USD',
            status: i === 0 ? 'paid' : 'paid', // All orders are paid to show reorder functionality
          },
        });

        // Create order items - use different products for each order
        const productsToUse = productIds.slice(i % 2, (i % 2) + 2).slice(0, 2);

        for (let j = 0; j < productsToUse.length; j++) {
          const productId = productsToUse[j];
          const price = 5000 + (j * 3000); // Varying prices

          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: productId,
              title: `Sample Product ${j + 1}`,
              price: price,
              qty: j === 0 ? 2 : 1, // First item: 2 qty, second item: 1 qty
              variantId: null,
              variantLabel: null,
              variantOptions: undefined,
            },
          });
        }

        // Create payment record
        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: order.total,
            status: 'paid',
            stripePaymentIntentId: `pi_demo_${order.id}`,
          },
        });
      });
    }
  }

  return { admin, customer };
}

export async function seedAll(options: { mongoUrl?: string } = {}) {
  const mongoUrl = options.mongoUrl ?? process.env.MONGO_URL ?? DEFAULT_MONGO_URL;
  const productIds = await seedMongo(mongoUrl);

  if (productIds.length < 3) {
    throw new Error(`Mongo seed only returned ${productIds.length} product IDs; expected at least 3 so Postgres seed can attach analytics events.`);
  }

  await seedPostgres(productIds.slice(0, 3));
  return { productIds };
}

export async function ensureDatabasesSeeded(options: { mongoUrl?: string } = {}) {
  const mongoUrl = options.mongoUrl ?? process.env.MONGO_URL ?? DEFAULT_MONGO_URL;

  await connectMongo(mongoUrl);

  const [categoryCount, productCount, adminCount, customerCount, eventCount] = await Promise.all([
    Category.estimatedDocumentCount().exec(),
    Product.estimatedDocumentCount().exec(),
    prisma.user.count({ where: { email: ADMIN_EMAIL } }),
    prisma.user.count({ where: { email: CUSTOMER_EMAIL } }),
    prisma.event.count({ where: { id: { in: ['seed-event-view', 'seed-event-cart', 'seed-event-purchase'] } } }),
  ]);

  const needsMongoSeed = categoryCount === 0 || productCount === 0;
  const needsPostgresSeed = adminCount === 0 || customerCount === 0 || eventCount < 3;

  if (!needsMongoSeed && !needsPostgresSeed) {
    return false;
  }

  await seedAll({ mongoUrl });
  return true;
}
