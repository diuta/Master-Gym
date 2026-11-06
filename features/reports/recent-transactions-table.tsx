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
import { formatDateId, formatTimeWib, rupiah } from "@/lib/format";
import { cashBankLabel, type IncomeKind, type RecentTx } from "./logic";

const KIND_LABELS: Record<IncomeKind, string> = {
  sale: "Penjualan",
  membership: "Membership",
  visit: "Visit",
  pt: "PT",
  corporate: "Corporate",
};

export function RecentTransactionsTable({ rows }: { rows: RecentTx[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={ReceiptText} title="Belum ada transaksi di periode ini." />;
  }
  return (
    <Table className="text-base">
      <TableHeader>
        <TableRow>
          <TableHead>Waktu</TableHead>
          <TableHead>Jenis</TableHead>
          <TableHead>Keterangan</TableHead>
          <TableHead>Metode</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={`${r.kind}:${r.docId}`}>
            <TableCell>
              {formatDateId(r.date)} {formatTimeWib(r.at)}
            </TableCell>
            <TableCell>{KIND_LABELS[r.kind]}</TableCell>
            <TableCell className="font-medium">{r.label}</TableCell>
            <TableCell>{cashBankLabel(r.methods)}</TableCell>
            <TableCell className="text-right">{rupiah.format(r.total)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
