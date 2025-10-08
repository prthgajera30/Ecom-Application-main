// Use types from ReviewCard for ProductReviews API
// Use types from ReviewCard for ProductReviews API
import type { Review } from '../../../../components/ReviewCard';

type ReviewFilters = {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: string;
};
'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

import { Button } from '../../../../components/ui/Button';
import { Card } from '../../../../components/ui/Card';
import { WishlistButton } from '../../../../components/ui/WishlistButton';
import { ProductReviews } from '../../../../components/ProductReviews';
import { apiGet, apiPost, ApiError } from '../../../../lib/api';
import { useCartState } from '../../../../context/CartContext';
import { cn } from '@/lib/utils';

type ProductVariant = {
  variantId?: string;
  label?: string;
  price?: number;
  stock?: number;
  options?: Record<string, string>;
  images?: string[];
};

type ProductSpec = {
  key: string;
  value: string;
};

type ProductRating = {
  average?: number;
  count?: number;
};

type ProductDetail = {
  _id: string;
  title: string;
  slug: string;
  price: number;
  currency?: string;
  description?: string;
  longDescription?: string;
  images?: string[];
  mediaGallery?: string[];
  brand?: string;
  badges?: string[];
  stock?: number;
  rating?: ProductRating;
  variants?: ProductVariant[];
  defaultVariantId?: string;
  specs?: ProductSpec[];
};

type RecommendationItem = {
  score: number;
  product: ProductDetail | null;
  productId?: string;
};

type OptionFacetValue = {
  value: string;
  stock: number;
  available: boolean;
};

const optionPriority = ['color', 'colour', 'size'];

function formatCurrency(value: number, currency = 'USD') {
  if (!Number.isFinite(value)) return '$0.00';
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(value / 100);
}

