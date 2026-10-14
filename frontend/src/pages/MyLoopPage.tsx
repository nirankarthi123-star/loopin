import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeftRight,
  Check,
  X,
  Clock,
  Inbox,
  Send,
  Calendar,
} from "lucide-react";
import {
  listLoans,
  getCurrentUser,
  approveLoan,
  rejectLoan,
  markReturned,
  cancelLoan,
} from "@/services/index.ts";
import type { Loan, UserProfile } from "@loopin/shared";
import {
  cn,
  formatDate,
  daysUntil,
  formatCurrency,
} from "@/lib/utils.ts";
import {
  Tabs,
  StatusBadge,
  PageLoader,
  EmptyState,
  ErrorMessage,
  SuccessMessage,
} from "@/components/ui/shared.tsx";

export function MyLoopPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("borrowed");

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchLoans = async () => {
    try {
      const [allLoans, user] = await Promise.all([listLoans(), getCurrentUser()]);
      setLoans(allLoans);
      setCurrentUser(user);
    } catch (err) {
      console.error("[MyLoopPage] Failed to fetch loans:", err);
      setActionError("Failed to fetch loans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const handleApprove = async (loanId: string) => {
    try {
      setActionError(null);
      await approveLoan(loanId);
      setActionMessage("Loan approved! The borrower has been notified to coordinate pickup.");
      await fetchLoans();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve loan");
    }
  };

  const handleReject = async (loanId: string) => {
    try {
      setActionError(null);
      await rejectLoan(loanId);
      setActionMessage("Loan request was declined.");
      await fetchLoans();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reject loan");
    }
  };

  const handleMarkReturned = async (loanId: string) => {
    try {
      setActionError(null);
      await markReturned(loanId);
      setActionMessage("Item marked as returned! Reliability scores and savings updated.");
      await fetchLoans();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update return");
    }
  };

  const handleCancelRequest = async (loanId: string) => {
    try {
      setActionError(null);
      await cancelLoan(loanId);
      setActionMessage("Your loan request was cancelled.");
      await fetchLoans();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel request");
    }
  };

  if (loading || !currentUser) {
    return <PageLoader />;
  }

  // Filter lists based on roles and statuses
  const borrowedLoans = loans.filter(
    (l) =>
      l.borrowerId === currentUser.userId &&
      (l.status === "active" || l.status === "pending" || l.status === "approved" || l.status === "overdue"),
  );

  const lentLoans = loans.filter(
    (l) =>
      l.lenderId === currentUser.userId &&
      (l.status === "active" || l.status === "approved" || l.status === "overdue"),
  );

  const incomingRequests = loans.filter(
    (l) => l.lenderId === currentUser.userId && l.status === "pending",
  );

  const pastHistory = loans.filter(
    (l) =>
      l.status === "returned" || l.status === "rejected" || l.status === "cancelled",
  );

  const tabList = [
    { id: "borrowed", label: "Items Borrowed", count: borrowedLoans.length },
    { id: "lent", label: "Items Lent", count: lentLoans.length },
    { id: "incoming", label: "Incoming Requests", count: incomingRequests.length },
    { id: "history", label: "Loan History", count: pastHistory.length },
  ];

  return (
    <div className="space-y-6 animate-slide-up pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink">My Loop</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Manage your active loops, campus borrows, lendings, and incoming requests.
          </p>
        </div>
        <Link to="/explore" className="btn-secondary self-start sm:self-auto text-sm">
          Browse items to borrow
        </Link>
      </div>

      {actionMessage && (
        <div className="animate-fade-in">
          <SuccessMessage message={actionMessage} />
        </div>
      )}
      {actionError && (
        <div className="animate-fade-in">
          <ErrorMessage message={actionError} />
        </div>
      )}

      {/* Navigation Tabs */}
      <Tabs tabs={tabList} activeTab={activeTab} onChange={(id) => {
        setActionMessage(null);
        setActionError(null);
        setActiveTab(id);
      }} />

      {/* Tab 1: Borrowed */}
      {activeTab === "borrowed" && (
        <div className="space-y-4">
          {borrowedLoans.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<ArrowLeftRight className="h-8 w-8 text-ink-subtle" />}
                title="No active borrowed items"
                description="Explore items on campus and request something you need for your projects or exams."
                action={
                  <Link to="/explore" className="btn-primary text-xs mt-2">
                    Explore items
                  </Link>
                }
              />
            </div>
          ) : (
            borrowedLoans.map((loan) => {
              const days = daysUntil(loan.dueDate);
              const isOverdue = days < 0 && loan.status === "active";

              return (
                <div
                  key={loan.loanId}
                  className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <Link
                        to={`/items/${loan.itemId}`}
                        className="font-bold text-ink hover:text-brand-600 transition-colors"
                      >
                        {loan.itemTitle}
                      </Link>
                      <StatusBadge status={loan.status} />
                    </div>

                    <p className="text-xs text-ink-muted">
                      Lent by <span className="font-semibold text-ink">{loan.lenderName}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-ink-subtle" />
                        Due: {formatDate(loan.dueDate)}
                      </span>
                      {loan.rentalFee !== undefined && (
                        <span className="font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                          Rent: {formatCurrency(loan.rentalFee)} ({loan.durationDays ?? 7}d)
                        </span>
                      )}
                      {loan.status === "active" && (
                        <span
                          className={cn(
                            "font-semibold",
                            isOverdue ? "text-red-600" : "text-brand-600",
                          )}
                        >
                          {isOverdue
                            ? `${Math.abs(days)} day(s) overdue`
                            : days === 0
                            ? "Due today"
                            : `${days} days left`}
                        </span>
                      )}
                    </div>

                    {loan.borrowerNote && (
                      <p className="text-xs text-ink-muted italic border-l-2 border-brand-200 pl-2 mt-2">
                        &ldquo;{loan.borrowerNote}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {loan.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => handleCancelRequest(loan.loanId)}
                        className="btn-danger text-xs py-1.5 px-3"
                      >
                        Cancel Request
                      </button>
                    )}
                    <Link
                      to={`/items/${loan.itemId}`}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      View Item
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Lent */}
      {activeTab === "lent" && (
        <div className="space-y-4">
          {lentLoans.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Send className="h-8 w-8 text-ink-subtle" />}
                title="No active items lent out"
                description="List items you own to start lending to fellow students."
                action={
                  <Link to="/items/new" className="btn-primary text-xs mt-2">
                    List an item
                  </Link>
                }
              />
            </div>
          ) : (
            lentLoans.map((loan) => {
              const days = daysUntil(loan.dueDate);

              return (
                <div
                  key={loan.loanId}
                  className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <Link
                        to={`/items/${loan.itemId}`}
                        className="font-bold text-ink hover:text-brand-600 transition-colors"
                      >
                        {loan.itemTitle}
                      </Link>
                      <StatusBadge status={loan.status} />
                    </div>

                    <p className="text-xs text-ink-muted">
                      Currently with <span className="font-semibold text-ink">{loan.borrowerName}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-ink-muted pt-1">
                      <span>Due Date: {formatDate(loan.dueDate)}</span>
                      {loan.rentalFee !== undefined && (
                        <span className="font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                          Rent: {formatCurrency(loan.rentalFee)} ({loan.durationDays ?? 7}d)
                        </span>
                      )}
                      <span className="font-medium text-brand-600">
                        {days >= 0 ? `${days} days remaining` : "Past due date"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {loan.status === "active" && (
                      <button
                        type="button"
                        onClick={() => handleMarkReturned(loan.loanId)}
                        className="btn-primary text-xs py-1.5 px-3 shadow-brand-sm"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Mark as Returned
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 3: Incoming Requests */}
      {activeTab === "incoming" && (
        <div className="space-y-4">
          {incomingRequests.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Inbox className="h-8 w-8 text-ink-subtle" />}
                title="No pending incoming requests"
                description="When peers request to borrow your listed items, they will appear here for your review."
              />
            </div>
          ) : (
            incomingRequests.map((loan) => (
              <div
                key={loan.loanId}
                className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-brand-500"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-ink">{loan.itemTitle}</p>
                    <span className="badge bg-amber-100 text-amber-800 text-[11px]">
                      Needs Approval
                    </span>
                  </div>

                  <p className="text-xs text-ink-muted">
                    Requested by <span className="font-semibold text-ink">{loan.borrowerName}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                    <span>Requested Return: {formatDate(loan.dueDate)}</span>
                    {loan.rentalFee !== undefined && (
                      <span className="font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md">
                        Rent: {formatCurrency(loan.rentalFee)} ({loan.durationDays ?? 7}d)
                      </span>
                    )}
                  </div>

                  {loan.borrowerNote && (
                    <div className="rounded-lg bg-surface-muted p-2.5 text-xs text-ink-muted mt-2">
                      <span className="font-semibold text-ink">Note: </span>
                      &ldquo;{loan.borrowerNote}&rdquo;
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleReject(loan.loanId)}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    <X className="h-3.5 w-3.5 text-red-500" />
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(loan.loanId)}
                    className="btn-primary text-xs py-1.5 px-3 shadow-brand-sm"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve Loan
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 4: History */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {pastHistory.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Clock className="h-8 w-8 text-ink-subtle" />}
                title="No past loans recorded yet"
                description="Completed loans and returns will be archived here."
              />
            </div>
          ) : (
            pastHistory.map((loan) => (
              <div
                key={loan.loanId}
                className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4 opacity-90"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <p className="font-semibold text-ink">{loan.itemTitle}</p>
                    <StatusBadge status={loan.status} />
                  </div>
                  <p className="text-xs text-ink-muted">
                    {loan.borrowerId === currentUser.userId
                      ? `Borrowed from ${loan.lenderName}`
                      : `Lent to ${loan.borrowerName}`}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-ink-subtle pt-1">
                    <span>Requested: {formatDate(loan.requestedAt)}</span>
                    {loan.returnedAt && <span>Returned: {formatDate(loan.returnedAt)}</span>}
                    {loan.rentalFee !== undefined && (
                      <span className="text-brand-600 font-medium">Rent: {formatCurrency(loan.rentalFee)}</span>
                    )}
                    <span>Value: {formatCurrency(loan.savingsValue)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
