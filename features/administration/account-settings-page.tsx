"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredMark } from "@/components/ui/required-mark";
import { changePasswordAction } from "./actions";
import type { ChangePasswordInput } from "./validation";

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

function PasswordCard({ target, title }: { target: ChangePasswordInput["target"]; title: string }) {
  const [form, setForm] = useState(EMPTY);
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
      const result = await changePasswordAction({ target, ...form });
      if (result.success) {
        setSaved(true);
        setForm(EMPTY);
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

  const fields = [
    { key: "currentPassword", label: "Password Anda Saat Ini", autoComplete: "current-password" },
    { key: "newPassword", label: "Password Baru", autoComplete: "new-password" },
    { key: "confirmPassword", label: "Ulangi Password Baru", autoComplete: "new-password" },
  ] as const;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`${target}-${f.key}`}>
                {f.label}
                <RequiredMark />
              </Label>
              <Input
                id={`${target}-${f.key}`}
                type="password"
                autoComplete={f.autoComplete}
                className="h-11 text-base"
                value={form[f.key]}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                disabled={pending}
              />
              {errors[f.key]?.[0] && (
                <p className="text-base text-destructive">{errors[f.key][0]}</p>
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
              <AlertDescription className="text-base">Password berhasil diganti.</AlertDescription>
            </Alert>
          )}
          <Button type="submit" variant="success" className="h-11 text-base" disabled={pending}>
            {pending ? "Menyimpan..." : "Simpan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function AccountSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Pengaturan Akun</h1>
      <p className="text-base text-muted-foreground">
        Perangkat yang sudah login tetap login sampai keluar.
      </p>
      <div className="flex flex-wrap items-start gap-6">
        <PasswordCard target="kasir" title="Password Kasir" />
        <PasswordCard target="self" title="Password Saya" />
      </div>
    </div>
  );
}
