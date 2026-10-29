"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/required-mark";
import { saveCategoryPricesAction } from "./actions";
import { KelolaPaketDialog } from "./kelola-paket-dialog";
import type { PackageOption } from "./queries";
import {
  CATEGORY_LABELS,
  type CategoryPrices,
  type MemberCategory,
} from "./validation";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as MemberCategory[];

export function PricingPage({
  packages,
  prices,
}: {
  packages: PackageOption[];
  prices: CategoryPrices;
}) {
  const router = useRouter();
  const [form, setForm] = useState(() =>
    Object.fromEntries(
      CATEGORIES.map((c) => [
        c,
        prices[c] === undefined ? "" : String(prices[c]),
      ]),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setMessage(null);
    setSaved(false);
    try {
      // Empty string must reach the schema as undefined so it reports "wajib diisi".
      const input = Object.fromEntries(
        CATEGORIES.map((c) => [
          c,
          form[c] === "" ? undefined : Number(form[c]),
        ]),
      ) as Record<MemberCategory, number>;
      const result = await saveCategoryPricesAction(input);
      if (result.success) {
        setSaved(true);
        router.refresh();
      } else {
        setErrors(result.errors ?? {});
        setMessage(result.message ?? null);
      }
    } catch {
      setMessage("Terjadi kesalahan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Pengaturan Harga</h1>
        <KelolaPaketDialog packages={packages} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-md space-y-4 rounded-xl border bg-card p-4 sm:p-6"
      >
        <div className="space-y-1">
          <p className="text-lg font-medium">Harga Dasar per Bulan</p>
          <p className="text-base text-muted-foreground">
            Harga paket = harga dasar status × jumlah bulan paket.
          </p>
        </div>
        {CATEGORIES.map((c) => (
          <div key={c} className="space-y-1.5">
            <Label htmlFor={`price-${c}`}>
              {CATEGORY_LABELS[c]}
              <RequiredMark />
            </Label>
            <CurrencyInput
              id={`price-${c}`}
              className="h-11 text-base"
              value={form[c]}
              onChange={(v) => setForm((f) => ({ ...f, [c]: v }))}
              disabled={pending}
            />
            {errors[c]?.[0] && (
              <p className="text-base text-destructive">{errors[c][0]}</p>
            )}
          </div>
        ))}
        {message && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription className="text-base">{message}</AlertDescription>
          </Alert>
        )}
        {saved && (
          <Alert>
            <CheckCircle2 />
            <AlertDescription className="text-base">
              Harga tersimpan.
            </AlertDescription>
          </Alert>
        )}
        <Button
          type="submit"
          variant="success"
          className="h-11 text-base"
          disabled={pending}
        >
          {pending ? "Menyimpan..." : "Simpan Harga"}
        </Button>
      </form>
    </div>
  );
}
