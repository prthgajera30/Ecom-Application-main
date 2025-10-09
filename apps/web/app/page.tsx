"use client";
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, ButtonLink } from '../components/ui/Button';
import { ProductCard } from '../components/ui/ProductCard';
import { WishlistButton } from '../components/ui/WishlistButton';
import { apiGet, ApiError } from '../lib/api';
import { getSocket } from '../lib/ws';
import { useCartState } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';

type Recommendation = {
  score: number;
  product: {
    _id: string;
    title: string;
    slug: string;
    price: number;
    images?: string[];
  };
  productId?: string;
};

type ProductVariant = {
  variantId?: string;
  label?: string;
  price?: number;
  stock?: number;
  options?: Record<string, string>;
  images?: string[];
};

type Product = {
  _id: string;
  title: string;
  slug: string;
  price: number;
  images?: string[];
  brand?: string;
  defaultVariantId?: string;
  variants?: ProductVariant[];
};

type Category = { _id: string; name: string; slug?: string };

const heroChecklist = [
  {
    title: 'Fast delivery',
    description: 'Pulse Prime brings millions of items to your door with two-day shipping.',
    icon: '🚚',
  },
  {
    title: 'Easy returns',
    description: 'Start a return in seconds and drop off packages at convenient locations nationwide.',
    icon: '🔁',
  },
  {
    title: 'Trusted reviews',
    description: 'Shop authentic products backed by verified ratings from millions of customers.',
    icon: '⭐',
  },
];

const workflowMoments = [
  {
    label: 'Discover',
    caption: 'Trending now',
    description: 'Browse curated storefronts, lightning deals, and seasonal collections updated all day.',
  },
  {
    label: 'Save',
    caption: 'Lists & Subscribe',
    description: 'Create wish lists, set up Subscribe & Save, and get notified before essentials run out.',
  },
  {
    label: 'Checkout',
    caption: '1-click secure',
    description: 'Fast, secure payments with real-time tracking from warehouse to doorstep.',
  },
];

const stats = [
  { value: '50K+', label: 'Prime-eligible products ready to ship' },
  { value: '2 hr', label: 'Average delivery window across major cities' },
  { value: '24/7', label: 'Customer support and order tracking' },
];

const communityLogos = [
  { name: 'Pulse Prime', badge: '2-Day Delivery' },
  { name: 'Pulse Fresh', badge: 'Groceries' },
  { name: 'Pulse Home', badge: 'Smart Living' },
  { name: 'Pulse Media', badge: 'Streaming' },
];

