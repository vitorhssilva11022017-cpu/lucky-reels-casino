// @ts-nocheck
/** Weekly leaderboard cycle: anchored to Monday 00:00 UTC, top 50 biggest single wins. */

export const BOARD_SIZE = 50;

export interface RewardTier {
  minRank: number;
  amount: number;
}

/** Prize for finishing the week inside the paid ranks. Virtual coins only. */
export const REWARD_TIERS: RewardTier[] = [
  { minRank: 1, amount: 10_000_000 },
  { minRank: 3, amount: 5_000_000 },
  { minRank: 10, amount: 2_000_000 },
  { minRank: 25, amount: 1_000_000 },
  { minRank: 50, amount: 500_000 },
];

/** Monday 00:00:00.000 UTC of the week containing `now`. */
export function weekStart(now: number): number {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

export function weekKey(now: number): string {
  return new Date(weekStart(now)).toISOString().slice(0, 10);
}

/** When the current weekly race ends (start of the next one). */
export function weekEnd(now: number): number {
  return weekStart(now) + 7 * 24 * 60 * 60 * 1000;
}

/** Coin reward for a weekly rank, or 0 when outside the paid zones. */
export function boardReward(rank: number): number {
  for (const tier of REWARD_TIERS) {
    if (rank <= tier.minRank) return tier.amount;
  }
  return 0;
}
