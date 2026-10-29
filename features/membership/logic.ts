// Pure rules, no server imports: also used by client components.
export type MembershipStatus = "active" | "expiring" | "expired";

const DAY_MS = 86_400_000;

function parse(date: string): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m - 1, d];
}

function fmt(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayWib(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}

// Inclusive last day: same day N months later (clamped to month length) minus 1.
export function membershipEndDate(startDate: string, months: number): string {
  const [y, m, d] = parse(startDate);
  const lastDay = new Date(Date.UTC(y, m + months + 1, 0)).getUTCDate();
  return fmt(Date.UTC(y, m + months, Math.min(d, lastDay)) - DAY_MS);
}

export function daysRemaining(endDate: string, today: string): number {
  return Math.round((Date.UTC(...parse(endDate)) - Date.UTC(...parse(today))) / DAY_MS);
}

export function membershipStatus(endDate: string, today: string): MembershipStatus {
  const days = daysRemaining(endDate, today);
  return days < 0 ? "expired" : days <= 7 ? "expiring" : "active";
}

export function normalizePhone(input: string): string | null {
  const p = input.replace(/[\s.-]/g, "").replace(/^\+?62/, "0");
  return /^0\d{8,13}$/.test(p) ? p : null;
}

// null when the superadmin hasn't set this category's base price yet.
export function membershipPrice(pricePerMonth: number | undefined, months: number): number | null {
  return pricePerMonth === undefined ? null : pricePerMonth * months;
}

export function paymentsMatchPrice(payments: { amount: number }[], price: number): boolean {
  return (
    payments.length > 0 &&
    Number.isInteger(price) &&
    payments.every((p) => Number.isInteger(p.amount) && p.amount > 0) &&
    payments.reduce((s, p) => s + p.amount, 0) === price
  );
}

export function formatMemberNo(n: number): string {
  return `MG-${String(n).padStart(4, "0")}`;
}
