"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { searchMembersAction } from "./actions";
import { normalizePhone } from "./logic";
import { STATUS_KIND } from "./members-page";
import type { MemberSummary } from "./validation";

function Thumb({ m }: { m: MemberSummary }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- auth-gated upload route, not optimisable
    <img
      src={`/api/uploads/${m.photoPath}`}
      alt={`Foto ${m.name}`}
      className="size-10 shrink-0 rounded-md border object-cover"
    />
  );
}

export function MemberSearch({
  value,
  onChange,
}: {
  value: MemberSummary | null;
  onChange: (m: MemberSummary | null) => void;
}) {
  const [text, setText] = useState("");
  const [results, setResults] = useState<MemberSummary[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(false);
  // Drops answers of searches that were superseded while in flight.
  const seq = useRef(0);

  async function run(q: string) {
    const mine = ++seq.current;
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    try {
      const found = await searchMembersAction(q);
      if (mine !== seq.current) return;
      setError(false);
      setSearched(true);
      // A scan or exact phone yields exactly one hit: no need to pick it by hand.
      if (found.length === 1 && (found[0].qrToken === q.trim() || found[0].phone === normalizePhone(q))) {
        select(found[0]);
        return;
      }
      setResults(found);
    } catch {
      if (mine === seq.current) setError(true);
    }
  }

  function select(m: MemberSummary | null) {
    seq.current++;
    setText("");
    setResults([]);
    setSearched(false);
    onChange(m);
  }

  useEffect(() => {
    if (value) return;
    const t = setTimeout(() => void run(text), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only reads the latest text
  }, [text, value]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
        <Thumb m={value} />
        <div className="min-w-0 flex-1 text-base">
          <p className="truncate font-medium">{value.name}</p>
          <p className="text-muted-foreground">{value.memberNo}</p>
        </div>
        <Button type="button" variant="outline" className="h-11" onClick={() => select(null)}>
          Ganti
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="member-search">Cari Member</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" />
        <Input
          id="member-search"
          className="h-11 pl-9 text-base"
          placeholder="Scan QR, no. HP, no. member atau nama"
          autoComplete="off"
          value={text}
          onChange={(e) => {
            // Results belong to the old text: drop them (and any in-flight answer) so Enter can't pick them.
            seq.current++;
            setResults([]);
            setSearched(false);
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            // Enter picks a single result straight away instead of waiting for the pause.
            if (results.length === 1) return select(results[0]);
            void run(text);
          }}
        />
      </div>
      {error && <p className="text-base text-destructive">Pencarian gagal, coba lagi.</p>}
      {searched && !error && results.length === 0 && (
        <p className="text-base text-muted-foreground">Member tidak ditemukan.</p>
      )}
      {results.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-3 p-2 text-left text-base hover:bg-muted focus-visible:bg-muted"
                onClick={() => select(m)}
              >
                <Thumb m={m} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.name}</span>
                  <span className="block text-muted-foreground">
                    {m.memberNo} · {m.phone}
                  </span>
                </span>
                <StatusBadge status={STATUS_KIND[m.status]} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
