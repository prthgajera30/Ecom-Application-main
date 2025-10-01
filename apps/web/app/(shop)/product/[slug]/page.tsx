'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiGet, ApiError } from '../../../../lib/api';
import { useCartState } from '../../../../context/CartContext';

type ProductDetail = {
  _id: string;
  title: string;
  slug: string;
  price: number;
  description?: string;
  images?: string[];
};

type RecommendationItem = {
  score: number;
  product: ProductDetail | null;
  productId?: string;
};

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [similar, setSimilar] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const { addItem, pending } = useCartState();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(false);
    apiGet<ProductDetail>(`/products/slug/${slug}`)
      .then((data) => {
        setProduct(data);
        setError(false);
        const productId = (data as any)?._id;
        if (productId) {
          apiGet<{ items: RecommendationItem[] }>(`/recommendations?productId=${productId}&k=4`)
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

  async function add() {
    if (!product) return;
    setAddError(null);
    try {
      await addItem(product._id, 1);
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

  const gallery = product.images ?? [];
  const primaryImage = gallery[0];
  const secondaryImages = gallery.slice(1, 4);
  const pendingAdd = Boolean(pending[`add:${product._id}`]);

  return (
    <div className="space-y-12">
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          {primaryImage ? (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/40">
              <img src={primaryImage} alt={product.title} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-white/10 bg-slate-900/40 text-sm text-indigo-100/60">
              No imagery available
            </div>
          )}
          {secondaryImages.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {secondaryImages.map((image, idx) => (
                <div
                  key={`${image}-${idx}`}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40"
                >
                  <img
                    src={image}
                    alt={`${product.title} alternate ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
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
            <div className="text-lg font-semibold text-indigo-100/80">
              ${(product.price / 100).toFixed(2)}
            </div>
            {product.description && (
              <p className="text-sm leading-relaxed text-indigo-100/70 whitespace-pre-line">
                {product.description}
              </p>
            )}
          </div>
          <div className="space-y-3">
            <button className="btn-primary w-full justify-center sm:w-auto disabled:opacity-60" onClick={add} disabled={pendingAdd}>
              {pendingAdd ? 'Adding…' : 'Add to cart'}
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

      {similar.length > 0 && (
        <section className="space-y-4">
          <h2 className="section-title">Similar items</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((item) => {
              const related = item.product;
              if (!related) return null;
              const href = related.slug ? `/product/${related.slug}` : '/products';
              return (
                <Link
                  key={related._id || item.productId}
                  href={href}
                  className="card group overflow-hidden"
                >
                  <div className="relative h-44 overflow-hidden">
                    {related.images?.[0] ? (
                      <img
                        src={related.images[0]}
                        alt={related.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-900/40 text-xs text-indigo-100/50">
                        No image
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-transparent" />
                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-900">
                      Match {(item.score ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-1 p-4">
                    <div className="text-sm font-medium text-white line-clamp-1">
                      {related.title || 'Product'}
                    </div>
                    <div className="text-xs text-indigo-100/70">
                      ${((related.price ?? 0) / 100).toFixed(2)}
                    </div>
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
