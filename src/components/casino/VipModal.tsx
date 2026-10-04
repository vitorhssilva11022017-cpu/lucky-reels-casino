import { Check, Gem, Lock } from "lucide-react";
import { useRef, useState } from "react";

import { centerOf, flyCoinsToBalance } from "@/game/collect";
import type { VipStatus } from "@/game/types";
import { useGame } from "@/game/useGame";
import { vipTierStyle, VIP_TIER_STYLE } from "@/game/vip";
import { useTicker } from "@/hooks/useCountUp";
import { formatDuration, formatShort } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CoinIcon } from "./CoinIcon";
import { GButton } from "./GButton";
import { Modal } from "./Modal";

/** The current tier's hero card: status, points progress and the daily gift. */
function TierHero({ vip }: { vip: VipStatus }) {
  const { now, claimVip, releaseWin } = useGame();
  const [claiming, setClaiming] = useState<boolean>(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const style = vipTierStyle(vip);
  const cur = vip.tiers[vip.tierIndex];
  const next = vip.tiers[vip.tierIndex + 1] ?? null;
  const pct = next ? Math.min(100, Math.max(3, ((vip.points - cur.minPoints) / Math.max(1, next.minPoints - cur.minPoints)) * 100)) : 100;

  const onClaim = async () => {
    if (!vip.giftReady || claiming) return;
    setClaiming(true);
    const got = await claimVip();
    setClaiming(false);
    if (got !== null) flyCoinsToBalance(centerOf(btnRef.current), got, (a) => releaseWin(a), 24);
  };

  return (
    <div className="rounded-3xl p-[2px]" style={{ boxShadow: `0 0 30px ${style.glow}` }}>
      <div className={cn("rounded-[22px] bg-gradient-to-br p-[2px]", style.grad)}>
        <div className="rounded-[20px] bg-[#0b0518]/95 p-4">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br shadow-lg ring-2 ring-white/50", style.grad, vip.giftReady && "heartbeat")}>
              <Gem className="h-8 w-8 text-white drop-shadow" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[11px] tracking-[0.22em] text-white/60">VIP STATUS</div>
              <div className="font-display text-gold truncate text-[24px] leading-none">{vip.tierName.toUpperCase()}</div>
            </div>
            <div className="text-right">
              <div className="font-display tabular text-[18px] text-cyan-200">{formatShort(vip.points)}</div>
              <div className="text-[10px] tracking-wider text-white/55">POINTS</div>
            </div>
          </div>

          <div className="mt-3">
            <div className="h-2.5 overflow-hidden rounded-full bg-black/60 ring-1 ring-white/10">
              <div className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-700", style.grad)} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-violet-100/75">
              {next ? `${formatShort(Math.max(0, next.minPoints - vip.points))} points to ${next.name}` : "Top tier reached — you've seen it all"}
            </div>
          </div>

          <div className={cn("mt-3 flex items-center gap-3 rounded-2xl bg-black/45 p-3 ring-1 ring-white/15", vip.giftReady && "glow-pulse")}>
            <div className="min-w-0 flex-1">
              <div className="font-display text-[12px] tracking-wider text-white/70">DAILY GIFT</div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <CoinIcon className="h-5 w-5" />
                <span className="font-display text-gold text-[18px]">{formatShort(vip.gift)}</span>
              </div>
            </div>
            {vip.giftReady ? (
              <GButton ref={btnRef} variant="green" disabled={claiming} onClick={onClaim} className="glow-pulse min-w-[104px] px-3 py-2.5 text-[15px]">
                COLLECT
              </GButton>
            ) : (
              <div className="pill-dark rounded-full px-3.5 py-2 text-center">
                <div className="text-[9px] tracking-wider text-white/55">NEXT GIFT IN</div>
                <div className="font-display tabular text-[14px] text-amber-100">{formatDuration(vip.resetsAt - now())}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The Lucky VIP club: lifetime tier ladder, points progress and the daily tier gift. */
export function VipModal() {
  const { modal, setModal, player } = useGame();
  useTicker(1000);
  if (modal !== "vip") return null;
  const vip = player?.vip ?? null;
  if (!vip) return null;

  return (
    <Modal
      open
      onClose={() => setModal(null)}
      title={
        <span className="inline-flex items-center gap-2">
          <Gem className="h-6 w-6 text-cyan-300" strokeWidth={2.6} />
          VIP CLUB
        </span>
      }
    >
      <div className="flex flex-col gap-2.5">
        <TierHero vip={vip} />
        {vip.tiers.map((t, i) => {
          const ts = VIP_TIER_STYLE[i] ?? VIP_TIER_STYLE[0];
          const isCurrent = i === vip.tierIndex;
          const reached = vip.points >= t.minPoints;
          return (
            <div
              key={t.id}
              className={cn("flex items-center gap-3 rounded-2xl p-2.5 ring-1", isCurrent ? "bg-white/[0.09] ring-2 ring-amber-300/70" : "bg-white/[0.04] ring-white/10", !reached && "opacity-60")}
            >
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br", ts.grad, isCurrent && "ring-2 ring-white/80")}>
                <Gem className="h-5 w-5 text-white drop-shadow" strokeWidth={2.4} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-extrabold text-white">{t.name}</div>
                <div className="text-[11px] text-amber-100/80">Daily gift {formatShort(t.gift)}</div>
              </div>
              {isCurrent ? (
                <span className="font-display rounded-full bg-gradient-to-b from-amber-300 to-orange-500 px-2.5 py-1 text-[11px] text-amber-950">CURRENT</span>
              ) : reached ? (
                <Check className="h-5 w-5 text-green-300" strokeWidth={3} />
              ) : (
                <span className="font-display flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-violet-100/80 tabular">
                  <Lock className="h-3 w-3" />
                  {formatShort(t.minPoints)}
                </span>
              )}
            </div>
          );
        })}
        <p className="px-1 pb-1 text-center text-[11px] text-violet-100/60">
          Earn 1 point per 1,000 coins wagered on any machine · Points never reset · Gifts refresh at midnight UTC
        </p>
      </div>
    </Modal>
  );
}
