"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Pencil, Plus, Settings, Truck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { createSupplierAction, deleteSupplierAction, updateSupplierAction } from "./actions";
import type { SupplierOption } from "./queries";


export function KelolaSupplierDialog({ suppliers }: { suppliers: SupplierOption[] }) {
  const router = useRouter();
  // One stage machine instead of a nested AlertDialog, so the delete
  // confirmation replaces the list rather than stacking on top of it.
  const [stage, setStage] = useState<"closed" | "list" | "confirmDelete">("closed");
  const [deleteTarget, setDeleteTarget] = useState<SupplierOption | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function resetForm() {
    setEditingId(null);
    setName("");
    setPhone("");
    setErrors({});
    setMessage(null);
  }

  function startEdit(p: SupplierOption) {
    setEditingId(p.id);
    setName(p.name);
    setPhone(p.phone ?? "");
    setErrors({});
    setMessage(null);
  }

  async function run(fn: () => Promise<Awaited<ReturnType<typeof createSupplierAction>>>) {
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
    const input = { name, phone };
    const ok = await run(() =>
      editingId === null ? createSupplierAction(input) : updateSupplierAction(editingId, input),
    );
    if (ok) resetForm();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const ok = await run(() => deleteSupplierAction(deleteTarget.id));
    if (ok) {
      if (editingId === deleteTarget.id) resetForm();
      setStage("list");
    }
  }

  const fieldError = (key: string) =>
    errors[key]?.[0] && <p className="text-sm text-destructive">{errors[key][0]}</p>;

  return (
    <>
      <Dialog
        open={stage === "list"}
        onOpenChange={(next) => {
          setStage(next ? "list" : "closed");
          if (!next) resetForm();
        }}
      >
        <DialogTrigger render={<Button variant="outline" className="h-11 text-base" />}>
          <Settings />
          Kelola Supplier
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Kelola Supplier</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {suppliers.length === 0 ? (
              <EmptyState
                icon={Truck}
                title="Belum ada supplier"
                description="Tambahkan supplier pertama lewat form di bawah."
                className="py-4"
              />
            ) : (
              suppliers.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <div className="min-w-0 flex-1 text-base">
                    <p className="font-medium">{p.name}</p>
                    {p.phone && <p className="text-muted-foreground">{p.phone}</p>}
                  </div>
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
                      setStage("confirmDelete");
                    }}
                  >
                    <Trash2 />
                    Hapus
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* The dialog is portaled but React events still bubble to the wizard's Enter-to-advance. Only Enter is stopped: Base UI closes on Escape via a document listener, which a blanket stopPropagation starves. */}
          <form
            onSubmit={handleSubmit}
            onKeyDown={(e) => e.key === "Enter" && e.stopPropagation()}
            className="space-y-3 border-t pt-4"
          >
            <p className="text-base font-medium">
              {editingId === null ? "Tambah Supplier Baru" : "Edit Supplier"}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-name">
                Nama Supplier
                <RequiredMark />
              </Label>
              <Input
                id="supplier-name"
                className="h-11 text-base"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
              />
              {fieldError("name")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="supplier-phone">No. HP</Label>
              <Input
                id="supplier-phone"
                className="h-11 text-base"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={pending}
              />
              {fieldError("phone")}
            </div>
            {message && stage === "list" && (
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
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={stage === "confirmDelete"}
        onOpenChange={(next) => setStage(next ? "confirmDelete" : "list")}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus supplier {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Supplier yang sudah dipakai pembelian hanya dinonaktifkan, pembelian lama tidak
              berubah.
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
              onClick={() => setStage("list")}
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
    </>
  );
}
