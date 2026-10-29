"use client";

import { AlertTriangle, CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rupiah } from "@/lib/format";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "./validation";

export type PaymentRow = { method: PaymentMethod; amount: number };

const METHODS = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
  value: value as PaymentMethod,
  label,
}));

export function PaymentRows({
  price,
  value,
  onChange,
}: {
  price: number;
  value: PaymentRow[];
  onChange: (rows: PaymentRow[]) => void;
}) {
  const total = value.reduce((s, r) => s + r.amount, 0);
  const diff = total - price;

  const update = (i: number, patch: Partial<PaymentRow>) =>
    onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      {value.map((row, i) => (
        <div key={i} className="flex items-start gap-2">
          <Select
            items={METHODS}
            value={row.method}
            onValueChange={(m) => m && update(i, { method: m as PaymentMethod })}
          >
            <SelectTrigger
              aria-label={`Metode pembayaran ${i + 1}`}
              className="h-11 w-36 shrink-0 text-base"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1">
            <CurrencyInput
              className="h-11 text-base"
              value={row.amount ? String(row.amount) : ""}
              onChange={(raw) => update(i, { amount: raw === "" ? 0 : Number(raw) })}
            />
          </div>
          {value.length > 1 && (
            <Button
              type="button"
              variant="outline"
              className="size-11"
              aria-label="Hapus metode"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="h-11 text-base"
        onClick={() =>
          onChange([...value, { method: "qris", amount: Math.max(price - total, 0) }])
        }
      >
        <Plus />
        Tambah metode
      </Button>

      <p className="text-base">
        Total dibayar <span className="font-semibold">{rupiah.format(total)}</span>
      </p>
      {diff < 0 ? (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertDescription className="text-base">Kurang {rupiah.format(-diff)}</AlertDescription>
        </Alert>
      ) : diff > 0 ? (
        <Alert variant="destructive">
          <XCircle />
          <AlertDescription className="text-base">Lebih {rupiah.format(diff)}</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="success">
          <CheckCircle2 />
          <AlertDescription className="text-base">Pas</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
