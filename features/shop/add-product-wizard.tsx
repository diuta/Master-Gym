"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { rupiah } from "@/lib/format";
import { createProductAction } from "./actions";
import type { CategoryOption } from "./queries";
import { CreateProductSchema, ProductSchema, type CreateProductInput } from "./validation";

const STEPS = [
  { key: "basic", label: "Nama & Kategori" },
  { key: "stock", label: "Stok & Harga" },
  { key: "review", label: "Cek Lagi" },
];

const STEP_SCHEMAS = {
  basic: ProductSchema.pick({ name: true, categoryId: true, unit: true }),
  stock: ProductSchema.pick({ salePrice: true, minStock: true }),
};
type StepKey = keyof typeof STEP_SCHEMAS;
const STEP_ORDER: StepKey[] = ["basic", "stock"];

type FormState = {
  name: string;
  categoryId: number | null;
  unit: string;
  initialStock: string;
  costPrice: string;
  salePrice: string;
  minStock: string;
};

const emptyForm = (): FormState => ({
  name: "",
  categoryId: null,
  unit: "",
  initialStock: "0",
  costPrice: "",
  salePrice: "",
  minStock: "5",
});

// Empty string must reach the schema as undefined so it reports "wajib diisi".
const num = (s: string) => (s === "" ? undefined : Number(s));

function toInput(f: FormState): CreateProductInput {
  return {
    name: f.name,
    categoryId: f.categoryId ?? undefined,
    unit: f.unit,
    initialStock: num(f.initialStock),
    // Cost is optional without opening stock; the schema only requires it when stock > 0.
    costPrice: num(f.costPrice) ?? 0,
    salePrice: num(f.salePrice),
    minStock: num(f.minStock),
  } as CreateProductInput;
}

