"use client";
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet, ApiError } from '../lib/api';
import { getSocket } from '../lib/ws';
import { useCartState } from '../context/CartContext';

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

type Product = {
  _id: string;
  title: string;
  slug: string;
  price: number;
  images?: string[];
};

type Category = { _id: string; name: string; slug?: string };

const heroChecklist = [
  {
    title: 'Signal-first architecture',
    description: 'Sockets, analytics, and personalization share a single source of truth so every shopper sees up-to-date context.',
    icon: '🛰️',
  },
  {
    title: 'Production-grade flows',
    description: 'Next.js app router, type-safe APIs, and Prisma orders ensure portfolio demos feel like a launch-ready store.',
    icon: '🛠️',
  },
  {
    title: 'Insights baked in',
    description: 'Feature flags, recommendations, and trend tabs help product teams experiment without extra scaffolding.',
    icon: '📈',
  },
];

const workflowMoments = [
  {
    label: 'Observe',
    caption: 'Real-time telemetry',
    description: 'Every click, add-to-cart, and checkout pings the websocket hub so your UI reacts instantly.',
  },
  {
    label: 'Personalize',
    caption: 'Recommendations-on-demand',
    description: 'Match shoppers to inventory with lightweight APIs that return curated tiles in <250 ms.',
  },
  {
    label: 'Convert',
    caption: 'Checkout orchestration',
    description: 'Stripe-backed flows keep payments snappy while orders hydrate dashboards for follow-up experiences.',
  },
];

const stats = [
  { value: '3.2x', label: 'Faster onboarding for shoppers exploring trends' },
  { value: '250ms', label: 'Median personalization latency end-to-end' },
  { value: '0 ops', label: 'DevOps required for demo-ready launches' },
];

const communityLogos = [
  { name: 'Next.js', badge: 'App Router 14' },
  { name: 'Stripe', badge: 'Checkout Ready' },
  { name: 'Prisma', badge: 'Typed Models' },
  { name: 'Socket.io', badge: 'Realtime' },
];

