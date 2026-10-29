"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus, Wallet } from "lucide-react";
import { PeriodFilter } from "@/components/period-filter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/required-mark";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { todayWib } from "@/features/membership/logic";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/features/membership/validation";
import { formatDateId, rupiah } from "@/lib/format";
import type { Period } from "@/lib/period";
import type { Role } from "@/lib/auth/session";
import { createExpenseAction } from "./actions";
import { DeleteExpenseButton } from "./delete-expense-button";
import { KelolaKategoriPengeluaranDialog } from "./kelola-kategori-pengeluaran-dialog";
import type { ExpenseRow } from "./queries";

type Category = { id: number; name: string };

const methodItems = (Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => ({
  value: m,
  label: PAYMENT_METHOD_LABELS[m],
}));

function ExpenseForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [date, setDate] = useState(todayWib);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (categories.length === 0) {
    return (
      <Alert>
        <AlertCircle />
        <AlertDescription>Kategori belum diatur, hubungi superadmin.</AlertDescription>
      </Alert>
    );
  }

  const categoryItems = categories.map((c) => ({ value: String(c.id), label: c.name }));
  const fieldError = (key: string) =>
    errors[key]?.[0] && <p className="text-sm text-destructive">{errors[key][0]}</p>;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      const r = await createExpenseAction({
        date,
        categoryId: categoryId ? Number(categoryId) : (undefined as unknown as number),
        description,
        amount: amount ? Number(amount) : (undefined as unknown as number),
        method,
      });
      if (r.success) {
        // Keep the date: a kasir usually enters several expenses for one day.
        setCategoryId(null);
        setDescription("");
        setAmount("");
        setMethod("cash");
      } else {
        setErrors(r.errors ?? {});
        setMessage(r.message ?? null);
      }
      // Refresh on failure too: an inactive category must drop out of the select.
      router.refresh();
    } catch {
      setMessage("Terjadi kesalahan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">Tambah Pengeluaran</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="expense-date">
            Tanggal
            <RequiredMark />
          </Label>
          <Input
            id="expense-date"
            type="date"
            max={todayWib()}
            className="h-11 text-base"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={pending}
          />
          {fieldError("date")}
        </div>
        <div className="space-y-1.5">
          <Label>
            Kategori
            <RequiredMark />
          </Label>
          <Select items={categoryItems} value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-11 w-full text-base" aria-label="Kategori">
              <SelectValue placeholder="Pilih kategori" />
            </SelectTrigger>
            <SelectContent>
              {categoryItems.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError("categoryId")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expense-description">
            Keterangan
            <RequiredMark />
          </Label>
          <Input
            id="expense-description"
            className="h-11 text-base"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={pending}
          />
          {fieldError("description")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expense-amount">
            Jumlah
            <RequiredMark />
          </Label>
          <CurrencyInput
            id="expense-amount"
            className="h-11 text-base"
            value={amount}
            onChange={setAmount}
            disabled={pending}
          />
          {fieldError("amount")}
        </div>
        <div className="space-y-1.5">
          <Label>
            Metode
            <RequiredMark />
          </Label>
          <Select items={methodItems} value={method} onValueChange={(v) => v && setMethod(v as PaymentMethod)}>
            <SelectTrigger className="h-11 w-full text-base" aria-label="Metode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {methodItems.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError("method")}
        </div>
      </div>
      {message && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" variant="success" className="h-11 text-base" disabled={pending}>
        <Plus />
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </form>
  );
}

export function ExpensesPage({
  rows,
  categories,
  period,
  from,
  to,
  role,
}: {
  rows: ExpenseRow[];
  categories: Category[];
  period: Period;
  from?: string;
  to?: string;
  role: Role;
}) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Pengeluaran</h1>
        {role === "superadmin" && <KelolaKategoriPengeluaranDialog categories={categories} />}
      </div>
      {role === "kasir" && <ExpenseForm categories={categories} />}
      <PeriodFilter period={period} from={from} to={to} />
      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Belum ada pengeluaran di periode ini."
          className="rounded-xl border bg-card"
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table className="text-base">
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead>Metode</TableHead>
                {role === "superadmin" && <TableHead>Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatDateId(r.date)}</TableCell>
                  <TableCell>{r.categoryName}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal">{r.description}</TableCell>
                  <TableCell className="text-right">{rupiah.format(r.amount)}</TableCell>
                  <TableCell>{PAYMENT_METHOD_LABELS[r.method]}</TableCell>
                  {role === "superadmin" && (
                    <TableCell>
                      <DeleteExpenseButton id={r.id} label={r.description} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="border-t px-4 py-3 text-right text-base font-semibold">
            Total periode ini: {rupiah.format(total)}
          </p>
        </div>
      )}
    </div>
  );
}
