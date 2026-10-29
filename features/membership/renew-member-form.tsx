"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { formatDateId, rupiah } from "@/lib/format";
import { renewMemberAction } from "./actions";
import { membershipEndDate, membershipPrice, renewalStartDate, todayWib } from "./logic";
import { downloadMemberPdf } from "./member-pdf";
import { MemberSearch } from "./member-search";
import { STATUS_KIND } from "./members-page";
import { PaymentRows, type PaymentRow } from "./payment-rows";
import type { PackageOption } from "./queries";
import {
  CATEGORY_LABELS,
  GENDER_LABELS,
  RenewMemberSchema,
  type CategoryPrices,
  type MemberCard,
  type MemberCategory,
  type MemberSummary,
  type RenewMemberInput,
} from "./validation";

const PRICE_UNSET = "Harga belum diatur, hubungi superadmin.";
const CATEGORIES = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

export function RenewMemberForm({
  packages,
  prices,
  initialMember,
}: {
  packages: PackageOption[];
  prices: CategoryPrices;
  initialMember: MemberSummary | null;
}) {
  const [member, setMember] = useState<MemberSummary | null>(initialMember);
  const [category, setCategory] = useState<MemberCategory | null>(
    initialMember?.category ?? null,
  );
  const [packageId, setPackageId] = useState<number | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([{ method: "cash", amount: 0 }]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [card, setCard] = useState<MemberCard | null>(null);
  const [pdfError, setPdfError] = useState(false);
  const [pdfPending, setPdfPending] = useState(false);
  const [pending, startTransition] = useTransition();

  const pkg = packages.find((p) => p.id === packageId);
  const base = category ? prices[category] : undefined;
  const price = pkg && category ? membershipPrice(base, pkg.months) : null;
  const priceUnset = !!pkg && !!category && price === null;
  const packageItems = packages.map((p) => ({ value: p.id, label: `${p.name} (${p.months} bulan)` }));
  const newStart = member ? renewalStartDate(member.endDate, todayWib()) : null;
  const newEnd = newStart && pkg ? membershipEndDate(newStart, pkg.months) : null;

  // Status or Paket changed: payments collapse to one row of the new price.
  function setPricing(next: { category?: MemberCategory | null; packageId?: number | null }) {
    const c = next.category !== undefined ? next.category : category;
    const id = next.packageId !== undefined ? next.packageId : packageId;
    if (next.category !== undefined) setCategory(c);
    if (next.packageId !== undefined) setPackageId(id);
    const months = packages.find((p) => p.id === id)?.months;
    const p = c && months ? membershipPrice(prices[c], months) : null;
    if (p !== null) setPayments([{ method: "cash", amount: p }]);
  }

  function pickMember(m: MemberSummary | null) {
    setMember(m);
    setCategory(m?.category ?? null);
    setPackageId(null);
    setPayments([{ method: "cash", amount: 0 }]);
    setErrors({});
    setMessage(null);
  }

  function reset() {
    pickMember(null);
    setCard(null);
    setPdfError(false);
  }

  function submit() {
    if (pending || !member) return;
    setMessage(null);
    if (priceUnset) return setErrors({ price: [PRICE_UNSET] });
    const input = {
      memberId: member.id,
      category: category ?? undefined,
      packageId: packageId ?? undefined,
      price: price ?? undefined,
      payments,
    } as RenewMemberInput;
    const r = RenewMemberSchema.safeParse(input);
    if (!r.success) {
      const errs = r.error.flatten().fieldErrors;
      // Harga has no input of its own; "Paket wajib dipilih" already covers a missing price.
      delete errs.price;
      return setErrors(errs);
    }
    setErrors({});
    startTransition(async () => {
      try {
        const result = await renewMemberAction(input);
        if (result.success) return setCard(result.data);
        setErrors(result.errors ?? {});
        setMessage(result.message ?? null);
      } catch {
        setMessage("Terjadi kesalahan. Coba lagi.");
      }
    });
  }

  async function handlePdf() {
    if (!card) return;
    setPdfError(false);
    setPdfPending(true);
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
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated upload route, not optimisable */}
            <img
              src={`/api/uploads/${member.photoPath}`}
              alt={`Foto ${member.name}`}
              className="size-32 shrink-0 rounded-lg border object-cover"
            />
            <dl className="space-y-1 text-base">
              <dd className="text-xl font-semibold">{member.name}</dd>
              <dd className="text-muted-foreground">{member.memberNo}</dd>
              <dd>
                Lahir: {member.birthDate ? formatDateId(member.birthDate) : "-"} ·{" "}
                {GENDER_LABELS[member.gender]}
              </dd>
              <dd>{member.phone}</dd>
            </dl>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-base">
            <span>
              Paket sekarang: {member.packageName} · berakhir {formatDateId(member.endDate)}
            </span>
            <StatusBadge status={STATUS_KIND[member.status]} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="renew-category">
              Status
              <RequiredMark />
            </Label>
            <Select
              items={CATEGORIES}
              value={category}
              onValueChange={(v) => setPricing({ category: v as MemberCategory | null })}
            >
              <SelectTrigger id="renew-category" className="h-11 w-full text-base">
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
          <div className="space-y-1.5">
            <Label htmlFor="renew-package">
              Paket
              <RequiredMark />
            </Label>
            <Select
              items={packageItems}
              value={packageId}
              onValueChange={(v) => setPricing({ packageId: v as number | null })}
            >
              <SelectTrigger id="renew-package" className="h-11 w-full text-base">
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
            {newStart && newEnd && (
              <p className="text-base text-muted-foreground">
                Periode baru: {formatDateId(newStart)} s/d {formatDateId(newEnd)}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Harga</p>
            <p className="text-2xl font-semibold">{price === null ? "-" : rupiah.format(price)}</p>
            {(priceUnset || errors.price) && (
              <p className="text-base text-destructive">{PRICE_UNSET}</p>
            )}
          </div>
          {price !== null && (
            <div className="space-y-1.5">
              <Label>
                Pembayaran
                <RequiredMark />
              </Label>
              <PaymentRows price={price} value={payments} onChange={setPayments} />
              {fieldError("payments")}
            </div>
          )}

          {message && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription className="text-base">{message}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" size="xl" disabled={pending || priceUnset}>
            {pending ? "Menyimpan..." : "Perpanjang"}
          </Button>
        </>
      )}

      <Dialog open={card !== null} onOpenChange={(open) => !open && reset()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Membership diperpanjang</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 py-2 text-center">
            <p className="text-lg">{card?.name}</p>
            <p className="text-base text-muted-foreground">Berlaku s/d</p>
            <p className="text-2xl font-bold">{card && formatDateId(card.endDate)}</p>
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
          <Button type="button" variant="outline" size="xl" onClick={reset}>
            Selesai
          </Button>
        </DialogContent>
      </Dialog>
    </form>
  );
}
