import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  ArrowLeftRight,
  DollarSign,
  Search,
  PlusCircle,
  Sparkles,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { cn, formatCurrency, formatDate, daysUntil, scoreTierColor, scoreTierLabel } from "@/lib/utils.ts";
import {
  getCurrentUser,
  listLoans,
  listItems,
  getCommunityStats,
} from "@/services/index.ts";
import type { UserProfile, Loan, Item } from "@loopin/shared";
import type { CommunityStats } from "@/services/types.ts";
import { PageLoader, StatusBadge, ScoreRing } from "@/components/ui/shared.tsx";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  badge?: string;
}

function StatCard({ title, value, subtitle, icon: Icon, accentClass, badge }: StatCardProps) {
  return (
    <div className="card flex flex-col justify-between gap-4 transition-all hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{title}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", accentClass)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-extrabold text-ink">{value}</p>
          {badge && (
            <span className="text-[11px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getCurrentUser(),
      listLoans(),
      listItems({ status: "available" }),
      getCommunityStats(),
    ])
      .then(([user, loanList, items, stats]) => {
        setCurrentUser(user);
        setLoans(loanList);
        setAvailableItems(items.slice(0, 4));
        setCommunityStats(stats);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !currentUser || !communityStats) {
    return <PageLoader />;
  }

  const activeLoans = loans.filter((l) => l.status === "active" || l.status === "pending");

  return (
    <div className="space-y-8 animate-slide-up pb-12">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink">
            Welcome back, {currentUser.displayName.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {communityStats.campusName} · {communityStats.membersCount} students sharing on the quad
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          <Link to="/explore" className="btn-secondary text-sm">
            <Search className="h-4 w-4" />
            Explore
          </Link>
          <Link to="/items/new" className="btn-primary text-sm shadow-brand">
            <PlusCircle className="h-4 w-4" />
            List Item
          </Link>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Reliability Score"
          value={`${currentUser.reliabilityScore}/100`}
          subtitle="Top 15% on campus"
          badge={scoreTierLabel(currentUser.reliabilityScore)}
          icon={ShieldCheck}
          accentClass="bg-brand-50 text-brand-600"
        />
        <StatCard
          title="Money Saved"
          value={formatCurrency(currentUser.totalSavings)}
          subtitle="Estimated campus savings"
          icon={DollarSign}
          accentClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Items Lent"
          value={currentUser.lendCount}
          subtitle={`${currentUser.borrowCount} times borrowed`}
          icon={Package}
          accentClass="bg-lime-100 text-lime-800"
        />
        <StatCard
          title="Active Loops"
          value={activeLoans.length}
          subtitle="Borrows + lends in motion"
          icon={ArrowLeftRight}
          accentClass="bg-brand-50 text-brand-600"
        />
      </div>

      {/* Two Column Layout: Upcoming Returns & TrustScore Overview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Active Loans & Returns */}
        <div className="lg:col-span-8 space-y-6">
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div>
                <h2 className="text-base font-bold text-ink">Active Loans & Returns</h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Upcoming due dates and active handshakes on campus
                </p>
              </div>
              <Link to="/my-loop" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                View all in My Loop <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {activeLoans.length === 0 ? (
              <p className="text-sm text-ink-muted py-6 text-center">
                No active loans right now. Explore the quad or list an item to start!
              </p>
            ) : (
              <div className="space-y-3">
                {activeLoans.map((loan) => {
                  const isBorrower = loan.borrowerId === currentUser.userId;
                  const days = daysUntil(loan.dueDate);
                  const isOverdue = days < 0 && loan.status === "active";
                  const isDueSoon = days <= 2 && days >= 0 && loan.status === "active";

                  return (
                    <div
                      key={loan.loanId}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-surface-border p-4 hover:border-brand-300 transition-colors bg-white"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-ink">{loan.itemTitle}</p>
                          <StatusBadge status={loan.status} />
                        </div>
                        <p className="text-xs text-ink-muted">
                          {isBorrower
                            ? `Borrowed from ${loan.lenderName}`
                            : `Lent to ${loan.borrowerName}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right text-xs">
                          <p className="text-ink-subtle">Due {formatDate(loan.dueDate)}</p>
                          {loan.status === "active" && (
                            <p
                              className={cn(
                                "font-semibold",
                                isOverdue
                                  ? "text-red-600"
                                  : isDueSoon
                                  ? "text-amber-600"
                                  : "text-brand-600",
                              )}
                            >
                              {isOverdue
                                ? `${Math.abs(days)}d overdue`
                                : days === 0
                                ? "Due today"
                                : `${days}d left`}
                            </p>
                          )}
                        </div>
                        <Link
                          to="/my-loop"
                          className="btn-secondary text-xs py-1.5 px-3"
                        >
                          Manage
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Available Items on Campus Preview */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div>
                <h2 className="text-base font-bold text-ink">Recently Available on Campus</h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Items listed by other students ready for borrowing
                </p>
              </div>
              <Link to="/explore" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
                Explore all items <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {availableItems.map((item) => (
                <Link
                  key={item.itemId}
                  to={`/items/${item.itemId}`}
                  className="flex gap-3 rounded-xl border border-surface-border p-3 hover:border-brand-300 transition-all hover:shadow-card bg-white group"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface-muted">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xl">📦</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-ink truncate group-hover:text-brand-600 transition-colors">
                      {item.title}
                    </p>
                    <p className="text-xs text-ink-muted truncate mt-0.5">{item.ownerName}</p>
                    <p className="text-xs font-semibold text-brand-600 mt-1">
                      {formatCurrency(item.estimatedValue)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: TrustScore & Community Impact */}
        <div className="lg:col-span-4 space-y-6">
          {/* TrustScore Card */}
          <div className="card space-y-5">
            <span className="section-label text-brand-600">TrustScore™ Breakdown</span>
            <div className="flex items-center gap-5 justify-center py-2">
              <ScoreRing score={currentUser.reliabilityScore} size={96} />
              <div className="space-y-1">
                <p className={cn("text-lg font-extrabold", scoreTierColor(currentUser.reliabilityScore))}>
                  {scoreTierLabel(currentUser.reliabilityScore)} Tier
                </p>
                <p className="text-xs text-ink-muted">
                  Calculated from 14 on-time returns and 22 active lends.
                </p>
              </div>
            </div>

            <div className="space-y-2 border-t border-surface-border pt-4 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-muted">On-Time Return Rate</span>
                <span className="font-bold text-emerald-600">100%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Campus Standing</span>
                <span className="font-bold text-ink">Verified Student</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Community Endorsements</span>
                <span className="font-bold text-brand-600">8 peers</span>
              </div>
            </div>

            <Link to="/profile" className="btn-secondary w-full justify-center text-xs py-2">
              View Profile & Score Details
            </Link>
          </div>

          {/* Community Stats Quick Card */}
          <div className="card space-y-4 bg-gradient-to-br from-white to-brand-50/30">
            <div className="flex items-center gap-2 text-brand-600">
              <Sparkles className="h-4 w-4" />
              <h3 className="text-sm font-bold text-ink">Quad Impact Snapshot</h3>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Together, {communityStats.campusName} students have circulated {communityStats.totalItems} items,
              saving over <span className="font-bold text-brand-600">{formatCurrency(communityStats.totalSavings)}</span> this semester.
            </p>
            <Link to="/community" className="btn-ghost text-xs text-brand-600 p-0 font-semibold flex items-center gap-1 hover:bg-transparent">
              View campus leaderboard & stats <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
