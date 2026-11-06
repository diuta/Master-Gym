"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
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
import { formatDateId } from "@/lib/format";
import { corporateCheckInAction } from "./actions";
import type { CorporateCheckInOption } from "./queries";

export function CorporateCheckInDialog({
  options,
  returnFocusTo,
  onClose,
}: {
  options: CorporateCheckInOption[];
  returnFocusTo: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [packageId, setPackageId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState("");
  const [phone, setPhone] = useState("");
  const [lockerNo, setLockerNo] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const items = options.map((o) => ({
    value: String(o.corporatePackageId),
    label: `${o.companyName} (paket ${o.packageQuota} visit) — sisa ${o.remaining} visit, s/d ${formatDateId(o.soonestEnd)}`,
  }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      const result = await corporateCheckInAction({
        // NaN fails z.number() and reports "Paket wajib dipilih."
        corporatePackageId: packageId ? Number(packageId) : NaN,
        employeeName,
        phone,
        lockerNo,
      });
      if (result.success) {
        router.refresh();
        onClose();
        return;
      }
      // The used-up company must leave the list.
      if (result.message === "Kuota corporate habis atau sudah berakhir.") router.refresh();
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
      <DialogContent finalFocus={returnFocusTo} className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Check-In Corporate</DialogTitle>
        </DialogHeader>
        {options.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={Building2}
              title="Belum ada paket corporate yang aktif."
              className="rounded-xl border bg-card"
            />
            <Button type="button" variant="outline" className="h-11 text-base" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="corp-company">
                Perusahaan
                <RequiredMark />
              </Label>
              <Select
                items={items}
                value={packageId}
                onValueChange={(v) => setPackageId(v)}
                disabled={pending}
              >
                <SelectTrigger id="corp-company" className="h-11 w-full text-base">
                  <SelectValue placeholder="Pilih perusahaan" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("corporatePackageId")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="corp-name">
                Nama Karyawan
                <RequiredMark />
              </Label>
              <Input
                id="corp-name"
                autoComplete="off"
                className="h-11 text-base"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                disabled={pending}
              />
              {fieldError("employeeName")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="corp-phone">No. HP</Label>
              <Input
                id="corp-phone"
                type="tel"
                autoComplete="off"
                className="h-11 text-base"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={pending}
              />
              {fieldError("phone")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="corp-locker">No. Loker</Label>
              <Input
                id="corp-locker"
                autoComplete="off"
                className="h-11 text-base"
                value={lockerNo}
                onChange={(e) => setLockerNo(e.target.value)}
                disabled={pending}
              />
              {fieldError("lockerNo")}
            </div>

            {message && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription className="text-base">{message}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="h-11 text-base" disabled={pending}>
                {pending ? "Menyimpan..." : "Check-In"}
              </Button>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
