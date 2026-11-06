"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCorporatePackageManager } from "@/features/corporate/kelola-paket-corporate-dialog";
import type { CorporatePackageOption } from "@/features/corporate/queries";
import { useProgramPtManager } from "./kelola-program-pt-dialog";
import { useTrainerManager } from "./kelola-trainer-dialog";
import type { PtProgramOption, TrainerOption } from "./queries";

type Section = "corporate" | "trainer" | "program";

const SECTIONS: { value: Section; label: string }[] = [
  { value: "corporate", label: "Paket Corporate" },
  { value: "trainer", label: "Data Trainer" },
  { value: "program", label: "Program Trainer" },
];

export function KelolaTrainerPaketTambahanDialog({
  trainers,
  programs,
  corporatePackages,
}: {
  trainers: TrainerOption[];
  programs: PtProgramOption[];
  corporatePackages: CorporatePackageOption[];
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<Section>("corporate");
  const trainer = useTrainerManager({ trainers });
  const program = useProgramPtManager({ programs });
  const corporate = useCorporatePackageManager({ packages: corporatePackages });
  const active = { corporate, trainer, program }[section];

  function reset() {
    trainer.resetForm();
    program.resetForm();
    corporate.resetForm();
  }

  return (
    <>
      <Dialog
        open={open && !trainer.confirming && !program.confirming && !corporate.confirming}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogTrigger render={<Button type="button" variant="outline" className="h-11 text-base" />}>
          <Settings />
          Kelola Trainer & Paket Tambahan
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Kelola Trainer & Paket Tambahan</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="tambahan-section">Kelola</Label>
            <Select
              items={SECTIONS}
              value={section}
              onValueChange={(v) => {
                if (!v) return;
                reset();
                setSection(v as Section);
              }}
            >
              <SelectTrigger id="tambahan-section" className="h-11 w-full text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {active.list}
        </DialogContent>
      </Dialog>
      {trainer.confirmDialog}
      {program.confirmDialog}
      {corporate.confirmDialog}
    </>
  );
}
