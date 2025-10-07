import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Product, Category } from '../db';
import { recordEvent } from '../services/recs';
import { cache } from '../cache';

type AttributeFilters = Record<string, string[]>;

type FacetCategory = { id: string; name: string; count: number };

type FacetAttributeValue = { value: string; count: number };

type FacetAttribute = { key: string; values: FacetAttributeValue[] };

const router = Router();

function getSessionId(req: any) {
  return (req.headers['x-session-id'] as string) || undefined;
}

function getUserId(req: any) {
  return (req.user && req.user.userId) || (req.headers['x-user-id'] as string) || undefined;
}

function withImageFallback<T extends any>(doc: any) {
  const base = typeof doc?.toObject === 'function' ? doc.toObject() : { ...doc };
  const obj: any = { ...base };

  const primaryImages = Array.isArray(obj.images) ? obj.images : [];
  const normalizedImages = primaryImages
    .map((url: any) => (typeof url === 'string' ? url.trim() : ''))
    .filter((url: string) => !!url);
  if (normalizedImages.length === 0) {
    obj.images = [`https://picsum.photos/seed/${obj._id}/600/600`];
  } else {
    obj.images = normalizedImages;
  }

  obj.price = Number.isFinite(Number(obj.price)) ? Number(obj.price) : 0;
  obj.stock = Number.isFinite(Number(obj.stock)) ? Number(obj.stock) : 0;
  obj.currency = typeof obj.currency === 'string' ? obj.currency : 'USD';

  const rating = obj.rating && typeof obj.rating === 'object' ? obj.rating : {};
  obj.rating = {
    average: Number.isFinite(Number(rating.average)) ? Number(rating.average) : 0,
    count: Number.isFinite(Number(rating.count)) ? Number(rating.count) : 0,
  };

  const variants = Array.isArray(obj.variants) ? obj.variants : [];
  obj.variants = variants.map((variant: any, index: number) => {
    const raw = typeof variant?.toObject === 'function' ? variant.toObject() : variant;
    const next: any = { ...raw };
    next.variantId = next.variantId ? String(next.variantId) : undefined;
    next.price = Number.isFinite(Number(next.price)) ? Number(next.price) : obj.price;
    next.stock = Number.isFinite(Number(next.stock)) ? Number(next.stock) : 0;

    if (next.options && typeof next.options === 'object') {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(next.options)) {
        if (value == null) continue;
        normalized[String(key)] = String(value);
      }
      next.options = normalized;
    } else {
      next.options = {};
    }

    const fallbackSeed = next.variantId ? `${obj._id}-${next.variantId}` : `${obj._id}-variant-${index}`;
    const images = Array.isArray(next.images) ? next.images : [];
    const normalizedVariantImages = images
      .map((url: any) => (typeof url === 'string' ? url.trim() : ''))
      .filter((url: string) => !!url);
    next.images = normalizedVariantImages.length
      ? normalizedVariantImages
      : [`https://picsum.photos/seed/${fallbackSeed}/600/600`];

    return next;
  });

  const gallerySource = [
    ...(Array.isArray(obj.images) ? obj.images : []),
    ...obj.variants.flatMap((variant: any) => (Array.isArray(variant.images) ? variant.images : [])),
  ];
  const seen = new Set<string>();
  const mediaGallery: string[] = [];
  for (const url of gallerySource) {
    if (typeof url !== 'string') continue;
    const normalized = url.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    mediaGallery.push(normalized);
  }
  obj.mediaGallery = mediaGallery;

  return obj;
}

function normalizeAttributeFilters(query: Record<string, unknown>): AttributeFilters {
  const filters: AttributeFilters = {};

  // Handle both bracket notation and nested object notation
  // Case 1: attr[brand]=value → {"attr[brand]": "value"}
  // Case 2: attr[brand]=value → {"attr": {"brand": "value"}} (parsed by qs middleware)
  for (const [key, value] of Object.entries(query)) {
    if (key === 'attr' && typeof value === 'object' && value !== null) {
      // Handle nested object case: {"attr": {"brand": "value"}}
      for (const [attrKey, attrValue] of Object.entries(value)) {
        if (Array.isArray(attrValue)) {
          filters[attrKey] = attrValue.map((v) => String(v));
        } else if (typeof attrValue !== 'undefined') {
          filters[attrKey] = String(attrValue).split(',').map((v) => v.trim()).filter(Boolean);
        }
      }
    } else if (key.startsWith('attr[') && key.endsWith(']')) {
      // Handle bracket notation case: {"attr[brand]": "value"}
      const attrKey = key.slice(5, -1);
      if (!attrKey) continue;
      if (Array.isArray(value)) {
        filters[attrKey] = value.map((v) => String(v));
      } else if (typeof value !== 'undefined') {
        filters[attrKey] = String(value).split(',').map((v) => v.trim()).filter(Boolean);
      }
    }
  }
  return filters;
}

