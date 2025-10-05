'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useWishlist } from '../../../context/WishlistContext';
import { useAuth } from '../../../context/AuthContext';
import { apiGet } from '../../../lib/api';
import { Button } from '../../../components/ui/Button';

type Product = {
  _id: string;
  title: string;
  slug: string;
  price: number;
  images?: string[];
  brand?: string;
  defaultVariantId?: string;
  variants?: Array<{
    variantId?: string;
    label?: string;
    price?: number;
    stock?: number;
    options?: Record<string, string>;
    images?: string[];
  }>;
};

export default function WishlistPage() {
  const { wishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { user } = useAuth();
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(false);

  const isAuthenticated = !!user;

  // Fetch product details for wishlist items
  useEffect(() => {
    if (!isAuthenticated || wishlist.length === 0) {
      setProducts({});
      return;
    }

    const fetchProducts = async () => {
      setLoading(true);
      try {
        // Process in batches to avoid overwhelming the API
        const BATCH_SIZE = 5;
        const productsMap: Record<string, Product> = {};

        for (let i = 0; i < wishlist.length; i += BATCH_SIZE) {
          const batch = wishlist.slice(i, i + BATCH_SIZE);
          const productPromises = batch.map(async (productId) => {
            try {
              console.log(`Fetching product: ${productId}`);
              // Try both endpoints - some IDs might be slugs, some might be MongoDB IDs
              let response;
              try {
                response = await apiGet<Product>(`/products/${productId}`);
                console.log(`Found product via /products/${productId}:`, response?._id);
                return { productId, product: response };
              } catch (error) {
                console.log(`Product ${productId} not found via direct ID, trying slug endpoint`);
                try {
                  response = await apiGet<{ product: Product }>(`/products/slug/${productId}`);
                  console.log(`Found product via /products/slug/${productId}:`, response.product?._id);
                  return { productId, product: response.product };
                } catch (slugError) {
                  console.error(`Failed to fetch product ${productId} via both endpoints:`, slugError);
                  return { productId, product: null };
                }
              }
            } catch (error) {
              console.error(`Failed to fetch product ${productId}:`, error);
              return { productId, product: null };
            }
          });

          const results = await Promise.all(productPromises);
          results.forEach(({ productId, product }) => {
            if (product) {
              productsMap[productId] = product;
            }
          });
        }

        setProducts(productsMap);
      } catch (error) {
        console.error('Failed to fetch wishlist products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [wishlist, isAuthenticated]);

  const handleRemoveFromWishlist = async (productId: string) => {
    try {
      await removeFromWishlist(productId);
    } catch (error) {
      console.error('Failed to remove from wishlist:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center space-y-4">
        <div className="text-6xl">🤍</div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Sign in to your wishlist</h1>
        <p className="text-[var(--text-muted)] max-w-md">
          Create an account or sign in to save items you'd like to purchase later.
        </p>
        <div className="flex gap-3 mt-6">
          <Link href="/login" className="btn btn-secondary">
            Sign in
          </Link>
          <Link href="/register" className="btn btn-primary">
            Create account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-semibold text-[var(--text-primary)]">My Wishlist</h1>
        <p className="text-[var(--text-muted)]">
          {wishlist.length === 0
            ? "No saved items yet. Start shopping to add favorites!"
            : `${wishlist.length} item${wishlist.length === 1 ? '' : 's'} saved for later`}
        </p>
      </div>

      {wishlist.length === 0 ? (
        <div className="min-h-[40vh] flex flex-col items-center justify-center text-center space-y-6">
          <div className="text-8xl opacity-50">🤍</div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Your wishlist is empty</h2>
            <p className="text-[var(--text-muted)]">Discover products and save them for later shopping.</p>
          </div>
          <Link href="/products" className="btn btn-primary">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {wishlist.map((productId) => {
            const product = products[productId];

            if (!product) {
              return (
                <div
                  key={productId}
                  className="card flex h-32 items-center justify-center"
                >
                  {loading ? (
                    <div className="text-[var(--text-muted)]">Loading...</div>
                  ) : (
                    <div className="text-center">
                      <div className="text-sm text-[var(--text-muted)] mb-2">Product unavailable</div>
                      <button
                        onClick={() => handleRemoveFromWishlist(productId)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            const variant = product.variants?.find(v => v.variantId === product.defaultVariantId) || product.variants?.[0];
            const price = variant?.price ?? product.price;

            return (
              <div key={productId} className="card group overflow-hidden">
                <Link href={`/product/${product.slug}`} className="block">
                  <div className="relative h-48 overflow-hidden">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-800 text-xs text-[var(--text-muted)]">
                        No image
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-transparent" />
                  </div>
                  <div className="space-y-3 p-5">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] line-clamp-2">
                        {product.title}
                      </h3>
                      {product.brand && (
                        <p className="text-sm text-[var(--text-muted)]">{product.brand}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold text-[var(--text-primary)]">
                        ${(price / 100).toFixed(2)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.preventDefault();
                          handleRemoveFromWishlist(productId);
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {wishlist.length > 0 && (
        <div className="text-center">
          <Link href="/products" className="btn btn-secondary">
            Continue Shopping
          </Link>
        </div>
      )}
    </div>
  );
}
