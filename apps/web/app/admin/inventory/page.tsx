"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { API_BASE } from '../../../lib/api';
import { Card } from '../../../components/ui/Card';

type InventoryOverview = {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
  lowStockProducts: Array<{
    productId: string;
    availableStock: number;
    threshold: number;
  }>;
};

type InventoryProduct = {
  _id: string;
  title: string;
  slug: string;
  price: number;
  stock: number;
  reservedStock: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  isActive: boolean;
  image?: string;
  category?: string;
  variants?: Array<{
    variantId: string;
    availableStock: number;
    reservedStock?: number;
    totalStock: number;
    isLowStock: boolean;
  }>;
  inventory: {
    availableStock: number;
    reservedStock: number;
    totalStock: number;
    lowStockThreshold: number;
    isLowStock: boolean;
    status: 'inStock' | 'lowStock' | 'outOfStock';
  };
};

export default function AdminInventoryPage() {
  const { user, token, logout, initializing } = useAuth();
  const router = useRouter();
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterBy, setFilterBy] = useState<'all' | 'lowStock' | 'outOfStock' | 'inStock'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    // Check auth state only after we've attempted to verify
    if (user === null && token) {
      return;
    }

    if (!token) {
      window.location.href = '/login';
      return;
    }

    if (!user || user.role !== 'admin') {
      window.location.href = '/';
      return;
    }

    fetchOverview();
    fetchProducts();
  }, [user, token]);

  useEffect(() => {
    fetchProducts();
  }, [currentPage, filterBy, search]);

  const fetchOverview = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/inventory/overview`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch inventory overview');

      const data = await response.json();
      setOverview(data);
    } catch (err) {
      console.error('Failed to fetch inventory overview:', err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        filterBy,
        search: search.trim(),
      });

      const response = await fetch(`${API_BASE}/admin/inventory/products?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch products');

      const data = await response.json();
      setProducts(data.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleStockAdjustment = async (productId: string, change: number, reason: string) => {
    try {
      const response = await fetch(`${API_BASE}/admin/inventory/products/${productId}/adjust`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          change,
          reason,
          note: `Admin adjustment: ${change > 0 ? 'Increased' : 'Decreased'} stock`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Stock adjustment failed');
      }

      // Refresh data
      await fetchOverview();
      await fetchProducts();
    } catch (err) {
      console.error('Stock adjustment error:', err);
      alert('Failed to adjust stock: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'inStock': return 'text-green-400';
      case 'lowStock': return 'text-yellow-400';
      case 'outOfStock': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'inStock': return 'bg-green-500/20 border-green-500/20';
      case 'lowStock': return 'bg-yellow-500/20 border-yellow-500/20';
      case 'outOfStock': return 'bg-red-500/20 border-red-500/20';
      default: return 'bg-gray-500/20 border-gray-500/20';
    }
  };

  // Show loading while user data is being fetched
  if (initializing || (!user && token)) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Card className="p-8 text-center">
            <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-indigo-400">⚡</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Loading Inventory</h2>
            <p className="text-indigo-100/70">Verifying admin access...</p>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <AdminLayout>
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-semibold text-white mb-4">Access Denied</h2>
          <p className="text-indigo-100/70 mb-6">
            You don't have permission to access the admin panel.
          </p>
          <Link href="/" className="btn-primary">Back to Store</Link>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">Inventory Management</h1>
            <p className="text-indigo-100/70 mt-1">
              Monitor and manage your product inventory
            </p>
          </div>
        </div>

        {/* Overview Stats */}
        {overview && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-100/70">Total Products</p>
                  <p className="text-2xl font-bold text-white">{overview.totalProducts}</p>
                </div>
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <span className="text-blue-400 text-sm">📦</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-100/70">Low Stock Items</p>
                  <p className="text-2xl font-bold text-yellow-400">{overview.lowStockCount}</p>
                </div>
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <span className="text-yellow-400 text-sm">⚠️</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-100/70">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-400">{overview.outOfStockCount}</p>
                </div>
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <span className="text-red-400 text-sm">❌</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-100/70">Inventory Value</p>
                  <p className="text-2xl font-bold text-white">${overview.totalValue.toFixed(2)}</p>
                </div>
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <span className="text-green-400 text-sm">$</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Low Stock Alerts */}
        {overview?.lowStockProducts && overview.lowStockProducts.length > 0 && (
          <Card className="p-6">
            <h3 className="text-xl font-semibold text-white mb-4">⚠️ Low Stock Alerts</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {overview.lowStockProducts.slice(0, 6).map((product) => (
                <div
                  key={product.productId}
                  className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10"
                >
                  <p className="font-medium text-white truncate">
                    Product #{product.productId.slice(-8)}
                  </p>
                  <p className="text-sm text-yellow-200">
                    Available: {product.availableStock} (Threshold: {product.threshold})
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Filters and Search */}
        <Card className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-indigo-100/50 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as any)}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:border-indigo-400 focus:outline-none"
              >
                <option value="all">All Products</option>
                <option value="inStock">In Stock</option>
                <option value="lowStock">Low Stock</option>
                <option value="outOfStock">Out of Stock</option>
              </select>
            </div>
            <button
              onClick={fetchProducts}
              className="btn-primary whitespace-nowrap"
            >
              Search
            </button>
          </div>
        </Card>

        {/* Products Table */}
        <Card className="p-6">
          <h3 className="text-xl font-semibold text-white mb-6">Product Inventory</h3>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/10 rounded-lg animate-pulse"></div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="text-indigo-100/60 text-center py-8">No products found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-2 text-indigo-100/70 font-medium">Product</th>
                    <th className="text-center py-3 px-2 text-indigo-100/70 font-medium">Total</th>
                    <th className="text-center py-3 px-2 text-indigo-100/70 font-medium">Available</th>
                    <th className="text-center py-3 px-2 text-indigo-100/70 font-medium">Reserved</th>
                    <th className="text-center py-3 px-2 text-indigo-100/70 font-medium">Status</th>
                    <th className="text-center py-3 px-2 text-indigo-100/70 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {products.map((product) => (
                    <tr key={product._id} className="hover:bg-white/5">
                      <td className="py-4 px-2">
                        <div>
                          <p className="font-medium text-white truncate max-w-xs">
                            {product.title}
                          </p>
                          <p className="text-sm text-indigo-100/60">
                            ID: {product._id.slice(-8)}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-center text-white">
                        {product.inventory.totalStock}
                      </td>
                      <td className="py-4 px-2 text-center text-white">
                        {product.inventory.availableStock}
                      </td>
                      <td className="py-4 px-2 text-center text-indigo-100/60">
                        {product.inventory.reservedStock}
                      </td>
                      <td className="py-4 px-2 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBg(product.inventory.status)} ${getStatusColor(product.inventory.status)}`}>
                          {product.inventory.status === 'inStock' ? 'In Stock' :
                           product.inventory.status === 'lowStock' ? 'Low Stock' : 'Out of Stock'}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleStockAdjustment(product._id, 1, 'manual_adjustment')}
                            className="px-2 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 text-sm"
                            title="Add 1 to stock"
                          >
                            +1
                          </button>
                          <button
                            onClick={() => handleStockAdjustment(product._id, -1, 'manual_adjustment')}
                            className="px-2 py-1 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 text-sm"
                            title="Remove 1 from stock"
                          >
                            -1
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {error && (
          <Card className="p-4 border-red-500/20 bg-red-500/10">
            <p className="text-red-200 text-sm">{error}</p>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="border-b border-white/10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-lg font-semibold text-white shadow-lg shadow-indigo-600/40">
                AC
              </span>
              <div className="leading-tight">
                <span className="block text-sm font-semibold text-white">Admin Console</span>
              </div>
            </Link>

            <nav className="flex items-center gap-6">
              <Link href="/admin" className="text-indigo-200 hover:text-white transition">
                Dashboard
              </Link>
              <Link href="/admin/products" className="text-indigo-200 hover:text-white transition">
                Products
              </Link>
              <span className="text-white transition">
                Inventory
              </span>
              <Link href="/admin/orders" className="text-indigo-200 hover:text-white transition">
                Orders
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              <span className="text-indigo-200 text-sm">
                Welcome, {user?.email?.split('@')[0]} (Admin)
              </span>
              <Link
                href="/"
                className="text-indigo-200 hover:text-white transition text-sm"
              >
                ← Back to Store
              </Link>
              <button
                onClick={handleLogout}
                className="text-indigo-200 hover:text-white transition text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {children}
      </div>
    </div>
  );
}
