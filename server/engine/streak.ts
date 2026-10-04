// @ts-nocheck
/** Daily login streak: claim once per UTC day, rewards climb over a 7-day cycle, missing a day restarts at Day 1. */

import { dayKey, nextResetAt } from "./missions";
import { wheelMultiplier } from "./progression";

export interface StreakData {
  count: number;
  lastClaimDay: string | null;
  best: number;
}

/** Base rewards for days 1-7 of the cycle, scaled by level at claim time. */
export const STREAK_REWARDS = [100_000, 150_000, 250_000, 350_000, 500_000, 750_000, 1_500_000];
export const STREAK_CYCLE = STREAK_REWARDS.length;
const DAY_MS = 24 * 60 * 60 * 1000;

export function emptyStreak(): StreakData {
  return { count: 0, lastClaimDay: null, best: 0 };
}

export function scaledStreakRewards(level: number): number[] {
  const m = wheelMultiplier(level);
  return STREAK_REWARDS.map((r) => Math.round(r * m));
}

/** Streak length that is still alive right now (0 if a day was missed). */
function liveCount(s: StreakData, now: number): number {
  const today = dayKey(now);
  const yesterday = dayKey(now - DAY_MS);
  return s.lastClaimDay === today || s.lastClaimDay === yesterday ? s.count : 0;
}

export function streakStatus(s: StreakData, level: number, now: number) {
  const claimedToday = s.lastClaimDay === dayKey(now);
  const current = liveCount(s, now);
  const todayCount = claimedToday ? current : current + 1;
  return {
    count: current,
    best: s.best,
    claimedToday,
    broken: !claimedToday && current === 0 && s.count > 0,
    cycleDay: ((todayCount - 1) % STREAK_CYCLE) + 1,
    rewards: scaledStreakRewards(level),
    resetAt: nextResetAt(now),
  };
}

/** Claims today's reward. Returns null if already claimed today. */
export function claimStreak(s: StreakData, level: number, now: number): { amount: number; day: number } | null {
  const today = dayKey(now);
  if (s.lastClaimDay === today) return null;
  const count = liveCount(s, now) + 1;
  const day = ((count - 1) % STREAK_CYCLE) + 1;
  s.count = count;
  s.lastClaimDay = today;
  s.best = Math.max(s.best, count);
  return { amount: scaledStreakRewards(level)[day - 1], day };
}
