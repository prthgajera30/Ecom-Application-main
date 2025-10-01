"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '../../../lib/api';
import { useCartState } from '../../../context/CartContext';
import { ApiError } from '../../../lib/api';

type Product = {
  _id: string;
  title: string;
  slug: string;
  price: number;
  images?: string[];
  categoryId?: string;
};

type Category = { _id: string; name: string };

type ProductsResponse = { items: Product[] };

const sortOptions = [
  { value: '', label: 'Featured' },
  { value: 'price', label: 'Price: Low to High' },
  { value: 'popular', label: 'Most Popular' },
];

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sort, setSort] = useState<string>('');
  const [errorsByProduct, setErrorsByProduct] = useState<Record<string, string>>({});
  const { addItem, pending } = useCartState();

  useEffect(() => {
    apiGet<Category[]>('/categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (selectedCategory) params.set('category', selectedCategory);
        if (sort) params.set('sort', sort);
        params.set('limit', '24');
        const query = params.toString();
        const { items } = await apiGet<ProductsResponse>(`/products${query ? `?${query}` : ''}`);
        setItems(items);
      } catch (err) {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [debouncedSearch, selectedCategory, sort]);

  async function add(product: Product) {
    setErrorsByProduct((current) => {
      const next = { ...current };
      delete next[product._id];
      return next;
    });
    try {
      await addItem(product._id, 1);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to add this product right now.';
      setErrorsByProduct((current) => ({ ...current, [product._id]: message }));
    }
  }

  const activeCategoryName = useMemo(() => categories.find((c) => c._id === selectedCategory)?.name, [categories, selectedCategory]);

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-indigo-900/20 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white">Explore the catalog</h1>
            <p className="text-sm text-indigo-100/70">
              Discover seeded inventory and stress-test the personalization pipeline. {activeCategoryName ? `Viewing ${activeCategoryName}.` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {sortOptions.map((option) => (
              <button
                key={option.value || 'featured'}
                onClick={() => setSort(option.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  sort === option.value ? 'bg-indigo-500 text-white shadow shadow-indigo-500/30' : 'bg-white/10 text-indigo-100/80 hover:bg-white/20'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 flex gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-inner shadow-indigo-900/10">
            <span className="text-lg">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products, e.g. sneakers or bags"
              className="w-full bg-transparent text-sm text-white placeholder:text-indigo-100/50 focus:outline-none"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 px-3 py-2 md:justify-end">
            <button
              onClick={() => setSelectedCategory('')}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium ${
                selectedCategory === '' ? 'bg-indigo-500 text-white' : 'bg-white/10 text-indigo-100/80'
              }`}
            >
              All categories
            </button>
            {categories.map((category) => (
              <button
                key={category._id}
                onClick={() => setSelectedCategory(category._id)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium ${
                  selectedCategory === category._id ? 'bg-indigo-500 text-white' : 'bg-white/10 text-indigo-100/80'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="card animate-pulse overflow-hidden">
                <div className="h-48 w-full bg-white/10" />
                <div className="space-y-2 p-5">
                  <div className="h-4 w-2/3 rounded-full bg-white/10" />
                  <div className="h-4 w-1/4 rounded-full bg-white/10" />
                </div>
              </div>
            ))
          : items.map((product) => {
              const pendingAdd = Boolean(pending[`add:${product._id}`]);
              return (
                <div key={product._id} className="card group overflow-hidden">
                  <Link href={`/product/${product.slug}`} className="block">
                    <div className="relative h-48 overflow-hidden">
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
                    </div>
                    <div className="space-y-2 p-5">
                      <h3 className="text-lg font-semibold text-white line-clamp-1">{product.title}</h3>
                      <p className="text-sm text-indigo-100/70">${(product.price / 100).toFixed(2)}</p>
                    </div>
                  </Link>
                  <div className="border-t border-white/10 bg-white/5 p-4">
                    <button
                      className="btn-primary w-full justify-center disabled:opacity-60"
                      onClick={() => add(product)}
                      disabled={pendingAdd}
                    >
                      {pendingAdd ? 'Adding…' : 'Add to cart'}
                    </button>
                    {errorsByProduct[product._id] && (
                      <p className="mt-2 rounded-full bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
                        {errorsByProduct[product._id]}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
      </div>

      {!loading && items.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-indigo-100/70">
          No products matched your filters yet. Try adjusting your search or clear filters.
        </div>
      )}
    </div>
  );
}

