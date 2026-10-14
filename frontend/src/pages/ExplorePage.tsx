import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Filter,
  Package,
  ArrowUpDown,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { listItems } from "@/services/index.ts";
import type { Item } from "@loopin/shared";
import { ITEM_CATEGORIES, ITEM_CONDITIONS } from "@loopin/shared";
import { formatCurrency, truncate } from "@/lib/utils.ts";
import { StatusBadge, PageLoader, EmptyState } from "@/components/ui/shared.tsx";

export function ExplorePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [condition, setCondition] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "value_desc" | "value_asc">("newest");

  const fetchItems = useCallback(() => {
    setLoading(true);
    listItems({
      search: search.trim() || undefined,
      category: category !== "all" ? category : undefined,
      condition: condition !== "all" ? condition : undefined,
      status: status !== "all" ? status : undefined,
      sortBy,
    })
      .then(setItems)
      .finally(() => setLoading(false));
  }, [search, category, condition, status, sortBy]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const handleReset = () => {
    setSearch("");
    setCategory("all");
    setCondition("all");
    setStatus("all");
    setSortBy("newest");
  };

  const hasActiveFilters =
    search !== "" || category !== "all" || condition !== "all" || status !== "all";

  return (
    <div className="space-y-6 animate-slide-up pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink">Explore Campus Items</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Borrow verified gear, books, and tools directly from peers on campus.
          </p>
        </div>
        <Link to="/items/new" className="btn-primary self-start sm:self-auto text-sm shadow-brand">
          <Sparkles className="h-4 w-4" />
          List an Item
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="card space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              id="explore-search-input"
              type="search"
              className="input pl-10"
              placeholder="Search items, keywords, or tags (e.g. arduino, camera, ti-84)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-secondary px-4">
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-surface-border">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted mr-1">
            <Filter className="h-3.5 w-3.5" />
            Filters:
          </div>

          {/* Category */}
          <select
            id="filter-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input w-auto text-xs py-1.5 px-3 h-auto"
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {Object.entries(ITEM_CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* Condition */}
          <select
            id="filter-condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="input w-auto text-xs py-1.5 px-3 h-auto"
            aria-label="Filter by condition"
          >
            <option value="all">All Conditions</option>
            {Object.entries(ITEM_CONDITIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          {/* Availability */}
          <select
            id="filter-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input w-auto text-xs py-1.5 px-3 h-auto"
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="available">Available Now</option>
            <option value="on_loan">Currently On Loan</option>
          </select>

          {/* Sort By */}
          <div className="ml-auto flex items-center gap-2">
            <ArrowUpDown className="h-3.5 w-3.5 text-ink-subtle hidden sm:inline" />
            <select
              id="filter-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="input w-auto text-xs py-1.5 px-3 h-auto"
              aria-label="Sort items"
            >
              <option value="newest">Newest First</option>
              <option value="value_desc">Highest Value</option>
              <option value="value_asc">Lowest Value</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleReset}
                className="btn-ghost text-xs py-1 px-2.5 inline-flex items-center gap-1 text-ink-muted hover:text-ink"
                title="Reset filters"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items Grid */}
      {loading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Package className="h-8 w-8 text-ink-subtle" />}
            title="No items found"
            description="Try modifying your search keywords or resetting filters."
            action={
              hasActiveFilters ? (
                <button type="button" onClick={handleReset} className="btn-secondary text-xs mt-2">
                  Reset all filters
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <div
              key={item.itemId}
              className="card group flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
            >
              <div className="space-y-3">
                {/* Thumbnail Image */}
                <Link to={`/items/${item.itemId}`} className="block overflow-hidden rounded-xl bg-surface-muted aspect-video">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl">
                      📦
                    </div>
                  )}
                </Link>

                {/* Details */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/items/${item.itemId}`}
                      className="font-bold text-ink hover:text-brand-600 transition-colors leading-tight line-clamp-1"
                    >
                      {item.title}
                    </Link>
                    <StatusBadge status={item.status} className="shrink-0 text-[11px]" />
                  </div>
                  <p className="mt-1 text-xs text-ink-muted line-clamp-2 leading-relaxed">
                    {truncate(item.description, 85)}
                  </p>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-4 pt-3 border-t border-surface-border space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-ink-subtle">Lender: </span>
                    <span className="font-medium text-ink">{item.ownerName}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-ink-subtle">Est. Value: </span>
                    <span className="font-semibold text-brand-600">
                      {formatCurrency(item.estimatedValue)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/items/${item.itemId}`}
                    className="btn-secondary w-full justify-center text-xs py-2"
                  >
                    View Details
                  </Link>
                  {item.status === "available" && (
                    <Link
                      to={`/items/${item.itemId}`}
                      className="btn-primary w-full justify-center text-xs py-2"
                    >
                      Borrow
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
