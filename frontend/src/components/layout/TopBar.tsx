import { Bell } from "lucide-react";
import { useState } from "react";
import { DEMO_NOTIFICATIONS } from "@/demo/data.ts";
import { cn } from "@/lib/utils.ts";

export function TopBar() {
  const unread = DEMO_NOTIFICATIONS.filter((n) => !n.read).length;
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="relative flex h-14 flex-shrink-0 items-center justify-between border-b border-surface-border bg-white px-6">
      {/* Left side — breadcrumb or title slot (filled by pages if needed) */}
      <div id="topbar-title" />

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button
          id="notification-bell-btn"
          type="button"
          onClick={() => setShowNotifications((v) => !v)}
          aria-label={`Notifications — ${unread} unread`}
          aria-expanded={showNotifications}
          aria-haspopup="true"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <Bell className="h-4.5 w-4.5" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white"
            >
              {unread}
            </span>
          )}
        </button>
      </div>

      {/* Notification dropdown */}
      {showNotifications && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-4 top-14 z-30 w-80 rounded-2xl border border-surface-border bg-white shadow-xl animate-slide-up"
        >
          <div className="border-b border-surface-border px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {DEMO_NOTIFICATIONS.map((n) => (
              <li
                key={n.notificationId}
                role="menuitem"
                className={cn(
                  "flex gap-3 px-4 py-3 text-sm border-b border-surface-border last:border-0",
                  !n.read ? "bg-brand-50/60" : "",
                )}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {!n.read && (
                    <span className="block h-2 w-2 rounded-full bg-brand-500 animate-pulse-dot" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-ink leading-tight">{n.message}</p>
                  <p className="mt-1 text-[11px] text-ink-subtle">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
