import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar.tsx";
import { TopBar } from "./TopBar.tsx";
import { IS_DEMO } from "@/lib/env.ts";
import { Menu, X, RefreshCw, LayoutDashboard, Search, Package, ArrowLeftRight, Globe, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils.ts";

const MOBILE_NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/explore", label: "Explore", icon: Search },
  { to: "/my-items", label: "My Items", icon: Package },
  { to: "/my-loop", label: "My Loop", icon: ArrowLeftRight },
  { to: "/community", label: "Community", icon: Globe },
  { to: "/profile", label: "Profile", icon: UserCircle },
] as const;

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)]">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white pt-5 pb-4 shadow-xl">
            <div className="flex items-center justify-between px-5 pb-4 border-b border-surface-border">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-white shadow-brand-sm">
                  <RefreshCw className="h-4 w-4" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">LoopIn</p>
                  <p className="text-[10px] text-ink-subtle">Need it? Loop it.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4">
              {MOBILE_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
                const isActive =
                  to === "/dashboard"
                    ? location.pathname === "/dashboard"
                    : location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand-50 text-brand-600"
                        : "text-ink-muted hover:bg-surface-muted hover:text-ink",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive ? "text-brand-500" : "text-ink-subtle")} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Top Header */}
        <div className="flex h-14 items-center justify-between border-b border-surface-border bg-white px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-2 text-ink-muted hover:bg-surface-muted"
            aria-label="Open sidebar navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white">
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-sm text-ink">LoopIn</span>
          </div>
          <div className="w-8" />
        </div>

        {/* Desktop TopBar */}
        <div className="hidden md:block">
          <TopBar />
        </div>

        {/* Demo Mode Notice */}
        {IS_DEMO && (
          <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200/70 px-6 py-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-xs font-medium text-amber-900">
                <span className="font-semibold">Demo Mode:</span> Interacting with simulated campus data.
                Requests & loans persist in memory.
              </p>
            </div>
            <span className="text-[11px] font-mono text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded">
              VITE_APP_MODE=demo
            </span>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 animate-fade-in">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
