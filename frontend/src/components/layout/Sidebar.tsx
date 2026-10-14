import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import {
  LayoutDashboard,
  Search,
  Package,
  ArrowLeftRight,
  UserCircle,
  RefreshCw,
  Globe,
} from "lucide-react";
import { useAuth } from "@/lib/authContext.tsx";

const NAV_ITEMS = [
  { to: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { to: "/explore",    label: "Explore",     icon: Search },
  { to: "/my-items",   label: "My Items",    icon: Package },
  { to: "/my-loop",    label: "My Loop",     icon: ArrowLeftRight },
  { to: "/community",  label: "Community",   icon: Globe },
  { to: "/profile",    label: "Profile",     icon: UserCircle },
] as const;

export function Sidebar() {
  const location = useLocation();
  const { session } = useAuth();

  const displayName = session?.displayName || "Student";
  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "ST";

  const campusName = session?.campusId === "campus-vit-chennai"
    ? "VIT Chennai"
    : session?.campusId === "campus-iit-delhi"
    ? "IIT Delhi"
    : session?.campusId === "campus-iit-madras"
    ? "IIT Madras"
    : session?.campusId === "campus-mit"
    ? "MIT"
    : "VIT Chennai";

  return (
    <aside
      className="flex h-full w-60 flex-shrink-0 flex-col border-r border-surface-border bg-white"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-surface-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 shadow-brand-sm">
          <RefreshCw className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-[15px] font-bold text-ink tracking-tight leading-none">LoopIn</p>
          <p className="text-[10px] font-medium text-ink-subtle mt-0.5">Need it? Loop it.</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="App navigation">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive =
            to === "/dashboard"
              ? location.pathname === "/dashboard"
              : location.pathname.startsWith(to);

          return (
            <NavLink
              key={to}
              to={to}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-brand-50 text-brand-600"
                  : "text-ink-muted hover:bg-surface-muted hover:text-ink",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  isActive ? "text-brand-500" : "text-ink-subtle",
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              {label}
            </NavLink>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-surface-border px-3 py-4">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-600">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink leading-tight">
              {displayName}
            </p>
            <p className="truncate text-[11px] text-ink-subtle">
              {campusName}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
