'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiGet, ApiError } from '../../../../lib/api';
import { useCartState } from '../../../../context/CartContext';

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
      <div className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-10 text-sm text-indigo-100/70">
        Loading product details...
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-10 text-center text-sm text-rose-100">
        We couldn't find that product.
        <Link href="/products" className="ml-2 text-white underline hover:text-rose-50">
          Back to products
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40">
            {activeImage ? (
              <img src={activeImage} alt={product.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex min-h-[280px] items-center justify-center text-sm text-indigo-100/60">
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
                    className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border transition ${
                      isSelected ? 'border-white/80' : 'border-white/10 hover:border-indigo-400/60'
                    }`}
                    onClick={() => setActiveImage(image)}
                  >
                    <img src={image} alt="Product preview" className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="card-elevated space-y-6 p-6 md:p-8">
          <div className="space-y-3">
            <Link
              href="/products"
              className="text-xs font-semibold uppercase tracking-wider text-indigo-100/60 hover:text-white"
            >
              Back to products
            </Link>
            <h1 className="text-3xl font-semibold leading-tight text-white">{product.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-indigo-100/70">
              {product.brand && <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wider">{product.brand}</span>}
              {ratingAverage && (
                <span className="flex items-center gap-2 text-xs text-amber-300">
                  <span className="text-lg leading-none">★</span>
                  <span className="font-semibold text-white">{ratingAverage}</span>
                  <span className="text-[11px] uppercase tracking-wider text-indigo-100/60">({ratingCount} reviews)</span>
                </span>
              )}
              {!ratingAverage && <span className="text-xs uppercase tracking-wider text-indigo-100/60">Reviews coming soon</span>}
            </div>
            <div className="text-2xl font-semibold text-indigo-50">{formatCurrency(displayPrice, currency)}</div>
            {product.badges && product.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-wider text-indigo-100/70">
                {product.badges.map((badge) => (
                  <span key={badge} className="rounded-full border border-indigo-300/40 px-3 py-1">
                    {badge}
                  </span>
                ))}
              </div>
            )}
            {product.description && (
              <p className="text-sm leading-relaxed text-indigo-100/80 whitespace-pre-line">
                {product.description}
              </p>
            )}
          </div>

          {optionKeys.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between text-xs uppercase tracking-wider text-indigo-100/60">
                <span>Configure</span>
                <span className="text-indigo-100/80">{stockMessage}</span>
              </div>
              {optionKeys.map((key) => {
                const values = optionFacets[key] ?? [];
                const selectedValue = selectedOptions[key];
                return (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wider text-indigo-100/60">
                      <span>{formatOptionLabel(key)}</span>
                      {selectedValue && (
                        <button
                          type="button"
                          className="text-[11px] text-indigo-200 underline hover:text-white"
                          onClick={() => clearOption(key)}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {values.map((entry) => {
                        const isSelected = entry.value === selectedValue;
                        const disabled = !entry.available && !isSelected;
                        const baseClasses = 'min-w-[72px] rounded-2xl border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70';
                        const colorClasses = isSelected
                          ? 'border-white/80 bg-white/20 text-white'
                          : 'border-white/10 bg-white/5 text-indigo-100/80 hover:border-indigo-400/60 hover:bg-white/10';
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
                            <span className="block text-[10px] font-normal capitalize text-indigo-100/50">
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

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-indigo-100/60">
              <span>{selectedVariant?.label || (optionKeys.length ? 'Select options for availability' : 'Availability')}</span>
              <span className={isOutOfStock ? 'text-rose-200' : 'text-emerald-200'}>{stockMessage}</span>
            </div>
            <button
              className="btn-primary w-full justify-center sm:w-auto disabled:opacity-60"
              onClick={add}
              disabled={pendingAdd || isOutOfStock}
            >
              {pendingAdd ? 'Adding…' : isOutOfStock ? 'Out of stock' : 'Add to cart'}
            </button>
            {addError && (
              <p className="rounded-full bg-rose-500/15 px-4 py-2 text-sm text-rose-100">
                {addError}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs uppercase tracking-wider text-indigo-100/50">
            SKU: <span className="text-indigo-100/80">{product._id}</span>
          </div>
        </div>
      </section>

      {(product.longDescription || (product.specs && product.specs.length > 0)) && (
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-indigo-900/20 backdrop-blur">
          <div className="flex gap-3">
            <button
              type="button"
              className={`rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                selectedTab === 'details' ? 'bg-white/20 text-white' : 'bg-white/5 text-indigo-100/70 hover:bg-white/10'
              }`}
              onClick={() => setSelectedTab('details')}
            >
              Details
            </button>
            {product.specs && product.specs.length > 0 && (
              <button
                type="button"
                className={`rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
                  selectedTab === 'specs' ? 'bg-white/20 text-white' : 'bg-white/5 text-indigo-100/70 hover:bg-white/10'
                }`}
                onClick={() => setSelectedTab('specs')}
              >
                Specs
              </button>
            )}
          </div>
          <div className="mt-5 text-sm leading-relaxed text-indigo-100/80">
            {selectedTab === 'details' ? (
              <div className="space-y-4">
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
                  <div key={`${spec.key}-${spec.value}`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <dt className="text-xs uppercase tracking-wider text-indigo-100/60">{spec.key}</dt>
                    <dd className="mt-1 text-sm text-white">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-title">You might also like</h2>
            <Link href="/products" className="text-xs text-indigo-200 underline hover:text-white">
              View all products
            </Link>
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-4">
              {similar.map((item) => {
                const related = item.product;
                if (!related) return null;
                const href = related.slug ? `/product/${related.slug}` : '/products';
                return (
                  <Link
                    key={related._id || item.productId}
                    href={href}
                    className="w-[220px] flex-shrink-0 rounded-3xl border border-white/10 bg-white/5 shadow-lg shadow-indigo-900/10 transition hover:border-indigo-400/60 hover:bg-white/10"
                  >
                    <div className="relative h-44 overflow-hidden rounded-t-3xl">
                      {related.images?.[0] ? (
                        <img
                          src={related.images[0]}
                          alt={related.title}
                          className="h-full w-full object-cover transition duration-500 hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-slate-900/40 text-xs text-indigo-100/50">
                          No image
                        </div>
                      )}
                      <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-900">
                        Match {(item.score ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-1 p-4">
                      <div className="text-sm font-medium text-white line-clamp-1">
                        {related.title || 'Product'}
                      </div>
                      <div className="text-xs text-indigo-100/70">
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
