import { formatShort } from "@/lib/format";

import type { Mission, MissionsState } from "./types";

/** Human-readable goal for a mission, e.g. "Spin 25 times". */
export function missionLabel(m: Mission): string {
  switch (m.kind) {
    case "spins":
      return `Spin ${m.target} times`;
    case "wager":
      return `Bet ${formatShort(m.target)} coins in total`;
    case "win":
      return `Win ${formatShort(m.target)} coins`;
    case "machines":
      return `Play ${m.target} different machines`;
    case "bonus":
      return "Collect the free bonus";
    case "freeSpins":
      return "Trigger free spins";
    case "bigWin":
      return "Land a Big Win or better";
    default:
      return "Mission";
  }
}

/** Short progress text, e.g. "12 / 25" or "1.2M / 3M". */
export function missionProgressText(m: Mission): string {
  const big = m.target >= 10_000;
  const p = big ? formatShort(m.progress) : String(m.progress);
  const t = big ? formatShort(m.target) : String(m.target);
  return `${p} / ${t}`;
}

/** Count of missions (and the chest) that are ready to collect. */
export function claimableCount(ms: MissionsState | null | undefined): number {
  if (!ms) return 0;
  const missions = ms.missions.filter((m) => !m.claimed && m.progress >= m.target).length;
  const chest = !ms.chestClaimed && ms.missions.every((m) => m.claimed) ? 1 : 0;
  return missions + chest;
}
