/** Lucky VIP: seven lifetime tiers earned by wagering. 1 point per 1,000 coins wagered on paid spins. Points never reset. */

import { dayKey, nextResetAt } from "./missions";

export interface VipTier {
  id: string;
  name: string;
  /** Lifetime VIP points needed to reach this tier. */
  minPoints: number;
  /** Daily gift paid while at this tier. */
  gift: number;
}

/** Ordered from lowest to highest; the ladder shown in the VIP club. */
export const VIP_TIERS: VipTier[] = [
  { id: "bronze", name: "Bronze", minPoints: 0, gift: 150_000 },
  { id: "silver", name: "Silver", minPoints: 50_000, gift: 400_000 },
  { id: "gold", name: "Gold", minPoints: 300_000, gift: 1_000_000 },
  { id: "platinum", name: "Platinum", minPoints: 1_200_000, gift: 2_500_000 },
  { id: "diamond", name: "Diamond", minPoints: 5_000_000, gift: 6_000_000 },
  { id: "royal", name: "Royal Diamond", minPoints: 20_000_000, gift: 15_000_000 },
  { id: "noir", name: "Noir", minPoints: 75_000_000, gift: 40_000_000 },
];

/** VIP points earned for a paid spin's stake: 1 point per 1,000 coins wagered. */
export function pointsForWager(bet: number): number {
  return Math.max(1, Math.floor(bet / 1000));
}

/** The highest tier whose threshold the player has reached. */
export function tierFor(points: number): VipTier {
  let tier = VIP_TIERS[0];
  for (const t of VIP_TIERS) {
    if (points >= t.minPoints) tier = t;
  }
  return tier;
}

export interface VipStatus {
  points: number;
  tierIndex: number;
  tierId: string;
  tierName: string;
  /** Today's gift amount at the current tier. */
  gift: number;
  /** True when today's gift has not been collected yet. */
  giftReady: boolean;
  nextTierName: string | null;
  /** Points still needed for the next tier, or null at the top tier. */
  pointsToNext: number | null;
  /** The full ladder for display; the server stays the source of truth. */
  tiers: { id: string; name: string; minPoints: number; gift: number }[];
  /** Next UTC midnight, when the gift refreshes. */
  resetsAt: number;
}

export function vipStatus(points: number, giftDay: string | null, now: number): VipStatus {
  const tier = tierFor(points);
  const tierIndex = VIP_TIERS.indexOf(tier);
  const next = VIP_TIERS[tierIndex + 1] ?? null;
  return {
    points,
    tierIndex,
    tierId: tier.id,
    tierName: tier.name,
    gift: tier.gift,
    giftReady: giftDay !== dayKey(now),
    nextTierName: next?.name ?? null,
    pointsToNext: next ? Math.max(0, next.minPoints - points) : null,
    tiers: VIP_TIERS.map(({ id, name, minPoints, gift }) => ({ id, name, minPoints, gift })),
    resetsAt: nextResetAt(now),
  };
}
