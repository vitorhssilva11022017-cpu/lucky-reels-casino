// @ts-nocheck
/** Daily missions: three goals per UTC day (easy, medium, hard) plus a bonus chest for finishing all three. */

import { wheelMultiplier } from "./progression";

export type MissionKind = "spins" | "wager" | "win" | "machines" | "bonus" | "freeSpins" | "bigWin";
export type MissionTier = "easy" | "medium" | "hard";

export interface Mission {
  id: string;
  kind: MissionKind;
  tier: MissionTier;
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
}

export interface DailyMissions {
  day: string;
  missions: Mission[];
  chestReward: number;
  chestClaimed: boolean;
  machinesPlayed: string[];
}

interface Template {
  kind: MissionKind;
  target: (m: number) => number;
  minLevel?: number;
}

const POOL: Record<MissionTier, Template[]> = {
  easy: [
    { kind: "spins", target: () => 25 },
    { kind: "bonus", target: () => 1 },
    { kind: "machines", target: () => 2, minLevel: 3 },
    { kind: "win", target: (m) => roundNice(100_000 * m) },
  ],
  medium: [
    { kind: "spins", target: () => 75 },
    { kind: "wager", target: (m) => roundNice(400_000 * m) },
    { kind: "win", target: (m) => roundNice(300_000 * m) },
    { kind: "machines", target: () => 3, minLevel: 6 },
  ],
  hard: [
    { kind: "freeSpins", target: () => 1 },
    { kind: "bigWin", target: () => 1 },
    { kind: "wager", target: (m) => roundNice(1_500_000 * m) },
    { kind: "spins", target: () => 200 },
  ],
};

const BASE_REWARD: Record<MissionTier, number> = { easy: 150_000, medium: 350_000, hard: 750_000 };
const CHEST_REWARD = 1_000_000;

function roundNice(n: number): number {
  const step = n >= 1_000_000 ? 100_000 : 10_000;
  return Math.max(step, Math.round(n / step) * step);
}

function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function dayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Next UTC midnight after `now`. */
export function nextResetAt(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/** Builds today's missions for a player. Deterministic per player and day. */
export function createDailyMissions(now: number, level: number, seed: string): DailyMissions {
  const day = dayKey(now);
  const m = wheelMultiplier(level);
  const used = new Set<MissionKind>();
  const missions: Mission[] = (["easy", "medium", "hard"] as MissionTier[]).map((tier) => {
    const options = POOL[tier].filter((t) => (t.minLevel ?? 1) <= level && !used.has(t.kind));
    const pick = options[hashStr(`${seed}|${day}|${tier}`) % options.length];
    used.add(pick.kind);
    return {
      id: `${day}-${tier}`,
      kind: pick.kind,
      tier,
      target: pick.target(m),
      progress: 0,
      reward: Math.round(BASE_REWARD[tier] * m),
      claimed: false,
    };
  });
  return { day, missions, chestReward: Math.round(CHEST_REWARD * m), chestClaimed: false, machinesPlayed: [] };
}

/** Adds progress to every unfinished mission of `kind`. */
export function trackMission(dm: DailyMissions, kind: MissionKind, amount: number, machineId?: string): void {
  if (kind === "machines" && machineId && !dm.machinesPlayed.includes(machineId)) {
    dm.machinesPlayed.push(machineId);
  }
  for (const mission of dm.missions) {
    if (mission.kind !== kind || mission.progress >= mission.target) continue;
    const next = kind === "machines" ? dm.machinesPlayed.length : mission.progress + amount;
    mission.progress = Math.min(mission.target, next);
  }
}
