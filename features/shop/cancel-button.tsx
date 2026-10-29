"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cancelPurchaseAction, cancelSaleAction } from "./actions";

export function CancelButton({
  kind,
  id,
  invoiceNo,
  onDone,
}: {
  kind: "sale" | "purchase";
  id: number;
  invoiceNo: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      try {
        const r = await (kind === "sale" ? cancelSaleAction(id) : cancelPurchaseAction(id));
        // Refresh on failure too: a stale tab's row status must catch up.
        router.refresh();
        if (r.success) {
          setOpen(false);
          onDone();
        } else {
          setError(r.message ?? "Terjadi kesalahan. Coba lagi.");
        }
      } catch {
        setError("Terjadi kesalahan. Coba lagi.");
      }
    });
  }

  return (
    <>
      <Button
        variant="destructive"
        className="h-11 text-base"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Batalkan
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan transaksi {invoiceNo}?</AlertDialogTitle>
            <AlertDialogDescription>Stok akan dikembalikan.</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="text-base text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                confirm();
              }}
            >
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
