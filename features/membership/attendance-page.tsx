"use client";

import { ClipboardList } from "lucide-react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { AttendanceTable } from "./attendance-table";
import { todayWib } from "./logic";
import type { AttendanceRow } from "./validation";

export function AttendancePage({ date, rows }: { date: string; rows: AttendanceRow[] }) {
  const router = useRouter();
  const members = rows.filter((r) => r.kind === "member").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Riwayat Absen</h1>
        <input
          type="date"
          aria-label="Tanggal"
          value={date}
          max={todayWib()}
          onChange={(e) => e.target.value && router.replace(`?date=${e.target.value}`)}
          className="h-11 rounded-lg border bg-card px-3 text-base"
        />
      </div>
      <p className="text-base text-muted-foreground">
        {rows.length} orang ({members} member, {rows.length - members} visitor)
      </p>
      {rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Belum ada absen di tanggal ini."
          className="rounded-xl border bg-card"
        />
      ) : (
        <AttendanceTable rows={rows} showDate />
      )}
    </div>
  );
}
