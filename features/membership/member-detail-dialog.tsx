"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateId, formatTimeWib } from "@/lib/format";
import { memberDetailAction } from "./actions";
import { todayWib } from "./logic";
import type { MemberDetail, MemberRow } from "./queries";

export function MemberDetailDialog({ member, onClose }: { member: MemberRow; onClose: () => void }) {
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    memberDetailAction(member.id)
      .then((r) => {
        if (cancelled) return;
        if (r.success) setDetail(r.data);
        else setError(r.message ?? "Terjadi kesalahan. Coba lagi.");
      })
      .catch(() => !cancelled && setError("Terjadi kesalahan. Coba lagi."));
    return () => {
      cancelled = true;
    };
  }, [member.id]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {member.name} ({member.memberNo})
          </DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-base text-destructive">{error}</p>
        ) : !detail ? (
          <p className="text-base text-muted-foreground">Memuat...</p>
        ) : (
          <div className="space-y-4 text-base">
            <p className="font-medium">Sisa sesi PT: {detail.ptBalance}</p>
            {detail.checkIns.length === 0 ? (
              <p className="text-muted-foreground">Belum pernah check-in.</p>
            ) : (
              <Table className="text-base">
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jam</TableHead>
                    <TableHead>Loker</TableHead>
                    <TableHead>PT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.checkIns.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDateId(todayWib(c.at))}</TableCell>
                      <TableCell>{formatTimeWib(c.at)}</TableCell>
                      <TableCell>{c.lockerNo ?? "-"}</TableCell>
                      <TableCell>{c.trainerName ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
