/**
 * Shared UI primitives — LoopIn
 * Spinner, EmptyState, ErrorMessage, ConfirmDialog, Modal
 */
import type { ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils.ts";

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      aria-label="Loading"
      role="status"
      className={cn("animate-spin text-brand-400", className ?? "h-5 w-5")}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

// ── PageLoader ────────────────────────────────────────────────────────────────

export function PageLoader() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated text-slate-500">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="font-semibold text-slate-300">{title}</p>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ── ErrorMessage ──────────────────────────────────────────────────────────────

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
      <p className="text-sm text-red-300">{message}</p>
    </div>
  );
}

// ── SuccessMessage ────────────────────────────────────────────────────────────

export function SuccessMessage({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4"
    >
      <span className="mt-0.5 h-4 w-4 shrink-0 text-green-400">✓</span>
      <p className="text-sm text-green-300">{message}</p>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = "max-w-lg" }: ModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel */}
      <div
        className={cn(
          "relative w-full rounded-2xl border border-surface-border bg-surface-card p-6 shadow-2xl animate-slide-up",
          maxWidth,
        )}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-surface-elevated hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div role="tablist" className="flex gap-1 rounded-xl bg-surface-elevated p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
            activeTab === tab.id
              ? "bg-surface-card text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
                activeTab === tab.id
                  ? "bg-brand-500/20 text-brand-300"
                  : "bg-surface-card text-slate-500",
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Badge variants ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-400",
  on_loan: "bg-amber-500/15 text-amber-400",
  unavailable: "bg-slate-500/15 text-slate-400",
  pending: "bg-blue-500/15 text-blue-300",
  active: "bg-violet-500/15 text-violet-300",
  approved: "bg-green-500/15 text-green-400",
  returned: "bg-slate-500/15 text-slate-400",
  rejected: "bg-red-500/15 text-red-400",
  overdue: "bg-red-500/15 text-red-400",
  cancelled: "bg-slate-500/15 text-slate-400",
  new: "bg-slate-500/15 text-slate-400",
  like_new: "bg-emerald-500/15 text-emerald-400",
  good: "bg-blue-500/15 text-blue-300",
  fair: "bg-amber-500/15 text-amber-400",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  on_loan: "On Loan",
  unavailable: "Unavailable",
  pending: "Pending",
  active: "Active",
  approved: "Approved",
  returned: "Returned",
  rejected: "Rejected",
  overdue: "Overdue",
  cancelled: "Cancelled",
  new: "New",
  like_new: "Like New",
  good: "Good",
  fair: "Fair",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? "bg-slate-500/15 text-slate-400";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        style,
        className,
      )}
    >
      {label}
    </span>
  );
}

// ── FormField ─────────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}

export function FormField({
  label,
  htmlFor,
  error,
  required,
  children,
  hint,
}: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-200">
        {label}
        {required && <span className="ml-1 text-brand-400">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p role="alert" id={`${htmlFor}-error`} className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

// ── ScoreRing ─────────────────────────────────────────────────────────────────

export function ScoreRing({
  score,
  size = 112,
}: {
  score: number;
  size?: number;
}) {
  const radius = size * 0.375;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const strokeWidth = size * 0.071;
  const center = size / 2;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        className="absolute -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(230 12% 22%)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(244 78% 55%)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="text-center" aria-label={`Score: ${score} out of 100`}>
        <p className="font-bold text-white" style={{ fontSize: size * 0.214 }}>
          {score}
        </p>
        <p className="text-slate-400" style={{ fontSize: size * 0.089 }}>
          / 100
        </p>
      </div>
    </div>
  );
}