export default function Page() {
  const router = useRouter();
  const { user } = useAuth();
  const [health, setHealth] = useState<string>('loading…');
  const [connected, setConnected] = useState<boolean>(false);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [lightningDeals, setLightningDeals] = useState<Product[]>([]);
  const [lightningLoading, setLightningLoading] = useState<boolean>(true);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Recommendation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [categoryProducts, setCategoryProducts] = useState<Record<string, Product[]>>({});
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryPagination, setCategoryPagination] = useState<Record<string, number>>({});
  const [homeSearch, setHomeSearch] = useState('');
  const rotationRef = useRef<number>(Date.now());
  const { addItem, pending } = useCartState();
  const [productErrors, setProductErrors] = useState<Record<string, string>>({});

  const getDefaultVariant = (product: Product): ProductVariant | undefined => {
    if (Array.isArray(product.variants) && product.variants.length) {
      if (product.defaultVariantId) {
        const explicit = product.variants.find((variant) => variant.variantId === product.defaultVariantId);
        if (explicit) return explicit;
      }
      return product.variants[0];
    }
    return undefined;
  };

  useEffect(() => {
    apiGet<{ ok: boolean }>('/health')
      .then((d) => setHealth(d.ok ? 'OK' : 'Attention'))
      .catch(() => setHealth('Attention'));
    apiGet<{ items: Product[] }>('/products?limit=6')
      .then((d) => setFeatured(d.items || []))
      .catch(() => setFeatured([]));
    setLightningLoading(true);
    apiGet<{ items: Product[] }>('/products?limit=4&sort=price_asc')
      .then((d) => setLightningDeals(d.items || []))
      .catch(() => setLightningDeals([]))
      .finally(() => setLightningLoading(false));
    apiGet<{ items: Product[] }>('/products?limit=4&sort=popular')
      .then((d) => setBestSellers(d.items || []))
      .catch(() => setBestSellers([]));
    apiGet<{ items: Recommendation[] }>('/recommendations?k=6')
      .then((d) => setRecommended(d.items || []))
      .catch(() => setRecommended([]));
    setCategoriesLoading(true);
    apiGet<Category[]>('/categories')
      .then((items) => {
        setCategories(items);
        if (items.length && !activeCategory) setActiveCategory(items[0]._id);
      })
      .catch(() => setCategories([]))
      .finally(() => setCategoriesLoading(false));

    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeCategory) return;
    if (categoryProducts[activeCategory]) return;
    setCategoryLoading(true);
    apiGet<{ items: Product[] }>(`/products?limit=4&category=${activeCategory}`)
      .then((d) => setCategoryProducts((prev) => ({ ...prev, [activeCategory]: d.items || [] })))
      .catch(() => setCategoryProducts((prev) => ({ ...prev, [activeCategory]: [] })))
      .finally(() => setCategoryLoading(false));
  }, [activeCategory, categoryProducts]);

  useEffect(() => {
    if (categories.length <= 1) return;
    const interval = setInterval(() => {
      if (Date.now() - rotationRef.current < 8000) return;
      setActiveCategory((current) => {
        if (!categories.length) return current;
        if (!current) return categories[0]._id;
        const index = categories.findIndex((cat) => cat._id === current);
        const next = categories[(index + 1) % categories.length];
        return next?._id || current;
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [categories]);

  const curatedRecommendations = useMemo(
    () => recommended.filter((item): item is Recommendation & { product: NonNullable<Recommendation['product']> } => Boolean(item.product)),
    [recommended]
  );

  const activeCategoryProducts = categoryProducts[activeCategory] || [];
  const activeCategoryName = categories.find((cat) => cat._id === activeCategory)?.name;

  const pendingAdd = (productId: string, variantId?: string | null) => {
    const key = variantId ? `add:${productId}::${variantId}` : `add:${productId}`;
    return Boolean(pending[key]);
  };

  const quickAdd = async (productId: string, variant?: ProductVariant) => {
    rotationRef.current = Date.now();
    setProductErrors((current) => {
      if (!current[productId]) return current;
      const next = { ...current };
      delete next[productId];
      return next;
    });
    try {
      await addItem(productId, 1, variant
        ? {
            variantId: variant.variantId,
            variantLabel: variant.label,
            variantOptions: variant.options,
            unitPrice: variant.price,
          }
        : undefined);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to add this product right now.';
      setProductErrors((current) => ({ ...current, [productId]: message }));
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    rotationRef.current = Date.now();
    setActiveCategory(categoryId);
  };

  const loadMoreCategoryProducts = async () => {
    if (!activeCategory || categoryLoading) return;
    setCategoryLoading(true);
    const nextPage = (categoryPagination[activeCategory] || 0) + 1;
    try {
      const offset = nextPage * 4; // 4 products per page
      const response = await apiGet<{ items: Product[] }>(`/products?limit=4&category=${activeCategory}&offset=${offset}`);
      setCategoryProducts((prev) => ({
        ...prev,
        [activeCategory]: [...(prev[activeCategory] || []), ...response.items]
      }));
      setCategoryPagination((prev) => ({ ...prev, [activeCategory]: nextPage }));
    } catch (err) {
      // Handle error silently
    } finally {
      setCategoryLoading(false);
    }
  };

  const submitHomeSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = homeSearch.trim();
    if (!q) {
      router.push('/products');
      return;
    }
    const params = new URLSearchParams({ search: q });
    router.push(`/products?${params.toString()}`);
  };

  const liveSnapshot = useMemo(
    () => [
  {
    label: 'Store status',
    value: health === 'OK' ? 'Online' : 'Check back soon',
  tone: health === 'OK' ? 'text-[color:var(--text-primary)] bg-[color:var(--brand)]/10' : 'text-[color:var(--danger-100)] bg-[color:var(--danger-10)]',
  },
  {
    label: 'Live updates',
    value: connected ? 'Realtime' : 'Paused',
  tone: connected ? 'text-[color:var(--text-primary)] bg-[color:var(--brand)]/10' : 'text-[color:var(--danger-100)] bg-[color:var(--danger-10)]',
  },
      {
        label: 'Deals today',
        value: featured.length ? `${featured.length}+ active` : 'Loading',
  tone: 'text-[color:var(--text-muted)] bg-ghost-10',
      },
    ],
    [connected, featured.length, health]
  );

  return (
    <div className="space-y-24">
  <section className="relative overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-strong)] p-8 shadow-xl shadow-slate-950/30 backdrop-blur-xl transition-colors md:p-14">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--bg-glow-1)_0%,transparent_55%)]" />
          <div className="absolute -right-20 top-10 hidden h-72 w-72 rounded-full bg-[var(--bg-glow-2)] blur-3xl lg:block" />
        </div>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <div className="space-y-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)] px-4 py-1 text-xs font-semibold uppercase tracking-widest text-subtle">
              Pulse Market
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
                Everything you love. Delivered fast.
              </h1>
              <p className="max-w-2xl text-base text-[var(--text-muted)]">
                From daily essentials to the latest tech, enjoy Prime perks on every order.
              </p>
            </div>
            <form onSubmit={submitHomeSearch} className="md:max-w-xl">
              <div className="flex gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3 shadow-inner shadow-slate-900/10">
                <span className="text-lg text-[var(--text-muted)]">🔍</span>
                <input
                  value={homeSearch}
                  onChange={(e) => setHomeSearch(e.target.value)}
                  placeholder="Search millions of products, e.g. headphones or sneakers"
                  className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-subtle)] focus:outline-none"
                />
                <Button type="submit" className="px-4 py-1.5 text-sm">Search</Button>
              </div>
            </form>
            <div className="flex flex-wrap gap-3">
              <Link href="/products?sort=price" className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)] px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]">
                Today's Deals
              </Link>
              <Link href="/products?sort=popular" className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)] px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]">
                Best Sellers
              </Link>
              <Link href="/products" className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)] px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]">
                New Arrivals
              </Link>
              <Link href="/orders" className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)] px-4 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]">
                Your Orders
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {heroChecklist.map((item) => (
                <div key={item.title} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-5 shadow-lg shadow-slate-900/15">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{item.title}</h3>
                      <p className="text-xs text-[var(--text-muted)]">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-6 text-xs font-medium uppercase tracking-wide text-[var(--text-subtle)]">
              {communityLogos.map((logo) => (
                <div key={logo.name} className="flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1">
                  <span>{logo.name}</span>
                  <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">{logo.badge}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="mx-auto max-w-lg space-y-6 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] p-6 shadow-2xl shadow-slate-950/30">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Store status</h3>
                <p className="text-xs text-[var(--text-muted)]">Live indicators so you always know shipping and deals are ready.</p>
              </div>
              <div className="space-y-3">
                {liveSnapshot.map((item) => (
                  <div key={item.label} className={cn('flex items-center justify-between rounded-2xl border border-[var(--surface-border)] px-4 py-3 text-sm text-[var(--text-primary)]', item.tone)}>
                    <span className="text-[var(--text-muted)]">{item.label}</span>
                    <span className="font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-muted)] p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-subtle)]">Pulse shopping perks</span>
                <div className="space-y-3">
                  {workflowMoments.map((moment) => (
                    <div key={moment.label} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-muted)]">
                      <div className="flex items-center justify-between text-[var(--text-primary)]">
                        <span className="font-semibold">{moment.label}</span>
                        <span className="rounded-full border border-[var(--surface-border)] bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--text-subtle)]">{moment.caption}</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[var(--text-subtle)]">{moment.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-muted)] p-5 text-center shadow-lg shadow-slate-900/15">
              <div className="text-2xl font-semibold text-[var(--text-primary)]">{stat.value}</div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Shop by category</h2>
            <p className="section-subtitle">Browse popular categories and quickly add items to your cart.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div data-testid="category-nav">
              {categoriesLoading ? (
                // simple skeleton buttons
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={`cat-skel-${i}`} className="h-8 w-24 rounded-full bg-ghost-10 animate-pulse" />
                ))
              ) : (
                categories.slice(0, 6).map((category) => (
                  <button
                    key={category._id}
                    type="button"
                    onClick={() => handleCategorySelect(category._id)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                      activeCategory === category._id ? 'bg-surface-solid text-[var(--text-primary)] shadow shadow-[color:var(--brand)]/30' : 'bg-ghost-10 text-muted hover:bg-ghost-20'
                    }`}
                  >
                    {category.name}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
  <div className="relative min-h-[220px] overflow-hidden rounded-3xl border border-ghost-10 bg-ghost-5 p-6">
          {categoryLoading && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-[color:var(--surface-strong)]/40 backdrop-blur-sm text-xs text-muted">
              Loading personalized picks…
            </div>
          )}
          {activeCategoryProducts.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {activeCategoryProducts.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    variant="category"
                    onQuickAdd={quickAdd}
                    pendingItems={pending}
                    errors={productErrors}
                  />
                ))}
              </div>
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={loadMoreCategoryProducts}
                  disabled={categoryLoading}
                  className="rounded-full bg-ghost-10 border border-ghost-20 px-6 py-2 text-sm font-semibold text-primary hover:bg-ghost-20 disabled:opacity-60 transition"
                >
                  {categoryLoading ? 'Loading more...' : 'Load more products'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              {activeCategoryName ? `No items in ${activeCategoryName} yet—try another category.` : 'Pick a category to preview items.'}
            </div>
          )}
        </div>
      </section>

      {(lightningDeals.length > 0 || lightningLoading) && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="section-title">Lightning deals</h2>
              <p className="section-subtitle">Grab limited-time savings before the timer runs out.</p>
            </div>
            <ButtonLink href="/products?sort=price_asc" variant="secondary">View all deals</ButtonLink>
          </div>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {lightningLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={`deal-skel-${i}`} className="h-56 w-full rounded-2xl bg-ghost-10 animate-pulse" />
                ))
              ) : (
                lightningDeals.map((product) => (
                  <ProductCard
                    key={product._id}
                    product={product}
                    variant="default"
                    badgeLabel="Hot deal"
                    badgeColor="amber"
                    onQuickAdd={quickAdd}
                    pendingItems={pending}
                    errors={productErrors}
                  />
                ))
              )}
            </div>
        </section>
      )}

      {bestSellers.length > 0 && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="section-title">Best sellers</h2>
              <p className="section-subtitle">Crowd favorites with consistently high demand.</p>
            </div>
            <ButtonLink href="/products?sort=popular" variant="secondary">View best sellers</ButtonLink>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {bestSellers.map((product) => (
              <ProductCard
                key={product._id}
                product={product}
                variant="default"
                badgeLabel="Best seller"
                badgeColor="indigo"
                onQuickAdd={quickAdd}
                pendingItems={pending}
                errors={productErrors}
              />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Featured products</h2>
            <p className="section-subtitle">Hand-picked items from our catalog.</p>
          </div>
          <ButtonLink href="/products" variant="secondary">View all products</ButtonLink>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {featured.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              variant="featured"
              badgeLabel="Featured"
              badgeColor="emerald"
              onQuickAdd={quickAdd}
              pendingItems={pending}
              errors={productErrors}
            />
          ))}
        </div>
      </section>

      {curatedRecommendations.length > 0 && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="section-title">Recommended for you</h2>
              <p className="section-subtitle">Personalized picks based on your browsing.</p>
            </div>
            <ButtonLink href="/cart" variant="secondary">Go to cart</ButtonLink>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {curatedRecommendations.map((item) => {
              const product = item.product!;
              const variant = getDefaultVariant(product);
              const price = variant?.price ?? product.price;
              const addBusy = pendingAdd(product._id, variant?.variantId ?? null);
              return (
                  <div key={product._id} className="card flex h-full flex-col overflow-hidden">
                  <Link href={product.slug ? `/product/${product.slug}` : '#'} className="group relative block h-48 overflow-hidden">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        loading="eager"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[var(--surface-strong)]" role="img" aria-label="No image">No image</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--surface-strong)] via-transparent" />
                    <div className="absolute left-4 top-4 rounded-full bg-surface-solid px-3 py-1 text-xs font-medium text-primary">
                      Match {(item.score ?? 0).toFixed(2)}
                    </div>
                  </Link>
                  <div className="flex flex-1 flex-col justify-between space-y-3 p-5">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-primary line-clamp-1">{product.title}</h3>
                      <p className="text-sm text-muted">${(price / 100).toFixed(2)}</p>
                    </div>
                    <div className="space-y-2">
                      <Button
                        type="button"
                        className="w-full justify-center"
                        onClick={() => quickAdd(product._id, variant)}
                        disabled={addBusy}
                      >
                        {addBusy ? 'Adding…' : 'Add to Cart'}
                      </Button>
                      {productErrors[product._id] && (
                        <p className="rounded-full bg-[var(--danger-10)] px-3 py-2 text-xs text-[var(--danger-100)] text-center">
                          {productErrors[product._id]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

  <section className="rounded-3xl border border-ghost-10 bg-ghost-5 p-8 text-center shadow-xl shadow-[color:var(--brand)]/30">
        {(!user) ? (
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold text-primary">Sign in for your best experience</h2>
            <p className="mx-auto max-w-2xl text-sm text-muted">Track orders, save items, and get better recommendations.</p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/login" variant="secondary">Sign in</ButtonLink>
              <ButtonLink href="/register">Create account</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold text-primary">Welcome back</h2>
            <p className="mx-auto max-w-2xl text-sm text-muted">Jump to your orders or keep shopping today's deals.</p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/orders" variant="secondary">Your orders</ButtonLink>
              <ButtonLink href="/products?sort=price">Today's deals</ButtonLink>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
