"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIOD_OPTIONS, type Period } from "@/lib/period";

export function PeriodFilter({
  period,
  from,
  to,
  children,
}: {
  period: Period;
  from?: string;
  to?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function push(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        items={PERIOD_OPTIONS}
        value={period}
        onValueChange={(v) => v && push({ period: v, from: undefined, to: undefined })}
      >
        <SelectTrigger className="h-11 w-44 text-base" aria-label="Periode">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {period === "custom" && (
        <>
          <input
            type="date"
            aria-label="Dari tanggal"
            value={from ?? ""}
            onChange={(e) => push({ from: e.target.value })}
            className="h-11 rounded-lg border bg-card px-3 text-base"
          />
          <span className="text-muted-foreground">s/d</span>
          <input
            type="date"
            aria-label="Sampai tanggal"
            value={to ?? ""}
            onChange={(e) => push({ to: e.target.value })}
            className="h-11 rounded-lg border bg-card px-3 text-base"
          />
        </>
      )}
      {children}
    </div>
  );
}
