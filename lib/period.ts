export type Period = "today" | "week" | "month" | "year" | "all" | "custom";

export const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "today", label: "Hari Ini" },
  { value: "week", label: "Minggu Ini" },
  { value: "month", label: "Bulan Ini" },
  { value: "year", label: "Tahun Ini" },
  { value: "all", label: "Semua Waktu" },
  { value: "custom", label: "Custom" },
];

export function parsePeriod(v: string | undefined): Period {
  return PERIOD_OPTIONS.some((o) => o.value === v) ? (v as Period) : "month";
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Both ends inclusive; a missing end means unbounded.
export function periodRange(
  period: Period,
  today: string,
  custom?: { from?: string; to?: string },
): { from?: string; to?: string } {
  switch (period) {
    case "today":
      return { from: today, to: today };
    case "week": {
      const d = new Date(`${today}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return { from: d.toISOString().slice(0, 10), to: today };
    }
    case "month":
      return { from: `${today.slice(0, 8)}01`, to: today };
    case "year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "all":
      return {};
    case "custom": {
      const out: { from?: string; to?: string } = {};
      if (custom?.from && ISO.test(custom.from)) out.from = custom.from;
      if (custom?.to && ISO.test(custom.to)) out.to = custom.to;
      return out;
    }
  }
}
