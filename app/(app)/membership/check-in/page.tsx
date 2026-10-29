import { requireRole } from "@/lib/auth/dal";
import { CheckInPage } from "@/features/membership/check-in-page";
import { todayWib } from "@/features/membership/logic";
import { listActiveTrainers, listAttendance } from "@/features/membership/queries";

export default async function Page() {
  await requireRole("kasir");
  const [today, trainers] = await Promise.all([listAttendance(todayWib()), listActiveTrainers()]);
  return <CheckInPage today={today} trainers={trainers} />;
}
