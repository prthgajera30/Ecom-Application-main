import { Product } from '../db';

const RECS_BASE = process.env.RECS_URL?.trim();
const RECS_SUPPRESS_WINDOW_MS = 60_000;

let recsUnavailableUntil = 0;
let loggedUnavailable = false;

function recsFeatureEnabled() {
  if (!RECS_BASE) return false;
  if (recsUnavailableUntil && recsUnavailableUntil <= Date.now()) {
    loggedUnavailable = false;
    recsUnavailableUntil = 0;
  }
  if (recsUnavailableUntil > Date.now()) return false;
  return true;
}

function markRecsFailure(err: unknown) {
  recsUnavailableUntil = Date.now() + RECS_SUPPRESS_WINDOW_MS;
  if (!loggedUnavailable) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.warn(`Recommendation service unreachable, suppressing for ${RECS_SUPPRESS_WINDOW_MS / 1000}s (${message})`);
    loggedUnavailable = true;
  }
}

function markRecsSuccess() {
  recsUnavailableUntil = 0;
  loggedUnavailable = false;
}

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
  if (!recsFeatureEnabled()) return;
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
    markRecsSuccess();
  } catch (err) {
    markRecsFailure(err);
  }
}

export type RecommendationRequest = {
  userId?: string;
  productId?: string;
  k?: number;
};

export type RecommendationItem = { score: number; productId: string; product: any };

export async function fetchRecommendations({ userId, productId, k = 8 }: RecommendationRequest) {
  if (!recsFeatureEnabled()) return { items: [] };
  const url = new URL(`${RECS_BASE}/recommendations`);
  if (userId) url.searchParams.set('userId', userId);
  if (productId) url.searchParams.set('productId', productId);
  url.searchParams.set('k', String(k));

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch recommendations: ${response.status}`);
    }
    markRecsSuccess();
    return response.json() as Promise<{ items: Array<{ productId: string; score: number }> }>;
  } catch (err) {
    markRecsFailure(err);
    return { items: [] };
  }
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
