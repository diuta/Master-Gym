"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MethodFilter as Value } from "./logic";

const OPTIONS: { value: Value; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
];

export function MethodFilter({ value }: { value: Value }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function push(method: string) {
    const next = new URLSearchParams(params.toString());
    next.set("method", method);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <Select items={OPTIONS} value={value} onValueChange={(v) => v && push(v)}>
      <SelectTrigger className="h-11 w-40 text-base" aria-label="Metode pembayaran">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
