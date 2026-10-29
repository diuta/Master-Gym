"use client";

import { useState } from "react";
import { ReceiptText } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PeriodFilter } from "@/components/period-filter";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAYMENT_METHOD_LABELS } from "@/features/membership/validation";
import { formatDateId, rupiah } from "@/lib/format";
import type { Period } from "@/lib/period";
import type { Role } from "@/lib/auth/session";
import type { SaleRow } from "./queries";
import { TransactionDetailDialog } from "./transaction-detail-dialog";

const ALL = "all";

export function SalesHistoryPage({
  rows,
  products,
  period,
  from,
  to,
  productId,
  role,
}: {
  rows: SaleRow[];
  products: { id: number; name: string }[];
  period: Period;
  from?: string;
  to?: string;
  productId?: number;
  role: Role;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [detail, setDetail] = useState<SaleRow | null>(null);
  const productItems = [
    { value: ALL, label: "Semua Produk" },
    ...products.map((p) => ({ value: String(p.id), label: p.name })),
  ];

  function setProduct(v: string | null) {
    const next = new URLSearchParams(params.toString());
    if (v && v !== ALL) next.set("product", v);
    else next.delete("product");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Riwayat Penjualan</h1>
      <PeriodFilter period={period} from={from} to={to}>
        <Select items={productItems} value={productId ? String(productId) : ALL} onValueChange={setProduct}>
          <SelectTrigger className="h-11 w-56 text-base" aria-label="Filter produk">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {productItems.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PeriodFilter>
      {rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Belum ada transaksi di periode ini."
          className="rounded-xl border bg-card"
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table className="text-base">
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Pembeli</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDateId(r.date)}</TableCell>
                  <TableCell className="font-medium">{r.invoiceNo}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal">{r.itemsLabel}</TableCell>
                  <TableCell className="text-right">{rupiah.format(r.total)}</TableCell>
                  <TableCell>{r.buyerName ?? "-"}</TableCell>
                  <TableCell>{r.methods.map((m) => PAYMENT_METHOD_LABELS[m]).join(", ")}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" className="h-11 text-base" onClick={() => setDetail(r)}>
                        Detail
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {detail && (
        <TransactionDetailDialog
          kind="sale"
          id={detail.id}
          invoiceNo={detail.invoiceNo}
          role={role}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
