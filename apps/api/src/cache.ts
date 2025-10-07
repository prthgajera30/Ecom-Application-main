import { createClient, RedisClientType } from 'redis';

export class Cache {
  private client: RedisClientType;
  private connected = false;

  constructor(url?: string) {
    this.client = createClient({
      url: url || process.env.REDIS_URL || 'redis://localhost:6379',
    });

    this.client.on('error', (err) => {
      console.warn('Redis connection error:', err.message);
    });

    this.client.on('connect', () => {
      this.connected = true;
      console.log('Connected to Redis');
    });

    this.client.on('disconnect', () => {
      this.connected = false;
      console.log('Disconnected from Redis');
    });
  }

  async connect() {
    if (!this.connected) {
      await this.client.connect();
    }
  }

  async disconnect() {
    if (this.connected) {
      await this.client.disconnect();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) return null;

    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn(`Redis get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.connected) return;

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (error) {
      console.warn(`Redis set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      console.warn(`Redis del error for key ${key}:`, error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.connected) return;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.warn(`Redis delPattern error for pattern ${pattern}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.warn(`Redis exists error for key ${key}:`, error);
      return false;
    }
  }

  // Product-specific caching methods
  getProductKey(slug: string): string {
    return `product:${slug}`;
  }

  getProductsKey(page: number, limit: number, search?: string, filterKey?: string): string {
    const searchParam = search ? `:${search}` : '';
    // Use hash of filterKey to avoid cache collisions with different filter combinations of same length
    const filterParam = filterKey ? `:filters-${require('crypto').createHash('md5').update(filterKey).digest('hex').slice(0, 8)}` : '';
    return `products:${page}:${limit}${searchParam}${filterParam}`;
  }

  getAllProductsKey(): string {
    return 'products:all';
  }

  getProductCategoryKey(category: string): string {
    return `products:category:${category}`;
  }

  // Cache methods with automatic key generation
  async getProducts(page: number, limit: number, search?: string, filterKey?: string) {
    return this.get(this.getProductsKey(page, limit, search, filterKey));
  }

  async setProducts(page: number, limit: number, search: string | undefined, filterKey: string | undefined, products: any, ttlSeconds = 1800) {
    await this.set(this.getProductsKey(page, limit, search, filterKey), products, ttlSeconds);
  }

  async getAllProducts() {
    return this.get(this.getAllProductsKey());
  }

  async setAllProducts(products: any, ttlSeconds = 1800) {
    await this.set(this.getAllProductsKey(), products, ttlSeconds);
  }

  // Invalidation methods
  async invalidateProduct(slugOrId: string) {
    await Promise.all([
      this.del(this.getProductKey(slugOrId)),
      this.delPattern('products:*'), // Invalidate all product lists since they might include this product
    ]);
  }

  async invalidateAllProducts() {
    await this.delPattern('product:*');
    await this.delPattern('products:*');
  }

  async invalidateCategory(category: string) {
    await this.del(this.getProductCategoryKey(category));
    await this.delPattern('products:*'); // Category change affects product listings
  }

  // Health check
  async ping(): Promise<boolean> {
    if (!this.connected) return false;

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

// Global cache instance
export const cache = new Cache();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await cache.disconnect();
});

process.on('SIGINT', async () => {
  await cache.disconnect();
});

export default cache;