function applyAttributeFilters(base: mongoose.FilterQuery<any>, filters: AttributeFilters) {
  const entries = Object.entries(filters).filter(([, values]) => values.length);
  if (!entries.length) return base;
  const attrConditions = entries.map(([attrKey, values]) => ({ [`attributes.${attrKey}`]: { $in: values } }));
  return { ...base, $and: [...(base.$and ?? []), ...attrConditions] };
}

type SortStage = Record<string, mongoose.SortOrder>;

function buildSort(sort?: string): SortStage {
  const sortMap: Record<string, SortStage> = {
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    newest: { createdAt: -1 },
    popular: { stock: -1 },
  };

  return sortMap[sort ?? ''] ?? { createdAt: -1 };
}

router.get('/products', async (req, res) => {
  const schema = z.object({
    search: z.string().optional(),
    category: z.string().optional(),
    categories: z.string().optional(),
    sort: z.enum(['price_asc', 'price_desc', 'popular', 'newest']).optional(),
    page: z.coerce.number().min(1).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    userId: z.string().optional(),
  });

  const parse = schema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({ error: 'VALIDATION', details: parse.error.flatten() });
  }

  // Debug: log the raw query to understand the structure
  console.log('DEBUG: raw req.query:', JSON.stringify(req.query, null, 2));

  const attributeFilters = normalizeAttributeFilters(req.query as Record<string, unknown>);
  const { search, category, categories, sort, page = 1, limit = 12, userId: queryUserId, minPrice, maxPrice } = parse.data;
  const sessionId = getSessionId(req);
  const userId = getUserId(req) ?? queryUserId;

  // Create filter object for cache key generation
  const categoryFilters: string[] = [];
  if (category) categoryFilters.push(category);
  if (categories) {
    categoryFilters.push(...categories.split(',').map((cat) => cat.trim()).filter(Boolean));
  }

  // Generate cache key that includes all filter parameters
  const filterKey = JSON.stringify({
    categoryIds: Array.from(new Set(categoryFilters)).sort(),
    attributes: Object.keys(attributeFilters).sort().reduce<Record<string, string[]>>((acc, key) => {
      acc[key] = [...attributeFilters[key]].sort();
      return acc;
    }, {}),
    price: { minPrice, maxPrice },
    sort: sort ?? 'newest',
  });
  // TEMPORARILY DISABLED CACHING TO DEBUG FILTERING
  console.log(`DEBUG: Processing products request - page=${page}, limit=${limit}, search=${search || 'none'}, filters=${JSON.stringify(attributeFilters)}`);

  console.log(`Cache miss for products: page=${page}, limit=${limit}, search=${search || 'none'}, filters=${JSON.stringify(attributeFilters)}`);

  const filter: mongoose.FilterQuery<any> = {};

  if (search) {
    filter.title = { $regex: search, $options: 'i' };
  }

  if (categoryFilters.length) {
    filter.categoryId = { $in: Array.from(new Set(categoryFilters)) };
  }

  const filterWithAttributes = applyAttributeFilters(filter, attributeFilters);

  // Apply price filters to the main query
  if (typeof minPrice === 'number') {
    (filterWithAttributes as any).price = { ...((filterWithAttributes as any).price ?? {}), $gte: minPrice };
  }
  if (typeof maxPrice === 'number') {
    (filterWithAttributes as any).price = { ...((filterWithAttributes as any).price ?? {}), $lte: maxPrice };
  }

  console.log('DEBUG: final MongoDB filter:', JSON.stringify(filterWithAttributes, null, 2));

  const sortStage = buildSort(sort);

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Product.find(filterWithAttributes).sort(sortStage).skip(skip).limit(limit).exec(),
    Product.countDocuments(filterWithAttributes),
  ]);

  console.log(`DEBUG: Query returned ${items.length} items out of ${total} total matching docs`);

  const itemsWithImages = items.map(withImageFallback);

  const facetMatch = filterWithAttributes;

  const [categoryFacetRaw, attributeFacetRaw, priceFacetRaw] = await Promise.all([
    Product.aggregate([
      { $match: facetMatch },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Product.aggregate([
      { $match: facetMatch },
      { $project: { attributePairs: { $objectToArray: { $ifNull: ['$attributes', {}] } } } },
      { $unwind: '$attributePairs' },
      { $group: { _id: { key: '$attributePairs.k', value: '$attributePairs.v' }, count: { $sum: 1 } } },
    ]),
    Product.aggregate([
      { $match: facetMatch },
      { $group: { _id: null, minPrice: { $min: '$price' }, maxPrice: { $max: '$price' } } },
    ]),
  ]);

  const categoryIds = categoryFacetRaw.map((entry) => entry._id).filter(Boolean);
  const categoryDocs = categoryIds.length
    ? await Category.find({ _id: { $in: categoryIds } }).exec()
    : [];
  const categoryNameMap = new Map<string, string>();
  for (const doc of categoryDocs) {
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    categoryNameMap.set(String(obj._id), obj.name);
  }

  const facets: {
    categories: FacetCategory[];
    attributes: FacetAttribute[];
    price: { min?: number; max?: number };
  } = {
    categories: categoryFacetRaw.map((entry) => ({
      id: String(entry._id),
      name: categoryNameMap.get(String(entry._id)) || String(entry._id),
      count: entry.count || 0,
    })),
    attributes: [],
    price: {
      min: priceFacetRaw?.[0]?.minPrice ?? undefined,
      max: priceFacetRaw?.[0]?.maxPrice ?? undefined,
    },
  };

  const attrMap = new Map<string, FacetAttributeValue[]>();
  for (const entry of attributeFacetRaw) {
    if (!entry?._id?.key) continue;
    const values = attrMap.get(entry._id.key) || [];
    values.push({ value: String(entry._id.value ?? 'Unknown'), count: entry.count || 0 });
    attrMap.set(entry._id.key, values);
  }
  facets.attributes = Array.from(attrMap.entries()).map(([key, values]) => ({
    key,
    values: values.sort((a, b) => b.count - a.count),
  }));

  if (sessionId && itemsWithImages.length) {
    await recordEvent({
      sessionId,
      userId,
      productIdList: itemsWithImages.map((item) => String(item._id)),
      eventType: search ? 'view' : 'impression',
    });
  }

  const responseData = {
    items: itemsWithImages,
    total,
    page,
    limit,
    facets,
    appliedFilters: {
      categories: filter.categoryId?.$in ?? [],
      attributes: attributeFilters,
      price: { min: minPrice, max: maxPrice },
      search: search ?? null,
      sort: sort ?? 'newest',
    },
  };

  // Cache the response - TEMPORARILY DISABLED FOR DEBUGGING
  // await cache.setProducts(page, limit, search, filterKey, responseData, 1800); // 30 minutes

  res.json(responseData);
});

router.get('/products/:id', async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ error: 'NOT_FOUND' });
  const product = withImageFallback(p);
  const sessionId = getSessionId(req);
  const userId = getUserId(req);
  if (sessionId) {
    await recordEvent({ sessionId, userId, productIdList: [String(product._id)], eventType: 'view' });
  }
  res.json(product);
});

router.get('/products/slug/:slug', async (req, res) => {
  const p = await Product.findOne({ slug: req.params.slug });
  if (!p) return res.status(404).json({ error: 'NOT_FOUND' });
  const product = withImageFallback(p);
  const sessionId = getSessionId(req);
  const userId = getUserId(req);
  if (sessionId) {
    await recordEvent({ sessionId, userId, productIdList: [String(product._id)], eventType: 'view' });
  }
  res.json(product);
});

router.get('/categories', async (_req, res) => {
  const cats = await Category.find({}).exec();
  res.json(cats);
});

export default router;
