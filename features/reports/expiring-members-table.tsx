import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MemberRow } from "@/features/membership/queries";
import { formatDateId } from "@/lib/format";

export function ExpiringMembersTable({ members }: { members: MemberRow[] }) {
  const rows = members
    .filter((m) => m.status === "expiring")
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
  if (rows.length === 0) {
    return <EmptyState icon={CalendarCheck} title="Tidak ada member yang segera habis" />;
  }
  return (
    <Table className="text-base">
      <TableHeader>
        <TableRow>
          <TableHead>Nama</TableHead>
          <TableHead>No. HP</TableHead>
          <TableHead>Paket</TableHead>
          <TableHead>Berakhir</TableHead>
          <TableHead className="text-right">Sisa Hari</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m.id}>
            <TableCell className="font-medium">{m.name}</TableCell>
            <TableCell>{m.phone}</TableCell>
            <TableCell>{m.packageName}</TableCell>
            <TableCell>{formatDateId(m.endDate)}</TableCell>
            <TableCell className="text-right">{m.daysRemaining} hari</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
