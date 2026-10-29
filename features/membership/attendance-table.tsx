import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateId, formatTimeWib } from "@/lib/format";
import { todayWib } from "./logic";
import type { AttendanceRow } from "./validation";

export function AttendanceTable({ rows, showDate }: { rows: AttendanceRow[]; showDate?: boolean }) {
  if (rows.length === 0) {
    return <EmptyState icon={ClipboardList} title="Belum ada absen" className="rounded-xl border bg-card" />;
  }
  return (
    <div className="rounded-xl border bg-card">
      <Table className="text-base">
        <TableHeader>
          <TableRow>
            <TableHead>No</TableHead>
            {showDate && <TableHead>Tanggal</TableHead>}
            <TableHead>Jam Masuk</TableHead>
            <TableHead>Nama</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Loker</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.kind}-${r.at.getTime()}-${i}`}>
              <TableCell>{i + 1}</TableCell>
              {showDate && <TableCell>{formatDateId(todayWib(r.at))}</TableCell>}
              <TableCell>{formatTimeWib(r.at)}</TableCell>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.kind} className="h-7 px-2.5 text-base [&>svg]:size-4!" />
                  {r.trainerName && <span>PT · {r.trainerName}</span>}
                </div>
              </TableCell>
              <TableCell>{r.lockerNo ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
