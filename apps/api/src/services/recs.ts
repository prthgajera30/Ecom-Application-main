import { Product } from '../db';

const RECS_BASE = process.env.RECS_URL || 'http://127.0.0.1:5000';

export type RecsEventType = 'view' | 'impression' | 'add_to_cart' | 'remove_from_cart' | 'purchase';

export type RecsEventBatch = {
  sessionId?: string;
  userId?: string;
  productIdList: string[];
  eventType: RecsEventType;
};

const ALLOWED_EVENT_TYPES = new Set<RecsEventType>(['view', 'impression', 'add_to_cart', 'remove_from_cart', 'purchase']);

function withImageFallback(doc: any) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  if (!obj.images || obj.images.length === 0) {
    obj.images = [`https://picsum.photos/seed/${obj._id}/600/600`];
  }
  return obj;
}

export async function recordEvent({ sessionId, userId, productIdList, eventType }: RecsEventBatch) {
  if (!ALLOWED_EVENT_TYPES.has(eventType) || productIdList.length === 0) return;
  const body = productIdList.map((productId) => ({
    sessionId,
    userId,
    productId,
    eventType,
    ts: Date.now(),
  }));

  try {
    await fetch(`${RECS_BASE}/ingest/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn('Failed to forward recommendation events', err);
  }
}

export type RecommendationRequest = {
  userId?: string;
  productId?: string;
  k?: number;
};

export type RecommendationItem = { score: number; productId: string; product: any };

export async function fetchRecommendations({ userId, productId, k = 8 }: RecommendationRequest) {
  const url = new URL(`${RECS_BASE}/recommendations`);
  if (userId) url.searchParams.set('userId', userId);
  if (productId) url.searchParams.set('productId', productId);
  url.searchParams.set('k', String(k));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch recommendations: ${response.status}`);
  }
  return response.json() as Promise<{ items: Array<{ productId: string; score: number }> }>;
}

export async function fetchRecommendationsWithProducts(params: RecommendationRequest) {
  const { items } = await fetchRecommendations(params);
  const ids = items.map((item) => item.productId);
  if (ids.length === 0) return [] as RecommendationItem[];
  const products = await Product.find({ _id: { $in: ids } }).exec();
  const map = new Map<string, any>(products.map((p: any) => [String(p._id), withImageFallback(p)]));
  const enriched = items
    .map(({ productId, score }) => ({ productId, score, product: map.get(productId) }))
    .filter((item) => Boolean(item.product));
  return enriched as RecommendationItem[];
}
