"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiGet, apiPost } from '../../../../lib/api';

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
  const [p, setP] = useState<ProductDetail | null>(null);
  const [msg, setMsg] = useState('');
  const [similar, setSimilar] = useState<RecommendationItem[]>([]);

  useEffect(() => {
    if (!slug) return;
    apiGet<ProductDetail>(`/products/slug/${slug}`)
      .then((data) => {
        setP(data);
        const productId = (data as any)?._id;
        if (productId) {
          apiGet<{ items: RecommendationItem[] }>(`/recommendations?productId=${productId}&k=4`)
            .then((d) => setSimilar(d.items || []))
            .catch(() => setSimilar([]));
        }
      })
      .catch(() => {
        setP(null);
        setSimilar([]);
      });
  }, [slug]);

  async function add() {
    if (!p) return;
    await apiPost('/cart/add', { productId: p._id, qty: 1 });
    setMsg('Added to cart');
    setTimeout(() => setMsg(''), 1000);
  }

  if (!p) return <p>Loading...</p>;

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          {p.images?.[0] && <img src={p.images[0]} alt={p.title} className="w-full rounded" />}
          {p.images?.[1] && <img src={p.images[1]} alt={p.title} className="w-full mt-3 rounded" />}
        </div>
        <div>
          <h1 className="text-2xl font-semibold mb-2">{p.title}</h1>
          <div className="text-gray-600 mb-4">${p.price / 100}</div>
          <p className="mb-4 whitespace-pre-line">{p.description}</p>
          <button className="bg-black text-white px-4 py-2 rounded" onClick={add}>Add to cart</button>
          {msg && <p className="mt-3 text-sm text-green-700">{msg}</p>}
        </div>
      </div>

      {similar.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Similar items</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {similar.map((item) => {
              const product = item.product;
              if (!product) return null;
              const href = product.slug ? `/product/${product.slug}` : '#';
              return (
                <Link key={product._id || item.productId} href={href} className="card overflow-hidden">
                  {product.images?.[0] && <img src={product.images[0]} alt={product.title} className="w-full h-40 object-cover" />}
                  <div className="p-4">
                    <div className="font-medium mb-1 line-clamp-1">{product.title || 'Product'}</div>
                    {product.price && <div className="text-sm text-gray-600">${product.price / 100}</div>}
                    <div className="text-xs text-gray-400">Match {(item.score ?? 0).toFixed(2)}</div>
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