export default function Page() {
  const [health, setHealth] = useState<string>('loading…');
  const [connected, setConnected] = useState<boolean>(false);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Recommendation[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [categoryProducts, setCategoryProducts] = useState<Record<string, Product[]>>({});
  const [categoryLoading, setCategoryLoading] = useState(false);
  const rotationRef = useRef<number>(Date.now());
  const { addItem, pending } = useCartState();
  const [productErrors, setProductErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    apiGet<{ ok: boolean }>('/health')
      .then((d) => setHealth(d.ok ? 'OK' : 'Attention'))
      .catch(() => setHealth('Attention'));
    apiGet<{ items: Product[] }>('/products?limit=6')
      .then((d) => setFeatured(d.items || []))
      .catch(() => setFeatured([]));
    apiGet<{ items: Recommendation[] }>('/recommendations?k=6')
      .then((d) => setRecommended(d.items || []))
      .catch(() => setRecommended([]));
    apiGet<Category[]>('/categories')
      .then((items) => {
        setCategories(items);
        if (items.length && !activeCategory) setActiveCategory(items[0]._id);
      })
      .catch(() => setCategories([]));

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

  const pendingAdd = (productId: string) => Boolean(pending[`add:${productId}`]);

  const quickAdd = async (productId: string) => {
    rotationRef.current = Date.now();
    setProductErrors((current) => {
      if (!current[productId]) return current;
      const next = { ...current };
      delete next[productId];
      return next;
    });
    try {
      await addItem(productId, 1);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to add this product right now.';
      setProductErrors((current) => ({ ...current, [productId]: message }));
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    rotationRef.current = Date.now();
    setActiveCategory(categoryId);
  };

  const liveSnapshot = useMemo(
    () => [
      {
        label: 'API health',
        value: health,
        tone: health === 'OK' ? 'text-emerald-300 bg-emerald-500/10' : 'text-rose-200 bg-rose-500/10',
      },
      {
        label: 'Websocket',
        value: connected ? 'Connected' : 'Offline',
        tone: connected ? 'text-sky-200 bg-sky-500/10' : 'text-rose-200 bg-rose-500/10',
      },
      {
        label: 'Featured items',
        value: featured.length ? `${featured.length}+ curated` : 'Loading…',
        tone: 'text-indigo-200 bg-indigo-500/10',
      },
    ],
    [connected, featured.length, health]
  );

  return (
    <div className="space-y-24">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-8 shadow-2xl shadow-indigo-950/40 backdrop-blur-xl md:p-14">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,var(--bg-glow-1)_0%,transparent_55%)]" />
        <div className="absolute -right-20 top-10 hidden h-72 w-72 rounded-full bg-cyan-500/30 blur-3xl lg:block" />
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
          <div className="space-y-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-indigo-100/80">
              Pulse Commerce Studio
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Stage a portfolio storefront that feels like a live product launch.
              </h1>
              <p className="max-w-2xl text-base text-indigo-100/80">
                Swap sample data, recompute recommendations, and watch real-time events flow without wiring a single backend. Drag this project into interviews and ship ideas faster than slide decks.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/products" className="btn-primary">
                Explore catalog
              </Link>
              <Link href="/orders" className="btn-secondary">
                View order history
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {heroChecklist.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-indigo-900/20">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                      <p className="text-xs text-indigo-100/70">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-6 text-xs font-medium uppercase tracking-wide text-indigo-100/60">
              {communityLogos.map((logo) => (
                <div key={logo.name} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <span>{logo.name}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-indigo-100/70">{logo.badge}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="mx-auto max-w-lg space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/40">
              <div>
                <h3 className="text-lg font-semibold text-white">Live signal snapshot</h3>
                <p className="text-xs text-indigo-100/70">Directly from the API so you can demo resilience during interviews.</p>
              </div>
              <div className="space-y-3">
                {liveSnapshot.map((item) => (
                  <div key={item.label} className={`flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm ${item.tone}`}>
                    <span className="text-indigo-100/70">{item.label}</span>
                    <span className="font-semibold text-white/90">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-indigo-100/60">Workflow blueprint</span>
                <div className="space-y-3">
                  {workflowMoments.map((moment) => (
                    <div key={moment.label} className="rounded-xl border border-white/5 bg-white/10 px-4 py-3 text-sm text-indigo-100/80">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{moment.label}</span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-indigo-100/60">{moment.caption}</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-indigo-100/60">{moment.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center shadow-lg shadow-indigo-900/20">
              <div className="text-2xl font-semibold text-white">{stat.value}</div>
              <div className="mt-1 text-sm text-indigo-100/70">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Trending collections</h2>
            <p className="section-subtitle">Glide between audiences and categories to showcase how the storefront adapts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 6).map((category) => (
              <button
                key={category._id}
                type="button"
                onClick={() => handleCategorySelect(category._id)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  activeCategory === category._id ? 'bg-white text-slate-900 shadow shadow-indigo-500/30' : 'bg-white/10 text-indigo-100/80 hover:bg-white/20'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
        <div className="relative min-h-[220px] overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6">
          {categoryLoading && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/40 backdrop-blur-sm text-xs text-indigo-100/70">
              Loading personalized picks…
            </div>
          )}
          {activeCategoryProducts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {activeCategoryProducts.map((product) => (
                <div key={product._id} className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
                  <Link href={`/product/${product.slug}`} className="relative h-32 overflow-hidden rounded-xl">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-indigo-100/60">No image</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/80 via-transparent" />
                  </Link>
                  <div className="space-y-2 text-sm text-indigo-100/80">
                    <div className="text-base font-semibold text-white line-clamp-1">{product.title}</div>
                    <div className="flex items-center justify-between text-xs">
                      <span>${(product.price / 100).toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => quickAdd(product._id)}
                        className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
                        disabled={pendingAdd(product._id)}
                      >
                        {pendingAdd(product._id) ? 'Adding…' : 'Quick add'}
                      </button>
                    </div>
                    {productErrors[product._id] && (
                      <p className="rounded-full bg-rose-500/15 px-2 py-1 text-[11px] text-rose-100">{productErrors[product._id]}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-indigo-100/70">
              {activeCategoryName ? `No items in ${activeCategoryName} yet—try another audience.` : 'Pick a category to preview personalized tiles.'}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Featured arrivals</h2>
            <p className="section-subtitle">Hand-picked inventory seeded into the catalog so you can explore the storefront experience.</p>
          </div>
          <Link href="/products" className="btn-secondary">View all products</Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {featured.map((product) => (
            <div key={product._id} className="card group overflow-hidden">
              <Link href={`/product/${product.slug}`} className="block">
                <div className="relative h-52 overflow-hidden">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-slate-800">No image</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent" />
                </div>
                <div className="space-y-2 p-5">
                  <div className="flex items-center justify-between text-sm text-indigo-200/80">
                    <span>Featured</span>
                    <span>${(product.price / 100).toFixed(2)}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white line-clamp-1">{product.title}</h3>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {curatedRecommendations.length > 0 && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="section-title">Because you viewed</h2>
              <p className="section-subtitle">Recommendations generated from the realtime event pipeline. Scores refresh as you browse.</p>
            </div>
            <Link href="/cart" className="btn-secondary">Go to cart</Link>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {curatedRecommendations.map((item) => {
              const product = item.product!;
              const addBusy = pendingAdd(product._id);
              return (
                <div key={product._id} className="card flex h-full flex-col overflow-hidden">
                  <Link href={product.slug ? `/product/${product.slug}` : '#'} className="group relative block h-48 overflow-hidden">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-800">No image</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-transparent" />
                    <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-900">
                      Match {(item.score ?? 0).toFixed(2)}
                    </div>
                  </Link>
                  <div className="flex flex-1 flex-col justify-between space-y-3 p-5">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-white line-clamp-1">{product.title}</h3>
                      <p className="text-sm text-indigo-100/70">${(product.price / 100).toFixed(2)}</p>
                    </div>
                    <div className="space-y-2">
                      <button
                        type="button"
                        className="btn-primary w-full justify-center disabled:opacity-60"
                        onClick={() => quickAdd(product._id)}
                        disabled={addBusy}
                      >
                        {addBusy ? 'Adding…' : 'Add to cart'}
                      </button>
                      {productErrors[product._id] && (
                        <p className="rounded-full bg-rose-500/15 px-3 py-2 text-xs text-rose-100 text-center">
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

      <section className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-xl shadow-indigo-950/30">
        <div className="space-y-3">
          <span className="badge">Launch-ready blueprint</span>
          <h2 className="text-3xl font-semibold text-white">Cut the time it takes to demo a full-stack shop.</h2>
          <p className="mx-auto max-w-2xl text-sm text-indigo-100/70">
            Fork the repo, swap the seeded catalog, and connect your own analytics. Pulse Commerce was built for product designers, engineers, and founders who want to impress without a months-long build.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/register" className="btn-primary">
            Create an account
          </Link>
          <Link href="https://github.com/" className="btn-secondary" target="_blank" rel="noreferrer">
            View GitHub project
          </Link>
        </div>
      </section>
    </div>
  );
}
