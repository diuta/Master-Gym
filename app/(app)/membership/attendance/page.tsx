import { requireRole } from "@/lib/auth/dal";
import { AttendancePage } from "@/features/membership/attendance-page";
import { todayWib } from "@/features/membership/logic";
import { listAttendance } from "@/features/membership/queries";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await requireRole("kasir");
  const { date: raw } = await searchParams;
  const today = todayWib();
  // ISO dates compare correctly as strings; future or malformed falls back to today.
  const date = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw <= today ? raw : today;
  return <AttendancePage date={date} rows={await listAttendance(date)} />;
}
