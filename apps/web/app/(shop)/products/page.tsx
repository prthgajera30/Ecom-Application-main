"use client";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '../../../lib/api';
import { useCartState } from '../../../context/CartContext';
import { ApiError } from '../../../lib/api';
import { cn } from '../../../lib/cn';

type ProductVariant = {
  variantId?: string;
  label?: string;
  price?: number;
  stock?: number;
  options?: Record<string, string>;
  images?: string[];
};

type ProductRating = {
  average?: number;
  count?: number;
};

type Product = {
  _id: string;
  title: string;
  slug: string;
  price: number;
  images?: string[];
  categoryId?: string;
  brand?: string;
  defaultVariantId?: string;
  variants?: ProductVariant[];
  rating?: ProductRating;
};

type Category = { _id: string; name: string };

type FacetCategory = { id: string; name: string; count: number };
type FacetAttributeValue = { value: string; count: number };
type FacetAttribute = { key: string; values: FacetAttributeValue[] };

type ProductsResponse = {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  facets: {
    categories: FacetCategory[];
    attributes: FacetAttribute[];
    price: { min?: number; max?: number };
  };
  appliedFilters: {
    categories: string[];
    attributes: Record<string, string[]>;
    price: { min?: number; max?: number };
    search: string | null;
    sort: string;
  };
};

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
];

const ALLOWED_ATTRIBUTES = ['brand', 'color', 'material', 'type'];

