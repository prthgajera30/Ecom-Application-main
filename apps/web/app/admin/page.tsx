"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../lib/api';
import { Card } from '../../components/ui/Card';

type DashboardStats = {
  revenue: {
    total: string;
    thisMonth: string;
    thisWeek: string;
    today: string;
  };
  orders: {
    total: number;
    thisMonth: number;
    thisWeek: number;
    today: number;
    paid: number;
    pending: number;
  };
  customers: {
    total: number;
    thisMonth: number;
  };
  products: {
    total: number;
    published: number;
  };
  inventory: {
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalValue: number;
  };
  alerts: {
    lowStock: Array<{
      title: string;
      lowStockVariants: Array<{
        variantId: string;
        stock: number;
      }>;
    }>;
  };
  recentOrders: Array<{
    id: string;
    status: string;
    total: string;
    createdAt: string;
    itemCount: number;
  }>;
};

export default function AdminDashboard() {
  const { user, token, logout, initializing } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Check auth state only after we've attempted to verify
    if (user === null && token) {
      // Still loading user data - wait for AuthContext to complete refresh
      return;
    }

    // Auth verification is complete
    // If no token exists, redirect to login immediately
    if (!token) {
      console.log('No token - redirecting to login');
      window.location.href = '/login';
      return;
    }

    // If token exists but no user, authentication failed
    if (!user) {
      console.log('Token exists but no user - authentication failed, redirecting to login');
      // Use logout to clear token and session
      logout();
      window.location.href = '/login';
      return;
    }

    // Check admin role
    if (user.role !== 'admin') {
      console.log('User not admin - redirecting to home');
      window.location.href = '/';
      return;
    }

    console.log('User is admin - loading dashboard');
    fetchDashboardStats();
  }, [user, token, router]);

  const fetchDashboardStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/admin/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Show loading while user data is being fetched
  if (initializing || (!user && token)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        <div className="container py-8 flex items-center justify-center">
          <Card className="p-8 text-center">
            <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-indigo-400">⚡</span>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Loading Admin Panel</h2>
            <p className="text-indigo-100/70">Verifying admin access...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        <div className="container py-8 flex items-center justify-center">
          <Card className="p-8 text-center">
            <h2 className="text-2xl font-semibold text-white mb-4">Access Denied</h2>
            <p className="text-indigo-100/70 mb-6">
              You don't have permission to access the admin panel.
            </p>
            <Link href="/" className="btn-primary">
              Back to Store
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-8">
          {/* Skeleton Loading */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="p-6">
                <div className="h-16 bg-white/10 rounded-lg animate-pulse"></div>
              </Card>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-white mb-4">Error Loading Dashboard</h2>
          <p className="text-red-200 mb-6">{error}</p>
          <button
            onClick={fetchDashboardStats}
            className="btn-primary"
          >
            Try Again
          </button>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
            <p className="text-indigo-100/70 mt-1">
              Overview of your store performance
            </p>
          </div>
          <div className="text-sm text-indigo-100/70">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>

        {error && (
          <Card className="p-4 border-red-500/20 bg-red-500/10">
            <p className="text-red-200 text-sm">{error}</p>
          </Card>
        )}

        {/* Revenue Metrics */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-100/70">Total Revenue</p>
                <p className="text-2xl font-bold text-white">${stats?.revenue.total}</p>
              </div>
              <div className="p-2 bg-green-500/20 rounded-lg">
                <span className="text-green-400 text-sm">$</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-100/70">This Month</p>
                <p className="text-2xl font-bold text-white">${stats?.revenue.thisMonth}</p>
              </div>
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <span className="text-blue-400 text-sm">¥</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-100/70">This Week</p>
                <p className="text-2xl font-bold text-white">${stats?.revenue.thisWeek}</p>
              </div>
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <span className="text-purple-400 text-sm">€</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-100/70">Today</p>
                <p className="text-2xl font-bold text-white">${stats?.revenue.today}</p>
              </div>
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <span className="text-orange-400 text-sm">£</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Orders & Customers & Inventory */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-6">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-100/70">Total Orders</p>
                <p className="text-2xl font-bold text-white">{stats?.orders.total}</p>
                <p className="text-xs text-indigo-100/60 mt-1">
                  {stats?.orders.thisMonth} this month
                </p>
              </div>
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <span className="text-indigo-400 text-sm">📦</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-100/70">Paid Orders</p>
                <p className="text-2xl font-bold text-white">{stats?.orders.paid}</p>
                <p className="text-xs text-green-400 mt-1">
                  Pending: {stats?.orders.pending}
                </p>
              </div>
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <span className="text-emerald-400 text-sm">✓</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-100/70">Customers</p>
                <p className="text-2xl font-bold text-white">{stats?.customers.total}</p>
                <p className="text-xs text-indigo-100/60 mt-1">
                  +{stats?.customers.thisMonth} this month
                </p>
              </div>
              <div className="p-2 bg-pink-500/20 rounded-lg">
                <span className="text-pink-400 text-sm">👥</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <Link href="/admin/inventory" className="block h-full hover:opacity-90 transition-opacity">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-100/70">Inventory Items</p>
                  <p className="text-2xl font-bold text-white">{stats?.inventory.totalProducts || 0}</p>
                  <p className="text-xs text-indigo-100/60 mt-1">
                    {stats?.inventory.lowStockCount || 0} low stock
                  </p>
                </div>
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <span className="text-amber-400 text-sm">📊</span>
                </div>
              </div>
            </Link>
          </Card>

          <Card className="p-6">
            <Link href="/admin/inventory" className="block h-full hover:opacity-90 transition-opacity">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-100/70">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-400">{stats?.inventory.outOfStockCount || 0}</p>
                  <p className="text-xs text-indigo-100/60 mt-1">
                    Need restocking
                  </p>
                </div>
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <span className="text-red-400 text-sm">🚨</span>
                </div>
              </div>
            </Link>
          </Card>

          <Card className="p-6">
            <Link href="/admin/inventory" className="block h-full hover:opacity-90 transition-opacity">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-indigo-100/70">Stock Value</p>
                  <p className="text-2xl font-bold text-white">${((stats?.inventory.totalValue || 0) / 100).toFixed(0)}</p>
                  <p className="text-xs text-indigo-100/60 mt-1">
                    Total inventory value
                  </p>
                </div>
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <span className="text-green-400 text-sm">$</span>
                </div>
              </div>
            </Link>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Orders */}
          <Card className="lg:col-span-2 p-6">
            <h3 className="text-xl font-semibold text-white mb-6">Recent Orders</h3>
            {stats?.recentOrders.length ? (
              <div className="space-y-4">
                {stats.recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                        <span className="text-sm text-indigo-400">📦</span>
                      </div>
                      <div>
                        <p className="font-medium text-white">Order #{order.id.slice(-8)}</p>
                        <p className="text-sm text-indigo-100/60">
                          {formatDate(order.createdAt)} • {order.itemCount} items
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-white">${order.total}</p>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        order.status === 'paid'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-indigo-100/60 text-center py-8">No orders yet</p>
            )}
          </Card>

          {/* Alerts */}
          <Card className="p-6">
            <h3 className="text-xl font-semibold text-white mb-6">Alerts</h3>
            {stats?.alerts.lowStock.length ? (
              <div className="space-y-4">
                {stats.alerts.lowStock.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border border-orange-500/20 bg-orange-500/10"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-orange-400 text-sm mt-0.5">⚠️</span>
                      <div>
                        <p className="font-medium text-white">{item.title}</p>
                        <p className="text-sm text-orange-200 mt-1">
                          {item.lowStockVariants.length} variant{item.lowStockVariants.length !== 1 ? 's' : ''} low on stock
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-green-500/20 bg-green-500/10">
                <div className="flex items-center gap-3">
                  <span className="text-green-400 text-sm">✓</span>
                  <p className="font-medium text-green-200">All products well stocked</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

function AdminLayout({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    window.location.href = '/login'; // Force redirect after logout
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="border-b border-white/10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/admin" className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 text-lg font-semibold text-white shadow-lg shadow-indigo-600/40">
                  AC
                </span>
                <div className="leading-tight">
                  <span className="block text-sm font-semibold text-white">Admin Console</span>
                </div>
              </Link>

            <nav className="flex items-center gap-6">
                <span className="text-indigo-200 transition">
                  Dashboard
                </span>
                <Link href="/admin/products" className="text-indigo-200 hover:text-white transition">
                  Products
                </Link>
                <Link href="/admin/inventory" className="text-indigo-200 hover:text-white transition">
                  Inventory
                </Link>
                <Link href="/admin/orders" className="text-indigo-200 hover:text-white transition">
                  Orders
                </Link>
              </nav>
            </div>

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
