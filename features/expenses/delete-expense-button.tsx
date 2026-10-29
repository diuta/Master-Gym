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
import { deleteExpenseAction } from "./actions";

export function DeleteExpenseButton({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      try {
        const r = await deleteExpenseAction(id);
        // Refresh on failure too: a stale tab's list must catch up.
        router.refresh();
        if (r.success) setOpen(false);
        else setError(r.message ?? "Terjadi kesalahan. Coba lagi.");
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
        Hapus
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengeluaran {label}?</AlertDialogTitle>
            <AlertDialogDescription>Data pengeluaran ini akan dihapus permanen.</AlertDialogDescription>
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
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
