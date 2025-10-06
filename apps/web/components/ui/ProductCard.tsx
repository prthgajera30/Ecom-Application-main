import Link from 'next/link';
import { Button } from './Button';
import { WishlistButton } from './WishlistButton';

interface ProductVariant {
  variantId?: string;
  label?: string;
  price?: number;
  stock?: number;
  options?: Record<string, string>;
  images?: string[];
}

interface Product {
  _id: string;
  title: string;
  slug: string;
  price: number;
  images?: string[];
  brand?: string;
  variants?: ProductVariant[];
  defaultVariantId?: string;
}

interface ProductCardProps {
  product: Product;
  variant?: 'default' | 'featured' | 'category';
  badgeLabel?: string;
  badgeColor?: 'indigo' | 'amber' | 'emerald';
  showWishlist?: boolean;
  addItem: (productId: string, variant?: ProductVariant) => void;
  pendingItems: Record<string, boolean>;
  errors?: Record<string, string>;
}

export function ProductCard({
  product,
  variant = 'default',
  badgeLabel,
  badgeColor = 'indigo',
  showWishlist = true,
  addItem,
  pendingItems,
  errors
}: ProductCardProps) {
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

  const productVariant = getDefaultVariant(product);
  const price = productVariant?.price ?? product.price;
  const pendingKey = productVariant?.variantId ? `add:${product._id}::${productVariant.variantId}` : `add:${product._id}`;
  const isPending = Boolean(pendingItems[pendingKey]);

  const badgeColors = {
    indigo: 'bg-indigo-500/90',
    amber: 'bg-amber-500/90',
    emerald: 'bg-emerald-500/90'
  };

  const handleAddToCart = () => {
    addItem(product._id, productVariant);
  };

  const CardContent = (
    <div key={product._id} className={`card group overflow-hidden ${variant === 'category' ? 'flex h-full flex-col' : ''}`}>
      <Link href={`/product/${product.slug}`} className="block">
        <div className={`relative overflow-hidden ${
          variant === 'featured' ? 'h-52' :
          variant === 'category' ? 'h-32' :
          'h-44'
        }`}>
          {product.images?.[0] ? (
            <img
              src={product.images[0]}
              alt={product.title}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className={`flex h-full items-center justify-center text-xs text-indigo-100/60 ${
              variant === 'category' ? '' : 'bg-slate-800'
            }`}>
              No image
            </div>
          )}
          {badgeLabel && (
            <div className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold text-slate-900 ${badgeColors[badgeColor]}`}>
              {badgeLabel}
            </div>
          )}
          {variant === 'category' && showWishlist && (
            <div className="absolute right-3 top-3">
              <WishlistButton productId={product._id} variant="icon" size="sm" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-transparent" />
        </div>
        {variant === 'featured' ? (
          <div className="space-y-2 p-5">
            <div className="flex items-center justify-between text-sm text-indigo-200/80">
              <span>{badgeLabel || 'Featured'}</span>
              <span>${(price / 100).toFixed(2)}</span>
            </div>
            <h3 className="text-lg font-semibold text-white line-clamp-1">{product.title}</h3>
          </div>
        ) : (
            <div className={`flex flex-1 flex-col justify-between ${variant === 'default' ? 'space-y-3 p-5' : ''}`}>
            <div className="space-y-1">
              <h3 className={`font-semibold text-white line-clamp-2 ${variant === 'category' ? 'text-base' : 'text-base'}`}>{product.title}</h3>
              <p className={`text-sm ${badgeColor === 'amber' ? 'text-amber-200/80' : 'text-indigo-100/80'}`}>
                ${(price / 100).toFixed(2)}
              </p>
            </div>
            {variant !== 'category' && (
              <div className="space-y-2">
                <Button
                  type="button"
                  className="w-full justify-center"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddToCart();
                  }}
                  disabled={isPending}
                >
                  {isPending ? 'Adding…' : 'Add to cart'}
                </Button>
                {errors?.[product._id] && (
                  <p className="rounded-full bg-rose-500/15 px-3 py-2 text-xs text-rose-100 text-center">
                    {errors[product._id]}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Link>
      {variant === 'category' && (
        <div className="flex-1 space-y-2 p-4 text-sm text-indigo-100/80">
          {product.brand && (
            <div className="text-[11px] text-indigo-100/60">{product.brand}</div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span>${(price / 100).toFixed(2)}</span>
            <button
              type="button"
              onClick={handleAddToCart}
              className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
              disabled={isPending}
            >
              {isPending ? 'Adding…' : 'Quick add'}
            </button>
          </div>
          {errors?.[product._id] && (
            <p className="rounded-full bg-rose-500/15 px-2 py-1 text-[11px] text-rose-100">{errors[product._id]}</p>
          )}
        </div>
      )}
    </div>
  );

  if (variant === 'category') {
    return (
      <div className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/5 p-4">
        {CardContent}
      </div>
    );
  }

  return CardContent;
}
