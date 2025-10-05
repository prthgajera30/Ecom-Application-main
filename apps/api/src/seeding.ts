import { createHash } from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import { prisma, Product, Category, connectMongo } from './db';

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
  { name: 'Apparel', slug: 'apparel' },
  { name: 'Outerwear', slug: 'outerwear' },
  { name: 'Gear & Travel', slug: 'gear-travel' },
  { name: 'Home & Kitchen', slug: 'home-kitchen' },
  { name: 'Accessories', slug: 'accessories' },
  { name: 'Wellness', slug: 'wellness' },
  { name: 'Tech', slug: 'tech' },
];

const productCatalog: SeedProduct[] = [
  {
    slug: 'aurora-running-sneaker',
    title: 'Aurora Running Sneaker',
    brand: 'StrideLab',
    categorySlug: 'footwear',
    description: 'Lightweight daily trainer with responsive cushioning for runners logging serious miles.',
    longDescription:
      'Aurora blends a recycled engineered mesh upper with a pebax energy core midsole to deliver breathable comfort and serious rebound. The secure heel cradle and articulated outsole flex naturally with your stride, making it the go-to shoe for tempo sessions and long runs alike.',
    badges: ['Bestseller'],
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1526804507-25e8e2ee632e?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1588361861040-3f3c46ef6c26?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 13900,
    currency: 'USD',
    variants: [
      {
        variantId: 'aurora-running-sneaker-onyx-8',
        label: 'Onyx Black / US 8',
        sku: 'SL-AUR-ONX-8',
        price: 13900,
        stock: 16,
        options: { color: 'Onyx Black', size: 'US 8' },
        images: [
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1526804507-25e8e2ee632e?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'aurora-running-sneaker-onyx-9',
        label: 'Onyx Black / US 9',
        sku: 'SL-AUR-ONX-9',
        price: 13900,
        stock: 22,
        options: { color: 'Onyx Black', size: 'US 9' },
        images: [
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1526804507-25e8e2ee632e?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'aurora-running-sneaker-onyx-10',
        label: 'Onyx Black / US 10',
        sku: 'SL-AUR-ONX-10',
        price: 13900,
        stock: 18,
        options: { color: 'Onyx Black', size: 'US 10' },
        images: [
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1526804507-25e8e2ee632e?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'aurora-running-sneaker-ocean-8',
        label: 'Ocean Mist / US 8',
        sku: 'SL-AUR-OCN-8',
        price: 14500,
        stock: 14,
        options: { color: 'Ocean Mist', size: 'US 8' },
        images: [
          'https://images.unsplash.com/photo-1595341888016-a392ef81b7de?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1579338559194-a162d19bf842?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'aurora-running-sneaker-ocean-9',
        label: 'Ocean Mist / US 9',
        sku: 'SL-AUR-OCN-9',
        price: 14500,
        stock: 20,
        options: { color: 'Ocean Mist', size: 'US 9' },
        images: [
          'https://images.unsplash.com/photo-1595341888016-a392ef81b7de?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1579338559194-a162d19bf842?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'aurora-running-sneaker-ocean-10',
        label: 'Ocean Mist / US 10',
        sku: 'SL-AUR-OCN-10',
        price: 14500,
        stock: 15,
        options: { color: 'Ocean Mist', size: 'US 10' },
        images: [
          'https://images.unsplash.com/photo-1595341888016-a392ef81b7de?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1579338559194-a162d19bf842?auto=format&fit=crop&w=1200&q=80',
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
  {
    slug: 'meridian-commuter-backpack',
    title: 'Meridian Commuter Backpack',
    brand: 'Northwind Supply',
    categorySlug: 'gear-travel',
    description: 'Weatherproof 24L commuter pack with padded laptop sleeve and clever organization.',
    longDescription:
      'The Meridian Commuter Backpack is engineered to keep your daily essentials protected and within reach. A DWR-coated recycled canvas shell sheds unexpected showers while the structured interior houses a 16-inch laptop sleeve, quick-access tech pocket, and modular compression straps.',
    badges: ['Water-resistant', 'Recycled'],
    images: [
      'https://images.unsplash.com/photo-1516205651411-aef33a44f7c2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 18900,
    currency: 'USD',
    variants: [
      {
        variantId: 'meridian-backpack-graphite',
        label: 'Graphite',
        sku: 'NW-MER-GRA',
        price: 18900,
        stock: 28,
        options: { color: 'Graphite Grey', capacity: '24L' },
        images: [
          'https://images.unsplash.com/photo-1516205651411-aef33a44f7c2?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'meridian-backpack-moss',
        label: 'Deep Moss',
        sku: 'NW-MER-MOS',
        price: 18900,
        stock: 24,
        options: { color: 'Deep Moss', capacity: '24L' },
        images: [
          'https://images.unsplash.com/photo-1528819622765-d6bcf132f793?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1510074377623-8cf13fb86c08?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Volume', value: '24L' },
      { key: 'Outer Fabric', value: '100% recycled 600D canvas with DWR' },
      { key: 'Laptop Sleeve', value: 'Fits up to 16" devices' },
    ],
    rating: { average: 4.7, count: 96 },
    attributes: {
      material: 'Recycled canvas',
      color: 'Graphite Grey',
    },
  },
  {
    slug: 'summit-field-jacket',
    title: 'Summit Field Jacket',
    brand: 'Redwood & Co.',
    categorySlug: 'outerwear',
    description: 'Heritage-inspired field jacket upgraded with modern waterproof-breathable technology.',
    longDescription:
      'Crafted with a three-layer waterproof membrane and soft brushed lining, the Summit Field Jacket shields from alpine squalls while maintaining day-long comfort. Articulated sleeves, storm flap pockets, and a removable hood adapt effortlessly from city commutes to trail weekends.',
    badges: ['Weatherproof'],
    images: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 25900,
    variants: [
      {
        variantId: 'summit-field-jacket-olive-s',
        label: 'Olive / Small',
        sku: 'RW-SUM-OLV-S',
        price: 25900,
        stock: 12,
        options: { color: 'Olive', size: 'Small' },
        images: [
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'summit-field-jacket-olive-m',
        label: 'Olive / Medium',
        sku: 'RW-SUM-OLV-M',
        price: 25900,
        stock: 18,
        options: { color: 'Olive', size: 'Medium' },
        images: [
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'summit-field-jacket-olive-l',
        label: 'Olive / Large',
        sku: 'RW-SUM-OLV-L',
        price: 25900,
        stock: 17,
        options: { color: 'Olive', size: 'Large' },
        images: [
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'summit-field-jacket-onyx-xl',
        label: 'Onyx / XL',
        sku: 'RW-SUM-ONX-XL',
        price: 26900,
        stock: 10,
        options: { color: 'Onyx Black', size: 'XL' },
        images: [
          'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Shell', value: '3-layer recycled nylon with 20K/20K membrane' },
      { key: 'Lining', value: 'Soft brushed tricot' },
      { key: 'Features', value: 'Removable hood, storm flap pockets, cinch hem' },
    ],
    rating: { average: 4.5, count: 74 },
    attributes: {
      material: '3-layer recycled nylon',
      color: 'Olive',
    },
  },
  {
    slug: 'lumen-active-tee',
    title: 'Lumen Active Tee',
    brand: 'Aether Athletics',
    categorySlug: 'apparel',
    description: 'Moisture-wicking training tee with cooling minerals and bonded seams.',
    longDescription:
      'The Lumen Active Tee is your go-to layer for high-output sessions. An open-knit micro-mesh back dumps heat, while the front panel uses mineral-infused fibers that actively pull warmth from the skin. Bonded seams eliminate chafe so you can focus on the workout.',
    badges: ['New Arrival'],
    images: [
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80',
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
          'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'lumen-tee-storm-m',
        label: 'Storm Grey / Medium',
        sku: 'AT-LUM-STR-M',
        price: 7800,
        stock: 28,
        options: { color: 'Storm Grey', size: 'Medium' },
        images: [
          'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'lumen-tee-storm-l',
        label: 'Storm Grey / Large',
        sku: 'AT-LUM-STR-L',
        price: 7800,
        stock: 24,
        options: { color: 'Storm Grey', size: 'Large' },
        images: [
          'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'lumen-tee-ember-m',
        label: 'Ember / Medium',
        sku: 'AT-LUM-EMB-M',
        price: 8200,
        stock: 18,
        options: { color: 'Ember Red', size: 'Medium' },
        images: [
          'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'lumen-tee-tide-l',
        label: 'Tide Blue / Large',
        sku: 'AT-LUM-TID-L',
        price: 8200,
        stock: 16,
        options: { color: 'Tide Blue', size: 'Large' },
        images: [
          'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Fabric', value: '52% recycled polyester, 48% phase-change nylon' },
      { key: 'Features', value: 'Anti-odor finish, bonded seams, drop hem' },
    ],
    rating: { average: 4.4, count: 63 },
    attributes: {
      material: 'Recycled performance knit',
      color: 'Storm Grey',
    },
  },
  {
    slug: 'cascade-pour-over-set',
    title: 'Cascade Pour-Over Set',
    brand: 'Hearthline',
    categorySlug: 'home-kitchen',
    description: 'Hand-glazed ceramic pour-over brewer with double-wall carafe for café-level coffee at home.',
    longDescription:
      'The Cascade set features a precision-pierced dripper paired with a double-wall carafe that keeps your brew at the perfect sipping temperature. Each piece is hand-glazed, producing subtle variations that make every set unique.',
    badges: ['Small Batch'],
    images: [
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1459755486867-b55449bb39ff?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 12400,
    variants: [
      {
        variantId: 'cascade-set-sandstone',
        label: 'Sandstone',
        sku: 'HL-CAS-SAND',
        price: 12400,
        stock: 22,
        options: { color: 'Sandstone', size: 'Universal' },
        images: [
          'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'cascade-set-charcoal',
        label: 'Charcoal',
        sku: 'HL-CAS-CHAR',
        price: 12400,
        stock: 18,
        options: { color: 'Charcoal', size: 'Universal' },
        images: [
          'https://images.unsplash.com/photo-1510627498534-cf7e9002facc?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Capacity', value: '600 ml carafe' },
      { key: 'Material', value: 'Double-wall ceramic with walnut lid' },
      { key: 'Included', value: 'Dripper, carafe, reusable stainless filter' },
    ],
    rating: { average: 4.8, count: 54 },
    attributes: {
      material: 'Ceramic',
      color: 'Sandstone',
    },
  },
  {
    slug: 'echo-noise-cancelling-earbuds',
    title: 'Echo Noise-Cancelling Earbuds',
    brand: 'Horizon Audio',
    categorySlug: 'tech',
    description: 'Adaptive ANC earbuds with 8-hour battery life and wireless charging case.',
    longDescription:
      'Echo earbuds analyze ambient sound in real time, adapting active noise cancellation on the fly. The graphene-coated drivers deliver rich, balanced sound, while the ergonomic silhouette stays secure through every commute and workout.',
    badges: ['Top Rated'],
    images: [
      'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1584946488600-0c2f87f2360c?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 19900,
    variants: [
      {
        variantId: 'echo-earbuds-graphite',
        label: 'Graphite',
        sku: 'HA-ECH-GRA',
        price: 19900,
        stock: 34,
        options: { color: 'Graphite', storage: 'Standard' },
        images: [
          'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'echo-earbuds-ivory',
        label: 'Ivory',
        sku: 'HA-ECH-IVR',
        price: 19900,
        stock: 29,
        options: { color: 'Ivory', storage: 'Standard' },
        images: [
          'https://images.unsplash.com/photo-1584946488600-0c2f87f2360c?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Battery Life', value: '8 hours playback + 24 hours with case' },
      { key: 'Connectivity', value: 'Bluetooth 5.3 with multipoint' },
      { key: 'Features', value: 'IPX4 water resistance, wireless Qi charging' },
    ],
    rating: { average: 4.7, count: 211 },
    attributes: {
      color: 'Graphite',
    },
  },
  {
    slug: 'horizon-solar-smartwatch',
    title: 'Horizon Solar Smartwatch',
    brand: 'Solace Instruments',
    categorySlug: 'tech',
    description: 'Hybrid smartwatch powered by ambient light with multi-sport GPS tracking.',
    longDescription:
      'Horizon pairs a sapphire crystal lens with discreet solar cells, extending daylight battery life for weeks. A crisp AMOLED display, onboard maps, and heart rate variability tracking provide insight for athletes and adventurers alike.',
    images: [
      'https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 32900,
    variants: [
      {
        variantId: 'horizon-watch-steel',
        label: 'Matte Steel',
        sku: 'SI-HOR-STE',
        price: 32900,
        stock: 18,
        options: { color: 'Matte Steel', strap: 'Silicone' },
        images: [
          'https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'horizon-watch-graphite',
        label: 'Graphite Leather',
        sku: 'SI-HOR-GRA',
        price: 34900,
        stock: 14,
        options: { color: 'Graphite', strap: 'Horween leather' },
        images: [
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'horizon-watch-slate',
        label: 'Slate Nylon',
        sku: 'SI-HOR-SLT',
        price: 33900,
        stock: 16,
        options: { color: 'Slate', strap: 'Recycled nylon' },
        images: [
          'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Battery Life', value: '18 days smartwatch mode with solar charging' },
      { key: 'Sensors', value: 'GPS, HR, Pulse Ox, altimeter, barometer' },
      { key: 'Water Rating', value: '10 ATM' },
    ],
    rating: { average: 4.5, count: 132 },
    attributes: {
      color: 'Matte Steel',
    },
  },
  {
    slug: 'loft-knit-throw',
    title: 'Loft Knit Throw',
    brand: 'Oak & Loom',
    categorySlug: 'home-kitchen',
    description: 'Ultra-soft organic cotton throw with oversized waffle texture.',
    longDescription:
      'Woven on vintage looms in Portugal, the Loft Knit Throw layers beautifully over sofas and beds. Its airy waffle texture traps warmth without weight, and the enzyme wash finishes each piece with an irresistible softness.',
    images: [
      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1449247709967-d4461a6a6103?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 9800,
    variants: [
      {
        variantId: 'loft-throw-oat',
        label: 'Oat Heather',
        sku: 'OL-LOF-OAT',
        price: 9800,
        stock: 30,
        options: { color: 'Oat Heather', size: '50" x 70"' },
        images: [
          'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'loft-throw-slate',
        label: 'Slate Blue',
        sku: 'OL-LOF-SLT',
        price: 9800,
        stock: 26,
        options: { color: 'Slate Blue', size: '50" x 70"' },
        images: [
          'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Material', value: '100% GOTS-certified organic cotton' },
      { key: 'Care', value: 'Machine wash cold, tumble dry low' },
    ],
    rating: { average: 4.9, count: 88 },
    attributes: {
      material: 'Organic cotton',
      color: 'Oat Heather',
    },
  },
  {
    slug: 'cascade-stainless-bottle',
    title: 'Cascade Insulated Bottle',
    brand: 'Peak Hydration',
    categorySlug: 'wellness',
    description: 'Vacuum-insulated stainless bottle that keeps drinks cold for 30 hours.',
    longDescription:
      'Built from double-wall stainless steel with a copper lining, the Cascade bottle resists condensation and maintains temperature through full-day adventures. A powder-coated exterior improves grip while the removable strap clips onto packs.',
    images: [
      'https://images.unsplash.com/photo-1600180758890-6b94519a181c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1526404428533-46c4e5e83287?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 4200,
    variants: [
      {
        variantId: 'cascade-bottle-21oz',
        label: '21 oz / Glacier',
        sku: 'PH-CAS-21G',
        price: 4200,
        stock: 42,
        options: { color: 'Glacier Blue', capacity: '21 oz' },
        images: [
          'https://images.unsplash.com/photo-1600180758890-6b94519a181c?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'cascade-bottle-32oz',
        label: '32 oz / Obsidian',
        sku: 'PH-CAS-32O',
        price: 4800,
        stock: 36,
        options: { color: 'Obsidian', capacity: '32 oz' },
        images: [
          'https://images.unsplash.com/photo-1526404428533-46c4e5e83287?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Insulation', value: 'Double-wall stainless with copper lining' },
      { key: 'Keeps Cold', value: 'Up to 30 hours' },
      { key: 'Lid', value: 'Leakproof twist cap with strap' },
    ],
    rating: { average: 4.6, count: 57 },
    attributes: {
      material: 'Stainless steel',
      color: 'Glacier Blue',
    },
  },
  {
    slug: 'atlas-slim-wallet',
    title: 'Atlas Slim Wallet',
    brand: 'Beacon Street',
    categorySlug: 'accessories',
    description: 'Hand-finished leather wallet with RFID shielding and quick-access pull tab.',
    longDescription:
      'The Atlas Slim Wallet is crafted from vegetable-tanned leather that patinas beautifully over time. Six card slots, a secure cash sleeve, and RFID shielding keep essentials organized without the bulk.',
    images: [
      'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 9800,
    variants: [
      {
        variantId: 'atlas-wallet-cognac',
        label: 'Cognac',
        sku: 'BS-ATL-COG',
        price: 9800,
        stock: 32,
        options: { color: 'Cognac', size: 'One Size' },
        images: [
          'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'atlas-wallet-chestnut',
        label: 'Chestnut',
        sku: 'BS-ATL-CHS',
        price: 9800,
        stock: 27,
        options: { color: 'Chestnut', size: 'One Size' },
        images: [
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'atlas-wallet-onyx',
        label: 'Onyx',
        sku: 'BS-ATL-ONX',
        price: 9800,
        stock: 25,
        options: { color: 'Onyx', size: 'One Size' },
        images: [
          'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Material', value: 'Vegetable-tanned leather with cotton lining' },
      { key: 'Capacity', value: 'Holds 8 cards plus cash' },
      { key: 'Features', value: 'RFID shielding, quick-access pull tab' },
    ],
    rating: { average: 4.8, count: 141 },
    attributes: {
      material: 'Vegetable-tanned leather',
      color: 'Cognac',
    },
  },
  {
    slug: 'terra-hiker-boot',
    title: 'Terra Hiker Boot',
    brand: 'Summit Forge',
    categorySlug: 'footwear',
    description: 'Waterproof hiking boot with Vibram outsole built for technical trails.',
    longDescription:
      'Terra combines a full-grain leather upper with a seam-sealed membrane to block out weather while keeping feet supported on unpredictable terrain. Cushioned EVA midsoles absorb impact and a Vibram Megagrip outsole bites into wet rock and slick roots.',
    badges: ['Waterproof'],
    images: [
      'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 18900,
    currency: 'USD',
    variants: [
      {
        variantId: 'terra-boot-cedar-9',
        label: 'Cedar Brown / US 9',
        sku: 'SF-TER-CED-9',
        price: 18900,
        stock: 14,
        options: { color: 'Cedar Brown', size: 'US 9' },
        images: [
          'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'terra-boot-cedar-10',
        label: 'Cedar Brown / US 10',
        sku: 'SF-TER-CED-10',
        price: 18900,
        stock: 18,
        options: { color: 'Cedar Brown', size: 'US 10' },
        images: [
          'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'terra-boot-slate-11',
        label: 'Slate Grey / US 11',
        sku: 'SF-TER-SLT-11',
        price: 19500,
        stock: 12,
        options: { color: 'Slate Grey', size: 'US 11' },
        images: [
          'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Upper', value: 'Full-grain leather with seam-sealed membrane' },
      { key: 'Outsole', value: 'Vibram Megagrip rubber' },
      { key: 'Weight', value: '21 oz (size 10)' },
    ],
    rating: { average: 4.5, count: 68 },
    attributes: {
      material: 'Full-grain leather',
      color: 'Cedar Brown',
    },
  },
  {
    slug: 'velocity-court-sneaker',
    title: 'Velocity Court Sneaker',
    brand: 'Stratus Labs',
    categorySlug: 'footwear',
    description: 'Heritage-inspired court sneaker tuned for everyday comfort.',
    longDescription:
      'Velocity revitalizes a classic tennis silhouette with a recycled leather upper, responsive cupsole cushioning, and memory foam ankle collar. It is light enough for all-day wear while the rubber outsole maintains the board feel sneakerheads love.',
    badges: ['Recycled'],
    images: [
      'https://images.unsplash.com/photo-1517142874080-09548ab78358?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1518226203300-8d3f06ed9c6d?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 12500,
    variants: [
      {
        variantId: 'velocity-sneaker-ice-8',
        label: 'Ice White / US 8',
        sku: 'SLB-VEL-ICE-8',
        price: 12500,
        stock: 20,
        options: { color: 'Ice White', size: 'US 8' },
        images: [
          'https://images.unsplash.com/photo-1517142874080-09548ab78358?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1518226203300-8d3f06ed9c6d?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'velocity-sneaker-ice-9',
        label: 'Ice White / US 9',
        sku: 'SLB-VEL-ICE-9',
        price: 12500,
        stock: 26,
        options: { color: 'Ice White', size: 'US 9' },
        images: [
          'https://images.unsplash.com/photo-1517142874080-09548ab78358?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'velocity-sneaker-midnight-10',
        label: 'Midnight Navy / US 10',
        sku: 'SLB-VEL-MID-10',
        price: 12900,
        stock: 18,
        options: { color: 'Midnight Navy', size: 'US 10' },
        images: [
          'https://images.unsplash.com/photo-1518226203300-8d3f06ed9c6d?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1517142874080-09548ab78358?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Upper', value: 'Recycled leather with perforated vamp' },
      { key: 'Midsole', value: 'Responsive molded cupsole' },
      { key: 'Lining', value: 'Plant-based microfiber' },
    ],
    rating: { average: 4.4, count: 52 },
    attributes: {
      material: 'Recycled leather',
      color: 'Ice White',
    },
  },
  {
    slug: 'mariner-slip-on',
    title: 'Mariner Slip-On',
    brand: 'Tidebreak',
    categorySlug: 'footwear',
    description: 'Easy slip-on sneaker with breathable knit built for coastal weekends.',
    longDescription:
      'Mariner pairs a saltwater-resistant knit upper with antimicrobial linings, making it the go-to for boardwalk strolls and casual commutes alike. A collapsible heel turns the shoe into a slide, and the soft midsole keeps steps cushioned.',
    images: [
      'https://images.unsplash.com/photo-1510146758428-e5e4b17b8b6d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1445796886651-d31a2c15f3c9?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 9200,
    variants: [
      {
        variantId: 'mariner-slip-navy-9',
        label: 'Deep Navy / US 9',
        sku: 'TDB-MAR-NVY-9',
        price: 9200,
        stock: 24,
        options: { color: 'Deep Navy', size: 'US 9' },
        images: [
          'https://images.unsplash.com/photo-1510146758428-e5e4b17b8b6d?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'mariner-slip-navy-10',
        label: 'Deep Navy / US 10',
        sku: 'TDB-MAR-NVY-10',
        price: 9200,
        stock: 22,
        options: { color: 'Deep Navy', size: 'US 10' },
        images: [
          'https://images.unsplash.com/photo-1510146758428-e5e4b17b8b6d?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1445796886651-d31a2c15f3c9?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'mariner-slip-sand-9',
        label: 'Drift Sand / US 9',
        sku: 'TDB-MAR-SND-9',
        price: 9600,
        stock: 16,
        options: { color: 'Drift Sand', size: 'US 9' },
        images: [
          'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1445796886651-d31a2c15f3c9?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Upper', value: 'Saltwater-resistant engineered knit' },
      { key: 'Insole', value: 'Antimicrobial foam with arch support' },
      { key: 'Outsole', value: 'Slip-resistant rubber pods' },
    ],
    rating: { average: 4.3, count: 47 },
    attributes: {
      material: 'Engineered knit',
      color: 'Deep Navy',
    },
  },
  {
    slug: 'zenith-fleece-hoodie',
    title: 'Zenith Fleece Hoodie',
    brand: 'Aether Athletics',
    categorySlug: 'apparel',
    description: 'Midweight hoodie with brushed interior and bonded pocketing.',
    longDescription:
      'Zenith is crafted from recycled double-knit fleece that traps warmth without bulk. The scuba hood, bonded zipper pockets, and knit cuff gaiters keep heat locked in while you recover or commute.',
    badges: ['Recycled'],
    images: [
      'https://images.unsplash.com/photo-1521540216272-a50305cd4421?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1521572425945-88c34e72f762?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 10800,
    variants: [
      {
        variantId: 'zenith-hoodie-ash-s',
        label: 'Ash Grey / Small',
        sku: 'AT-ZEN-ASH-S',
        price: 10800,
        stock: 18,
        options: { color: 'Ash Grey', size: 'Small' },
        images: [
          'https://images.unsplash.com/photo-1521540216272-a50305cd4421?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'zenith-hoodie-ash-m',
        label: 'Ash Grey / Medium',
        sku: 'AT-ZEN-ASH-M',
        price: 10800,
        stock: 26,
        options: { color: 'Ash Grey', size: 'Medium' },
        images: [
          'https://images.unsplash.com/photo-1521540216272-a50305cd4421?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'zenith-hoodie-coast-l',
        label: 'Coast Blue / Large',
        sku: 'AT-ZEN-CST-L',
        price: 11200,
        stock: 20,
        options: { color: 'Coast Blue', size: 'Large' },
        images: [
          'https://images.unsplash.com/photo-1521572425945-88c34e72f762?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Fabric', value: '74% recycled polyester, 26% cotton double-knit' },
      { key: 'Features', value: 'Bonded zipper pockets, scuba hood, cuff gaiters' },
    ],
    rating: { average: 4.6, count: 58 },
    attributes: {
      material: 'Recycled fleece',
      color: 'Ash Grey',
    },
  },
  {
    slug: 'halo-seamless-legging',
    title: 'Halo Seamless Legging',
    brand: 'Flux Movement',
    categorySlug: 'apparel',
    description: 'High-rise legging with seamless compression zones for studio sessions.',
    longDescription:
      'Halo uses a knit-in ventilation map and four-way stretch yarns to move with you through yoga flows and HIIT days. A stay-put waistband and soft brushed interior deliver support and comfort in equal measure.',
    images: [
      'https://images.unsplash.com/photo-1542293787938-4d2226b05481?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1526401485004-46910ecc8e51?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 8800,
    variants: [
      {
        variantId: 'halo-legging-onyx-s',
        label: 'Onyx / Small',
        sku: 'FM-HAL-ONX-S',
        price: 8800,
        stock: 22,
        options: { color: 'Onyx', size: 'Small' },
        images: [
          'https://images.unsplash.com/photo-1542293787938-4d2226b05481?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'halo-legging-onyx-m',
        label: 'Onyx / Medium',
        sku: 'FM-HAL-ONX-M',
        price: 8800,
        stock: 28,
        options: { color: 'Onyx', size: 'Medium' },
        images: [
          'https://images.unsplash.com/photo-1542293787938-4d2226b05481?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'halo-legging-ember-l',
        label: 'Ember / Large',
        sku: 'FM-HAL-EMB-L',
        price: 9200,
        stock: 18,
        options: { color: 'Ember', size: 'Large' },
        images: [
          'https://images.unsplash.com/photo-1526401485004-46910ecc8e51?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Fabric', value: '58% recycled nylon, 32% nylon, 10% elastane' },
      { key: 'Features', value: 'Seamless construction, knit-in ventilation, high-rise waist' },
    ],
    rating: { average: 4.7, count: 71 },
    attributes: {
      material: 'Seamless knit',
      color: 'Onyx',
    },
  },
  {
    slug: 'cobalt-oxford-shirt',
    title: 'Cobalt Oxford Shirt',
    brand: 'Beacon Street',
    categorySlug: 'apparel',
    description: 'Classic Oxford shirt with wrinkle-resistant organic cotton blend.',
    longDescription:
      'Cut with a modern tailored fit, the Cobalt Oxford Shirt uses a soft organic cotton and recycled polyester blend that resists wrinkles straight from the dryer. Reinforced seams and corozo buttons elevate a staple for office or weekend wear.',
    images: [
      'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 9800,
    variants: [
      {
        variantId: 'cobalt-oxford-slim-m',
        label: 'Tailored Fit / Medium',
        sku: 'BS-COB-TFM',
        price: 9800,
        stock: 24,
        options: { fit: 'Tailored', size: 'Medium' },
        images: [
          'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'cobalt-oxford-slim-l',
        label: 'Tailored Fit / Large',
        sku: 'BS-COB-TFL',
        price: 9800,
        stock: 18,
        options: { fit: 'Tailored', size: 'Large' },
        images: [
          'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'cobalt-oxford-classic-l',
        label: 'Classic Fit / Large',
        sku: 'BS-COB-CLL',
        price: 10200,
        stock: 16,
        options: { fit: 'Classic', size: 'Large' },
        images: [
          'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Fabric', value: '72% organic cotton, 28% recycled polyester' },
      { key: 'Features', value: 'Wrinkle-resistant finish, corozo buttons' },
    ],
    rating: { average: 4.4, count: 39 },
    attributes: {
      material: 'Organic cotton blend',
      size: 'Medium',
    },
  },
  {
    slug: 'ridge-down-parka',
    title: 'Ridge Down Parka',
    brand: 'Redwood & Co.',
    categorySlug: 'outerwear',
    description: 'Expedition-ready down parka with 700-fill insulation and storm guard.',
    longDescription:
      'The Ridge Down Parka pairs responsibly sourced 700-fill down with a waterproof breathable shell to withstand frigid commutes and alpine getaways. Fleece-lined pockets and a removable faux-fur hood trim add warmth and versatility.',
    badges: ['Warmest'],
    images: [
      'https://images.unsplash.com/photo-1547824477-82d40aa0c4ad?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512427691650-1e0c84f45956?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 32900,
    variants: [
      {
        variantId: 'ridge-parka-ember-m',
        label: 'Ember Orange / Medium',
        sku: 'RW-RDG-EMB-M',
        price: 32900,
        stock: 14,
        options: { color: 'Ember Orange', size: 'Medium' },
        images: [
          'https://images.unsplash.com/photo-1547824477-82d40aa0c4ad?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'ridge-parka-ember-l',
        label: 'Ember Orange / Large',
        sku: 'RW-RDG-EMB-L',
        price: 32900,
        stock: 12,
        options: { color: 'Ember Orange', size: 'Large' },
        images: [
          'https://images.unsplash.com/photo-1547824477-82d40aa0c4ad?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'ridge-parka-storm-xl',
        label: 'Storm Blue / XL',
        sku: 'RW-RDG-STR-XL',
        price: 33900,
        stock: 10,
        options: { color: 'Storm Blue', size: 'XL' },
        images: [
          'https://images.unsplash.com/photo-1512427691650-1e0c84f45956?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Insulation', value: '700-fill responsibly sourced down' },
      { key: 'Shell', value: 'Waterproof breathable polyester' },
      { key: 'Features', value: 'Removable faux-fur hood trim, fleece-lined pockets' },
    ],
    rating: { average: 4.6, count: 51 },
    attributes: {
      material: 'Waterproof polyester',
      color: 'Ember Orange',
    },
  },
  {
    slug: 'harbor-rain-anorak',
    title: 'Harbor Rain Anorak',
    brand: 'Northwind Supply',
    categorySlug: 'outerwear',
    description: 'Packable rain anorak with three-layer waterproof membrane.',
    longDescription:
      'Designed for unpredictable forecasts, the Harbor Rain Anorak packs into its own kangaroo pocket yet delivers full wind and rain protection. Side zips vent heat on hikes while reflective binding boosts visibility.',
    images: [
      'https://images.unsplash.com/photo-1521572163475-279cf49769fe?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 19800,
    variants: [
      {
        variantId: 'harbor-anorak-sea-s',
        label: 'Sea Glass / Small',
        sku: 'NW-HRB-SEA-S',
        price: 19800,
        stock: 20,
        options: { color: 'Sea Glass', size: 'Small' },
        images: [
          'https://images.unsplash.com/photo-1521572163475-279cf49769fe?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'harbor-anorak-sea-m',
        label: 'Sea Glass / Medium',
        sku: 'NW-HRB-SEA-M',
        price: 19800,
        stock: 24,
        options: { color: 'Sea Glass', size: 'Medium' },
        images: [
          'https://images.unsplash.com/photo-1521572163475-279cf49769fe?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'harbor-anorak-graphite-l',
        label: 'Graphite / Large',
        sku: 'NW-HRB-GRA-L',
        price: 20500,
        stock: 18,
        options: { color: 'Graphite', size: 'Large' },
        images: [
          'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Waterproof Rating', value: '20K/20K 3-layer membrane' },
      { key: 'Weight', value: '12 oz (size M)' },
      { key: 'Features', value: 'Packable, side vent zippers, reflective binding' },
    ],
    rating: { average: 4.3, count: 42 },
    attributes: {
      material: '3-layer nylon',
      color: 'Sea Glass',
    },
  },
  {
    slug: 'voyager-carry-on',
    title: 'Voyager Carry-On Spinner',
    brand: 'Waypoint Luggage',
    categorySlug: 'gear-travel',
    description: 'Lightweight polycarbonate carry-on with 360° spinner wheels.',
    longDescription:
      'Voyager is built from aerospace-grade polycarbonate with a reinforced aluminum frame, helping the case shrug off overhead bin bumps. Interior compression panels keep outfits organized while the USB pass-through keeps devices topped up.',
    images: [
      'https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1518544889280-3caef1a7d72d?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 28500,
    variants: [
      {
        variantId: 'voyager-carry-graphite',
        label: 'Graphite',
        sku: 'WP-VYG-GRA',
        price: 28500,
        stock: 32,
        options: { color: 'Graphite', capacity: '38L' },
        images: [
          'https://images.unsplash.com/photo-1510511459019-5dda7724fd87?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'voyager-carry-coast',
        label: 'Coast Blue',
        sku: 'WP-VYG-CST',
        price: 28500,
        stock: 28,
        options: { color: 'Coast Blue', capacity: '38L' },
        images: [
          'https://images.unsplash.com/photo-1518544889280-3caef1a7d72d?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Material', value: 'Aerospace-grade polycarbonate shell' },
      { key: 'Weight', value: '6.7 lbs' },
      { key: 'Features', value: '360° spinner wheels, USB pass-through, TSA locks' },
    ],
    rating: { average: 4.6, count: 89 },
    attributes: {
      material: 'Polycarbonate',
      capacity: '38L',
    },
  },
  {
    slug: 'atlas-duffel-45l',
    title: 'Atlas Duffel 45L',
    brand: 'Northwind Supply',
    categorySlug: 'gear-travel',
    description: 'Convertible duffel with stowable backpack straps and weatherproof canvas.',
    longDescription:
      'Atlas transitions from weeklong travel to gym hauls with a waterproof canvas shell, reinforced base, and stowable backpack straps. Interior mesh dividers keep gear separated while the exterior shoe compartment manages trail-dirty footwear.',
    images: [
      'https://images.unsplash.com/photo-1527430253228-e93688616381?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522198632101-443f7a5db3b1?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 21500,
    variants: [
      {
        variantId: 'atlas-duffel-graphite',
        label: 'Graphite',
        sku: 'NW-ATD-GRA',
        price: 21500,
        stock: 30,
        options: { color: 'Graphite', capacity: '45L' },
        images: [
          'https://images.unsplash.com/photo-1527430253228-e93688616381?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'atlas-duffel-ridge',
        label: 'Ridge Green',
        sku: 'NW-ATD-RDG',
        price: 21500,
        stock: 26,
        options: { color: 'Ridge Green', capacity: '45L' },
        images: [
          'https://images.unsplash.com/photo-1522198632101-443f7a5db3b1?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Volume', value: '45 liters' },
      { key: 'Fabric', value: 'Waterproof 900D recycled canvas' },
      { key: 'Features', value: 'Backpack straps, shoe compartment, metal hardware' },
    ],
    rating: { average: 4.5, count: 63 },
    attributes: {
      material: 'Recycled canvas',
      capacity: '45L',
    },
  },
  {
    slug: 'artisan-chef-knife',
    title: 'Artisan Chef Knife',
    brand: 'Hearthline',
    categorySlug: 'home-kitchen',
    description: '8-inch chef knife hand-forged with layered Damascus steel.',
    longDescription:
      'Each Artisan Chef Knife is forged by master bladesmiths who fold high-carbon steel into 67 layers for lasting sharpness. A stabilized walnut handle balances the blade, making prep work a joy.',
    badges: ['Small Batch'],
    images: [
      'https://images.unsplash.com/photo-1586201375761-83865001e31b?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1604908176997-12518821a34d?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 16800,
    variants: [
      {
        variantId: 'artisan-knife-walnut',
        label: 'Walnut Handle',
        sku: 'HL-ART-WAL',
        price: 16800,
        stock: 22,
        options: { handle: 'Walnut', size: '8 inch' },
        images: [
          'https://images.unsplash.com/photo-1586201375761-83865001e31b?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'artisan-knife-onyx',
        label: 'Onyx Resin Handle',
        sku: 'HL-ART-ONX',
        price: 17800,
        stock: 16,
        options: { handle: 'Onyx Resin', size: '8 inch' },
        images: [
          'https://images.unsplash.com/photo-1604908176997-12518821a34d?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Steel', value: '67-layer Damascus VG10 core' },
      { key: 'Handle', value: 'Stabilized walnut or resin' },
      { key: 'Hardness', value: '60±2 HRC' },
    ],
    rating: { average: 4.8, count: 95 },
    attributes: {
      material: 'Damascus steel',
      handle: 'Walnut',
    },
  },
  {
    slug: 'ember-cast-iron-skillet',
    title: 'Ember Cast Iron Skillet',
    brand: 'Hearthline',
    categorySlug: 'home-kitchen',
    description: 'Pre-seasoned cast iron skillet tuned for even heat and easy seasoning.',
    longDescription:
      'Ember skillets are milled smooth and double seasoned with grapeseed oil for a naturally nonstick surface. Pour spouts and an assist handle make searing steaks or baking skillet cornbread effortless.',
    images: [
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1612874742237-6526221588ca?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 8800,
    variants: [
      {
        variantId: 'ember-skillet-10',
        label: '10-inch',
        sku: 'HL-EMB-10',
        price: 8800,
        stock: 34,
        options: { size: '10 inch' },
        images: [
          'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'ember-skillet-12',
        label: '12-inch',
        sku: 'HL-EMB-12',
        price: 9800,
        stock: 26,
        options: { size: '12 inch' },
        images: [
          'https://images.unsplash.com/photo-1612874742237-6526221588ca?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Material', value: 'Pre-seasoned cast iron' },
      { key: 'Finish', value: 'Milled smooth cooking surface' },
      { key: 'Heat Source', value: 'Induction, gas, oven safe up to 500°F' },
    ],
    rating: { average: 4.9, count: 112 },
    attributes: {
      material: 'Cast iron',
      size: '10 inch',
    },
  },
  {
    slug: 'luna-stoneware-dinnerware',
    title: 'Luna Stoneware Dinnerware Set',
    brand: 'Oak & Loom',
    categorySlug: 'home-kitchen',
    description: '12-piece stoneware dinnerware with hand-applied reactive glaze.',
    longDescription:
      'Luna includes four dinner plates, salad plates, and bowls crafted from durable stoneware. Each piece is kiln-fired with a moonlit reactive glaze that varies beautifully from set to set.',
    images: [
      'https://images.unsplash.com/photo-1495521821757-04c5cad6ba90?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1523365280197-f1783db9fe62?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 14200,
    variants: [
      {
        variantId: 'luna-dinnerware-moon',
        label: 'Moonstone',
        sku: 'OL-LUN-MST',
        price: 14200,
        stock: 28,
        options: { color: 'Moonstone' },
        images: [
          'https://images.unsplash.com/photo-1495521821757-04c5cad6ba90?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'luna-dinnerware-tide',
        label: 'Tide',
        sku: 'OL-LUN-TID',
        price: 14200,
        stock: 24,
        options: { color: 'Tide' },
        images: [
          'https://images.unsplash.com/photo-1523365280197-f1783db9fe62?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Pieces', value: '12-piece set (service for four)' },
      { key: 'Material', value: 'Glazed stoneware' },
      { key: 'Care', value: 'Dishwasher and microwave safe' },
    ],
    rating: { average: 4.7, count: 83 },
    attributes: {
      material: 'Stoneware',
      color: 'Moonstone',
    },
  },
  {
    slug: 'solstice-aviator-sunglasses',
    title: 'Solstice Aviator Sunglasses',
    brand: 'Beacon Street',
    categorySlug: 'accessories',
    description: 'Polarized aviators with scratch-resistant gradient lenses.',
    longDescription:
      'Solstice pairs slim stainless frames with polarized lenses that cut glare on bright coastal days. Adjustable nose pads dial in the fit while spring hinges keep the frames comfortable for extended wear.',
    images: [
      'https://images.unsplash.com/photo-1654274285614-37cad6007665?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1681147768258-d869869d2d97?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 14500,
    variants: [
      {
        variantId: 'solstice-sunglasses-gold',
        label: 'Gold / Amber Lens',
        sku: 'BS-SOL-GLD',
        price: 14500,
        stock: 26,
        options: { frame: 'Gold', lens: 'Amber Gradient' },
        images: [
          'https://images.unsplash.com/photo-1654274285614-37cad6007665?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'solstice-sunglasses-onyx',
        label: 'Onyx / Smoke Lens',
        sku: 'BS-SOL-ONX',
        price: 14500,
        stock: 22,
        options: { frame: 'Onyx', lens: 'Smoke Polarized' },
        images: [
          'https://images.unsplash.com/photo-1681147768258-d869869d2d97?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Frame', value: 'Stainless steel with spring hinges' },
      { key: 'Lens', value: 'Polarized scratch-resistant nylon' },
      { key: 'UV Protection', value: '100% UVA/UVB' },
    ],
    rating: { average: 4.5, count: 44 },
    attributes: {
      material: 'Stainless steel',
      lens: 'Amber Gradient',
    },
  },
  {
    slug: 'montane-leather-belt',
    title: 'Montane Leather Belt',
    brand: 'Beacon Street',
    categorySlug: 'accessories',
    description: 'Vegetable-tanned leather belt with brushed brass hardware.',
    longDescription:
      'Montane belts are cut from Italian vegetable-tanned hide that patinas beautifully over time. The brushed brass buckle and hand-stitched keepers lend the belt heirloom durability.',
    images: [
      'https://images.unsplash.com/photo-1664286074240-d7059e004dff?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1603636489686-2ab6dc08fa8d?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 7800,
    variants: [
      {
        variantId: 'montane-belt-32',
        label: 'Cognac / 32',
        sku: 'BS-MON-032',
        price: 7800,
        stock: 20,
        options: { color: 'Cognac', size: '32' },
        images: [
          'https://images.unsplash.com/photo-1664286074240-d7059e004dff?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'montane-belt-34',
        label: 'Cognac / 34',
        sku: 'BS-MON-034',
        price: 7800,
        stock: 22,
        options: { color: 'Cognac', size: '34' },
        images: [
          'https://images.unsplash.com/photo-1664286074240-d7059e004dff?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'montane-belt-onyx-36',
        label: 'Onyx / 36',
        sku: 'BS-MON-ONX-36',
        price: 8200,
        stock: 18,
        options: { color: 'Onyx', size: '36' },
        images: [
          'https://images.unsplash.com/photo-1603636489686-2ab6dc08fa8d?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Material', value: 'Italian vegetable-tanned leather' },
      { key: 'Buckle', value: 'Brushed brass' },
      { key: 'Width', value: '1.25 inches' },
    ],
    rating: { average: 4.7, count: 57 },
    attributes: {
      material: 'Vegetable-tanned leather',
      color: 'Cognac',
    },
  },
  {
    slug: 'serenity-yoga-mat',
    title: 'Serenity Yoga Mat',
    brand: 'Flux Movement',
    categorySlug: 'wellness',
    description: 'Natural rubber yoga mat with jute top layer for confident grip.',
    longDescription:
      'Serenity pairs sustainably harvested natural rubber with a woven jute surface that stays grippy even in hot sessions. At 5mm thick, it provides joint cushioning without sacrificing stability.',
    images: [
      'https://images.unsplash.com/photo-1646239646963-b0b9be56d6b5?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 7800,
    variants: [
      {
        variantId: 'serenity-mat-mist',
        label: 'Mist Blue',
        sku: 'FM-SER-MST',
        price: 7800,
        stock: 30,
        options: { color: 'Mist Blue', thickness: '5 mm' },
        images: [
          'https://images.unsplash.com/photo-1646239646963-b0b9be56d6b5?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'serenity-mat-sand',
        label: 'Sandstone',
        sku: 'FM-SER-SND',
        price: 7800,
        stock: 24,
        options: { color: 'Sandstone', thickness: '5 mm' },
        images: [
          'https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Material', value: 'Natural rubber with jute textile' },
      { key: 'Thickness', value: '5 mm' },
      { key: 'Dimensions', value: '72" x 26"' },
    ],
    rating: { average: 4.8, count: 64 },
    attributes: {
      material: 'Natural rubber',
      color: 'Mist Blue',
    },
  },
  {
    slug: 'calm-mist-aroma-diffuser',
    title: 'Calm Mist Aroma Diffuser',
    brand: 'Everwell Studio',
    categorySlug: 'wellness',
    description: 'Ultrasonic diffuser with ambient LED glow and auto-off timer.',
    longDescription:
      'Calm Mist quietly disperses essential oils for up to ten hours, featuring three mist levels and a gentle ambient glow. The sculpted ceramic cover elevates nightstands and entry tables alike.',
    images: [
      'https://images.unsplash.com/photo-1511918984145-48de785d4c4c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512069772995-ec315fe2eac6?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 6400,
    variants: [
      {
        variantId: 'calm-diffuser-porcelain',
        label: 'Porcelain White',
        sku: 'EVR-CAL-POR',
        price: 6400,
        stock: 34,
        options: { finish: 'Porcelain White' },
        images: [
          'https://images.unsplash.com/photo-1511918984145-48de785d4c4c?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'calm-diffuser-slate',
        label: 'Slate Grey',
        sku: 'EVR-CAL-SLT',
        price: 6600,
        stock: 28,
        options: { finish: 'Slate Grey' },
        images: [
          'https://images.unsplash.com/photo-1512069772995-ec315fe2eac6?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Run Time', value: 'Up to 10 hours' },
      { key: 'Capacity', value: '150 ml reservoir' },
      { key: 'Features', value: 'Auto shutoff, ambient LED glow, BPA-free reservoir' },
    ],
    rating: { average: 4.6, count: 73 },
    attributes: {
      material: 'Ceramic',
      finish: 'Porcelain White',
    },
  },
  {
    slug: 'nova-wireless-charger',
    title: 'Nova Wireless Charger',
    brand: 'Horizon Audio',
    categorySlug: 'tech',
    description: 'MagSafe-compatible wireless charger with aluminum stand.',
    longDescription:
      'Nova delivers up to 15W of fast wireless charging with a floating aluminum stand that keeps phones visible on desks or nightstands. A braided USB-C cable and passthrough port keep cables tidy.',
    images: [
      'https://images.unsplash.com/photo-1517430816045-df4b7de1d0b3?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1510552776732-01acc9a4c83d?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 8800,
    variants: [
      {
        variantId: 'nova-charger-silver',
        label: 'Silver',
        sku: 'HA-NOV-SLV',
        price: 8800,
        stock: 36,
        options: { color: 'Silver', output: '15W' },
        images: [
          'https://images.unsplash.com/photo-1517430816045-df4b7de1d0b3?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'nova-charger-graphite',
        label: 'Graphite',
        sku: 'HA-NOV-GRA',
        price: 9000,
        stock: 30,
        options: { color: 'Graphite', output: '15W' },
        images: [
          'https://images.unsplash.com/photo-1510552776732-01acc9a4c83d?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Output', value: 'Up to 15W wireless charging' },
      { key: 'Compatibility', value: 'MagSafe and Qi devices' },
      { key: 'Cable', value: '2 m braided USB-C' },
    ],
    rating: { average: 4.5, count: 61 },
    attributes: {
      material: 'Aluminum',
      color: 'Silver',
    },
  },
  {
    slug: 'vertex-mechanical-keyboard',
    title: 'Vertex Mechanical Keyboard',
    brand: 'Horizon Audio',
    categorySlug: 'tech',
    description: 'Hot-swappable 75% mechanical keyboard with RGB backlighting.',
    longDescription:
      'Vertex delivers a compact 75% layout with gasket-mounted aluminum housing and PBT doubleshot keycaps. Hot-swappable sockets let you tailor the typing feel while south-facing RGB lighting keeps legends vibrant.',
    images: [
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 19800,
    variants: [
      {
        variantId: 'vertex-keyboard-linear',
        label: 'Linear Switches',
        sku: 'HA-VTX-LNR',
        price: 19800,
        stock: 28,
        options: { switches: 'Linear', layout: '75%' },
        images: [
          'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'vertex-keyboard-tactile',
        label: 'Tactile Switches',
        sku: 'HA-VTX-TCT',
        price: 19800,
        stock: 26,
        options: { switches: 'Tactile', layout: '75%' },
        images: [
          'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Layout', value: '75% hot-swappable' },
      { key: 'Keycaps', value: 'PBT doubleshot keycaps' },
      { key: 'Connectivity', value: 'USB-C wired, Bluetooth 5.1' },
    ],
    rating: { average: 4.6, count: 74 },
    attributes: {
      material: 'Aluminum',
      switches: 'Linear',
    },
  },
  {
    slug: 'pulse-sport-headphones',
    title: 'Pulse Sport Headphones',
    brand: 'Horizon Audio',
    categorySlug: 'tech',
    description: 'Over-ear sport headphones with adaptive EQ and 40-hour battery.',
    longDescription:
      'Pulse Sport Headphones combine sweat-resistant materials with adaptive EQ that tunes audio to your movement. Multipoint Bluetooth and memory foam ear cups keep training sessions inspired and comfortable.',
    images: [
      'https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1471478331149-c72f17e33c73?auto=format&fit=crop&w=1200&q=80',
    ],
    price: 22900,
    variants: [
      {
        variantId: 'pulse-headphones-graphite',
        label: 'Graphite',
        sku: 'HA-PLS-GRA',
        price: 22900,
        stock: 34,
        options: { color: 'Graphite' },
        images: [
          'https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=crop&w=1200&q=80',
        ],
      },
      {
        variantId: 'pulse-headphones-ember',
        label: 'Ember Red',
        sku: 'HA-PLS-EMB',
        price: 22900,
        stock: 28,
        options: { color: 'Ember Red' },
        images: [
          'https://images.unsplash.com/photo-1471478331149-c72f17e33c73?auto=format&fit=crop&w=1200&q=80',
        ],
      },
    ],
    specs: [
      { key: 'Battery Life', value: 'Up to 40 hours playback' },
      { key: 'Water Resistance', value: 'IPX5 sweat resistant' },
      { key: 'Features', value: 'Adaptive EQ, multipoint Bluetooth' },
    ],
    rating: { average: 4.5, count: 58 },
    attributes: {
      color: 'Graphite',
    },
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

  const categoryCheck = await Category.find({})
    .select({ _id: 1 })
    .lean();
  const persistedCategoryIds = new Set(categoryCheck.map((doc) => String(doc._id)));
  if (persistedCategoryIds.size !== categorySeeds.length) {
    const missing = categorySeeds
      .map((cat) => String(cat._id))
      .filter((id) => !persistedCategoryIds.has(id));
    throw new Error(
      `Mongo seed failed: expected ${categorySeeds.length} categories but only ${persistedCategoryIds.size} persisted (${missing.join(', ')}).`,
    );
  }

  const categoryLookup = new Map(categorySeeds.map((cat) => [cat.slug, cat]));

  const productDocuments = productCatalog.map((product, index) => {
    const category = categoryLookup.get(product.categorySlug);
    if (!category) {
      throw new Error(`Seed configuration error: category ${product.categorySlug} not found for product ${product.slug}`);
    }

    const variants = product.variants.map((variant) => {
      const resolvedId =
        variant.variantId ||
        `${product.slug}-${Object.values(variant.options)
          .join('-')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')}`;
      return {
        variantId: resolvedId,
        sku: variant.sku,
        label: variant.label,
        options: variant.options,
        price: variant.price,
        stock: variant.stock,
        images: variant.images,
      };
    });

    const totalStock = variants.reduce((sum, entry) => sum + (entry.stock || 0), 0);
    const defaultVariantId = variants[0]?.variantId;

    const baseAttributes = {
      brand: product.brand,
      ...product.attributes,
      ...(variants[0]?.options?.color ? { color: variants[0].options.color } : {}),
      ...(variants[0]?.options?.size ? { size: variants[0].options.size } : {}),
    };
    const attributes = Object.fromEntries(
      Object.entries(baseAttributes).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    );

    return {
      _id: objectIdFor(`product:${product.slug}`),
      title: product.title,
      slug: product.slug,
      description: product.description,
      longDescription: product.longDescription,
      brand: product.brand,
      badges: product.badges ?? [],
      images: product.images,
      price: variants[0]?.price ?? product.price,
      currency: product.currency ?? 'USD',
      categoryId: category._id.toString(),
      stock: totalStock || 12,
      attributes,
      variants,
      defaultVariantId,
      specs: product.specs ?? [],
      rating: product.rating ?? { average: 4.4, count: 24 },
    };
  });

  await Product.deleteMany({});
  if (productDocuments.length) {
    await Product.insertMany(
      productDocuments.map((product, index) => ({
        ...product,
        createdAt: new Date(now.getTime() + index),
        updatedAt: new Date(now.getTime() + index),
      })),
      { ordered: true },
    );
  }

  const productCheck = await Product.find({})
    .select({ _id: 1 })
    .lean();
  const persistedProductIds = new Set(productCheck.map((doc) => String(doc._id)));
  if (persistedProductIds.size !== productDocuments.length) {
    const missing = productDocuments
      .map((product) => String(product._id))
      .filter((id) => !persistedProductIds.has(id));
    throw new Error(
      `Mongo seed failed: expected ${productDocuments.length} products but only ${persistedProductIds.size} persisted (${missing.join(', ')}).`,
    );
  }

  console.log(`[seed] Upserted ${persistedCategoryIds.size} categories and ${persistedProductIds.size} products in MongoDB.`);

  return productDocuments.map((product) => String(product._id));
}

export async function seedPostgres(productIds: string[]) {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: adminPassword, role: 'admin' },
    create: {
      email: ADMIN_EMAIL,
      passwordHash: adminPassword,
      role: 'admin',
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: CUSTOMER_EMAIL },
    update: { passwordHash: userPassword, role: 'customer' },
    create: {
      email: CUSTOMER_EMAIL,
      passwordHash: userPassword,
      role: 'customer',
    },
  });

  await prisma.event.upsert({
    where: { id: 'seed-event-view' },
    update: {
      userId: customer.id,
      payload: { productId: productIds[0] },
      type: 'view',
    },
    create: {
      id: 'seed-event-view',
      userId: customer.id,
      payload: { productId: productIds[0] },
      type: 'view',
    },
  });

  await prisma.event.upsert({
    where: { id: 'seed-event-cart' },
    update: {
      userId: customer.id,
      payload: { productId: productIds[1] },
      type: 'add_to_cart',
    },
    create: {
      id: 'seed-event-cart',
      userId: customer.id,
      payload: { productId: productIds[1] },
      type: 'add_to_cart',
    },
  });

  await prisma.event.upsert({
    where: { id: 'seed-event-purchase' },
    update: {
      userId: customer.id,
      payload: { productId: productIds[2] },
      type: 'purchase',
    },
    create: {
      id: 'seed-event-purchase',
      userId: customer.id,
      payload: { productId: productIds[2] },
      type: 'purchase',
    },
  });

  return { admin, customer };
}

export async function seedAll(options: { mongoUrl?: string } = {}) {
  const mongoUrl = options.mongoUrl ?? process.env.MONGO_URL ?? DEFAULT_MONGO_URL;
  const productIds = await seedMongo(mongoUrl);
  if (productIds.length < 3) {
    throw new Error(
      `Mongo seed only returned ${productIds.length} product IDs; expected at least 3 so Postgres seed can attach analytics events. Check the Mongo seed logs above for details.`,
    );
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
