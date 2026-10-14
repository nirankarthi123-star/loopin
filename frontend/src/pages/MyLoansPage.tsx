import { ArrowLeftRight } from "lucide-react";
import { DEMO_LOANS, DEMO_CURRENT_USER } from "@/demo/data.ts";
import { cn, formatDate, daysUntil } from "@/lib/utils.ts";
import type { Loan } from "@loopin/shared";

function LoanRow({ loan }: { loan: Loan }) {
  const isBorrower = loan.borrowerId === DEMO_CURRENT_USER.userId;
  const days = daysUntil(loan.dueDate);
  const isOverdue = days < 0 && loan.status === "active";

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-white">{loan.itemTitle}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {isBorrower ? `Borrowed from ${loan.lenderName}` : `Lent to ${loan.borrowerName}`}
          </p>
        </div>
        <span className={cn("badge shrink-0", `badge-${loan.status}`)}>
          {loan.status.replace("_", " ")}
        </span>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
        <div>
          <p className="text-slate-500">Requested</p>
          <p>{formatDate(loan.requestedAt)}</p>
        </div>
        <div>
          <p className="text-slate-500">Due</p>
          <p className={cn(isOverdue ? "text-red-400 font-semibold" : "")}>
            {formatDate(loan.dueDate)}
            {loan.status === "active" && (
              <span className="ml-1">
                ({isOverdue ? `${Math.abs(days)}d overdue` : days === 0 ? "Due today" : `${days}d left`})
              </span>
            )}
          </p>
        </div>
        {loan.returnedAt && (
          <div>
            <p className="text-slate-500">Returned</p>
            <p>{formatDate(loan.returnedAt)}</p>
          </div>
        )}
      </div>

      {loan.borrowerNote && (
        <p className="text-xs italic text-slate-500 border-l-2 border-surface-border pl-3">
          &ldquo;{loan.borrowerNote}&rdquo;
        </p>
      )}
    </div>
  );
}

export function MyLoansPage() {
  const active = DEMO_LOANS.filter(
    (l) => l.status === "active" || l.status === "pending" || l.status === "approved",
  );
  const past = DEMO_LOANS.filter(
    (l) => l.status === "returned" || l.status === "cancelled" || l.status === "rejected",
  );

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center gap-3">
        <ArrowLeftRight className="h-6 w-6 text-brand-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">My Loans</h1>
          <p className="text-sm text-slate-400">Track your borrows and lends</p>
        </div>
      </div>

      {/* Active */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Active ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No active loans.</p>
        ) : (
          <div className="space-y-3">
            {active.map((loan) => (
              <LoanRow key={loan.loanId} loan={loan} />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            History ({past.length})
          </h2>
          <div className="space-y-3">
            {past.map((loan) => (
              <LoanRow key={loan.loanId} loan={loan} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
