import { AlertTriangle, CheckCircle2, CircleOff, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type StatusKind =
  | "success"
  | "cancelled"
  | "paid"
  | "unpaid"
  | "out_of_stock"
  | "low_stock"
  | "in_stock"
  | "member_active"
  | "member_expiring"
  | "member_expired"

const statusConfig: Record<
  StatusKind,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  success: {
    label: "Berhasil",
    icon: CheckCircle2,
    className: "bg-success/10 text-success border-success/30",
  },
  cancelled: {
    label: "Dibatalkan",
    icon: XCircle,
    className: "bg-muted text-muted-foreground border-border",
  },
  paid: {
    label: "Sudah Lunas",
    icon: CheckCircle2,
    className: "bg-success/10 text-success border-success/30",
  },
  unpaid: {
    label: "Belum Lunas",
    icon: AlertTriangle,
    className: "bg-warning/15 text-warning-foreground border-warning/40",
  },
  out_of_stock: {
    label: "Stok Habis",
    icon: CircleOff,
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
  low_stock: {
    label: "Stok Menipis",
    icon: AlertTriangle,
    className: "bg-warning/15 text-warning-foreground border-warning/40",
  },
  in_stock: {
    label: "Stok Aman",
    icon: CheckCircle2,
    className: "bg-success/10 text-success border-success/30",
  },
  member_active: {
    label: "Aktif",
    icon: CheckCircle2,
    className: "bg-success/10 text-success border-success/30",
  },
  member_expiring: {
    label: "Habis ≤ 7 Hari",
    icon: AlertTriangle,
    className: "bg-warning/15 text-warning-foreground border-warning/40",
  },
  member_expired: {
    label: "Sudah Habis",
    icon: XCircle,
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: StatusKind
  className?: string
}) {
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      <Icon />
      {config.label}
    </Badge>
  )
}
