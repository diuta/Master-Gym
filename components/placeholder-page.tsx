import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <EmptyState
        icon={Construction}
        title="Halaman ini belum tersedia"
        description="Fitur ini sedang dalam pengembangan."
      />
    </div>
  );
}
