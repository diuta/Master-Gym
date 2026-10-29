"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Camera } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/required-mark";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateMemberAction } from "./actions";
import { todayWib } from "./logic";
import type { MemberRow } from "./queries";
import { WebcamCapture } from "./webcam-capture";
import { GENDER_LABELS, type Gender } from "./validation";

const GENDERS = Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }));

export function EditMemberDialog({ member, onClose }: { member: MemberRow; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone);
  const [birthDate, setBirthDate] = useState(member.birthDate ?? "");
  const [gender, setGender] = useState<Gender>(member.gender);
  const [retaking, setRetaking] = useState(false);
  // Only a newly taken photo is sent; null keeps the current one.
  const [photo, setPhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      const result = await updateMemberAction({
        id: member.id,
        name,
        phone,
        birthDate,
        gender,
        ...(photo && { photo }),
      });
      if (result.success) {
        router.refresh();
        onClose();
        return;
      }
      setErrors(result.errors ?? {});
      setMessage(result.message ?? null);
    } catch {
      setMessage("Terjadi kesalahan. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  const fieldError = (key: string) =>
    errors[key]?.[0] && <p className="text-base text-destructive">{errors[key][0]}</p>;

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-member-no">Nomor Member</Label>
            <Input
              id="edit-member-no"
              className="h-11 text-base"
              value={member.memberNo}
              readOnly
              disabled
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-member-name">
              Nama
              <RequiredMark />
            </Label>
            <Input
              id="edit-member-name"
              className="h-11 text-base"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
            />
            {fieldError("name")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-member-phone">
              No. HP
              <RequiredMark />
            </Label>
            <Input
              id="edit-member-phone"
              className="h-11 text-base"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={pending}
            />
            {fieldError("phone")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-member-birth">Tanggal Lahir</Label>
            <Input
              id="edit-member-birth"
              type="date"
              className="h-11 text-base"
              max={todayWib()}
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              disabled={pending}
            />
            {fieldError("birthDate")}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-member-gender">
              Jenis Kelamin
              <RequiredMark />
            </Label>
            <Select
              items={GENDERS}
              value={gender}
              onValueChange={(v) => v && setGender(v as Gender)}
              disabled={pending}
            >
              <SelectTrigger id="edit-member-gender" className="h-11 w-full text-base">
                <SelectValue placeholder="Pilih jenis kelamin" />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError("gender")}
          </div>
          <div className="space-y-1.5">
            <Label>Foto</Label>
            {retaking ? (
              <WebcamCapture value={photo} onChange={setPhoto} />
            ) : (
              <div className="flex items-end gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- auth-gated upload route, not optimisable */}
                <img
                  src={`/api/uploads/${member.photoPath}`}
                  alt={`Foto ${member.name}`}
                  className="h-40 w-40 shrink-0 rounded-lg border object-cover"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 text-base"
                  disabled={pending}
                  onClick={() => setRetaking(true)}
                >
                  <Camera />
                  Ganti Foto
                </Button>
              </div>
            )}
            {fieldError("photo")}
          </div>
          {message && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription className="text-base">{message}</AlertDescription>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="success" className="h-11 text-base" disabled={pending}>
              {pending ? "Menyimpan..." : "Simpan"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 text-base"
              disabled={pending}
              onClick={onClose}
            >
              Batal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
