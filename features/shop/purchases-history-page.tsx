"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { PeriodFilter } from "@/components/period-filter";
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
import { PAYMENT_METHOD_LABELS } from "@/features/membership/validation";
import { formatDateId, rupiah } from "@/lib/format";
import type { Period } from "@/lib/period";
import type { Role } from "@/lib/auth/session";
import type { PurchaseItemRow } from "./queries";
import { TransactionDetailDialog } from "./transaction-detail-dialog";

export function PurchasesHistoryPage({
  rows,
  period,
  from,
  to,
  role,
}: {
  rows: PurchaseItemRow[];
  period: Period;
  from?: string;
  to?: string;
  role: Role;
}) {
  const [detail, setDetail] = useState<PurchaseItemRow | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Riwayat Pembelian</h1>
      <PeriodFilter period={period} from={from} to={to} />
      {rows.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Belum ada transaksi di periode ini."
          className="rounded-xl border bg-card"
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table className="text-base">
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Produk</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Harga Satuan</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Metode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.itemId}>
                  <TableCell>{formatDateId(r.date)}</TableCell>
                  <TableCell className="font-medium">{r.productName}</TableCell>
                  <TableCell>{r.categoryName}</TableCell>
                  <TableCell className="text-right">{r.qty}</TableCell>
                  <TableCell className="text-right">{rupiah.format(r.unitCost)}</TableCell>
                  <TableCell className="text-right">{rupiah.format(r.lineTotal)}</TableCell>
                  <TableCell>{r.supplierName}</TableCell>
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
          kind="purchase"
          id={detail.purchaseId}
          invoiceNo={detail.invoiceNo}
          role={role}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
