/** Presentation styles for the seven VIP tiers, indexed to match VipStatus.tierIndex. */

import type { VipStatus } from "./types";

export interface VipTierStyle {
  /** Tailwind gradient stops for chips and hero cards. */
  grad: string;
  text: string;
  glow: string;
}

export const VIP_TIER_STYLE: VipTierStyle[] = [
  { grad: "from-amber-500 via-orange-700 to-amber-950", text: "text-amber-200", glow: "rgba(205,127,50,0.55)" },
  { grad: "from-slate-100 via-slate-400 to-slate-600", text: "text-slate-100", glow: "rgba(203,213,225,0.5)" },
  { grad: "from-yellow-200 via-amber-400 to-yellow-700", text: "text-amber-100", glow: "rgba(255,200,60,0.6)" },
  { grad: "from-cyan-100 via-slate-300 to-cyan-500", text: "text-cyan-50", glow: "rgba(190,230,255,0.55)" },
  { grad: "from-cyan-200 via-sky-400 to-blue-700", text: "text-cyan-100", glow: "rgba(80,190,255,0.6)" },
  { grad: "from-fuchsia-200 via-fuchsia-500 to-purple-800", text: "text-fuchsia-100", glow: "rgba(240,110,255,0.6)" },
  { grad: "from-zinc-200 via-zinc-500 to-zinc-900", text: "text-zinc-100", glow: "rgba(170,170,190,0.6)" },
];

export function vipTierStyle(vip: VipStatus): VipTierStyle {
  return VIP_TIER_STYLE[vip.tierIndex] ?? VIP_TIER_STYLE[0];
}
