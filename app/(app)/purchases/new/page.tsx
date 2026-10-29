import { requireRole } from "@/lib/auth/dal";
import { listActiveSuppliers, listProducts } from "@/features/shop/queries";
import { PurchaseWizard } from "@/features/shop/purchase-wizard";

export default async function Page() {
  await requireRole("kasir");
  const [products, suppliers] = await Promise.all([listProducts(), listActiveSuppliers()]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tambah Pembelian</h1>
      <PurchaseWizard products={products} suppliers={suppliers} />
    </div>
  );
}
