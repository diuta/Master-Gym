"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Download, UserPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/required-mark";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatDateId, rupiah } from "@/lib/format";
import { registerMemberAction } from "./actions";
import { downloadMemberPdf } from "./member-pdf";
import { membershipEndDate, membershipPrice, paymentsMatchPrice, todayWib } from "./logic";
import { PaymentRows, type PaymentRow } from "./payment-rows";
import type { PackageOption } from "./queries";
import { WebcamCapture } from "./webcam-capture";
import {
  CATEGORY_LABELS,
  GENDER_LABELS,
  PAYMENT_METHOD_LABELS,
  RegisterMemberFields,
  type CategoryPrices,
  type Gender,
  type MemberCard,
  type MemberCategory,
  type RegisterMemberInput,
} from "./validation";

const STEPS = [
  { key: "personal", label: "Data Diri" },
  { key: "photo", label: "Foto" },
  { key: "package", label: "Paket & Bayar" },
  { key: "review", label: "Cek Lagi" },
];

const STEP_SCHEMAS = {
  personal: RegisterMemberFields.pick({
    name: true,
    phone: true,
    birthDate: true,
    gender: true,
    category: true,
  }),
  photo: RegisterMemberFields.pick({ photo: true }),
  package: RegisterMemberFields.pick({
    packageId: true,
    startDate: true,
    price: true,
    payments: true,
  }),
};
type StepKey = keyof typeof STEP_SCHEMAS;
const STEP_ORDER: StepKey[] = ["personal", "photo", "package"];

const PRICE_UNSET = "Harga belum diatur, hubungi superadmin.";

const GENDERS = Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }));
const CATEGORIES = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

type FormState = {
  name: string;
  phone: string;
  birthDate: string;
  gender: Gender | null;
  category: MemberCategory | null;
  photo: string | null;
  packageId: number | null;
  startDate: string;
  payments: PaymentRow[];
};

const emptyForm = (): FormState => ({
  name: "",
  phone: "",
  birthDate: "",
  gender: null,
  category: null,
  photo: null,
  packageId: null,
  // "" means today, resolved when read, so a tab left open overnight doesn't backdate.
  startDate: "",
  payments: [{ method: "cash", amount: 0 }],
});

// Missing values go to the schema as undefined so it reports "wajib diisi".
function toInput(f: FormState, price: number | null): RegisterMemberInput {
  return {
    name: f.name,
    phone: f.phone,
    birthDate: f.birthDate,
    gender: f.gender ?? undefined,
    category: f.category ?? undefined,
    photo: f.photo ?? "",
    packageId: f.packageId ?? undefined,
    startDate: f.startDate || todayWib(),
    price: price ?? undefined,
    payments: f.payments,
  } as RegisterMemberInput;
}

