import { ReceiptText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateId, rupiah } from "@/lib/format";

export type SaleDetailRow = { date: string; label: string; total: number };

export function SalesDetailTable({ rows }: { rows: SaleDetailRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={ReceiptText} title="Belum ada penjualan di periode ini." />;
  }
  return (
    <Table className="text-base">
      <TableHeader>
        <TableRow>
          <TableHead>Tanggal</TableHead>
          <TableHead>No. Invoice</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.label}>
            <TableCell>{formatDateId(r.date)}</TableCell>
            <TableCell className="font-medium">{r.label}</TableCell>
            <TableCell className="text-right">{rupiah.format(r.total)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-semibold">
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell className="text-right">
            {rupiah.format(rows.reduce((a, r) => a + r.total, 0))}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
