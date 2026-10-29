"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Role } from "@/lib/auth/session";
import { PAYMENT_METHOD_LABELS } from "@/features/membership/validation";
import { formatDateId, rupiah } from "@/lib/format";
import { CancelButton } from "./cancel-button";
import { purchaseDetailAction, saleDetailAction } from "./actions";
import type { TransactionDetail } from "./queries";

export function TransactionDetailDialog({
  kind,
  id,
  invoiceNo,
  role,
  onClose,
}: {
  kind: "sale" | "purchase";
  id: number;
  invoiceNo: string;
  role: Role;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (kind === "sale" ? saleDetailAction(id) : purchaseDetailAction(id))
      .then((r) => {
        if (cancelled) return;
        if (r.success) setDetail(r.data);
        else setError(r.message ?? "Terjadi kesalahan. Coba lagi.");
      })
      .catch(() => !cancelled && setError("Terjadi kesalahan. Coba lagi."));
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{invoiceNo}</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-base text-destructive">{error}</p>
        ) : !detail ? (
          <p className="text-base text-muted-foreground">Memuat...</p>
        ) : (
          <div className="space-y-4 text-base">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>{formatDateId(detail.date)}</span>
              <StatusBadge status={detail.status} />
            </div>
            <p>
              {detail.kind === "sale" ? "Pembeli" : "Supplier"}: {detail.party ?? "-"}
            </p>
            {detail.notes && <p>Catatan: {detail.notes}</p>}
            <Table className="text-base">
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">
                    {detail.kind === "sale" ? "Harga" : "Harga Satuan"}
                  </TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.items.map((i, n) => (
                  <TableRow key={n}>
                    <TableCell>{i.name}</TableCell>
                    <TableCell className="text-right">
                      {i.qty} {i.unit}
                    </TableCell>
                    <TableCell className="text-right">{rupiah.format(i.unitPrice)}</TableCell>
                    <TableCell className="text-right">{rupiah.format(i.lineTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="space-y-1">
              {detail.payments.map((p, n) => (
                <p key={n} className="flex justify-between">
                  <span>{PAYMENT_METHOD_LABELS[p.method]}</span>
                  <span>{rupiah.format(p.amount)}</span>
                </p>
              ))}
              <p className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span>{rupiah.format(detail.total)}</span>
              </p>
            </div>
            {role === "superadmin" && detail.status === "success" && (
              <div className="flex justify-end">
                <CancelButton kind={kind} id={id} invoiceNo={invoiceNo} onDone={onClose} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
