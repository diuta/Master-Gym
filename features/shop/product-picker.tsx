"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { rupiah } from "@/lib/format";
import type { ProductRow } from "./queries";

const MAX_SHOWN = 8;

export function ProductPicker({
  products,
  onPick,
  showStock,
}: {
  products: ProductRow[];
  onPick: (p: ProductRow) => void;
  showStock: boolean;
}) {
  const [text, setText] = useState("");
  const q = text.trim().toLowerCase();
  const matches = q
    ? products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, MAX_SHOWN)
    : [];
  // A sale can't pick what it can't sell; a purchase can restock anything.
  const pickable = (p: ProductRow) => !showStock || p.stock > 0;

  function pick(p: ProductRow) {
    if (!pickable(p)) return;
    onPick(p);
    setText("");
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
        <Input
          aria-label="Cari produk"
          className="h-11 pl-9 text-base"
          placeholder="Ketik nama produk"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // Keep Enter from advancing the wizard while searching.
            e.preventDefault();
            e.stopPropagation();
            const first = matches.find(pickable);
            if (first) pick(first);
          }}
        />
      </div>
      {q && matches.length === 0 && (
        <p className="text-base text-muted-foreground">Produk tidak ditemukan.</p>
      )}
      {matches.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={!pickable(p)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 p-2 text-left text-base hover:bg-muted focus-visible:bg-muted",
                  !pickable(p) && "cursor-not-allowed opacity-50 hover:bg-transparent",
                )}
                onClick={() => pick(p)}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                {showStock && (
                  <span className="text-muted-foreground">
                    {p.stock > 0 ? `Stok ${p.stock} ${p.unit}` : "Stok habis"}
                  </span>
                )}
                <span>{rupiah.format(p.salePrice)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
