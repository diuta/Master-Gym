import { requireRole } from "@/lib/auth/dal";
import { listProducts } from "@/features/shop/queries";
import { SaleWizard } from "@/features/shop/sale-wizard";

export default async function Page() {
  await requireRole("kasir");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tambah Penjualan</h1>
      <SaleWizard products={await listProducts()} />
    </div>
  );
}
