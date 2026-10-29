"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/ui/currency-input";
import { RequiredMark } from "@/components/ui/required-mark";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { createPurchaseAction } from "./actions";
import { itemsTotal } from "./logic";
import { ProductPicker } from "./product-picker";
import { KelolaSupplierDialog } from "./kelola-supplier-dialog";
import type { ProductRow, SupplierOption } from "./queries";
import { PurchaseFields, PurchaseSchema, type PurchaseInput } from "./validation";

const STEPS = [
  { key: "info", label: "Info" },
  { key: "items", label: "Barang" },
  { key: "payment", label: "Pembayaran" },
  { key: "review", label: "Cek Lagi" },
];

type Line = { productId: number; qty: string; cost: string };

type FormState = {
  supplierId: number | null;
  date: string;
  notes: string;
  lines: Line[];
  payments: PaymentRow[];
};

const emptyForm = (): FormState => ({
  supplierId: null,
  date: todayWib(),
  notes: "",
  lines: [],
  payments: [{ method: "cash", amount: 0 }],
});

export function PurchaseWizard({
  products,
  suppliers,
}: {
  products: ProductRow[];
  suppliers: SupplierOption[];
}) {
  const router = useRouter();
  const wizard = useWizard(STEPS);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = new Map(products.map((p) => [p.id, p]));
  // Lines whose product vanished after a refresh are dropped from the purchase.
  const rows = form.lines.flatMap((l) => {
    const p = byId.get(l.productId);
    return p ? [{ p, qtyText: l.qty, qty: Number(l.qty) || 0, costText: l.cost, cost: Number(l.cost) || 0 }] : [];
  });
  const total = itemsTotal(rows.map((r) => ({ qty: r.qty, unitPrice: r.cost })));
  const supplierItems = suppliers.map((s) => ({ value: s.id, label: s.name }));
  const supplier = suppliers.find((s) => s.id === form.supplierId);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setLine = (productId: number, patch: Partial<Line>) =>
    set("lines", form.lines.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));

  function pick(p: ProductRow) {
    const has = form.lines.some((l) => l.productId === p.id);
    set(
      "lines",
      has
        ? form.lines.map((l) => (l.productId === p.id ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l))
        : [...form.lines, { productId: p.id, qty: "1", cost: "" }],
    );
  }

  function toInput(): PurchaseInput {
    return {
      supplierId: form.supplierId ?? undefined,
      date: form.date,
      notes: form.notes,
      items: rows.map((r) => ({ productId: r.p.id, qty: r.qty, unitCost: r.cost })),
      total,
      payments: form.payments,
    } as PurchaseInput;
  }

  function validateStep(key: string): boolean {
    let errs: Record<string, string[]> = {};
    if (key === "info") {
      const r = PurchaseFields.pick({ supplierId: true, date: true, notes: true }).safeParse(toInput());
      if (!r.success) errs = r.error.flatten().fieldErrors;
    } else if (key === "items") {
      if (rows.length === 0) errs = { items: ["Minimal satu barang."] };
      else if (rows.some((r) => r.qty < 1)) errs = { items: ["Jumlah minimal 1."] };
      else if (rows.some((r) => r.cost < 1)) errs = { items: ["Harga beli minimal 1."] };
    } else if (key === "payment") {
      const r = PurchaseSchema.safeParse(toInput());
      const pe = r.success ? undefined : r.error.flatten().fieldErrors.payments;
      if (pe) errs = { payments: pe };
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function submit() {
    setMessage(null);
    const r = PurchaseSchema.safeParse(toInput());
    if (!r.success) {
      setErrors(r.error.flatten().fieldErrors);
      return setMessage("Data belum lengkap, periksa langkah sebelumnya.");
    }
    startTransition(async () => {
      try {
        const result = await createPurchaseAction(toInput());
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
          <AlertDescription className="text-base">Pembelian {saved} tersimpan.</AlertDescription>
        </Alert>
      )}

      <div onKeyDown={onWizardEnterAdvance(handleNext)}>
        {wizard.step.key === "info" && (
          <WizardStep title="Info">
            <div className="space-y-1.5">
              <Label htmlFor="purchase-invoice">Invoice</Label>
              <Input id="purchase-invoice" className="h-11 text-base" value="Otomatis" disabled readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purchase-supplier">
                Supplier
                <RequiredMark />
              </Label>
              <div className="flex gap-2">
                <Select
                  items={supplierItems}
                  value={form.supplierId}
                  onValueChange={(v) => set("supplierId", v as number | null)}
                >
                  <SelectTrigger id="purchase-supplier" className="h-11 w-full flex-1 text-base">
                    <SelectValue placeholder="Pilih supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierItems.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <KelolaSupplierDialog suppliers={suppliers} />
              </div>
              {suppliers.length === 0 && (
                <p className="text-base text-muted-foreground">
                  Tambah supplier dulu lewat Kelola Supplier.
                </p>
              )}
              {fieldError("supplierId")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purchase-date">
                Tanggal
                <RequiredMark />
              </Label>
              <Input
                id="purchase-date"
                type="date"
                max={todayWib()}
                className="h-11 text-base"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
              {fieldError("date")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purchase-notes">Catatan</Label>
              <Input
                id="purchase-notes"
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
            <ProductPicker products={products} onPick={pick} showStock={false} />
            {rows.length > 0 && (
              <ul className="divide-y rounded-lg border">
                {rows.map((r) => (
                  <li key={r.p.id} className="flex flex-wrap items-center gap-2 p-3">
                    <div className="min-w-0 flex-1 basis-40 text-base">
                      <p className="truncate font-medium">{r.p.name}</p>
                      <p className="text-muted-foreground">
                        Stok {r.p.stock} {r.p.unit}
                      </p>
                    </div>
                    <Input
                      aria-label={`Jumlah ${r.p.name}`}
                      className="h-11 w-24 text-base"
                      inputMode="numeric"
                      value={r.qtyText}
                      onChange={(e) => setLine(r.p.id, { qty: e.target.value.replace(/\D/g, "") })}
                    />
                    <div className="w-40">
                      <CurrencyInput
                        className="h-11 text-base"
                        placeholder="Harga beli"
                        value={r.costText}
                        onChange={(v) => setLine(r.p.id, { cost: v })}
                      />
                    </div>
                    <p className="w-32 text-right text-base font-semibold">
                      {rupiah.format(r.qty * r.cost)}
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
              <dt className="text-muted-foreground">Supplier</dt>
              <dd>{supplier?.name ?? "-"}</dd>
              <dt className="text-muted-foreground">Tanggal</dt>
              <dd>{form.date}</dd>
              <dt className="text-muted-foreground">Catatan</dt>
              <dd>{form.notes.trim() || "-"}</dd>
            </dl>
            <ul className="divide-y rounded-lg border">
              {rows.map((r) => (
                <li key={r.p.id} className="flex justify-between gap-3 p-3 text-base">
                  <span>
                    {r.p.name} x {r.qty} {r.p.unit} @ {rupiah.format(r.cost)}
                  </span>
                  <span>{rupiah.format(r.qty * r.cost)}</span>
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
        submitLabel="Simpan Pembelian"
        pending={pending}
      />
    </div>
  );
}
