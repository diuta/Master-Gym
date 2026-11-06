"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import { buyPtAction } from "./actions";
import { MemberSearch } from "./member-search";
import { PaymentRows, type PaymentRow } from "./payment-rows";
import type { CorporatePackageOption } from "@/features/corporate/queries";
import { CorporateSaleForm } from "@/features/corporate/corporate-sale-form";
import { KelolaTrainerPaketTambahanDialog } from "./kelola-trainer-paket-tambahan-dialog";
import type { PtProgramOption, TrainerOption } from "./queries";
import { PtPurchaseSchema, type MemberSummary, type PtPurchaseInput } from "./validation";

export function PtAddonForm({
  programs,
  trainers,
  corporatePackages,
  initialMember,
}: {
  programs: PtProgramOption[];
  trainers: TrainerOption[];
  corporatePackages: CorporatePackageOption[];
  initialMember: MemberSummary | null;
}) {
  const [mode, setMode] = useState<"pt" | "corporate">("pt");
  const [member, setMember] = useState<MemberSummary | null>(initialMember);
  const [programId, setProgramId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<number | null>(null);
  const [price, setPriceState] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: "cash", amount: 0 }]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const items = programs.map((p) => ({ value: p.id, label: `${p.name} — ${p.sessions} sesi` }));

  function reset() {
    setMember(null);
    setProgramId(null);
    setSessions(null);
    setPriceState(null);
    setPayments([{ method: "cash", amount: 0 }]);
    setErrors({});
  }

  function pickMember(m: MemberSummary | null) {
    reset();
    setMember(m);
    setMessage(null);
    setBalance(null);
  }

  function pickProgram(id: number | null) {
    setProgramId(id);
    // A different Program refills Sesi and Harga from the list, overwriting manual edits.
    const p = programs.find((x) => x.id === id);
    setSessions(p?.sessions ?? null);
    setPriceState(p?.price ?? null);
    if (p) setPayments([{ method: "cash", amount: p.price }]);
  }

  // One payment row simply follows Harga; several rows stay as the kasir typed them.
  function setPrice(p: number | null) {
    setPriceState(p);
    if (payments.length === 1) setPayments([{ ...payments[0], amount: p ?? 0 }]);
  }

  // A program deleted in the pop-up must not stay selected.
  if (programId !== null && !programs.some((p) => p.id === programId)) {
    setProgramId(null);
    setSessions(null);
    setPriceState(null);
    setPayments([{ method: "cash", amount: 0 }]);
  }

  function submit() {
    if (pending || !member) return;
    setMessage(null);
    setBalance(null);
    const input = {
      memberId: member.id,
      ptProgramId: programId ?? undefined,
      sessions: sessions ?? undefined,
      price: price ?? undefined,
      payments,
    } as PtPurchaseInput;
    const r = PtPurchaseSchema.safeParse(input);
    if (!r.success) {
      return setErrors(r.error.flatten().fieldErrors);
    }
    setErrors({});
    startTransition(async () => {
      try {
        const result = await buyPtAction(input);
        if (result.success) {
          reset();
          return setBalance(result.data.ptBalance);
        }
        setErrors(result.errors ?? {});
        setMessage(result.message ?? null);
      } catch {
        setMessage("Terjadi kesalahan. Coba lagi.");
      }
    });
  }

  const fieldError = (key: string) =>
    errors[key]?.[0] && <p className="text-base text-destructive">{errors[key][0]}</p>;

  return (
    // The pop-up has its own forms and sits outside this one: React submit events bubble
    // through portals.
    <div className="max-w-2xl space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <KelolaTrainerPaketTambahanDialog
        trainers={trainers}
        programs={programs}
        corporatePackages={corporatePackages}
      />
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["pt", "Personal Trainer"],
            ["corporate", "Corporate"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={mode === value ? "default" : "outline"}
            className="h-11 text-base"
            onClick={() => setMode(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      {mode === "corporate" && <CorporateSaleForm packages={corporatePackages} />}
      <form
        className={mode === "pt" ? "space-y-4" : "hidden"}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <MemberSearch value={member} onChange={pickMember} />
        {fieldError("memberId")}

        {member && (
          <>
            <div className="space-y-1 text-base">
              <p className="text-xl font-semibold">{member.name}</p>
              <p className="text-muted-foreground">{member.memberNo}</p>
              <p>Sisa sesi PT: {member.ptBalance}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pt-program">
                Program PT
                <RequiredMark />
              </Label>
              <Select items={items} value={programId} onValueChange={(v) => pickProgram(v as number | null)}>
                <SelectTrigger id="pt-program" className="h-11 w-full text-base">
                  <SelectValue placeholder="Pilih program" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("ptProgramId")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt-sessions">
                Sesi
                <RequiredMark />
              </Label>
              <Input
                id="pt-sessions"
                className="h-11 text-base"
                inputMode="numeric"
                value={sessions === null ? "" : String(sessions)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                  setSessions(digits === "" ? null : Number(digits));
                }}
              />
              {fieldError("sessions")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pt-price">
                Harga
                <RequiredMark />
              </Label>
              <CurrencyInput
                id="pt-price"
                className="h-11 text-base"
                value={price === null ? "" : String(price)}
                onChange={(raw) => setPrice(raw === "" ? null : Number(raw))}
              />
              {fieldError("price")}
            </div>
            {programId !== null && (
              <div className="space-y-1.5">
                <Label>
                  Pembayaran
                  <RequiredMark />
                </Label>
                <PaymentRows price={price ?? 0} value={payments} onChange={setPayments} />
                {fieldError("payments")}
              </div>
            )}

            {message && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription className="text-base">{message}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" size="xl" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan Add-On"}
            </Button>
          </>
        )}
      </form>

      {!member && message && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="text-base">{message}</AlertDescription>
        </Alert>
      )}
      {balance !== null && (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertDescription className="text-base">
            PT tersimpan. Sisa sesi sekarang {balance}.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
