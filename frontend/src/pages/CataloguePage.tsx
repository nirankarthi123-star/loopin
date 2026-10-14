import { useState } from "react";
import { Search } from "lucide-react";
import { DEMO_ITEMS } from "@/demo/data.ts";
import { ITEM_CATEGORIES, ITEM_CONDITIONS } from "@loopin/shared";
import { cn, formatCurrency, truncate } from "@/lib/utils.ts";
import type { ItemCategory, ItemStatus } from "@loopin/shared";

function ItemCard({ item }: { item: (typeof DEMO_ITEMS)[number] }) {
  return (
    <div className="card group flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 hover:border-brand-500/30">
      {/* Image */}
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-surface-elevated">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-4xl">📦</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-white leading-tight">{item.title}</p>
          <span className={cn("badge shrink-0", `badge-${item.status}`)}>
            {item.status === "on_loan" ? "On Loan" : item.status}
          </span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{truncate(item.description, 90)}</p>
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-2 border-t border-surface-border">
        <div>
          <p className="text-xs text-slate-500">{ITEM_CATEGORIES[item.category]}</p>
          <p className="text-xs text-slate-500">{ITEM_CONDITIONS[item.condition]}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Est. value</p>
          <p className="text-sm font-semibold text-accent-300">{formatCurrency(item.estimatedValue)}</p>
        </div>
      </div>

      {item.status === "available" && (
        <button type="button" className="btn-primary w-full justify-center">
          Request to Borrow
        </button>
      )}
    </div>
  );
}

export function CataloguePage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ItemCategory | "all">("all");
  const [status, setStatus] = useState<ItemStatus | "all">("all");

  const filtered = DEMO_ITEMS.filter((item) => {
    const matchesSearch =
      search === "" ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = category === "all" || item.category === category;
    const matchesStatus = status === "all" || item.status === status;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-2xl font-bold text-white">Browse Items</h1>
        <p className="mt-1 text-sm text-slate-400">Find items to borrow from your campus community</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            id="catalogue-search"
            type="search"
            className="input pl-9"
            placeholder="Search items or tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          id="catalogue-category"
          className="input w-auto"
          value={category}
          onChange={(e) => setCategory(e.target.value as ItemCategory | "all")}
        >
          <option value="all">All Categories</option>
          {(Object.entries(ITEM_CATEGORIES) as [ItemCategory, string][]).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          id="catalogue-status"
          className="input w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value as ItemStatus | "all")}
        >
          <option value="all">All Statuses</option>
          <option value="available">Available</option>
          <option value="on_loan">On Loan</option>
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
          <span className="text-5xl">🔍</span>
          <p className="font-medium">No items match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <ItemCard key={item.itemId} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
