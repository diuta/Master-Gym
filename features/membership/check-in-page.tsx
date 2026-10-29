"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, ScanLine } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { checkInAction, lookupMemberAction } from "./actions";
import { AttendanceTable } from "./attendance-table";
import { STATUS_KIND } from "./members-page";
import type { TrainerOption } from "./queries";
import type { AttendanceRow, MemberSummary } from "./validation";

export function CheckInPage({
  today,
  trainers,
}: {
  today: AttendanceRow[];
  trainers: TrainerOption[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [member, setMember] = useState<MemberSummary | null>(null);

  // Runs after the dialog has unmounted, so the scanner's next Enter lands in the scan input.
  useEffect(() => {
    if (!member) inputRef.current?.focus();
  }, [member]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    setText("");
    if (q === "" || looking) return;
    setLooking(true);
    setError(null);
    try {
      const result = await lookupMemberAction(q);
      if (result.success) setMember(result.data);
      else setError(result.message ?? "Member tidak ditemukan.");
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLooking(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Absen</h1>

      <form onSubmit={handleLookup} className="max-w-xl space-y-2">
        <div className="relative">
          <ScanLine className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            autoFocus
            autoComplete="off"
            className="h-14 pl-13 text-xl md:text-xl"
            placeholder="Scan QR atau ketik No. HP"
            aria-label="Scan QR atau ketik No. HP"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        {error && <p className="text-base text-destructive">{error}</p>}
      </form>

      {member && (
        <CheckInDialog
          key={member.id}
          member={member}
          trainers={trainers}
          onClose={() => setMember(null)}
        />
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Absen Hari Ini</h2>
        <AttendanceTable rows={today} />
      </section>
    </div>
  );
}

function CheckInDialog({
  member,
  trainers,
  onClose,
}: {
  member: MemberSummary;
  trainers: TrainerOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const lockerRef = useRef<HTMLInputElement>(null);
  const [lockerNo, setLockerNo] = useState("");
  const [useTrainer, setUseTrainer] = useState(false);
  const [trainerId, setTrainerId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const expired = member.status === "expired";
  const trainerItems = trainers.map((t) => ({ value: String(t.id), label: t.name }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (expired || pending) return;
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      const result = await checkInAction({
        memberId: member.id,
        lockerNo,
        useTrainer,
        ...(useTrainer && trainerId && { trainerId: Number(trainerId) }),
      });
      if (result.success) {
        router.refresh();
        onClose();
        return;
      }
      setErrors(result.errors ?? {});
      setMessage(result.message ?? null);
    } catch {
      setMessage("Terjadi kesalahan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  const fieldError = (key: string) =>
    errors[key]?.[0] && <p className="text-base text-destructive">{errors[key][0]}</p>;

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent initialFocus={lockerRef} className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated upload route, not optimisable */}
            <img
              src={`/api/uploads/${member.photoPath}`}
              alt={`Foto ${member.name}`}
              className="size-48 shrink-0 rounded-lg border object-cover"
            />
            <div className="space-y-2 text-base">
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold">{member.name}</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground">{member.memberNo}</p>
              <p>{member.packageName}</p>
              <StatusBadge
                status={STATUS_KIND[member.status]}
                className="h-7 px-2.5 text-base [&>svg]:size-4!"
              />
              <p>
                {member.daysRemaining < 0
                  ? `Lewat ${-member.daysRemaining} hari`
                  : `Sisa ${member.daysRemaining} hari`}
              </p>
            </div>
          </div>

          {member.checkedInTodayAt && (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertDescription className="text-base text-foreground">
                Sudah check-in hari ini jam {member.checkedInTodayAt}
              </AlertDescription>
            </Alert>
          )}

          {!expired && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="check-in-locker">No. Loker</Label>
                <Input
                  ref={lockerRef}
                  id="check-in-locker"
                  autoComplete="off"
                  className="h-11 text-base"
                  value={lockerNo}
                  onChange={(e) => setLockerNo(e.target.value)}
                  disabled={pending}
                />
                {fieldError("lockerNo")}
              </div>

              {member.ptBalance > 0 && (
                <div className="space-y-1.5">
                  <Label className="flex h-11 items-center gap-3 text-base">
                    <Checkbox
                      checked={useTrainer}
                      onCheckedChange={(checked) => setUseTrainer(checked)}
                      disabled={pending}
                    />
                    Pakai PT sesi ini (sisa {member.ptBalance} sesi)
                  </Label>
                  {useTrainer && (
                    <>
                      <Label htmlFor="check-in-trainer">
                        Trainer
                        <RequiredMark />
                      </Label>
                      <Select
                        items={trainerItems}
                        value={trainerId}
                        onValueChange={(v) => setTrainerId(v)}
                        disabled={pending}
                      >
                        <SelectTrigger id="check-in-trainer" className="h-11 w-full text-base">
                          <SelectValue placeholder="Pilih trainer" />
                        </SelectTrigger>
                        <SelectContent>
                          {trainerItems.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldError("trainerId")}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {message && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription className="text-base">{message}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="h-11 text-base" disabled={expired || pending}>
              {pending ? "Menyimpan..." : "Check-In"}
            </Button>
            {expired && (
              <Button
                nativeButton={false}
                variant="success"
                className="h-11 text-base"
                render={<Link href={`/membership/payment?form=renew&member=${member.id}`} />}
              >
                Perpanjang
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-11 text-base"
              disabled={pending}
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
