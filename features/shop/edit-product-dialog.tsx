"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import { deleteProductAction, updateProductAction } from "./actions";
import type { CategoryOption, ProductRow } from "./queries";

// Empty string must reach the schema as undefined so it reports "wajib diisi".
const num = (s: string) => (s === "" ? undefined : Number(s));

export function EditProductDialog({
  product,
  categories,
  onClose,
}: {
  product: ProductRow;
  categories: CategoryOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(product.name);
  const [categoryId, setCategoryId] = useState<number | null>(product.categoryId);
  const [unit, setUnit] = useState(product.unit);
  const [salePrice, setSalePrice] = useState(String(product.salePrice));
  const [minStock, setMinStock] = useState(String(product.minStock));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(fn: () => ReturnType<typeof updateProductAction>) {
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      const result = await fn();
      if (result.success) {
        router.refresh();
        onClose();
        return;
      }
      setErrors(result.errors ?? {});
      setMessage(result.message ?? null);
      setConfirmDelete(false);
    } catch {
      setMessage("Terjadi kesalahan. Coba lagi.");
      setConfirmDelete(false);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    return run(() =>
      updateProductAction(product.id, {
        name,
        categoryId: categoryId as number,
        unit,
        salePrice: num(salePrice) as number,
        minStock: num(minStock) as number,
      }),
    );
  }

  const items = categories.map((c) => ({ value: c.id, label: c.name }));
  // The product's own category may have been deactivated since; keep it selectable.
  if (!items.some((i) => i.value === product.categoryId)) {
    items.push({ value: product.categoryId, label: product.categoryName });
  }
  const fieldError = (key: string) =>
    errors[key]?.[0] && <p className="text-base text-destructive">{errors[key][0]}</p>;

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Produk</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-product-name">
                Nama Produk
                <RequiredMark />
              </Label>
              <Input
                id="edit-product-name"
                className="h-11 text-base"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
              />
              {fieldError("name")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-product-category">
                Kategori
                <RequiredMark />
              </Label>
              <Select
                items={items}
                value={categoryId}
                onValueChange={(v) => v && setCategoryId(v as number)}
                disabled={pending}
              >
                <SelectTrigger id="edit-product-category" className="h-11 w-full text-base">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("categoryId")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-product-unit">
                Satuan
                <RequiredMark />
              </Label>
              <Input
                id="edit-product-unit"
                className="h-11 text-base"
                placeholder="botol, pcs, bungkus"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={pending}
              />
              {fieldError("unit")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-product-price">
                Harga Jual
                <RequiredMark />
              </Label>
              <CurrencyInput
                id="edit-product-price"
                className="h-11 text-base"
                value={salePrice}
                onChange={setSalePrice}
                disabled={pending}
              />
              {fieldError("salePrice")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-product-min">
                Stok Minimum
                <RequiredMark />
              </Label>
              <Input
                id="edit-product-min"
                className="h-11 text-base"
                inputMode="numeric"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value.replace(/\D/g, ""))}
                disabled={pending}
              />
              {fieldError("minStock")}
            </div>
            <p className="text-base text-muted-foreground">
              Stok dan harga modal berubah lewat pembelian, bukan dari sini.
            </p>
            {message && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription className="text-base">{message}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
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
              <Button
                type="button"
                variant="destructive"
                className="ml-auto h-11 text-base"
                disabled={pending}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 />
                Hapus
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus produk {product.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Produk yang sudah punya riwayat hanya dinonaktifkan, riwayat transaksi tidak
              berubah. Produk dengan stok tidak bisa dihapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              variant="outline"
              className="h-11"
              onClick={() => setConfirmDelete(false)}
              disabled={pending}
            >
              Kembali
            </AlertDialogAction>
            <AlertDialogAction
              variant="destructive"
              className="h-11"
              onClick={() => run(() => deleteProductAction(product.id))}
              disabled={pending}
            >
              {pending ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
