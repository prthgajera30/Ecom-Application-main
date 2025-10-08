"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { API_BASE } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

type Product = {
  id: string;
  title: string;
  slug: string;
  brand: string;
  price: number;
  stock: number;
  variants: Array<{
    id: string;
    variantId: string;
    stock: number;
    price: number;
  }>;
  category: {
    name: string;
    slug: string;
  };
  createdAt: string;
  updatedAt: string;
};

type PaginatedProducts = {
  products: Product[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export default function AdminProductsPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<PaginatedProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      router.push('/');
      return;
    }

    fetchProducts();
  }, [user, currentPage]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`${API_BASE}/admin/products?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchProducts();
  };

  const formatPrice = (price: number) => `$${(price / 100).toFixed(2)}`;

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-primary">Products</h1>
            <p className="text-muted mt-1">Manage your product catalog</p>
          </div>
          <Link href="/admin/products/new" className="btn-primary">
            Add Product
          </Link>
        </div>

        {error && (
          <Card className="p-4 border-[var(--danger)]/20 bg-[var(--danger-10)]">
            <p className="text-[var(--danger-100)] text-sm">{error}</p>
          </Card>
        )}

        {/* Search & Filters */}
        <Card className="p-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-ghost-10 border border-ghost-20 rounded-lg text-primary placeholder:text-muted focus:border-[var(--brand)] focus:outline-none"
              />
            </div>
            <Button type="submit" disabled={loading}>
              Search
            </Button>
          </form>
        </Card>

        {/* Products Table */}
        <Card>
          <div className="p-6">
                {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border-b border-ghost-10 last:border-b-0">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-ghost-10 rounded-lg animate-pulse"></div>
                      <div className="space-y-2">
                        <div className="w-48 h-4 bg-ghost-10 rounded animate-pulse"></div>
                        <div className="w-32 h-3 bg-ghost-10 rounded animate-pulse"></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <div key={j} className="w-16 h-4 bg-ghost-10 rounded animate-pulse"></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : products?.products.length ? (
              <div className="space-y-0">
                {/* Table Header */}
                <div className="flex items-center justify-between p-4 border-b border-ghost-10 font-medium text-primary">
                  <div className="flex-1">Product</div>
                  <div className="w-20 text-center">Stock</div>
                  <div className="w-24 text-center">Price</div>
                  <div className="w-32 text-center">Category</div>
                  <div className="w-32 text-center">Actions</div>
                </div>

                {/* Table Rows */}
                {products.products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-4 border-b border-ghost-10 last:border-b-0 hover:bg-ghost-5"
                  >
                    <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 bg-[color:var(--brand)]/20 rounded-lg flex items-center justify-center">
                <span className="text-[color:var(--brand)] text-sm font-bold">
                            {product.title.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium text-primary">{product.title}</h3>
                          <p className="text-sm text-muted">
                            {product.brand}    {product.stock} in stock
                          </p>
                        </div>
                      </div>

                      <div className="w-20 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        product.stock === 0
                          ? 'bg-[var(--danger-10)] text-[var(--danger-100)]'
                          : product.stock < 10
                          ? 'bg-[color:var(--accent)]/20 text-[color:var(--accent)]'
                          : 'bg-[color:var(--brand)]/20 text-[color:var(--brand)]'
                      }`}>
                        {product.stock}
                      </span>
                    </div>

                    <div className="w-24 text-center font-medium text-primary">
                      {formatPrice(product.price)}
                    </div>

                    <div className="w-32 text-center">
                      <span className="px-2 py-1 text-xs bg-[var(--brand)]/20 text-[var(--brand)] rounded">
                        {product.category.name}
                      </span>
                    </div>

                    <div className="w-32 text-center flex gap-2">
                      <Button size="sm" variant="secondary">
                        Edit
                      </Button>
                          <Button size="sm" variant="ghost" className="text-[var(--danger-100)] hover:text-[var(--danger-100)]/80">
                            Delete
                          </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
                <div className="text-center py-12">
                <div className="w-16 h-16 bg-ghost-10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📦</span>
                </div>
                <h3 className="text-lg font-medium text-primary mb-2">No products found</h3>
                <p className="text-muted mb-6">
                  {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding your first product'}
                </p>
                <Link href="/admin/products/new" className="btn-primary">
                  Add First Product
                </Link>
              </div>
            )}
          </div>

          {/* Pagination */}
          {products && products.pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-ghost-10">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">
                  Showing {(products.pagination.page - 1) * products.pagination.limit + 1} to{' '}
                  {Math.min(products.pagination.page * products.pagination.limit, products.pagination.total)}{' '}
                  of {products.pagination.total} products
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </Button>

                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, products.pagination.totalPages) }, (_, i) => {
                      const pageNumber = i + Math.max(1, Math.min(
                        currentPage - 2,
                        products.pagination.totalPages - 4
                      ));
                      if (pageNumber > products.pagination.totalPages) return null;

                      return (
                        <Button
                          key={pageNumber}
                          size="sm"
                          variant={currentPage === pageNumber ? "secondary" : "ghost"}
                          onClick={() => setCurrentPage(pageNumber)}
                        >
                          {pageNumber}
                        </Button>
                      );
                    })}
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={currentPage === products.pagination.totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[color:var(--brand-dark)] via-[color:var(--brand)] to-[color:var(--brand-dark)]">
    <div className="border-b border-ghost-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/admin" className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[color:var(--brand)] via-[color:var(--brand-dark)] to-[color:var(--brand-dark)] text-lg font-semibold text-primary shadow-lg shadow-[color:var(--brand-dark)]/40">
                  AC
                </span>
                <div className="leading-tight">
                  <span className="block text-sm font-semibold text-primary">Admin Console</span>
                </div>
              </Link>

              <nav className="flex items-center gap-6">
                <Link href="/admin" className="text-muted hover:text-primary transition">
                  Dashboard
                </Link>
                <Link href="/admin/products" className="text-muted hover:text-primary transition">
                  Products
                </Link>
                <Link href="/admin/orders" className="text-muted hover:text-primary transition">
                  Orders
                </Link>
              </nav>
            </div>

            <button
              onClick={logout}
              className="text-[var(--text-primary)] hover:text-primary transition text-sm"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {children}
      </div>
    </div>
  );
}
