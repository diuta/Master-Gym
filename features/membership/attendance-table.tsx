import { ClipboardList, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export const attendanceKey = (r: AttendanceRow) => `${r.kind}-${r.id}`;

// onCheckOut makes this a client-driven table; server pages leave it out for a read-only view.
export function AttendanceTable({
  rows,
  showDate,
  onCheckOut,
  pendingId,
}: {
  rows: AttendanceRow[];
  showDate?: boolean;
  onCheckOut?: (row: AttendanceRow) => void;
  pendingId?: string;
}) {
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
            <TableHead>Jam Keluar</TableHead>
            <TableHead>Nama</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Loker</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={attendanceKey(r)}>
              <TableCell>{i + 1}</TableCell>
              {showDate && <TableCell>{formatDateId(todayWib(r.at))}</TableCell>}
              <TableCell>{formatTimeWib(r.at)}</TableCell>
              <TableCell>
                {r.checkedOutAt ? (
                  formatTimeWib(r.checkedOutAt)
                ) : onCheckOut ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 text-base"
                    disabled={pendingId === attendanceKey(r)}
                    onClick={() => onCheckOut(r)}
                  >
                    <LogOut />
                    Logout
                  </Button>
                ) : (
                  "-"
                )}
              </TableCell>
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
