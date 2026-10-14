import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind classes with proper conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Formats a currency value in Indian Rupees (₹). */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formats a date string to a human-readable relative label. */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Returns how many days until (or past) a due date. */
export function daysUntil(isoString: string): number {
  const now = new Date();
  const target = new Date(isoString);
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/** Derives a score tier label from a numeric score. */
export function scoreTierLabel(score: number): string {
  if (score === 0) return "New Member";
  if (score < 40) return "Bronze";
  if (score < 70) return "Silver";
  if (score < 90) return "Gold";
  return "Platinum";
}

/** Derives a score tier CSS color class from a numeric score. */
export function scoreTierColor(score: number): string {
  if (score === 0) return "text-slate-400";
  if (score < 40) return "text-amber-700";
  if (score < 70) return "text-slate-300";
  if (score < 90) return "text-yellow-400";
  return "text-cyan-300";
}

/** Truncates a string to a max length and adds ellipsis. */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 1)}…`;
}
