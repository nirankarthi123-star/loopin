import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Tag,
  AlertCircle,
  Package,
} from "lucide-react";
import { getItem, requestLoan, getCurrentUser } from "@/services/index.ts";
import type { ItemDetail } from "@/services/types.ts";
import { type UserProfile, ITEM_CATEGORIES, ITEM_CONDITIONS, calculateRentalFee } from "@loopin/shared";
import {
  cn,
  formatCurrency,
  scoreTierColor,
  scoreTierLabel,
} from "@/lib/utils.ts";
import {
  Modal,
  StatusBadge,
  PageLoader,
  ErrorMessage,
  FormField,
} from "@/components/ui/shared.tsx";

function calculateDueDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Request modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loanDays, setLoanDays] = useState(7);
  const [borrowerNote, setBorrowerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  useEffect(() => {
    if (!itemId) return;
    setLoading(true);
    Promise.all([getItem(itemId), getCurrentUser()])
      .then(([itemData, userData]) => {
        if (!itemData) {
          setError("This item could not be found or may have been removed.");
        } else {
          setItem(itemData);
        }
        setCurrentUser(userData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load item.");
      })
      .finally(() => setLoading(false));
  }, [itemId]);

  if (loading) {
    return <PageLoader />;
  }

  if (error || !item) {
    return (
      <div className="space-y-6">
        <Link to="/explore" className="btn-ghost inline-flex items-center gap-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> Back to Explore
        </Link>
        <ErrorMessage message={error ?? "Item not found."} />
      </div>
    );
  }

  const isOwner = currentUser?.userId === item.ownerId;
  const isAvailable = item.status === "available";

  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemId) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const dueDate = calculateDueDate(loanDays);
      await requestLoan({
        itemId,
        dueDate,
        ...(borrowerNote.trim() ? { borrowerNote: borrowerNote.trim() } : {}),
      });

      // Update local state to reflect pending loan on the item
      setItem((prev) => (prev ? { ...prev, status: "on_loan" } : prev));
      setRequestSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to request loan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up pb-12">
      {/* Back button */}
      <div>
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Explore
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Image and details */}
        <div className="lg:col-span-7 space-y-6">
          <div className="aspect-4/3 w-full overflow-hidden rounded-2xl border border-surface-border bg-white shadow-card">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-surface-muted text-ink-subtle">
                <Package className="h-20 w-20 text-ink-subtle/50" />
              </div>
            )}
          </div>

          <div className="card space-y-4">
            <h2 className="text-lg font-bold text-ink">Description</h2>
            <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-line">
              {item.description}
            </p>

            <div className="pt-2">
              <span className="section-label">Tags</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-lg bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pricing, status, owner card, request action */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                  {ITEM_CATEGORIES[item.category]}
                </span>
                <h1 className="text-2xl font-bold text-ink mt-1 leading-tight">
                  {item.title}
                </h1>
              </div>
              <StatusBadge status={item.status} className="shrink-0 text-xs px-3 py-1" />
            </div>

            {/* Price, Condition & Rental Matrix */}
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-surface-muted p-4">
              <div>
                <p className="text-xs font-medium text-ink-muted">Condition</p>
                <p className="text-sm font-semibold text-ink mt-0.5">
                  {ITEM_CONDITIONS[item.condition]}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Est. Value</p>
                <p className="text-sm font-semibold text-ink mt-0.5">
                  {formatCurrency(item.estimatedValue)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-ink-muted">Rental Rate</p>
                <p className="text-sm font-semibold text-brand-600 mt-0.5">
                  {formatCurrency(calculateRentalFee(item.estimatedValue, 1))}/day
                </p>
                <span className="text-[10px] text-ink-subtle">Capped &lt; 15%</span>
              </div>
            </div>

            {/* Owner profile card */}
            <div className="border-t border-surface-border pt-4">
              <span className="section-label">Lender Information</span>
              <div className="flex items-center justify-between mt-2 rounded-xl border border-surface-border p-3.5 bg-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 font-bold text-sm">
                    {item.owner.displayName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-ink">{item.owner.displayName}</p>
                    <p className="text-xs text-ink-muted">Verified Campus Student</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-ink-subtle block">TrustScore</span>
                  <span
                    className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded-full inline-block",
                      scoreTierColor(item.owner.reliabilityScore),
                    )}
                  >
                    {item.owner.reliabilityScore}/100 · {scoreTierLabel(item.owner.reliabilityScore)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-2">
              {isOwner ? (
                <div className="rounded-xl bg-surface-muted p-4 text-center">
                  <p className="text-xs text-ink-muted font-medium">
                    This is your listed item. You can manage or edit it in My Items.
                  </p>
                  <Link to="/my-items" className="btn-secondary text-xs mt-3 w-full justify-center">
                    Manage in My Items
                  </Link>
                </div>
              ) : isAvailable ? (
                <button
                  type="button"
                  id="request-borrow-button"
                  onClick={() => {
                    setRequestSubmitted(false);
                    setIsModalOpen(true);
                  }}
                  className="btn-primary w-full justify-center py-3 text-base shadow-brand"
                >
                  <Clock className="h-4 w-4" />
                  Request to Borrow
                </button>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                  <p className="text-sm font-semibold text-amber-800">
                    Currently On Loan
                  </p>
                  <p className="text-xs text-amber-700 mt-1">
                    This item is checked out by another student. Check back soon!
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-ink-subtle justify-center">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
              <span>Campus protected • Fair student rent capped &lt; 15% • No security deposit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Borrow Request Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={requestSubmitted ? "Loan Request Submitted" : `Request to Borrow "${item.title}"`}
      >
        {requestSubmitted ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-ink">
                Request Sent to {item.owner.displayName}
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Your loan request is now <span className="font-semibold text-brand-600">pending approval</span>. 
                The lender has been notified. Per LoopIn rules, your loan only becomes active after {item.owner.displayName} approves it.
              </p>
            </div>

            <div className="rounded-xl bg-surface-muted p-3 text-left text-xs space-y-1.5 text-ink-muted">
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-semibold text-ink">{loanDays} days</span>
              </div>
              <div className="flex justify-between">
                <span>Proposed Return:</span>
                <span className="font-semibold text-ink">
                  {new Date(calculateDueDate(loanDays)).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between border-t border-surface-border pt-1">
                <span>Estimated Rent:</span>
                <span className="font-semibold text-brand-600">
                  {formatCurrency(calculateRentalFee(item.estimatedValue, loanDays))}
                </span>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn-secondary flex-1 justify-center text-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  navigate("/my-loop");
                }}
                className="btn-primary flex-1 justify-center text-sm"
              >
                View in My Loop
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleBorrowSubmit} className="space-y-4">
            {submitError && <ErrorMessage message={submitError} />}

            <FormField
              label="Borrow Duration (Days)"
              htmlFor="loan-days-select"
              hint="Standard campus loan is 7 days (maximum 30 days)."
            >
              <select
                id="loan-days-select"
                value={loanDays}
                onChange={(e) => setLoanDays(Number(e.target.value))}
                className="input"
              >
                <option value={1}>1 Day (Quick return)</option>
                <option value={3}>3 Days (Weekend project)</option>
                <option value={7}>7 Days (1 Week - Recommended)</option>
                <option value={14}>14 Days (2 Weeks)</option>
                <option value={30}>30 Days (Full Month)</option>
              </select>
            </FormField>

            {/* Transparent Rental Fee Summary */}
            <div className="rounded-xl bg-surface-muted p-3 text-xs space-y-1.5 border border-surface-border">
              <div className="flex justify-between text-ink-muted">
                <span>Daily Rent (0.5%/day):</span>
                <span className="text-ink font-medium">{formatCurrency(calculateRentalFee(item.estimatedValue, 1))}/day</span>
              </div>
              <div className="flex justify-between text-ink-muted">
                <span>Affordability Cap:</span>
                <span className="text-ink font-medium text-[11px]">&lt; 15% of item value ({formatCurrency(Math.floor(item.estimatedValue * 0.14))})</span>
              </div>
              <div className="flex justify-between border-t border-surface-border pt-1 font-semibold text-ink">
                <span>Calculated Rental Fee ({loanDays} {loanDays === 1 ? "day" : "days"}):</span>
                <span className="text-brand-600 font-bold">{formatCurrency(calculateRentalFee(item.estimatedValue, loanDays))}</span>
              </div>
            </div>

            <FormField
              label="Note to Owner (Optional)"
              htmlFor="borrower-note"
              hint="Let the owner know what project or class you need it for."
            >
              <textarea
                id="borrower-note"
                rows={3}
                placeholder="Hi! I need this for the EE201 lab experiment on Thursday..."
                value={borrowerNote}
                onChange={(e) => setBorrowerNote(e.target.value)}
                className="input"
                maxLength={300}
              />
            </FormField>

            <div className="rounded-xl border border-surface-border bg-brand-50/50 p-3 text-xs text-brand-900 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
              <span>
                By requesting, you agree to return the item on time and maintain your campus TrustScore.
              </span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn-secondary flex-1 justify-center"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1 justify-center"
                disabled={submitting}
              >
                {submitting ? "Sending Request..." : "Confirm Request"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
