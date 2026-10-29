"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, Package, PackageX, Pencil, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SortableTh } from "@/components/ui/sortable-th";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSort } from "@/hooks/use-sort";
import { rupiah } from "@/lib/format";
import { AddProductWizard } from "./add-product-wizard";
import { EditProductDialog } from "./edit-product-dialog";
import { KelolaKategoriProdukDialog } from "./kelola-kategori-produk-dialog";
import type { CategoryOption, ProductRow } from "./queries";

const ALL = "all";
const STATUS_ORDER = { out_of_stock: 0, low_stock: 1, in_stock: 2 };

function sortValue(p: ProductRow, key: string): string | number {
  switch (key) {
    case "category":
      return p.categoryName;
    case "stock":
      return p.stock;
    case "minStock":
      return p.minStock;
    case "salePrice":
      return p.salePrice;
    case "avgCost":
      return p.avgCost;
    case "stockValue":
      return p.stockValue;
    case "status":
      return STATUS_ORDER[p.status];
    default:
      return p.name;
  }
}

export function InventoryPage({
  products,
  categories,
}: {
  products: ProductRow[];
  categories: CategoryOption[];
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [editing, setEditing] = useState<ProductRow | null>(null);

  // shortcut: all products loaded and filtered in the browser, fine for a few thousand; paginate on the server past that
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (categoryId === ALL || p.categoryId === Number(categoryId)) &&
        (q === "" || p.name.toLowerCase().includes(q)),
    );
  }, [products, query, categoryId]);
  const { sortedRows, sort, toggleSort } = useSort(filtered, sortValue);

  const categoryItems = [
    { value: ALL, label: "Semua Kategori" },
    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
  ];
  const cards = [
    { label: "Total Produk", value: String(products.length), icon: Package },
    {
      label: "Nilai Stok",
      value: rupiah.format(products.reduce((s, p) => s + p.stockValue, 0)),
      icon: Wallet,
    },
    {
      label: "Stok Menipis",
      value: String(products.filter((p) => p.status === "low_stock").length),
      icon: AlertTriangle,
    },
    {
      label: "Stok Habis",
      value: String(products.filter((p) => p.status === "out_of_stock").length),
      icon: PackageX,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Inventori</h1>
        <div className="flex flex-wrap gap-2">
          <KelolaKategoriProdukDialog categories={categories} />
          <AddProductWizard categories={categories} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-3">
              <c.icon className="size-6 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-base text-muted-foreground">{c.label}</p>
                <p className="text-xl font-semibold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9 text-base"
            placeholder="Cari nama produk"
            aria-label="Cari nama produk"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          items={categoryItems}
          value={categoryId}
          onValueChange={(v) => setCategoryId(v ?? ALL)}
        >
          <SelectTrigger className="h-11 w-56 text-base" aria-label="Filter kategori">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryItems.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sortedRows.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={products.length === 0 ? "Belum ada produk" : "Produk tidak ditemukan"}
          description={
            products.length === 0
              ? "Tambah produk pertama lewat tombol Tambah Produk."
              : "Coba kata kunci atau kategori lain."
          }
          className="rounded-xl border bg-card"
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table className="text-base">
            <TableHeader>
              <TableRow>
                <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>
                  Nama
                </SortableTh>
                <SortableTh sortKey="category" sort={sort} onSort={toggleSort}>
                  Kategori
                </SortableTh>
                <SortableTh sortKey="stock" sort={sort} onSort={toggleSort}>
                  Stok
                </SortableTh>
                <SortableTh sortKey="minStock" sort={sort} onSort={toggleSort}>
                  Min
                </SortableTh>
                <SortableTh sortKey="salePrice" sort={sort} onSort={toggleSort}>
                  Harga Jual
                </SortableTh>
                <SortableTh sortKey="avgCost" sort={sort} onSort={toggleSort}>
                  Harga Modal
                </SortableTh>
                <SortableTh sortKey="stockValue" sort={sort} onSort={toggleSort}>
                  Nilai Stok
                </SortableTh>
                <SortableTh sortKey="status" sort={sort} onSort={toggleSort}>
                  Status
                </SortableTh>
                <TableHead>Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.categoryName}</TableCell>
                  <TableCell>
                    {p.stock} {p.unit}
                  </TableCell>
                  <TableCell>{p.minStock}</TableCell>
                  <TableCell>{rupiah.format(p.salePrice)}</TableCell>
                  <TableCell>{rupiah.format(Math.round(p.avgCost))}</TableCell>
                  <TableCell>{rupiah.format(p.stockValue)}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      className="h-11"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => setEditing(p)}
                    >
                      <Pencil />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <EditProductDialog
          key={editing.id}
          product={editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
