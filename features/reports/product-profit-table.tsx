import { Package } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { rupiah } from "@/lib/format";
import type { ProductProfitRow } from "./logic";

// Under a method filter a split sale contributes a fraction of its quantity.
const qtyFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

export function ProductProfitTable({ rows }: { rows: ProductProfitRow[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={Package} title="Belum ada penjualan produk di periode ini." />;
  }
  const sum = (pick: (r: ProductProfitRow) => number) => rows.reduce((a, r) => a + pick(r), 0);
  return (
    <Table className="text-base">
      <TableHeader>
        <TableRow>
          <TableHead>Produk</TableHead>
          <TableHead className="text-right">Terjual</TableHead>
          <TableHead className="text-right">Omzet</TableHead>
          <TableHead className="text-right">Modal</TableHead>
          <TableHead className="text-right">Laba</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.productId}>
            <TableCell className="font-medium">{r.productName}</TableCell>
            <TableCell className="text-right">{qtyFormat.format(r.qty)}</TableCell>
            <TableCell className="text-right">{rupiah.format(r.omzet)}</TableCell>
            <TableCell className="text-right">{rupiah.format(r.cost)}</TableCell>
            <TableCell className="text-right">{rupiah.format(r.profit)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-semibold">
          <TableCell>Total</TableCell>
          <TableCell className="text-right">{qtyFormat.format(sum((r) => r.qty))}</TableCell>
          <TableCell className="text-right">{rupiah.format(sum((r) => r.omzet))}</TableCell>
          <TableCell className="text-right">{rupiah.format(sum((r) => r.cost))}</TableCell>
          <TableCell className="text-right">{rupiah.format(sum((r) => r.profit))}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
