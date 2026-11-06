export type PurchaseState = {
  id: number;
  startDate: string;
  endDate: string;
  visitQuota: number;
  used: number;
};

// Soonest-expiring purchase first so quota that is about to lapse is spent before fresh quota.
export function pickCorporatePurchase(
  purchases: PurchaseState[],
  today: string,
): PurchaseState | null {
  const usable = purchases.filter(
    (p) => p.startDate <= today && today <= p.endDate && p.used < p.visitQuota,
  );
  usable.sort((a, b) => (a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : a.id - b.id));
  return usable[0] ?? null;
}
