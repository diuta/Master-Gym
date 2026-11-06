"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Building2, Pencil, Plus, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { RequiredMark } from "@/components/ui/required-mark";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createCorporatePackageAction,
  deleteCorporatePackageAction,
  updateCorporatePackageAction,
} from "./actions";
import { rupiah } from "@/lib/format";
import type { CorporatePackageOption } from "./queries";

type FormState = {
  companyName: string;
  employeeCount: string;
  visitQuota: string;
  months: string;
  price: string;
};
const EMPTY: FormState = {
  companyName: "",
  employeeCount: "",
  visitQuota: "",
  months: "",
  price: "",
};

// Empty string must reach the schema as undefined so it reports "wajib diisi".
const num = (s: string) => (s === "" ? undefined : Number(s));

// A hook, not a component: its state must live in the host so the delete confirmation can
// replace the list while the host dialog is closed.
export function useCorporatePackageManager({
  packages,
}: {
  packages: CorporatePackageOption[];
}) {
  const router = useRouter();
  // The delete confirmation replaces the list (the host closes its dialog while this is
  // true) rather than stacking on top of it.
  const [confirming, setConfirming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CorporatePackageOption | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (key: keyof FormState) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY);
    setErrors({});
    setMessage(null);
  }

  function startEdit(p: CorporatePackageOption) {
    setEditingId(p.id);
    setForm({
      companyName: p.companyName,
      employeeCount: String(p.employeeCount),
      visitQuota: String(p.visitQuota),
      months: String(p.months),
      price: String(p.price),
    });
    setErrors({});
    setMessage(null);
  }

  async function run(fn: () => Promise<Awaited<ReturnType<typeof createCorporatePackageAction>>>) {
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      const result = await fn();
      if (result.success) {
        router.refresh();
        return true;
      }
      setErrors(result.errors ?? {});
      setMessage(result.message ?? null);
      return false;
    } catch {
      setMessage("Terjadi kesalahan. Coba lagi.");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      companyName: form.companyName,
      employeeCount: num(form.employeeCount) as number,
      visitQuota: num(form.visitQuota) as number,
      months: num(form.months) as number,
      price: num(form.price) as number,
    };
    const ok = await run(() =>
      editingId === null ? createCorporatePackageAction(input) : updateCorporatePackageAction(editingId, input),
    );
    if (ok) resetForm();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const ok = await run(() => deleteCorporatePackageAction(deleteTarget.id));
    if (ok) {
      if (editingId === deleteTarget.id) resetForm();
      setConfirming(false);
    }
  }

  const fieldError = (key: string) =>
    errors[key]?.[0] && <p className="text-sm text-destructive">{errors[key][0]}</p>;

  const list = (
    <>
      {packages.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Belum ada paket corporate"
          description="Tambahkan paket pertama lewat form di bawah."
          className="py-4"
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-3 py-2 font-medium">Nama Perusahaan</th>
                <th className="px-3 py-2 font-medium">Karyawan</th>
                <th className="px-3 py-2 font-medium">Kuota Visit</th>
                <th className="px-3 py-2 font-medium">Masa Berlaku</th>
                <th className="px-3 py-2 font-medium">Harga</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{p.companyName}</td>
                  <td className="px-3 py-2">{p.employeeCount}</td>
                  <td className="px-3 py-2">{p.visitQuota}</td>
                  <td className="px-3 py-2">{p.months} bulan</td>
                  <td className="px-3 py-2">{rupiah.format(p.price)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="h-11"
                        disabled={pending}
                        onClick={() => startEdit(p)}
                      >
                        <Pencil />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        className="h-11"
                        disabled={pending}
                        onClick={() => {
                          setDeleteTarget(p);
                          setMessage(null);
                          setConfirming(true);
                        }}
                      >
                        <Trash2 />
                        Hapus
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
        <p className="text-base font-medium">
          {editingId === null ? "Tambah Paket Baru" : "Edit Paket"}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="corporate-company">
            Nama Perusahaan
            <RequiredMark />
          </Label>
          <Input
            id="corporate-company"
            className="h-11 text-base"
            value={form.companyName}
            onChange={(e) => set("companyName")(e.target.value)}
            disabled={pending}
          />
          {fieldError("companyName")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="corporate-employees">
            Jumlah Karyawan
            <RequiredMark />
          </Label>
          <Input
            id="corporate-employees"
            className="h-11 text-base"
            inputMode="numeric"
            value={form.employeeCount}
            onChange={(e) => set("employeeCount")(e.target.value.replace(/\D/g, ""))}
            disabled={pending}
          />
          {fieldError("employeeCount")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="corporate-quota">
            Kuota Visit
            <RequiredMark />
          </Label>
          <Input
            id="corporate-quota"
            className="h-11 text-base"
            inputMode="numeric"
            value={form.visitQuota}
            onChange={(e) => set("visitQuota")(e.target.value.replace(/\D/g, ""))}
            disabled={pending}
          />
          {fieldError("visitQuota")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="corporate-months">
            Masa Berlaku (bulan)
            <RequiredMark />
          </Label>
          <Input
            id="corporate-months"
            className="h-11 text-base"
            inputMode="numeric"
            value={form.months}
            onChange={(e) => set("months")(e.target.value.replace(/\D/g, ""))}
            disabled={pending}
          />
          {fieldError("months")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="corporate-price">
            Harga
            <RequiredMark />
          </Label>
          <CurrencyInput
            id="corporate-price"
            className="h-11 text-base"
            value={form.price}
            onChange={set("price")}
            disabled={pending}
          />
          {fieldError("price")}
        </div>
        {message && !confirming && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant="success" className="h-11 text-base" disabled={pending}>
            {editingId === null && <Plus />}
            {pending ? "Menyimpan..." : editingId === null ? "Tambah" : "Simpan"}
          </Button>
          {editingId !== null && (
            <Button
              type="button"
              variant="outline"
              className="h-11 text-base"
              disabled={pending}
              onClick={resetForm}
            >
              Batal
            </Button>
          )}
        </div>
      </form>
    </>
  );

  const confirmDialog = (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus paket {deleteTarget?.companyName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Paket yang sudah pernah dibeli hanya dinonaktifkan, riwayat pembelian tidak berubah.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {message && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogAction
            variant="outline"
            className="h-11"
            onClick={() => setConfirming(false)}
            disabled={pending}
          >
            Kembali
          </AlertDialogAction>
          <AlertDialogAction
            variant="destructive"
            className="h-11"
            onClick={handleDelete}
            disabled={pending}
          >
            {pending ? "Menghapus..." : "Ya, Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { list, confirmDialog, confirming, resetForm };
}

export function KelolaPaketCorporateDialog({ packages }: { packages: CorporatePackageOption[] }) {
  const [open, setOpen] = useState(false);
  const m = useCorporatePackageManager({ packages });

  return (
    <>
      <Dialog
        open={open && !m.confirming}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) m.resetForm();
        }}
      >
        <DialogTrigger render={<Button variant="outline" className="h-11 text-base" />}>
          <Settings />
          Kelola Paket Corporate
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Kelola Paket Corporate</DialogTitle>
          </DialogHeader>
          {m.list}
        </DialogContent>
      </Dialog>
      {m.confirmDialog}
    </>
  );
}
