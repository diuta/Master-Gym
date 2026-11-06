"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/required-mark";
import { todayWib } from "@/features/membership/logic";
import { formatDateId, rupiah } from "@/lib/format";
import { saveOpeningBalanceAction } from "./actions";

export function OpeningBalanceDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [asOf, setAsOf] = useState(todayWib);
  const [cash, setCash] = useState("");
  const [bank, setBank] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set when the server says the balance already exists: refresh only on close, or the
  // re-render drops the button and unmounts this dialog before the message is read.
  const [stale, setStale] = useState(false);

  const fieldError = (k: string) =>
    errors[k]?.[0] && <p className="text-base text-destructive">{errors[k][0]}</p>;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setErrors({});
      setMessage(null);
    } else if (stale) {
      router.refresh();
    }
  }

  async function save() {
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      const result = await saveOpeningBalanceAction({
        asOf,
        cash: Number(cash || 0),
        bank: Number(bank || 0),
      });
      if (result.success) {
        setConfirming(false);
        setOpen(false);
        router.refresh();
        return;
      }
      setConfirming(false);
      setErrors(result.errors ?? {});
      setMessage(result.message ?? null);
      if (result.message) setStale(true);
    } catch {
      setConfirming(false);
      setMessage("Terjadi kesalahan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger render={<Button className="h-11 text-base" />}>
          <Pencil />
          Edit Keuangan
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Keuangan</DialogTitle>
            <DialogDescription className="text-base">
              Uang yang ada di laci dan rekening pada awal tanggal ini. Transaksi sejak tanggal ini
              dihitung otomatis.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setConfirming(true);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="ob-as-of">
                Saldo per Tanggal
                <RequiredMark />
              </Label>
              <Input
                id="ob-as-of"
                type="date"
                className="h-11 text-base"
                value={asOf}
                max={todayWib()}
                onChange={(e) => setAsOf(e.target.value)}
                disabled={pending}
                required
              />
              {fieldError("asOf")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-cash">Saldo Awal Tunai</Label>
              <CurrencyInput
                id="ob-cash"
                className="h-11 text-base"
                value={cash}
                onChange={setCash}
                disabled={pending}
              />
              {fieldError("cash")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-bank">Saldo Awal Bank</Label>
              <CurrencyInput
                id="ob-bank"
                className="h-11 text-base"
                value={bank}
                onChange={setBank}
                disabled={pending}
              />
              {fieldError("bank")}
            </div>
            <p className="rounded-md bg-warning/20 px-3 py-2 text-base font-medium">
              Hanya bisa diisi sekali.
            </p>
            {message && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription className="text-base">{message}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" variant="success" className="h-11 w-full text-base" disabled={pending}>
              Simpan
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Simpan saldo awal?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Tunai {rupiah.format(Number(cash || 0))} dan Bank {rupiah.format(Number(bank || 0))}{" "}
              per {formatDateId(asOf)}. Saldo awal hanya bisa diisi sekali dan tidak bisa diubah lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {pending ? "Menyimpan..." : "Ya, Simpan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
