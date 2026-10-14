import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  Search,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { listItems, getCommunityStats } from "@/services/index.ts";
import type { Item } from "@loopin/shared";
import type { CommunityStats } from "@/services/types.ts";
import { formatCurrency } from "@/lib/utils.ts";

const CURRENT_YEAR = new Date().getFullYear();

export function LandingPage() {
  const [featuredItems, setFeaturedItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);

  useEffect(() => {
    listItems({ sortBy: "newest" }).then((items) => setFeaturedItems(items.slice(0, 4)));
    getCommunityStats().then(setStats);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-ink">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-surface-border bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-brand-sm">
              <RefreshCw className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-ink">LoopIn</span>
              <span className="hidden sm:inline-block text-[11px] font-medium text-ink-subtle ml-2 border-l border-surface-border pl-2">
                Need it? Loop it.
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/explore" className="btn-ghost text-sm">
              Explore Items
            </Link>
            <Link to="/login" className="btn-secondary text-sm hidden sm:inline-flex">
              Sign In
            </Link>
            <Link to="/dashboard" className="btn-primary text-sm">
              Open App
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-100/50 blur-3xl" />

        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          {/* Campus Pill Tag */}
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-brand-50/70 px-4 py-1.5 text-xs font-semibold text-brand-700 shadow-sm mb-6">
            <span className="flex h-2 w-2 rounded-full bg-lime-500" />
            Verified Campus Peer-to-Peer Sharing Network
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-ink leading-tight">
            Your campus has <br className="hidden sm:inline" />
            <span className="text-brand-600">what you need.</span>
          </h1>

          <p className="mt-4 text-xl sm:text-2xl font-medium text-brand-600/90 tracking-tight">
            “Need it? Loop it.”
          </p>

          <p className="mx-auto mt-4 max-w-2xl text-base sm:text-lg text-ink-muted leading-relaxed">
            Borrow lab equipment, graphing calculators, cameras, power tools, and books from students right across your quad. Zero rental costs. Built on campus trust.
          </p>

          {/* Primary Call to Action buttons */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              to="/explore"
              className="btn-primary w-full sm:w-auto px-7 py-3 text-base justify-center shadow-brand"
            >
              <Search className="h-4 w-4" />
              Explore Items
            </Link>
            <Link
              to="/items/new"
              className="btn-secondary w-full sm:w-auto px-7 py-3 text-base justify-center"
            >
              <PlusCircle className="h-4 w-4 text-brand-600" />
              List an Item
            </Link>
          </div>

          {/* Key Assurance Indicators */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-ink-muted">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              <span>Campus email verified (.ac.in / .edu)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-lime-600" />
              <span>100% Free peer loans</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-brand-600" />
              <span>TrustScore™ accountability</span>
            </div>
          </div>
        </div>
      </section>

      {/* Community Impact Stats Strip */}
      <section className="border-y border-surface-border bg-white py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4 text-center">
            <div className="space-y-1">
              <p className="text-3xl font-extrabold text-brand-600">
                {stats ? formatCurrency(stats.totalSavings) : "₹18,500+"}
              </p>
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Student Money Saved
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-extrabold text-ink">
                {stats ? stats.totalItems : "140+"}
              </p>
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Active Items on Quad
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-extrabold text-ink">
                {stats ? stats.activeLoans : "30+"}
              </p>
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Active Loops Right Now
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-extrabold text-emerald-600">
                {stats ? `${stats.membersCount}+` : "300+"}
              </p>
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                Verified IITM Students
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How LoopIn Works */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="section-label text-brand-600">Three Simple Steps</span>
            <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              How the Loop works
            </h2>
            <p className="mt-3 text-base text-ink-muted">
              Stop buying items you will only use once for a weekend project or an exam week.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="card space-y-4 hover:shadow-card-hover transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 font-bold text-lg">
                1
              </div>
              <h3 className="text-lg font-bold text-ink">Find & Request</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Search verified gear listed by peers in your hostel or department. Send a loan request specifying when and why you need it.
              </p>
              <div className="pt-2 text-xs font-semibold text-brand-600 flex items-center gap-1">
                Browse catalog instantly <ArrowRight className="h-3 w-3" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="card space-y-4 hover:shadow-card-hover transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-100 text-lime-800 font-bold text-lg">
                2
              </div>
              <h3 className="text-lg font-bold text-ink">Handshake on Campus</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Coordinate a 2-minute meetup at the library, student center, or lab. Inspect the item together and start your loop.
              </p>
              <div className="pt-2 text-xs font-semibold text-lime-700 flex items-center gap-1">
                Zero security deposits required <CheckCircle2 className="h-3 w-3" />
              </div>
            </div>

            {/* Step 3 */}
            <div className="card space-y-4 hover:shadow-card-hover transition-shadow">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 font-bold text-lg">
                3
              </div>
              <h3 className="text-lg font-bold text-ink">Return & Boost Trust</h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                Hand back the item on or before your due date. Automated reminders keep both parties in sync, boosting your campus TrustScore.
              </p>
              <div className="pt-2 text-xs font-semibold text-brand-600 flex items-center gap-1">
                Unlock gold campus tiers <ShieldCheck className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Items Preview */}
      {featuredItems.length > 0 && (
        <section className="bg-white py-16 border-t border-surface-border">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
              <div>
                <span className="section-label text-brand-600">Fresh on Campus</span>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  Recently listed items ready to loop
                </h2>
              </div>
              <Link to="/explore" className="btn-secondary text-sm self-start sm:self-auto">
                View all items
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredItems.map((item) => (
                <Link
                  key={item.itemId}
                  to={`/items/${item.itemId}`}
                  className="card group flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover"
                >
                  <div className="aspect-video w-full overflow-hidden rounded-xl bg-surface-muted">
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
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-ink group-hover:text-brand-600 transition-colors">
                      {item.title}
                    </p>
                    <p className="text-xs text-ink-muted mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-surface-border text-xs">
                    <span className="font-medium text-ink-subtle">{item.ownerName}</span>
                    <span className="font-semibold text-brand-600">
                      Est. {formatCurrency(item.estimatedValue)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-surface-border bg-white py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white">
              <RefreshCw className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-bold text-sm text-ink leading-tight">LoopIn</p>
              <p className="text-[11px] text-ink-subtle">“Need it? Loop it.” — VIT Chennai Campus Network</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-ink-muted">
            <Link to="/explore" className="hover:text-ink">Explore</Link>
            <Link to="/community" className="hover:text-ink">Impact Leaderboard</Link>
            <Link to="/dashboard" className="hover:text-ink">Dashboard</Link>
            <Link to="/login" className="hover:text-ink">Student Sign In</Link>
          </div>

          <p className="text-xs text-ink-subtle">
            © {CURRENT_YEAR} LoopIn. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