export function AddProductWizard({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const wizard = useWizard(STEPS);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const items = categories.map((c) => ({ value: c.id, label: c.name }));
  const category = categories.find((c) => c.id === form.categoryId);

  function reset() {
    setForm(emptyForm());
    setErrors({});
    setMessage(null);
    wizard.reset();
  }

  function validateStep(key: StepKey): boolean {
    const r = STEP_SCHEMAS[key].safeParse(toInput(form));
    let errs: Record<string, string[]> = r.success ? {} : r.error.flatten().fieldErrors;
    if (key === "stock") {
      // Stock/cost rules live in the full schema; surface only this step's fields.
      const full = CreateProductSchema.safeParse(toInput(form));
      if (!full.success) {
        const fe = full.error.flatten().fieldErrors;
        errs = { ...errs, ...Object.fromEntries(Object.entries(fe).filter(([k]) => ["initialStock", "costPrice"].includes(k))) };
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await createProductAction(toInput(form));
        if (result.success) {
          router.refresh();
          setOpen(false);
          reset();
          return;
        }
        const errs = result.errors ?? {};
        setErrors(errs);
        setMessage(result.message ?? null);
        const owner = STEP_ORDER.find((k) =>
          Object.keys(errs).some((f) => f in STEP_SCHEMAS[k].shape || (k === "stock" && (f === "initialStock" || f === "costPrice"))),
        );
        if (owner) wizard.goTo(STEPS.findIndex((s) => s.key === owner));
      } catch {
        setMessage("Terjadi kesalahan. Coba lagi.");
      }
    });
  }

  function handleNext() {
    if (pending) return;
    const key = wizard.step.key;
    if (key === "review") return submit();
    if (validateStep(key as StepKey)) {
      setMessage(null);
      wizard.goNext();
    }
  }

  function handleBack() {
    setErrors({});
    wizard.goBack();
  }

  const fieldError = (key: string) =>
    errors[key]?.[0] && <p className="text-base text-destructive">{errors[key][0]}</p>;
  const stockQty = Number(form.initialStock) || 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button className="h-11 text-base" />}>
        <Plus />
        Tambah Produk
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tambah Produk</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <WizardStepIndicator steps={STEPS} currentIndex={wizard.index} />

          <div onKeyDown={onWizardEnterAdvance(handleNext)}>
            {wizard.step.key === "basic" && (
              <WizardStep title="Nama & Kategori">
                <div className="space-y-1.5">
                  <Label htmlFor="product-name">
                    Nama Produk
                    <RequiredMark />
                  </Label>
                  <Input
                    id="product-name"
                    className="h-11 text-base"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                  {fieldError("name")}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="product-category">
                    Kategori
                    <RequiredMark />
                  </Label>
                  <Select
                    items={items}
                    value={form.categoryId}
                    onValueChange={(v) => set("categoryId", v as number | null)}
                  >
                    <SelectTrigger id="product-category" className="h-11 w-full text-base">
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {categories.length === 0 && (
                    <p className="text-base text-muted-foreground">
                      Tambah kategori dulu lewat Kelola Kategori.
                    </p>
                  )}
                  {fieldError("categoryId")}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="product-unit">
                    Satuan
                    <RequiredMark />
                  </Label>
                  <Input
                    id="product-unit"
                    className="h-11 text-base"
                    placeholder="botol, pcs, bungkus"
                    value={form.unit}
                    onChange={(e) => set("unit", e.target.value)}
                  />
                  {fieldError("unit")}
                </div>
              </WizardStep>
            )}

            {wizard.step.key === "stock" && (
              <WizardStep title="Stok & Harga">
                <div className="space-y-1.5">
                  <Label htmlFor="product-initial">Stok Awal</Label>
                  <Input
                    id="product-initial"
                    className="h-11 text-base"
                    inputMode="numeric"
                    value={form.initialStock}
                    onChange={(e) => set("initialStock", e.target.value.replace(/\D/g, ""))}
                  />
                  {fieldError("initialStock")}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="product-cost">
                    Harga Modal
                    {stockQty > 0 && <RequiredMark />}
                  </Label>
                  <CurrencyInput
                    id="product-cost"
                    className="h-11 text-base"
                    value={form.costPrice}
                    onChange={(v) => set("costPrice", v)}
                  />
                  {fieldError("costPrice")}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="product-price">
                    Harga Jual
                    <RequiredMark />
                  </Label>
                  <CurrencyInput
                    id="product-price"
                    className="h-11 text-base"
                    value={form.salePrice}
                    onChange={(v) => set("salePrice", v)}
                  />
                  {fieldError("salePrice")}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="product-min">
                    Stok Minimum
                    <RequiredMark />
                  </Label>
                  <Input
                    id="product-min"
                    className="h-11 text-base"
                    inputMode="numeric"
                    value={form.minStock}
                    onChange={(e) => set("minStock", e.target.value.replace(/\D/g, ""))}
                  />
                  {fieldError("minStock")}
                </div>
              </WizardStep>
            )}

            {wizard.step.key === "review" && (
              <WizardStep title="Cek Lagi" description="Pastikan semua data sudah benar.">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base">
                  <dt className="text-muted-foreground">Nama Produk</dt>
                  <dd className="font-medium">{form.name}</dd>
                  <dt className="text-muted-foreground">Kategori</dt>
                  <dd>{category?.name}</dd>
                  <dt className="text-muted-foreground">Satuan</dt>
                  <dd>{form.unit}</dd>
                  <dt className="text-muted-foreground">Stok Awal</dt>
                  <dd>
                    {stockQty} {form.unit}
                  </dd>
                  <dt className="text-muted-foreground">Harga Modal</dt>
                  <dd>{rupiah.format(stockQty > 0 ? Number(form.costPrice) : 0)}</dd>
                  <dt className="text-muted-foreground">Harga Jual</dt>
                  <dd className="font-semibold">{rupiah.format(Number(form.salePrice))}</dd>
                  <dt className="text-muted-foreground">Stok Minimum</dt>
                  <dd>{form.minStock}</dd>
                </dl>
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
            submitLabel="Simpan Produk"
            pending={pending}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
