import { requireRole } from "@/lib/auth/dal";
import { InventoryPage } from "@/features/shop/inventory-page";
import { listActiveProductCategories, listProducts } from "@/features/shop/queries";

export default async function Page() {
  await requireRole("kasir");
  const [products, categories] = await Promise.all([
    listProducts(),
    listActiveProductCategories(),
  ]);
  return <InventoryPage products={products} categories={categories} />;
}
