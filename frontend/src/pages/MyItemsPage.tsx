import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  Plus,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { listMyItems, deleteItem } from "@/services/index.ts";
import type { Item } from "@loopin/shared";
import { ITEM_CATEGORIES, ITEM_CONDITIONS } from "@loopin/shared";
import { formatCurrency } from "@/lib/utils.ts";
import {
  StatusBadge,
  PageLoader,
  EmptyState,
  SuccessMessage,
  ErrorMessage,
} from "@/components/ui/shared.tsx";

export function MyItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = () => {
    setLoading(true);
    listMyItems()
      .then(setItems)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleDelete = async (itemId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to remove "${title}" from your listings?`)) {
      return;
    }
    try {
      setError(null);
      await deleteItem(itemId);
      setMessage(`"${title}" has been removed from campus listings.`);
      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item.");
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6 animate-slide-up pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink">My Listed Items</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Manage the gear and tools you are sharing with the campus community ({items.length} total).
          </p>
        </div>
        <Link to="/items/new" className="btn-primary self-start sm:self-auto text-sm shadow-brand">
          <Plus className="h-4 w-4" />
          List New Item
        </Link>
      </div>

      {message && <SuccessMessage message={message} />}
      {error && <ErrorMessage message={error} />}

      {items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Package className="h-8 w-8 text-ink-subtle" />}
            title="You haven't listed any items yet"
            description="Lend equipment, textbooks, or calculators you don't use every day to build your TrustScore."
            action={
              <Link to="/items/new" className="btn-primary text-xs mt-2">
                <Plus className="h-4 w-4" />
                List your first item
              </Link>
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.itemId}
              className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-brand-300"
            >
              {/* Thumbnail and Info */}
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="h-18 w-18 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl bg-surface-muted border border-surface-border">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl">
                      📦
                    </div>
                  )}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <Link
                      to={`/items/${item.itemId}`}
                      className="font-bold text-sm sm:text-base text-ink hover:text-brand-600 transition-colors truncate"
                    >
                      {item.title}
                    </Link>
                    <StatusBadge status={item.status} className="shrink-0 text-[11px]" />
                  </div>

                  <p className="text-xs text-ink-muted">
                    {ITEM_CATEGORIES[item.category]} · {ITEM_CONDITIONS[item.condition]} · Est. value{" "}
                    <span className="font-semibold text-brand-600">
                      {formatCurrency(item.estimatedValue)}
                    </span>
                  </p>

                  <div className="flex flex-wrap gap-1 mt-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-ink-muted"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center border-t sm:border-t-0 pt-3 sm:pt-0 border-surface-border w-full sm:w-auto justify-end">
                <Link
                  to={`/items/${item.itemId}`}
                  className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="h-3 w-3" />
                  View
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(item.itemId, item.title)}
                  className="btn-ghost text-xs py-1.5 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 inline-flex items-center gap-1.5"
                  title="Remove listing"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
