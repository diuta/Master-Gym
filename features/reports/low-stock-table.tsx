import { PackageCheck } from "lucide-react";
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
import type { ProductRow } from "@/features/shop/queries";

export function LowStockTable({ products }: { products: ProductRow[] }) {
  const rows = products.filter((p) => p.status !== "in_stock");
  if (rows.length === 0) return <EmptyState icon={PackageCheck} title="Semua stok aman" />;
  return (
    <Table className="text-base">
      <TableHeader>
        <TableRow>
          <TableHead>Nama</TableHead>
          <TableHead>Kategori</TableHead>
          <TableHead className="text-right">Stok</TableHead>
          <TableHead className="text-right">Min</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="font-medium">{p.name}</TableCell>
            <TableCell>{p.categoryName}</TableCell>
            <TableCell className="text-right">
              {p.stock} {p.unit}
            </TableCell>
            <TableCell className="text-right">{p.minStock}</TableCell>
            <TableCell>
              <StatusBadge status={p.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
