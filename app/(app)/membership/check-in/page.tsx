import { requireRole } from "@/lib/auth/dal";
import { CheckInPage } from "@/features/membership/check-in-page";
import { listCorporateCheckInOptions } from "@/features/corporate/queries";
import { todayWib } from "@/features/membership/logic";
import { listActiveTrainers, listAttendance } from "@/features/membership/queries";

export default async function Page() {
  await requireRole("kasir");
  const day = todayWib();
  const [today, trainers, corporateOptions] = await Promise.all([
    listAttendance(day),
    listActiveTrainers(),
    listCorporateCheckInOptions(day),
  ]);
  return <CheckInPage today={today} trainers={trainers} corporateOptions={corporateOptions} />;
}