export function RegisterMemberWizard({
  packages,
  prices,
}: {
  packages: PackageOption[];
  prices: CategoryPrices;
}) {
  const wizard = useWizard(STEPS);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [card, setCard] = useState<MemberCard | null>(null);
  const [pending, startTransition] = useTransition();
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfError, setPdfError] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const priceOf = (f: Pick<FormState, "packageId" | "category">) => {
    const p = packages.find((x) => x.id === f.packageId);
    return p && f.category ? membershipPrice(prices[f.category], p.months) : null;
  };

  // Changing package or category collapses payments to one row of the new price.
  function setPricing(patch: Partial<Pick<FormState, "packageId" | "category">>) {
    setForm((f) => {
      const next = { ...f, ...patch };
      const p = priceOf(next);
      return p === null ? next : { ...next, payments: [{ method: "cash", amount: p }] };
    });
  }

  const pkg = packages.find((p) => p.id === form.packageId);
  const priceOrNull = priceOf(form);
  const price = priceOrNull ?? 0;
  const priceUnset = pkg !== undefined && form.category !== null && priceOrNull === null;
  const startDate = form.startDate || todayWib();
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  const endDate = pkg && validStart ? membershipEndDate(startDate, pkg.months) : null;
  const packageItems = packages.map((p) => ({ value: p.id, label: `${p.name} (${p.months} bulan)` }));

  function validateStep(key: StepKey): boolean {
    const input = toInput(form, priceOrNull);
    const r = STEP_SCHEMAS[key].safeParse(input);
    const errs: Record<string, string[]> = r.success ? {} : r.error.flatten().fieldErrors;
    // Harga has no input of its own; "Paket wajib dipilih" already covers a missing price.
    delete errs.price;
    if (priceUnset) errs.price = [PRICE_UNSET];
    if (key === "package" && !errs.payments && !paymentsMatchPrice(form.payments, price)) {
      errs.payments = ["Total pembayaran harus sama dengan harga."];
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function submit() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await registerMemberAction(toInput(form, priceOrNull));
        if (result.success) {
          setCard(result.data);
          return;
        }
        const errs = result.errors ?? {};
        setErrors(errs);
        setMessage(result.message ?? null);
        const owner = STEP_ORDER.find((k) =>
          Object.keys(errs).some((f) => f in STEP_SCHEMAS[k].shape),
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

  function resetAll() {
    setForm(emptyForm());
    setErrors({});
    setMessage(null);
    setCard(null);
    setPdfError(false);
    wizard.reset();
  }

  async function handlePdf() {
    if (!card) return;
    setPdfPending(true);
    setPdfError(false);
    try {
      await downloadMemberPdf(card);
    } catch {
      setPdfError(true);
    } finally {
      setPdfPending(false);
    }
  }

  const fieldError = (key: string) =>
    errors[key]?.[0] && <p className="text-base text-destructive">{errors[key][0]}</p>;

  return (
    <div className="max-w-2xl space-y-6 rounded-xl border bg-card p-4 sm:p-6">
      <WizardStepIndicator steps={STEPS} currentIndex={wizard.index} />

      <div onKeyDown={onWizardEnterAdvance(handleNext)}>
        {wizard.step.key === "personal" && (
          <WizardStep title="Data Diri">
            <div className="space-y-1.5">
              <Label htmlFor="member-no">Nomor Member</Label>
              <Input id="member-no" className="h-11 text-base" value="Otomatis" readOnly disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-name">
                Nama
                <RequiredMark />
              </Label>
              <Input
                id="member-name"
                className="h-11 text-base"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
              {fieldError("name")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-phone">
                No. HP
                <RequiredMark />
              </Label>
              <Input
                id="member-phone"
                className="h-11 text-base"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
              {fieldError("phone")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-birth">Tanggal Lahir</Label>
              <Input
                id="member-birth"
                type="date"
                className="h-11 text-base"
                max={todayWib()}
                value={form.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
              />
              {fieldError("birthDate")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-gender">
                Jenis Kelamin
                <RequiredMark />
              </Label>
              <Select
                items={GENDERS}
                value={form.gender}
                onValueChange={(v) => set("gender", v as Gender | null)}
              >
                <SelectTrigger id="member-gender" className="h-11 w-full text-base">
                  <SelectValue placeholder="Pilih jenis kelamin" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("gender")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-category">
                Status
                <RequiredMark />
              </Label>
              <Select
                items={CATEGORIES}
                value={form.category}
                onValueChange={(v) => setPricing({ category: v as MemberCategory | null })}
              >
                <SelectTrigger id="member-category" className="h-11 w-full text-base">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("category")}
            </div>
          </WizardStep>
        )}

        {wizard.step.key === "photo" && (
          <WizardStep title="Foto" description="Ambil foto member dengan webcam.">
            <WebcamCapture value={form.photo} onChange={(v) => set("photo", v)} />
            {fieldError("photo")}
          </WizardStep>
        )}

        {wizard.step.key === "package" && (
          <WizardStep title="Paket & Bayar">
            <div className="space-y-1.5">
              <Label htmlFor="member-package">
                Paket
                <RequiredMark />
              </Label>
              <Select
                items={packageItems}
                value={form.packageId}
                onValueChange={(v) => setPricing({ packageId: v as number | null })}
              >
                <SelectTrigger id="member-package" className="h-11 w-full text-base">
                  <SelectValue placeholder="Pilih paket" />
                </SelectTrigger>
                <SelectContent>
                  {packageItems.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("packageId")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-start">
                Tanggal Mulai
                <RequiredMark />
              </Label>
              <Input
                id="member-start"
                type="date"
                className="h-11 text-base"
                max={todayWib()}
                value={startDate}
                onChange={(e) => set("startDate", e.target.value)}
              />
              {endDate && (
                <p className="text-base text-muted-foreground">
                  Berlaku s/d {formatDateId(endDate)}
                </p>
              )}
              {fieldError("startDate")}
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Harga</p>
              <p className="text-2xl font-semibold">
                {priceOrNull === null ? "-" : rupiah.format(priceOrNull)}
              </p>
              {priceUnset && <p className="text-base text-destructive">{PRICE_UNSET}</p>}
            </div>
            {priceOrNull !== null && (
              <div className="space-y-1.5">
                <Label>
                  Pembayaran
                  <RequiredMark />
                </Label>
                <PaymentRows
                  price={price}
                  value={form.payments}
                  onChange={(rows) => set("payments", rows)}
                />
                {fieldError("payments")}
              </div>
            )}
          </WizardStep>
        )}

        {wizard.step.key === "review" && (
          <WizardStep title="Cek Lagi" description="Pastikan semua data sudah benar.">
            <div className="flex flex-col gap-4 sm:flex-row">
              {form.photo && (
                // eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise
                <img
                  src={form.photo}
                  alt="Foto member"
                  className="h-40 w-40 shrink-0 rounded-lg border object-cover"
                />
              )}
              <dl className="grid flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-base">
                <dt className="text-muted-foreground">Nomor Member</dt>
                <dd>Otomatis</dd>
                <dt className="text-muted-foreground">Nama</dt>
                <dd className="font-medium">{form.name}</dd>
                <dt className="text-muted-foreground">No. HP</dt>
                <dd>{form.phone}</dd>
                <dt className="text-muted-foreground">Tanggal Lahir</dt>
                <dd>{form.birthDate ? formatDateId(form.birthDate) : "-"}</dd>
                <dt className="text-muted-foreground">Jenis Kelamin</dt>
                <dd>{form.gender && GENDER_LABELS[form.gender]}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd>{form.category && CATEGORY_LABELS[form.category]}</dd>
                <dt className="text-muted-foreground">Paket</dt>
                <dd>{pkg && `${pkg.name} (${pkg.months} bulan)`}</dd>
                <dt className="text-muted-foreground">Masa Berlaku</dt>
                <dd>
                  {endDate && `${formatDateId(startDate)} s/d ${formatDateId(endDate)}`}
                </dd>
                <dt className="text-muted-foreground">Harga</dt>
                <dd className="font-semibold">{rupiah.format(price)}</dd>
                <dt className="text-muted-foreground">Pembayaran</dt>
                <dd>
                  {form.payments.map((p, i) => (
                    <div key={i}>
                      {PAYMENT_METHOD_LABELS[p.method]} {rupiah.format(p.amount)}
                    </div>
                  ))}
                </dd>
              </dl>
            </div>
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
        submitLabel="Daftarkan & Buat QR"
        pending={pending}
      />

      <Dialog open={card !== null} onOpenChange={(open) => !open && resetAll()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Member berhasil didaftarkan</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2 text-center">
            <p className="text-4xl font-bold tracking-wide">{card?.memberNo}</p>
            <p className="text-lg">{card?.name}</p>
          </div>
          {pdfError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription className="text-base">PDF gagal dibuat, coba lagi.</AlertDescription>
            </Alert>
          )}
          <Button type="button" size="xl" onClick={handlePdf} disabled={pdfPending}>
            <Download />
            {pdfPending ? "Membuat PDF..." : "Unduh PDF"}
          </Button>
          <Button type="button" variant="outline" size="xl" onClick={resetAll}>
            <UserPlus />
            Daftar Member Lain
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
