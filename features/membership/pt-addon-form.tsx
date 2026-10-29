"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/required-mark";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rupiah } from "@/lib/format";
import { buyPtAction } from "./actions";
import { MemberSearch } from "./member-search";
import { PaymentRows, type PaymentRow } from "./payment-rows";
import type { PtProgramOption } from "./queries";
import { PtPurchaseSchema, type MemberSummary, type PtPurchaseInput } from "./validation";

export function PtAddonForm({
  programs,
  initialMember,
}: {
  programs: PtProgramOption[];
  initialMember: MemberSummary | null;
}) {
  const [member, setMember] = useState<MemberSummary | null>(initialMember);
  const [programId, setProgramId] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: "cash", amount: 0 }]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const program = programs.find((p) => p.id === programId);
  const items = programs.map((p) => ({ value: p.id, label: `${p.name} — ${p.sessions} sesi` }));

  function reset() {
    setMember(null);
    setProgramId(null);
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
    const p = programs.find((x) => x.id === id);
    if (p) setPayments([{ method: "cash", amount: p.price }]);
  }

  function submit() {
    if (pending || !member) return;
    setMessage(null);
    setBalance(null);
    const input = {
      memberId: member.id,
      ptProgramId: programId ?? undefined,
      price: program?.price,
      payments,
    } as PtPurchaseInput;
    const r = PtPurchaseSchema.safeParse(input);
    if (!r.success) {
      const errs = r.error.flatten().fieldErrors;
      // Harga has no input of its own; "Program PT wajib dipilih" already covers it.
      delete errs.price;
      return setErrors(errs);
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

  if (programs.length === 0) {
    return (
      <div className="max-w-2xl rounded-xl border bg-card p-4 text-base text-muted-foreground sm:p-6">
        Belum ada program PT, hubungi superadmin.
      </div>
    );
  }

  return (
    <form
      className="max-w-2xl space-y-4 rounded-xl border bg-card p-4 sm:p-6"
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
            <p className="text-sm font-medium">Harga</p>
            <p className="text-2xl font-semibold">{program ? rupiah.format(program.price) : "-"}</p>
            {program && <p className="text-base text-muted-foreground">+{program.sessions} sesi</p>}
          </div>
          {program && (
            <div className="space-y-1.5">
              <Label>
                Pembayaran
                <RequiredMark />
              </Label>
              <PaymentRows price={program.price} value={payments} onChange={setPayments} />
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
    </form>
  );
}
