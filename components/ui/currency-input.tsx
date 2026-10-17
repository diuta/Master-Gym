"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function formatDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}

export function CurrencyInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  placeholder,
  disabled,
  required,
  className,
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (raw: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const isControlled = value !== undefined;
  const [raw, setRaw] = useState(() => value ?? defaultValue ?? "");
  const [prevValue, setPrevValue] = useState(value);
  if (isControlled && value !== prevValue) {
    setPrevValue(value);
    setRaw(value ?? "");
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    if (!isControlled) setRaw(digits);
    onChange?.(digits);
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        Rp
      </span>
      <Input
        id={id}
        inputMode="numeric"
        value={formatDigits(raw)}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={cn("pl-8", className)}
      />
      {name && <input type="hidden" name={name} value={raw} />}
    </div>
  );
}
