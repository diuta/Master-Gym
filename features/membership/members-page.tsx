"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Download, Eye, Pencil, Search, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge, type StatusKind } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateId, formatTimeWib } from "@/lib/format";
import { useSort } from "@/hooks/use-sort";
import { EditMemberDialog } from "./edit-member-dialog";
import { MemberDetailDialog } from "./member-detail-dialog";
import { downloadMemberPdf } from "./member-pdf";
import { normalizePhone, todayWib } from "./logic";
import type { MemberRow, VisitorRow } from "./queries";
import type { MembershipStatus } from "./validation";

export const STATUS_KIND: Record<MembershipStatus, StatusKind> = {
  active: "member_active",
  expiring: "member_expiring",
  expired: "member_expired",
};

type Filter = MembershipStatus | "all" | "visitor";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "expiring", label: "Habis ≤ 7 Hari" },
  { value: "expired", label: "Sudah Habis" },
  { value: "visitor", label: "Visitor" },
];

function sortValue(m: MemberRow, key: string): string | number {
  if (key === "daysRemaining") return m.daysRemaining;
  if (key === "totalCheckIns") return m.totalCheckIns;
  if (key === "name") return m.name;
  return m.memberNo;
}

export function MembersPage({ members, visitors }: { members: MemberRow[]; visitors: VisitorRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [viewing, setViewing] = useState<MemberRow | null>(null);
  const [pdfPendingId, setPdfPendingId] = useState<number | null>(null);
  const [pdfError, setPdfError] = useState(false);

  // shortcut: all members loaded and filtered in the browser, fine for a few thousand; paginate on the server past that
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Phones are stored normalised (08...), so "0812-3456" and "+62 812..." must match too.
    const digits = q.replace(/[\s.-]/g, "");
    const phoneQ = normalizePhone(q) ?? digits;
    return members.filter(
      (m) =>
        (filter === "all" || filter === "visitor" || m.status === filter) &&
        (q === "" ||
          m.name.toLowerCase().includes(q) ||
          (phoneQ !== "" && m.phone.includes(phoneQ)) ||
          m.memberNo.toLowerCase().includes(q)),
    );
  }, [members, query, filter]);
  const { sortedRows, sort, toggleSort } = useSort(filtered, sortValue);

  const filteredVisitors = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/[\s.-]/g, "");
    const phoneQ = normalizePhone(q) ?? digits;
    return visitors.filter(
      (v) =>
        q === "" || v.name.toLowerCase().includes(q) || (phoneQ !== "" && v.phone.includes(phoneQ)),
    );
  }, [visitors, query]);
  const showVisitors = filter === "visitor";

  async function handlePdf(m: MemberRow) {
    setPdfPendingId(m.id);
    setPdfError(false);
    try {
      await downloadMemberPdf(m);
    } catch {
      setPdfError(true);
    } finally {
      setPdfPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Data Member</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9 text-base"
            placeholder={showVisitors ? "Cari nama atau No. HP" : "Cari nama, No. HP, atau nomor member"}
            aria-label="Cari nama, No. HP, atau nomor member"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter status">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              type="button"
              variant={filter === f.value ? "default" : "outline"}
              className="h-11 text-base"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {pdfError && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription className="text-base">PDF gagal dibuat, coba lagi.</AlertDescription>
        </Alert>
      )}

      {showVisitors ? (
        filteredVisitors.length === 0 ? (
          <EmptyState
            icon={Users}
            title={visitors.length === 0 ? "Belum ada visitor" : "Visitor tidak ditemukan"}
            description={
              visitors.length === 0
                ? "Visitor tercatat lewat menu Pembayaran."
                : "Coba kata kunci lain."
            }
            className="rounded-xl border bg-card"
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table className="text-base">
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>No. HP</TableHead>
                  <TableHead>Jumlah Kunjungan</TableHead>
                  <TableHead>Kunjungan Terakhir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVisitors.map((v) => (
                  <TableRow key={v.phone}>
                    <TableCell className="font-medium">{v.name}</TableCell>
                    <TableCell>{v.phone}</TableCell>
                    <TableCell>{v.visits}</TableCell>
                    <TableCell>
                      {formatDateId(todayWib(v.lastVisitAt))} {formatTimeWib(v.lastVisitAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      ) : sortedRows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={members.length === 0 ? "Belum ada member" : "Member tidak ditemukan"}
          description={
            members.length === 0
              ? "Daftarkan member baru lewat menu Pembayaran."
              : "Coba kata kunci atau filter status lain."
          }
          className="rounded-xl border bg-card"
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table className="text-base">
            <TableHeader>
              <TableRow>
                <SortableTh sortKey="memberNo" sort={sort} onSort={toggleSort}>
                  Nomor Member
                </SortableTh>
                <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>
                  Nama
                </SortableTh>
                <TableHead>No. HP</TableHead>
                <TableHead>Paket</TableHead>
                <TableHead>Status</TableHead>
                <SortableTh sortKey="daysRemaining" sort={sort} onSort={toggleSort}>
                  Sisa Hari
                </SortableTh>
                <SortableTh sortKey="totalCheckIns" sort={sort} onSort={toggleSort}>
                  Total Kehadiran
                </SortableTh>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.memberNo}</TableCell>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m.phone}</TableCell>
                  <TableCell>{m.packageName}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={STATUS_KIND[m.status]}
                      className="h-7 px-2.5 text-base [&>svg]:size-4!"
                    />
                  </TableCell>
                  <TableCell>
                    {m.daysRemaining < 0
                      ? `Lewat ${-m.daysRemaining} hari`
                      : `${m.daysRemaining} hari`}
                  </TableCell>
                  <TableCell>{m.totalCheckIns}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={() => setViewing(m)}
                      >
                        <Eye />
                        Detail
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={() => setEditing(m)}
                      >
                        <Pencil />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        disabled={pdfPendingId !== null}
                        onClick={() => handlePdf(m)}
                      >
                        <Download />
                        {pdfPendingId === m.id ? "Membuat PDF..." : "Unduh PDF"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {viewing && (
        <MemberDetailDialog key={viewing.id} member={viewing} onClose={() => setViewing(null)} />
      )}
      {editing && (
        <EditMemberDialog key={editing.id} member={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
