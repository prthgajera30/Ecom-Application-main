"use client";
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiGet } from '../lib/api';
import { getSocket } from '../lib/ws';

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

const sellingPoints = [
  {
    title: 'Signals that learn with every click',
    description: 'Real-time events update recommendations instantly, ensuring shoppers always see the most relevant products.',
    icon: '⚡',
  },
  {
    title: 'Seamless checkout experiences',
    description: 'Stripe-powered flows with inventory-aware sockets keep teams and shoppers in sync.',
    icon: '💳',
  },
  {
    title: 'Full-stack observability',
    description: 'From Prisma to pandas, the entire stack is wired for insight and ready for production workloads.',
    icon: '📊',
  },
];

const stats = [
  { value: '250ms', label: 'Median personalization latency' },
  { value: '98%', label: 'Catalog coverage with rich imagery' },
  { value: '24/7', label: 'Realtime socket connectivity' },
];

export default function Page() {
  const [health, setHealth] = useState<string>('loading...');
  const [connected, setConnected] = useState<boolean>(false);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [recommended, setRecommended] = useState<Recommendation[]>([]);

  useEffect(() => {
    apiGet<{ ok: boolean }>("/health").then((d) => setHealth(d.ok ? 'OK' : 'ERR')).catch(() => setHealth('ERR'));
    apiGet<{ items: Product[] }>("/products?limit=6").then((d) => setFeatured(d.items || [])).catch(() => setFeatured([]));
    apiGet<{ items: Recommendation[] }>("/recommendations?k=6").then((d) => setRecommended(d.items || [])).catch(() => setRecommended([]));
    const s = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  const curatedRecommendations = useMemo(
    () => recommended.filter((item): item is Recommendation & { product: NonNullable<Recommendation['product']> } => Boolean(item.product)),
    [recommended]
  );

  return (
    <div className="space-y-20">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/20 via-slate-900/70 to-indigo-900/40 p-8 shadow-2xl shadow-indigo-950/30 backdrop-blur-xl md:p-12">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div className="space-y-6">
            <span className="badge">Realtime personalization cloud</span>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Craft shopping journeys that respond to every signal.
            </h1>
            <p className="text-lg text-indigo-100/80">
              Pulse Commerce fuses a Next.js storefront, realtime Node gateway, and machine-learned recommendations so you launch faster without sacrificing polish.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/products" className="btn-primary">Browse catalog</Link>
              <Link href="/register" className="btn-secondary">Create free account</Link>
            </div>
            <div className="flex flex-wrap gap-6 pt-4 text-sm text-indigo-100/70">
              <div>API: <span className={health === 'OK' ? 'text-emerald-400' : 'text-rose-400'}>{health}</span></div>
              <div>WebSocket: <span className={connected ? 'text-emerald-400' : 'text-rose-400'}>{connected ? 'connected' : 'offline'}</span></div>
            </div>
          </div>
          <div className="relative">
            <div className="card-elevated p-6 md:p-8">
              <h3 className="text-lg font-semibold text-white">Why teams choose Pulse</h3>
              <p className="mt-2 text-sm text-indigo-100/70">
                Built as a reference platform, the stack demonstrates how to blend analytics, sockets, and commerce flows with maintainable patterns.
              </p>
              <ul className="mt-6 space-y-4 text-sm text-indigo-100/80">
                {sellingPoints.map((point) => (
                  <li key={point.title} className="flex items-start gap-3">
                    <span className="mt-0.5 text-base">{point.icon}</span>
                    <div>
                      <div className="font-medium text-white">{point.title}</div>
                      <p className="text-indigo-100/70">{point.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center shadow-lg shadow-indigo-900/20">
              <div className="text-2xl font-semibold text-white">{stat.value}</div>
              <div className="mt-1 text-sm text-indigo-100/70">{stat.label}</div>
            </div>
          ))}
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
              return (
                <Link key={product._id} href={product.slug ? `/product/${product.slug}` : '#'} className="card group overflow-hidden">
                  <div className="relative h-48 overflow-hidden">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-800">No image</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-transparent" />
                    <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-900">
                      Match {(item.score ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="space-y-2 p-5">
                    <h3 className="text-lg font-semibold text-white line-clamp-1">{product.title}</h3>
                    <p className="text-sm text-indigo-100/70"> ${(product.price / 100).toFixed(2)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
