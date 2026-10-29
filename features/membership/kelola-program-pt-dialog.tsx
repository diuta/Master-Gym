"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Dumbbell, Pencil, Plus, Settings, Trash2 } from "lucide-react";
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
  createPtProgramAction,
  deletePtProgramAction,
  updatePtProgramAction,
} from "./actions";
import { rupiah } from "@/lib/format";
import type { PtProgramOption } from "./queries";

type FormState = { name: string; sessions: string; price: string };
const EMPTY: FormState = { name: "", sessions: "", price: "" };

// Empty string must reach the schema as undefined so it reports "wajib diisi".
const num = (s: string) => (s === "" ? undefined : Number(s));

export function KelolaProgramPtDialog({ programs }: { programs: PtProgramOption[] }) {
  const router = useRouter();
  // One stage machine instead of a nested AlertDialog, so the delete
  // confirmation replaces the list rather than stacking on top of it.
  const [stage, setStage] = useState<"closed" | "list" | "confirmDelete">("closed");
  const [deleteTarget, setDeleteTarget] = useState<PtProgramOption | null>(null);
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

  function startEdit(p: PtProgramOption) {
    setEditingId(p.id);
    setForm({ name: p.name, sessions: String(p.sessions), price: String(p.price) });
    setErrors({});
    setMessage(null);
  }

  async function run(fn: () => Promise<Awaited<ReturnType<typeof createPtProgramAction>>>) {
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
      name: form.name,
      sessions: num(form.sessions) as number,
      price: num(form.price) as number,
    };
    const ok = await run(() =>
      editingId === null ? createPtProgramAction(input) : updatePtProgramAction(editingId, input),
    );
    if (ok) resetForm();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const ok = await run(() => deletePtProgramAction(deleteTarget.id));
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
          Kelola Program PT
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Kelola Program PT</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {programs.length === 0 ? (
              <EmptyState
                icon={Dumbbell}
                title="Belum ada program"
                description="Tambahkan program pertama lewat form di bawah."
                className="py-4"
              />
            ) : (
              programs.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <p className="flex-1 text-base font-medium">
                    {p.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {p.sessions} sesi · {rupiah.format(p.price)}
                    </span>
                  </p>
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

          <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
            <p className="text-base font-medium">
              {editingId === null ? "Tambah Program Baru" : "Edit Program"}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="program-name">
                Nama Program
                <RequiredMark />
              </Label>
              <Input
                id="program-name"
                className="h-11 text-base"
                placeholder="contoh: 12 Sesi"
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
                disabled={pending}
              />
              {fieldError("name")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="program-sessions">
                Jumlah Sesi
                <RequiredMark />
              </Label>
              <Input
                id="program-sessions"
                className="h-11 text-base"
                inputMode="numeric"
                value={form.sessions}
                onChange={(e) => set("sessions")(e.target.value.replace(/\D/g, ""))}
                disabled={pending}
              />
              {fieldError("sessions")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="program-price">
                Harga
                <RequiredMark />
              </Label>
              <CurrencyInput
                id="program-price"
                className="h-11 text-base"
                value={form.price}
                onChange={set("price")}
                disabled={pending}
              />
              {fieldError("price")}
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
            <AlertDialogTitle>Hapus program {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Program yang sudah pernah dibeli member hanya dinonaktifkan, riwayat member tidak
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