const FILTER_SCROLL_THRESHOLD = 6;
const FILTER_SEARCH_THRESHOLD = 8;

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<ProductsResponse['facets']>({ categories: [], attributes: [], price: {} });
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const limit = 24;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<string>('newest');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [attributeFilters, setAttributeFilters] = useState<Record<string, string[]>>({});
  const [priceRange, setPriceRange] = useState<{ min?: number; max?: number }>({});
  const [priceDraft, setPriceDraft] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [categorySearch, setCategorySearch] = useState('');
  const [attributeSearchTerms, setAttributeSearchTerms] = useState<Record<string, string>>({});
  const categorySearchInputRef = useRef<HTMLInputElement | null>(null);
  const attributeSearchRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const categorySearchFocusInitialized = useRef(false);
  const pendingAttributeFocusKey = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorsByProduct, setErrorsByProduct] = useState<Record<string, string>>({});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { addItem, pending } = useCartState();
  const initializedFilters = useRef(false);
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

  const isAddPending = (product: Product, variant?: ProductVariant) => {
    const key = variant?.variantId ? `add:${product._id}::${variant.variantId}` : `add:${product._id}`;
    return Boolean(pending[key]);
  };

  const lastSearchParam = useRef<string | null>(null);

  useEffect(() => {
    apiGet<Category[]>('/categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileFiltersOpen(false);
      }
    };

    if (mobileFiltersOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', onKeyDown);
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileFiltersOpen]);

  useEffect(() => {
    const paramValue = searchParams.get('search');
    if (lastSearchParam.current === paramValue) return;
    lastSearchParam.current = paramValue;
    setSearch(paramValue ?? '');
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);



  // Don't automatically sync priceDraft when priceRange changes after filters are initialized
  // This was causing input focus loss when typing. Price draft is only set on initialization.

  useLayoutEffect(() => {
    const input = categorySearchInputRef.current;
    if (!input) return;
    if (!categorySearchFocusInitialized.current) {
      categorySearchFocusInitialized.current = true;
      return;
    }
    if (document.activeElement !== input) {
      input.focus({ preventScroll: true });
    }
    const position = input.value.length;
    try {
      input.setSelectionRange(position, position);
    } catch (err) {
      // ignore when selection range is unsupported
    }
  }, [categorySearch]);

  useEffect(() => {
    setAttributeSearchTerms((current) => {
      const allowedFacets = facets.attributes.filter(facet =>
        ALLOWED_ATTRIBUTES.includes(facet.key.toLowerCase())
      );
      const validKeys = new Set(allowedFacets.map((facet) => facet.key));
      let changed = false;
      const next: Record<string, string> = {};
      Object.entries(current).forEach(([key, value]) => {
        if (validKeys.has(key)) {
          next[key] = value;
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [facets.attributes]);

  const categoryKey = useMemo(() => selectedCategories.slice().sort().join(','), [selectedCategories]);
  const attributeKey = useMemo(() => {
    const sorted = Object.keys(attributeFilters)
      .sort()
      .reduce<Record<string, string[]>>((acc, key) => {
        acc[key] = [...attributeFilters[key]].sort();
        return acc;
      }, {});
    return JSON.stringify(sorted);
  }, [attributeFilters]);
  const priceKey = useMemo(() => `${priceRange.min ?? ''}:${priceRange.max ?? ''}`, [priceRange.min, priceRange.max]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, total, limit]);

  useEffect(() => {
    let cancelled = false;
    async function fetchProducts() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (selectedCategories.length) params.set('categories', selectedCategories.join(','));
        if (sort) params.set('sort', sort);
        if (page > 1) params.set('page', String(page));
        params.set('limit', String(limit));
        if (priceRange.min !== undefined) params.set('minPrice', String(priceRange.min));
        if (priceRange.max !== undefined) params.set('maxPrice', String(priceRange.max));
        Object.entries(attributeFilters).forEach(([key, values]) => {
          if (values.length) params.set(`attr[${key}]`, values.join(','));
        });

        const query = params.toString();
        const data = await apiGet<ProductsResponse>(`/products${query ? `?${query}` : ''}`);
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setFacets(data.facets);
        setLoading(false);

        if (!initializedFilters.current) {
          setSort(data.appliedFilters.sort || 'newest');
          setSelectedCategories([...(data.appliedFilters.categories || [])]);
          setAttributeFilters(() => {
            const next: Record<string, string[]> = {};
            Object.entries(data.appliedFilters.attributes || {}).forEach(([key, values]) => {
              next[key] = [...values];
            });
            return next;
          });
          const price = data.appliedFilters.price || {};
          setPriceRange({
            min: typeof price.min === 'number' ? price.min : undefined,
            max: typeof price.max === 'number' ? price.max : undefined,
          });
          setPriceDraft({
            min: typeof price.min === 'number' ? (price.min / 100).toFixed(2) : '',
            max: typeof price.max === 'number' ? (price.max / 100).toFixed(2) : '',
          });
          initializedFilters.current = true;
        }
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setFacets({ categories: [], attributes: [], price: {} });
        setLoading(false);
      }
    }
    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, categoryKey, attributeKey, priceKey, sort, page]);

  function toggleCategory(id: string) {
    setSelectedCategories((current) => {
      const exists = current.includes(id);
      const next = exists ? current.filter((cat) => cat !== id) : [...current, id];
      return next;
    });
    setPage(1);
  }

  function toggleAttribute(key: string, value: string) {
    setAttributeFilters((current) => {
      const existing = new Set(current[key] || []);
      if (existing.has(value)) existing.delete(value);
      else existing.add(value);
      const next = { ...current };
      if (existing.size) next[key] = Array.from(existing);
      else delete next[key];
      return next;
    });
    setPage(1);
  }

  function applyPriceFilters() {
    const minRaw = priceDraft.min.trim() ? Number(priceDraft.min) : undefined;
    const maxRaw = priceDraft.max.trim() ? Number(priceDraft.max) : undefined;
    const next: { min?: number; max?: number } = {};
    if (minRaw !== undefined && Number.isFinite(minRaw)) next.min = Math.max(0, Math.round(minRaw * 100));
    if (maxRaw !== undefined && Number.isFinite(maxRaw)) next.max = Math.max(0, Math.round(maxRaw * 100));
    if (next.max !== undefined && next.min !== undefined && next.max < next.min) {
      const temp = next.min;
      next.min = next.max;
      next.max = temp;
    }
    setPriceRange(next);
    setPage(1);
  }

  function clearPriceFilter() {
    setPriceRange({});
    setPriceDraft({ min: '', max: '' });
    setPage(1);
  }

  function clearFilters() {
    setSelectedCategories([]);
    setAttributeFilters({});
    clearPriceFilter();
  }

  async function add(product: Product) {
    setErrorsByProduct((current) => {
      const next = { ...current };
      delete next[product._id];
      return next;
    });
    try {
      const variant = getDefaultVariant(product);
      await addItem(product._id, 1,
        variant ? {
          variantId: variant.variantId,
          variantLabel: variant.label,
          variantOptions: variant.options,
          unitPrice: variant.price,
        } : undefined
      );
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to add this product right now.';
      setErrorsByProduct((current) => ({ ...current, [product._id]: message }));
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const mergedCategories = useMemo(() => {
    if (!categories.length) return facets.categories;
    const counts = new Map(facets.categories.map((entry) => [entry.id, entry.count]));
    return categories.map((cat) => ({ id: cat._id, name: cat.name, count: counts.get(cat._id) ?? 0 }));
  }, [categories, facets.categories]);

  const activeFilterBadges = useMemo(() => {
    const badges: { label: string; onRemove: () => void }[] = [];
    if (selectedCategories.length) {
      selectedCategories.forEach((catId) => {
        const catName = mergedCategories.find((cat) => cat.id === catId)?.name || catId;
        badges.push({
          label: catName,
          onRemove: () => toggleCategory(catId),
        });
      });
    }
    Object.entries(attributeFilters).forEach(([key, values]) => {
      values.forEach((value) => {
        badges.push({
          label: `${key}: ${value}`,
          onRemove: () => toggleAttribute(key, value),
        });
      });
    });
    if (priceRange.min !== undefined || priceRange.max !== undefined) {
      const labelParts = [priceRange.min !== undefined ? `$${(priceRange.min / 100).toFixed(2)}` : 'Min', priceRange.max !== undefined ? `$${(priceRange.max / 100).toFixed(2)}` : 'Max'];
      badges.push({ label: `Price ${labelParts.join(' - ')}`, onRemove: clearPriceFilter });
    }
    return badges;
  }, [selectedCategories, attributeFilters, priceRange, mergedCategories]);

  const activeFilterCount = activeFilterBadges.length;
  const openMobileFilters = () => setMobileFiltersOpen(true);
  const closeMobileFilters = () => setMobileFiltersOpen(false);

  function handleAttributeSearchChange(key: string, value: string) {
    setAttributeSearchTerms((current) => {
      const next = { ...current };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
    pendingAttributeFocusKey.current = key;
  }

  useLayoutEffect(() => {
    const focusKey = pendingAttributeFocusKey.current;
    if (!focusKey) return;
    pendingAttributeFocusKey.current = null;
    const input = attributeSearchRefs.current[focusKey];
    if (!input) return;
    const container = input.closest('[data-filter-scrollable="true"]') as HTMLElement | null;
    const previousScrollTop = container?.scrollTop ?? 0;
    input.focus({ preventScroll: true });
    const position = input.value.length;
    try {
      input.setSelectionRange(position, position);
    } catch (err) {
      // ignore when selection range is unsupported
    }
    if (container) {
      container.scrollTop = previousScrollTop;
    }
  }, [attributeSearchTerms]);


// Move FiltersPanel out to top-level to avoid remounting on every ProductsPageContent render
type FiltersPanelProps = {
  onClose?: () => void;
  mergedCategories: FacetCategory[];
  categorySearch: string;
  setCategorySearch: (v: string) => void;
  toggleCategory: (id: string) => void;
  selectedCategories: string[];
  priceRange: { min?: number; max?: number };
  priceDraft: { min: string; max: string };
  setPriceDraft: React.Dispatch<React.SetStateAction<{ min: string; max: string }>>;
  applyPriceFilters: () => void;
  clearPriceFilter: () => void;
  facets: ProductsResponse['facets'];
  attributeSearchTerms: Record<string, string>;
  attributeSearchRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  handleAttributeSearchChange: (key: string, value: string) => void;
  activeFilterCount: number;
  clearFilters: () => void;
  attributeFilters: Record<string, string[]>;
  toggleAttribute: (key: string, value: string) => void;
};

function FiltersPanel({
  onClose,
  mergedCategories,
  categorySearch,
  setCategorySearch,
  toggleCategory,
  priceRange,
  priceDraft,
  setPriceDraft,
  applyPriceFilters,
  clearPriceFilter,
  facets,
  attributeSearchTerms,
  attributeSearchRefs,
  handleAttributeSearchChange,
  activeFilterCount,
  clearFilters,
  attributeFilters,
  toggleAttribute,
}: FiltersPanelProps) {
  const categoryTerm = categorySearch.trim().toLowerCase();
  const filteredCategories = categoryTerm
    ? mergedCategories.filter((cat) => cat.name.toLowerCase().includes(categoryTerm))
    : mergedCategories;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <span
          className="text-sm font-semibold uppercase tracking-wide text-subtle"
          id={onClose ? 'mobile-filters-heading' : undefined}
        >
          Filters
        </span>
        {onClose && (
          <button
            type="button"
            className="btn-secondary !w-auto justify-center px-4 py-1 text-xs"
            onClick={onClose}
          >
            Done
          </button>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Categories</h2>
          <span className="text-xs text-subtle">{mergedCategories.length}</span>
        </div>
        <label className="block text-sm text-subtle">
          <span className="sr-only">Search categories</span>
          <input
            value={categorySearch}
            onChange={(event) => setCategorySearch(event.target.value)}
            placeholder="Search categories"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--text-primary)] focus:border-indigo-400 focus:outline-none"
          />
        </label>
        <div className="max-h-56 space-y-2 overflow-y-auto pr-1 text-sm text-subtle" data-filter-scrollable="true">
          {filteredCategories.length > 0 ? (
            filteredCategories.map((cat) => (
              <label key={cat.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="accent-indigo-500"
                    checked={selectedCategories.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                  />
                  <span className="text-sm">{cat.name}</span>
                </div>
                <span className="text-xs text-subtle">{cat.count}</span>
              </label>
            ))
          ) : mergedCategories.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-subtle">
              Categories will appear here as catalog data loads.
            </p>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-subtle">
              No categories match your search.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">Price</h2>
          {(priceRange.min !== undefined || priceRange.max !== undefined) && (
            <button
              type="button"
              className="text-xs text-subtle underline decoration-dotted underline-offset-4"
              onClick={clearPriceFilter}
            >
              Reset
            </button>
          )}
        </div>
        <div className="space-y-2 text-sm text-subtle">
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <span className="text-xs text-subtle">Min</span>
              <input
                value={priceDraft.min}
                onChange={(e) => setPriceDraft((prev) => ({ ...prev, min: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--text-primary)] focus:border-indigo-400 focus:outline-none"
                placeholder="$0.00"
                inputMode="numeric"
              />
            </label>
            <label className="flex-1">
              <span className="text-xs text-subtle">Max</span>
              <input
                value={priceDraft.max}
                onChange={(e) => setPriceDraft((prev) => ({ ...prev, max: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--text-primary)] focus:border-indigo-400 focus:outline-none"
                placeholder="$500.00"
                inputMode="numeric"
              />
            </label>
          </div>
          <button onClick={applyPriceFilters} className="btn-primary w-full justify-center py-2 text-xs">Apply price range</button>
          {facets.price.min !== undefined && facets.price.max !== undefined && (
            <p className="text-xs text-subtle">
              Available range: ${(facets.price.min / 100).toFixed(2)} – {(facets.price.max / 100).toFixed(2)}
            </p>
          )}
        </div>
      </div>

      {facets.attributes
        .filter((facet) => ALLOWED_ATTRIBUTES.includes(facet.key.toLowerCase()))
        .sort((a, b) => {
          const order = ALLOWED_ATTRIBUTES;
          return order.indexOf(a.key.toLowerCase()) - order.indexOf(b.key.toLowerCase());
        })
        .map((facet) => {
          const attributeSearchValue = attributeSearchTerms[facet.key] ?? '';
          const attributeTerm = attributeSearchValue.trim().toLowerCase();
          const filteredValues = attributeTerm
            ? facet.values.filter((entry) => entry.value.toLowerCase().includes(attributeTerm))
            : facet.values;
          const showAttributeSearch = facet.values.length > FILTER_SEARCH_THRESHOLD;
          const attributeShouldScroll = facet.values.length > FILTER_SCROLL_THRESHOLD;

          return (
            <div key={facet.key} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">{facet.key}</h2>
                <span className="text-xs text-subtle">{facet.values.length}</span>
              </div>
              {showAttributeSearch && (
                <label className="block text-sm text-subtle">
                  <span className="sr-only">Search {facet.key}</span>
                  <input
                    ref={(element) => {
                      if (element) attributeSearchRefs.current[facet.key] = element;
                      else delete attributeSearchRefs.current[facet.key];
                    }}
                    value={attributeSearchValue}
                    onChange={(event) => handleAttributeSearchChange(facet.key, event.target.value)}
                    placeholder={`Search ${facet.key.toLowerCase()}`}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--text-primary)] focus:border-indigo-400 focus:outline-none"
                  />
                </label>
              )}
              <div
                className={cn(
                  'space-y-2 text-sm text-subtle',
                  attributeShouldScroll && 'max-h-56 overflow-y-auto pr-1'
                )}
                data-filter-scrollable="true"
              >
                {filteredValues.length > 0 ? (
                  filteredValues.map((entry) => (
                    <label key={entry.value} className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={Boolean(attributeFilters[facet.key] && attributeFilters[facet.key].includes(entry.value))}
                          onChange={() => toggleAttribute(facet.key, entry.value)}
                        />
                        <span className="text-sm">{entry.value}</span>
                      </div>
                      <span className="text-xs text-subtle">{entry.count}</span>
                    </label>
                  ))
                ) : facet.values.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-subtle">No values</p>
                ) : (
                  <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-subtle">No values match</p>
                )}
              </div>
            </div>
          );
        })}

      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={() => {
            clearFilters();
            onClose?.();
          }}
          className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-subtle hover:bg-white/10"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-indigo-900/20 backdrop-blur sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">Explore the catalog</h1>
            <p className="text-sm text-indigo-100/70 sm:max-w-xl">
              Discover seeded inventory, filter by specs, and surface the right products with smarter sorting.
            </p>
          </div>
          <div className="hidden sm:flex flex-wrap gap-2">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setSort(option.value);
                  setPage(1);
                }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  sort === option.value
                    ? 'bg-indigo-500 text-white shadow shadow-indigo-500/30'
                    : 'bg-white/10 text-indigo-100/80 hover:bg-white/20'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-inner shadow-indigo-900/10">
            <span className="text-lg">🔍</span>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search products, e.g. sneakers or bags"
              className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-indigo-100/50 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="text-xs text-indigo-100/70 hover:text-[var(--text-primary)]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex gap-2 sm:hidden">
            <button
              type="button"
              onClick={openMobileFilters}
              className="btn-secondary flex-1 justify-center"
            >
              Filters
              {activeFilterCount ? (
                <span className="ml-2 inline-flex h-6 min-w-[2rem] items-center justify-center rounded-full bg-indigo-500/20 px-2 text-xs font-semibold text-indigo-100">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            <div className="flex gap-2">
              <label htmlFor="mobile-sort" className="sr-only">
                Sort products
              </label>
              <select
                id="mobile-sort"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[var(--text-primary)] focus:border-indigo-400 focus:outline-none"
              >
                {sortOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-[color:var(--surface-solid)] text-[var(--text-primary)]"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 text-xs text-subtle">
            {activeFilterBadges.map((badge) => (
              <button
                key={badge.label}
                onClick={badge.onRemove}
                className="inline-flex flex-shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[var(--text-primary)] hover:bg-white/10"
              >
                <span>{badge.label}</span>
                <span aria-hidden>✕</span>
              </button>
            ))}
            <button
              onClick={clearFilters}
              className="flex-shrink-0 text-[var(--text-primary)] underline decoration-dotted underline-offset-4"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-indigo-900/20">
            <FiltersPanel
              mergedCategories={mergedCategories}
              categorySearch={categorySearch}
              setCategorySearch={setCategorySearch}
              toggleCategory={toggleCategory}
              selectedCategories={selectedCategories}
              priceRange={priceRange}
              priceDraft={priceDraft}
              setPriceDraft={setPriceDraft}
              applyPriceFilters={applyPriceFilters}
              clearPriceFilter={clearPriceFilter}
              facets={facets}
              attributeSearchTerms={attributeSearchTerms}
              attributeSearchRefs={attributeSearchRefs}
              handleAttributeSearchChange={handleAttributeSearchChange}
              activeFilterCount={activeFilterCount}
              clearFilters={clearFilters}
              attributeFilters={attributeFilters}
              toggleAttribute={toggleAttribute}
            />
          </div>
        </aside>

        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-subtle">
            <span>
              Showing {items.length} of {total} result{total === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary px-3 py-1 text-xs"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
              >
                Prev
              </button>
              <span className="rounded-full bg-white/10 px-6 py-1 text-xs text-indigo-100/80">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn-secondary px-3 py-1 text-xs"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>

          <div data-testid="product-grid" className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
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
                  const variant = getDefaultVariant(product);
                  const displayPrice = variant?.price ?? product.price;
                  const pendingAdd = isAddPending(product, variant);
                  const rating = product.rating;
                  return (
                    <div key={product._id} data-testid="product-card" className="card group overflow-hidden">
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
                          {product.brand && (
                            <p className="text-xs uppercase tracking-wide text-indigo-100/60">{product.brand}</p>
                          )}
                          <p className="text-sm text-indigo-100/70">${(displayPrice / 100).toFixed(2)}</p>
                          {rating?.average && (
                            <p className="text-xs text-indigo-100/60">
                              ★ {rating.average.toFixed(1)}
                              {rating.count ? ` (${rating.count})` : ''}
                            </p>
                          )}
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
              No products matched your filters yet. Try adjusting filters or clearing them to explore the full catalog.
            </div>
          )}
        </div>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden" role="dialog" aria-modal="true" aria-labelledby="mobile-filters-heading">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 z-0 bg-black/60 backdrop-blur-sm"
            onClick={closeMobileFilters}
          />
          <div className="relative z-10 ml-auto flex h-full w-full max-w-sm flex-col overflow-hidden rounded-l-3xl border-l border-[var(--surface-border)] bg-[color:var(--surface-solid)] shadow-2xl shadow-slate-950/40">
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <FiltersPanel
                onClose={closeMobileFilters}
                mergedCategories={mergedCategories}
                categorySearch={categorySearch}
                setCategorySearch={setCategorySearch}
                toggleCategory={toggleCategory}
                selectedCategories={selectedCategories}
                priceRange={priceRange}
                priceDraft={priceDraft}
                setPriceDraft={setPriceDraft}
                applyPriceFilters={applyPriceFilters}
                clearPriceFilter={clearPriceFilter}
                facets={facets}
                attributeSearchTerms={attributeSearchTerms}
                attributeSearchRefs={attributeSearchRefs}
                handleAttributeSearchChange={handleAttributeSearchChange}
                activeFilterCount={activeFilterCount}
                clearFilters={clearFilters}
                attributeFilters={attributeFilters}
                toggleAttribute={toggleAttribute}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductsPageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-indigo-900/20 backdrop-blur">
        <div className="h-8 w-2/3 animate-pulse rounded-full bg-white/10" />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-10 w-full animate-pulse rounded-2xl bg-white/10 sm:max-w-xs" />
          <div className="hidden h-8 w-48 animate-pulse rounded-full bg-white/10 sm:block" />
        </div>
        <div className="mt-4 flex gap-2 sm:hidden">
          <div className="h-9 flex-1 animate-pulse rounded-full bg-white/10" />
          <div className="h-9 w-32 animate-pulse rounded-full bg-white/10" />
        </div>
      </div>
      <div className="lg:grid lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="hidden lg:block">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-10 animate-pulse rounded-xl bg-white/10" />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-8 w-40 animate-pulse rounded-full bg-white/10" />
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="card animate-pulse overflow-hidden">
                <div className="h-48 w-full bg-white/10" />
                <div className="space-y-2 p-5">
                  <div className="h-4 w-2/3 rounded-full bg-white/10" />
                  <div className="h-4 w-1/4 rounded-full bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsPageSkeleton />}>
      <ProductsPageContent />
    </Suspense>
  );
}