function formatOptionLabel(key: string) {
  const label = key.replace(/[-_]/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getStockMessage(stock?: number) {
  if (stock === undefined || stock === null) return 'In stock';
  if (stock <= 0) return 'Out of stock';
  if (stock <= 5) return `Only ${stock} left`;
  return 'In stock';
}

function getDefaultVariant(product: ProductDetail | null): ProductVariant | undefined {
  if (!product?.variants || product.variants.length === 0) return undefined;
  if (product.defaultVariantId) {
    const explicit = product.variants.find((variant) => variant.variantId === product.defaultVariantId);
    if (explicit) return explicit;
  }
  return product.variants[0];
}

function normalizeSelection(options: Record<string, string> | undefined | null) {
  if (!options) return {};
  return Object.fromEntries(
    Object.entries(options).map(([key, value]) => [String(key), String(value)])
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [similar, setSimilar] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'details' | 'specs'>('details');
  const { addItem, pending } = useCartState();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(false);
    apiGet<ProductDetail>(`/products/slug/${slug}`)
      .then((data) => {
        setProduct(data);
        setError(false);
        const defaultVariant = getDefaultVariant(data);
        setSelectedOptions(normalizeSelection(defaultVariant?.options));
        const initialImage =
          defaultVariant?.images?.[0] ||
          data.mediaGallery?.[0] ||
          data.images?.[0] ||
          null;
        setActiveImage(initialImage);
        const productId = (data as any)?._id;
        if (productId) {
          apiGet<{ items: RecommendationItem[] }>(`/recommendations?productId=${productId}&k=6`)
            .then((d) => setSimilar(d.items || []))
            .catch(() => setSimilar([]));
        } else {
          setSimilar([]);
        }
      })
      .catch(() => {
        setProduct(null);
        setSimilar([]);
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  const optionKeys = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return [];
    const keys = new Set<string>();
    product.variants.forEach((variant) => {
      Object.keys(variant.options || {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys).sort((a, b) => {
      const aIndex = optionPriority.indexOf(a.toLowerCase());
      const bIndex = optionPriority.indexOf(b.toLowerCase());
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [product?.variants]);

  const optionFacets = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return {} as Record<string, OptionFacetValue[]>;
    const record: Record<string, OptionFacetValue[]> = {};
    for (const key of optionKeys) {
      const map = new Map<string, OptionFacetValue>();
      for (const variant of product.variants) {
        const value = variant.options?.[key];
        if (!value) continue;
        const normalizedValue = String(value);
        const stock = Math.max(0, Number(variant.stock ?? 0));
        const entry = map.get(normalizedValue) ?? { value: normalizedValue, stock: 0, available: false };
        entry.stock += stock;
        const matchesOthers = optionKeys.every((otherKey) => {
          if (otherKey === key) return true;
          const selectedValue = selectedOptions[otherKey];
          if (!selectedValue) return true;
          return variant.options?.[otherKey] === selectedValue;
        });
        if (matchesOthers && stock > 0) {
          entry.available = true;
        }
        map.set(normalizedValue, entry);
      }
      record[key] = Array.from(map.values()).sort((a, b) => {
        if (a.available === b.available) {
          if (a.stock === b.stock) return a.value.localeCompare(b.value);
          return b.stock - a.stock;
        }
        return Number(b.available) - Number(a.available);
      });
    }
    return record;
  }, [product?.variants, optionKeys, selectedOptions]);

  const allOptionsSelected = optionKeys.every((key) => Boolean(selectedOptions[key]));

  const selectedVariant = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return undefined;
    if (!allOptionsSelected) return undefined;
    return product.variants.find((variant) =>
      optionKeys.every((key) => (variant.options?.[key] ?? '') === (selectedOptions[key] ?? ''))
    );
  }, [product?.variants, optionKeys, selectedOptions, allOptionsSelected]);

  const defaultVariant = useMemo(() => getDefaultVariant(product), [product]);
  const displayVariant = selectedVariant ?? defaultVariant;

  const gallery = useMemo(() => {
    const sources: string[] = [];
    if (selectedVariant?.images) sources.push(...selectedVariant.images);
    else if (defaultVariant?.images) sources.push(...defaultVariant.images);
    if (product?.mediaGallery?.length) sources.push(...product.mediaGallery);
    if (product?.images?.length) sources.push(...product.images);
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const url of sources) {
      if (!url) continue;
      const trimmed = url.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      deduped.push(trimmed);
    }
    return deduped;
  }, [product?.mediaGallery, product?.images, selectedVariant?.images, defaultVariant?.images]);

  useEffect(() => {
    if (!product) return;
    const candidate = selectedVariant?.images?.[0] || defaultVariant?.images?.[0] || product.mediaGallery?.[0] || product.images?.[0] || null;
    setActiveImage(candidate || null);
    setAddError(null);
  }, [product?._id, selectedVariant?.variantId, defaultVariant?.variantId]);

  const currency = product?.currency || 'USD';
  const displayPrice = selectedVariant?.price ?? product?.price ?? 0;
  const stockLevel = selectedVariant?.stock ?? product?.stock ?? 0;
  const stockMessage = getStockMessage(stockLevel);
  const isOutOfStock = stockLevel <= 0;
  const pendingKey = product
    ? `add:${product._id}${selectedVariant?.variantId ? `::${selectedVariant.variantId}` : ''}`
    : '';
  const pendingAdd = Boolean(pending[pendingKey]);

  const rating = product?.rating;
  const ratingAverage = rating?.average ? Number(rating.average).toFixed(1) : null;
  const ratingCount = rating?.count ? Number(rating.count) : 0;

  const handleSelectOption = (key: string, value: string) => {
    setSelectedOptions((current) => {
      const next = { ...current };
      if (current[key] === value) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
  };

  const clearOption = (key: string) => {
    setSelectedOptions((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  async function add() {
    if (!product) return;
    if (optionKeys.length > 0 && (!allOptionsSelected || !displayVariant)) {
      setAddError('Select available options before adding to cart.');
      return;
    }
    if (isOutOfStock) {
      setAddError('This variant is currently out of stock.');
      return;
    }

    setAddError(null);
    try {
      await addItem(
        product._id,
        1,
        displayVariant
          ? {
              variantId: displayVariant.variantId,
              variantLabel: displayVariant.label,
              variantOptions: normalizeSelection(displayVariant.options),
              unitPrice: displayVariant.price ?? product.price,
            }
          : undefined
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to add this product right now.';
      setAddError(message);
    }
  }

  if (loading) {
    return (
      <Card variant="elevated" className="flex min-h-[40vh] items-center justify-center p-10 text-sm text-subtle">
        Loading product details...
      </Card>
    );
  }

  if (error || !product) {
    return (
  <div className="rounded-3xl border border-[var(--danger)]/30 bg-[var(--danger-10)] p-10 text-center text-sm text-[var(--danger-100)]">
        We couldn't find that product.
  <Link href="/products" className="ml-2 text-[var(--text-primary)] underline hover:text-[var(--danger-100)]">
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10 sm:space-y-12">
      <section className="lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start lg:gap-10">
        <div className="space-y-5 lg:max-w-[560px]">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-ghost-10 bg-ghost-5 shadow-lg shadow-[color:var(--brand)]/20 sm:rounded-3xl lg:aspect-[4/5] lg:max-h-[540px] lg:rounded-[26px]">
            {activeImage ? (
              <img
                src={activeImage}
                alt={product.title}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-subtle" role="img" aria-label="No imagery available">
                No imagery available
              </div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
                    {gallery.map((image) => {
                const isSelected = image === activeImage;
                return (
                  <button
                    key={image}
                    type="button"
                      className={cn(
                        'h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border transition duration-200 xs:h-20 xs:w-20 xs:rounded-2xl',
                        isSelected ? 'border-ghost-20 ring-2 ring-[color:var(--brand)]/80' : 'border-ghost-10 hover:border-[color:var(--brand)]/60'
                      )}
                    onClick={() => setActiveImage(image)}
                  >
                    <img src={image} alt="Product preview" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <Card
          variant="elevated"
          className="space-y-4 p-5 sm:p-6 md:p-6 lg:sticky lg:top-24"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-wider text-subtle">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 text-subtle hover:text-primary"
              >
                <span aria-hidden>←</span>
                Back to products
              </Link>
              <span className="rounded-full border border-ghost-10 px-3 py-1 text-[11px] text-subtle">
                {stockMessage}
              </span>
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-primary sm:text-4xl">
              {product.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-subtle">
              {product.brand && (
                <span className="rounded-full border border-ghost-10 bg-ghost-5 px-3 py-1 text-primary">
                  {product.brand}
                </span>
              )}
              {ratingAverage ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-[var(--accent)]">
                  <span className="text-base leading-none">★</span>
                  <span className="font-semibold text-primary">{ratingAverage}</span>
                  <span className="text-[11px] uppercase tracking-wider text-[var(--accent)]/80">({ratingCount} reviews)</span>
                </span>
              ) : (
                <span className="text-[11px] uppercase tracking-wider text-subtle">Reviews coming soon</span>
              )}
            </div>
            <div className="rounded-xl border border-ghost-10 bg-ghost-5 px-4 py-3 shadow-inner shadow-[color:var(--brand)]/10">
              <span className="text-[11px] uppercase tracking-wider text-subtle">Price</span>
              <div className="mt-1 text-2xl font-semibold text-primary">
                {formatCurrency(displayPrice, currency)}
              </div>
            </div>
            {product.badges && product.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wider text-subtle">
                {product.badges.map((badge) => (
                  <span key={badge} className="rounded-full border border-ghost-10/40 px-3 py-1 text-primary">
                    {badge}
                  </span>
                ))}
              </div>
            )}
            {product.description && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-subtle">
                {product.description}
              </p>
            )}
          </div>

          {optionKeys.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-subtle">
                <span>Configure</span>
                <span className="text-subtle">{stockMessage}</span>
              </div>
              {optionKeys.map((key) => {
                const values = optionFacets[key] ?? [];
                const selectedValue = selectedOptions[key];
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wider text-subtle">
                      <span>{formatOptionLabel(key)}</span>
                      {selectedValue && (
                        <button
                          type="button"
                          className="text-[11px] text-subtle underline hover:text-[var(--text-primary)]"
                          onClick={() => clearOption(key)}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                      {values.map((entry) => {
                        const isSelected = entry.value === selectedValue;
                        const disabled = !entry.available && !isSelected;
                        const baseClasses = 'group relative min-w-[64px] rounded-xl border px-3 py-2 text-[13px] font-semibold uppercase tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]/70 sm:min-w-[80px]';
                        const colorClasses = isSelected
                          ? 'border-ghost-20 bg-ghost-20 text-primary shadow-inner shadow-[color:var(--brand)]/20'
                          : 'border-ghost-10 bg-ghost-5 text-subtle hover:border-[color:var(--brand)]/60 hover:bg-ghost-10';
                        const disabledClasses = disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer';
                        return (
                          <button
                            key={entry.value}
                            type="button"
                            className={`${baseClasses} ${colorClasses} ${disabledClasses}`}
                            onClick={() => handleSelectOption(key, entry.value)}
                            disabled={disabled}
                            aria-pressed={isSelected}
                          >
                            <span>{entry.value}</span>
                            <span className="mt-1 block text-[11px] font-normal capitalize text-subtle">
                              {entry.stock} available
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-ghost-10 bg-ghost-5 px-4 py-3.5 shadow-inner shadow-[color:var(--brand)]/10">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-subtle">
              <span>{selectedVariant?.label || (optionKeys.length ? 'Select options for availability' : 'Availability')}</span>
              <span className={isOutOfStock ? 'text-[var(--danger-100)]' : 'text-[var(--text-primary)]'}>{stockMessage}</span>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1 justify-center" onClick={add} disabled={pendingAdd || isOutOfStock}>
                {pendingAdd ? 'Adding…' : isOutOfStock ? 'Out of stock' : 'Add to Cart'}
              </Button>
              <WishlistButton productId={product._id} size="md" variant="button" />
            </div>
            {addError && (
              <p className="rounded-full bg-[var(--danger-10)] px-4 py-2 text-sm text-[var(--danger-100)]">
                {addError}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-ghost-10 bg-ghost-5 px-4 py-3 text-xs uppercase tracking-wider text-subtle">
            SKU: <span className="text-primary">{product._id}</span>
          </div>
        </Card>
      </section>

      {(product.longDescription || (product.specs && product.specs.length > 0)) && (
        <section>
          <Card className="p-5 shadow-lg shadow-[color:var(--brand)]/20 backdrop-blur sm:p-6">
            <div className="flex gap-3">
              <Button
                type="button"
                variant={selectedTab === 'details' ? 'secondary' : 'ghost'}
                size="sm"
                className={selectedTab === 'details' ? 'bg-ghost-20 text-primary' : ''}
                onClick={() => setSelectedTab('details')}
              >
                Details
              </Button>
              {product.specs && product.specs.length > 0 && (
                <Button
                  type="button"
                  variant={selectedTab === 'specs' ? 'secondary' : 'ghost'}
                  size="sm"
                  className={selectedTab === 'specs' ? 'bg-ghost-20 text-primary' : ''}
                  onClick={() => setSelectedTab('specs')}
                >
                  Specs
                </Button>
              )}
            </div>
            <div className="mt-5 text-sm leading-relaxed text-subtle">
              {selectedTab === 'details' ? (
                <div className="space-y-4 text-[0.95rem] leading-relaxed">
                  {product.longDescription ? (
                    product.longDescription.split('\n').map((paragraph, idx) => (
                      <p key={idx} className="whitespace-pre-line">
                        {paragraph}
                      </p>
                    ))
                  ) : (
                    <p>Product details are being finalized. Check back soon for the full story behind this item.</p>
                  )}
                </div>
              ) : (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {product.specs?.map((spec) => (
                    <div key={`${spec.key}-${spec.value}`} className="rounded-2xl border border-ghost-10 bg-ghost-5 p-4">
                      <dt className="text-xs uppercase tracking-wider text-subtle">{spec.key}</dt>
                      <dd className="mt-1 text-sm text-primary">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </Card>
        </section>
      )}

      {/* Product Reviews Section */}
      {product && (
        <section>
          <ProductReviews
            productId={product._id}
            api={{
              getReviewSummary: async (productId: string): Promise<any> => {
                const response = await apiGet(`/products/${productId}/reviews/summary`) as any;
                return {
                  average: response.average ?? 0,
                  count: response.count ?? 0,
                  breakdown: Array.isArray(response.breakdown)
                    ? response.breakdown
                    : [],
                  lastReviewedAt: response.lastReviewedAt ?? undefined,
                };
              },
              getProductReviews: async (productId: string, filters: ReviewFilters): Promise<{ items: Review[]; total: number; hasMore: boolean; limit: number; offset: number; }> => {
                const queryParams = new URLSearchParams();
                if (filters.limit) queryParams.set('limit', filters.limit.toString());
                if (filters.offset) queryParams.set('offset', filters.offset.toString());
                if (filters.sortBy) queryParams.set('sortBy', filters.sortBy);
                if (filters.sortOrder) queryParams.set('sortOrder', filters.sortOrder);

                const response = await apiGet(`/products/${productId}/reviews?${queryParams}`) as any;
                const items = Array.isArray(response.items)
                  ? response.items.map((r: any) => ({
                      ...r,
                      id: r.id ?? r._id ?? '',
                      verified: r.verified ?? false,
                      status: r.status ?? 'published',
                    }))
                  : [];
                return {
                  items,
                  total: response.total ?? items.length,
                  hasMore: response.hasMore ?? false,
                  limit: response.limit ?? filters.limit ?? 10,
                  offset: response.offset ?? filters.offset ?? 0,
                };
              },
              createReview: async (productId: string, data: any): Promise<Review> => {
                const response = await apiPost(`/products/${productId}/reviews`, data) as any;
                return {
                  ...response,
                  id: response.id ?? response._id ?? '',
                  verified: response.verified ?? false,
                  status: response.status ?? 'published',
                };
              },
              markReviewHelpful: async (reviewId: string): Promise<void> => {
                await apiPost(`/reviews/${reviewId}/helpful`, {});
              },
              addReviewResponse: async (reviewId: string, response: string): Promise<any> => {
                const result = await apiPost(`/reviews/${reviewId}/responses`, { response });
                return result;
              }
            }}
            onUpdateSummary={(summary) => {
              // Could update the product rating display here if needed
              console.log('Updated review summary:', summary);
            }}
          />
        </section>
      )}

      {similar.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">You might also like</h2>
            <Link href="/products" className="text-xs text-subtle underline hover:text-[var(--text-primary)]">
              View all products
            </Link>
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-4 snap-x snap-mandatory">
              {similar.map((item) => {
                const related = item.product;
                if (!related) return null;
                const href = related.slug ? `/product/${related.slug}` : '/products';
                return (
                  <Link
                    key={related._id || item.productId}
                    href={href}
                    className="w-[220px] flex-shrink-0 snap-start rounded-3xl border border-ghost-10 bg-ghost-5 text-subtle shadow-lg shadow-[color:var(--brand)]/10 transition hover:border-[var(--brand)]/60 hover:bg-ghost-10"
                  >
                    <div className="relative h-44 overflow-hidden rounded-t-3xl">
                      {related.images?.[0] ? (
                        <img
                          src={related.images[0]}
                          alt={related.title}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition duration-500 hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-[var(--surface-strong)]/40 text-xs text-muted">
                          No image
                        </div>
                      )}
                      <span className="absolute left-4 top-4 rounded-full bg-[var(--surface-solid)] px-3 py-1 text-[11px] font-medium text-[var(--text-primary)]">
                        Match {(item.score ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-1 p-4">
                      <div className="text-sm font-medium text-[var(--text-primary)] line-clamp-1">
                        {related.title || 'Product'}
                      </div>
                      <div className="text-xs text-subtle">
                        {formatCurrency(related.price ?? 0, related.currency || 'USD')}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
