"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/required-mark";
import {
  WizardNav,
  WizardStep,
  WizardStepIndicator,
  onWizardEnterAdvance,
  useWizard,
} from "@/components/ui/wizard";
import { todayWib } from "@/features/membership/logic";
import { PaymentRows, type PaymentRow } from "@/features/membership/payment-rows";
import { PAYMENT_METHOD_LABELS } from "@/features/membership/validation";
import { rupiah } from "@/lib/format";
import { createSaleAction } from "./actions";
import { itemsTotal } from "./logic";
import { ProductPicker } from "./product-picker";
import type { ProductRow } from "./queries";
import { SaleFields, SaleSchema, type SaleInput } from "./validation";

const STEPS = [
  { key: "info", label: "Info" },
  { key: "items", label: "Barang" },
  { key: "payment", label: "Pembayaran" },
  { key: "review", label: "Cek Lagi" },
];

type Line = { productId: number; qty: string };

type FormState = {
  buyerName: string;
  date: string;
  notes: string;
  lines: Line[];
  payments: PaymentRow[];
};

const emptyForm = (): FormState => ({
  buyerName: "",
  date: todayWib(),
  notes: "",
  lines: [],
  payments: [{ method: "cash", amount: 0 }],
});

export function SaleWizard({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const wizard = useWizard(STEPS);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = new Map(products.map((p) => [p.id, p]));
  // Lines whose product vanished after a refresh are dropped from the sale.
  const rows = form.lines.flatMap((l) => {
    const p = byId.get(l.productId);
    return p ? [{ p, qtyText: l.qty, qty: Number(l.qty) || 0 }] : [];
  });
  const total = itemsTotal(rows.map((r) => ({ qty: r.qty, unitPrice: r.p.salePrice })));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setQty = (productId: number, qty: string) =>
    set("lines", form.lines.map((l) => (l.productId === productId ? { ...l, qty } : l)));

  function pick(p: ProductRow) {
    const has = form.lines.some((l) => l.productId === p.id);
    set(
      "lines",
      has
        ? form.lines.map((l) => (l.productId === p.id ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l))
        : [...form.lines, { productId: p.id, qty: "1" }],
    );
  }

  const overStock = (r: (typeof rows)[number]) => r.qty > r.p.stock;

  function toInput(): SaleInput {
    return {
      buyerName: form.buyerName,
      date: form.date,
      notes: form.notes,
      items: rows.map((r) => ({ productId: r.p.id, qty: r.qty, unitPrice: r.p.salePrice })),
      total,
      payments: form.payments,
    };
  }

  function validateStep(key: string): boolean {
    let errs: Record<string, string[]> = {};
    if (key === "info") {
      const r = SaleFields.pick({ buyerName: true, date: true, notes: true }).safeParse(toInput());
      if (!r.success) errs = r.error.flatten().fieldErrors;
    } else if (key === "items") {
      if (rows.length === 0) errs = { items: ["Minimal satu barang."] };
      else if (rows.some((r) => r.qty < 1)) errs = { items: ["Jumlah minimal 1."] };
      else if (rows.some(overStock)) errs = { items: ["Ada barang yang melebihi stok."] };
    } else if (key === "payment") {
      const r = SaleSchema.safeParse(toInput());
      const pe = r.success ? undefined : r.error.flatten().fieldErrors.payments;
      if (pe) errs = { payments: pe };
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function submit() {
    setMessage(null);
    const r = SaleSchema.safeParse(toInput());
    if (!r.success) {
      setErrors(r.error.flatten().fieldErrors);
      return setMessage("Data belum lengkap, periksa langkah sebelumnya.");
    }
    startTransition(async () => {
      try {
        const result = await createSaleAction(toInput());
        if (result.success) {
          setSaved(result.data.invoiceNo);
          setForm(emptyForm());
          setErrors({});
          wizard.reset();
          router.refresh();
          return;
        }
        setErrors(result.errors ?? {});
        setMessage(
          result.message ??
            (result.errors ? "Data belum lengkap, periksa langkah sebelumnya." : null),
        );
      } catch {
        setMessage("Terjadi kesalahan. Coba lagi.");
      }
    });
  }

  function handleNext() {
    if (pending) return;
    const key = wizard.step.key;
    if (key === "review") return submit();
    if (!validateStep(key)) return;
    setMessage(null);
    setSaved(null);
    // Payment defaults to the whole total in cash; the cashier splits from there.
    // Keep a split the cashier already entered unless the total moved under it.
    if (key === "items" && form.payments.reduce((n, r) => n + r.amount, 0) !== total) {
      set("payments", [{ method: "cash", amount: total }]);
    }
    wizard.goNext();
  }

  function handleBack() {
    setErrors({});
    wizard.goBack();
  }

  const fieldError = (key: string) =>
    errors[key]?.[0] && <p className="text-base text-destructive">{errors[key][0]}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <WizardStepIndicator steps={STEPS} currentIndex={wizard.index} />

      {saved && (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertDescription className="text-base">Penjualan {saved} tersimpan.</AlertDescription>
        </Alert>
      )}

      <div onKeyDown={onWizardEnterAdvance(handleNext)}>
        {wizard.step.key === "info" && (
          <WizardStep title="Info">
            <div className="space-y-1.5">
              <Label htmlFor="sale-invoice">Invoice</Label>
              <Input id="sale-invoice" className="h-11 text-base" value="Otomatis" disabled readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale-buyer">Pembeli</Label>
              <Input
                id="sale-buyer"
                className="h-11 text-base"
                value={form.buyerName}
                onChange={(e) => set("buyerName", e.target.value)}
              />
              {fieldError("buyerName")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale-date">
                Tanggal
                <RequiredMark />
              </Label>
              <Input
                id="sale-date"
                type="date"
                max={todayWib()}
                className="h-11 text-base"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
              {fieldError("date")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sale-notes">Catatan</Label>
              <Input
                id="sale-notes"
                className="h-11 text-base"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
              {fieldError("notes")}
            </div>
          </WizardStep>
        )}

        {wizard.step.key === "items" && (
          <WizardStep title="Barang">
            <ProductPicker products={products} onPick={pick} showStock />
            {rows.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {rows.map((r) => (
                  <li key={r.p.id} className="space-y-1 p-3">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 text-base">
                        <p className="truncate font-medium">{r.p.name}</p>
                        <p className="text-muted-foreground">
                          {rupiah.format(r.p.salePrice)} / {r.p.unit}
                        </p>
                      </div>
                      <Input
                        aria-label={`Jumlah ${r.p.name}`}
                        className="h-11 w-24 text-base"
                        inputMode="numeric"
                        value={r.qtyText}
                        onChange={(e) => setQty(r.p.id, e.target.value.replace(/\D/g, ""))}
                      />
                      <p className="w-32 text-right text-base font-semibold">
                        {rupiah.format(r.qty * r.p.salePrice)}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="size-11"
                        aria-label={`Hapus ${r.p.name}`}
                        onClick={() => set("lines", form.lines.filter((l) => l.productId !== r.p.id))}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    {overStock(r) && (
                      <p className="text-base text-destructive">Stok tersedia {r.p.stock}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {fieldError("items")}
            <p className="text-lg">
              Total <span className="font-semibold">{rupiah.format(total)}</span>
            </p>
          </WizardStep>
        )}

        {wizard.step.key === "payment" && (
          <WizardStep title="Pembayaran" description={`Total ${rupiah.format(total)}`}>
            <PaymentRows
              price={total}
              value={form.payments}
              onChange={(p) => set("payments", p)}
            />
            {fieldError("payments")}
          </WizardStep>
        )}

        {wizard.step.key === "review" && (
          <WizardStep title="Cek Lagi" description="Pastikan semua data sudah benar.">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base">
              <dt className="text-muted-foreground">Pembeli</dt>
              <dd>{form.buyerName.trim() || "-"}</dd>
              <dt className="text-muted-foreground">Tanggal</dt>
              <dd>{form.date}</dd>
              <dt className="text-muted-foreground">Catatan</dt>
              <dd>{form.notes.trim() || "-"}</dd>
            </dl>
            <ul className="divide-y rounded-lg border">
              {rows.map((r) => (
                <li key={r.p.id} className="flex justify-between gap-3 p-3 text-base">
                  <span>
                    {r.p.name} x {r.qty} {r.p.unit}
                  </span>
                  <span>{rupiah.format(r.qty * r.p.salePrice)}</span>
                </li>
              ))}
            </ul>
            <p className="text-lg">
              Total <span className="font-semibold">{rupiah.format(total)}</span>
            </p>
            <ul className="text-base">
              {form.payments.map((p, i) => (
                <li key={i}>
                  {PAYMENT_METHOD_LABELS[p.method]}: {rupiah.format(p.amount)}
                </li>
              ))}
            </ul>
          </WizardStep>
        )}
      </div>

      {message && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="text-base">{message}</AlertDescription>
        </Alert>
      )}

      <WizardNav
        isFirst={wizard.isFirst}
        isLast={wizard.isLast}
        onBack={handleBack}
        onNext={handleNext}
        submitLabel="Simpan Penjualan"
        pending={pending}
      />
    </div>
  );
}
