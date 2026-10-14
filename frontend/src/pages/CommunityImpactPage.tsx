import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Globe,
  TrendingUp,
  Package,
  ArrowLeftRight,
  Leaf,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { getCommunityStats } from "@/services/index.ts";
import type { CommunityStats } from "@/services/types.ts";
import { formatCurrency } from "@/lib/utils.ts";
import { PageLoader } from "@/components/ui/shared.tsx";

const CAMPUS_LEADERBOARD = [
  { name: "Arjun Nair", hostel: "Block D", itemsLent: 31, trustScore: 94, savingsGenerated: 2100 },
  { name: "Niranjna Karthikeyan (You)", hostel: "Girls Hostel Block A", itemsLent: 22, trustScore: 87, savingsGenerated: 1240 },
  { name: "Rohan Patel", hostel: "Block C", itemsLent: 19, trustScore: 89, savingsGenerated: 1650 },
  { name: "Ananya Iyer", hostel: "Girls Hostel Block B", itemsLent: 15, trustScore: 91, savingsGenerated: 1120 },
  { name: "Kavya Menon", hostel: "Girls Hostel Block A", itemsLent: 11, trustScore: 72, savingsGenerated: 680 },
];

export function CommunityImpactPage() {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCommunityStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return <PageLoader />;
  }

  // Calculate environmental and community metrics
  const estimatedKgEwastePrevented = Math.round(stats.totalItems * 1.8);

  return (
    <div className="space-y-8 animate-slide-up pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full mb-2">
            <Globe className="h-3.5 w-3.5" />
            {stats.campusName} Sustainability & Trust Report
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink">Campus Community Impact</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Tracking collective money saved, electronic waste prevented, and campus trust built together.
          </p>
        </div>
        <Link to="/items/new" className="btn-primary self-start sm:self-auto text-sm shadow-brand">
          <Sparkles className="h-4 w-4" />
          Contribute an Item
        </Link>
      </div>

      {/* Hero Stats Matrix */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card space-y-2 border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Money Saved</span>
            <TrendingUp className="h-4 w-4 text-brand-600" />
          </div>
          <p className="text-3xl font-extrabold text-ink">{formatCurrency(stats.totalSavings)}</p>
          <p className="text-xs text-ink-muted">Saved by students borrowing instead of buying new</p>
        </div>

        <div className="card space-y-2 border-l-4 border-l-lime-500">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Loops</span>
            <ArrowLeftRight className="h-4 w-4 text-lime-700" />
          </div>
          <p className="text-3xl font-extrabold text-ink">{stats.activeLoans}</p>
          <p className="text-xs text-ink-muted">Peer loans currently circulating on the quad</p>
        </div>

        <div className="card space-y-2 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">E-Waste Prevented</span>
            <Leaf className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-600">~{estimatedKgEwastePrevented} kg</p>
          <p className="text-xs text-ink-muted">Of redundant hardware kept out of landfills</p>
        </div>

        <div className="card space-y-2 border-l-4 border-l-brand-400">
          <div className="flex items-center justify-between text-ink-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Items in Loop</span>
            <Package className="h-4 w-4 text-brand-500" />
          </div>
          <p className="text-3xl font-extrabold text-ink">{stats.totalItems}</p>
          <p className="text-xs text-ink-muted">Across 9 academic & hobby categories</p>
        </div>
      </div>

      {/* Campus Leaderboard */}
      <div className="card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-border pb-4">
          <div>
            <h2 className="text-lg font-bold text-ink">Campus Trust Champions</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Top students enabling peer sharing with perfect on-time return rates.
            </p>
          </div>
          <span className="badge bg-brand-50 text-brand-700 text-xs">
            {stats.membersCount} active campus peers
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label="Campus Trust Champions Leaderboard">
            <thead>
              <tr className="border-b border-surface-border text-xs text-ink-subtle font-semibold">
                <th scope="col" className="pb-3 pl-2">Rank</th>
                <th scope="col" className="pb-3">Student</th>
                <th scope="col" className="pb-3">Hostel</th>
                <th scope="col" className="pb-3">Items Lent</th>
                <th scope="col" className="pb-3">TrustScore</th>
                <th scope="col" className="pb-3 text-right pr-2">Community Savings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {CAMPUS_LEADERBOARD.map((peer, idx) => (
                <tr key={peer.name} className="hover:bg-surface-muted/60 transition-colors">
                  <td className="py-3.5 pl-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-ink-muted">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                    </span>
                  </td>
                  <td className="py-3.5 font-semibold text-ink">
                    {peer.name}
                  </td>
                  <td className="py-3.5 text-xs text-ink-muted">
                    {peer.hostel}
                  </td>
                  <td className="py-3.5 text-xs text-ink">
                    <span className="font-semibold text-brand-600">{peer.itemsLent}</span> loans
                  </td>
                  <td className="py-3.5">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full">
                      <ShieldCheck className="h-3 w-3" />
                      {peer.trustScore}/100
                    </span>
                  </td>
                  <td className="py-3.5 text-right pr-2 font-bold text-ink">
                    {formatCurrency(peer.savingsGenerated)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* The LoopIn Philosophy */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-ink">Zero Financial Barriers</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            Every loan on LoopIn is 100% free of charge. No student is priced out of having the right tools to build, study, or experiment.
          </p>
        </div>

        <div className="card space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-100 text-lime-800">
            <Leaf className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-ink">Circular Campus Ecology</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            By keeping expensive instruments and lab gear in continuous student circulation, we dramatically cut down single-use consumer waste.
          </p>
        </div>

        <div className="card space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-ink">Trust Over Collateral</h3>
          <p className="text-xs text-ink-muted leading-relaxed">
            No security deposits or paperwork. Campus institutional email verification and our peer TrustScore system keep items safe.
          </p>
        </div>
      </div>
    </div>
  );
}
