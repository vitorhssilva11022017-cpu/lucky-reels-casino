import { Check, Crown, Flame, Lock } from "lucide-react";
import { useRef, useState } from "react";

import { centerOf, flyCoinsToBalance } from "@/game/collect";
import { useGame } from "@/game/useGame";
import { useTicker } from "@/hooks/useCountUp";
import { formatDuration, formatShort } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CoinIcon } from "./CoinIcon";
import { GButton } from "./GButton";
import { Modal } from "./Modal";

type DayState = "claimed" | "ready" | "future";

function DayTile({ day, amount, state, big }: { day: number; amount: number; state: DayState; big?: boolean }) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl px-1 py-2 ring-1 transition-transform",
        big ? "col-span-3 flex-row gap-3 py-3" : "",
        state === "ready" && "glow-pulse scale-[1.04] bg-gradient-to-b from-amber-300/45 via-orange-500/30 to-fuchsia-700/40 ring-2 ring-amber-200",
        state === "claimed" && "bg-gradient-to-b from-emerald-400/25 to-emerald-900/30 ring-emerald-300/40",
        state === "future" && (big ? "bg-gradient-to-br from-fuchsia-600/35 via-violet-800/40 to-amber-500/25 ring-amber-300/50" : "bg-white/[0.06] ring-white/10"),
      )}
    >
      {state === "ready" ? <div className="shimmer pointer-events-none absolute inset-0" /> : null}
      <div className={cn("font-display text-[12px] tracking-wider", state === "ready" ? "text-white" : "text-violet-100/70")}>DAY {day}</div>
      <div className={cn("relative flex items-center justify-center", big ? "h-12 w-12" : "h-9 w-9")}>
        {big ? <Crown className="absolute -top-3 h-5 w-5 fill-amber-300 text-amber-200 drop-shadow" /> : null}
        <CoinIcon className={cn(big ? "h-12 w-12" : "h-9 w-9", state === "claimed" && "opacity-50 grayscale-[0.4]", state === "ready" && "heartbeat")} />
        {state === "claimed" ? (
          <span className="absolute inset-0 m-auto flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white">
            <Check className="h-4 w-4 text-white" strokeWidth={4} />
          </span>
        ) : null}
        {state === "future" && !big ? (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 ring-1 ring-white/20">
            <Lock className="h-2.5 w-2.5 text-violet-100/70" strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <div className={cn("font-display tabular leading-none", big ? "text-[22px] text-gold" : "text-[14px]", state === "claimed" ? "text-emerald-100/70" : "text-gold-flat")}>
        {formatShort(amount)}
      </div>
      {big ? <div className="text-[11px] font-bold uppercase text-amber-100/80">Mega reward</div> : null}
    </div>
  );
}

/** Seven-day login calendar. The server decides the streak and pays the reward. */
export function StreakModal() {
  const { modal, setModal, player, claimStreak, releaseWin, now } = useGame();
  const [claiming, setClaiming] = useState<boolean>(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  useTicker(1000);
  const s = player?.streak;
  if (!s) return null;

  const stateFor = (day: number): DayState => {
    if (day < s.cycleDay) return "claimed";
    if (day === s.cycleDay) return s.claimedToday ? "claimed" : "ready";
    return "future";
  };

  const onClaim = async () => {
    if (claiming || s.claimedToday) return;
    setClaiming(true);
    const res = await claimStreak();
    setClaiming(false);
    if (res) flyCoinsToBalance(centerOf(btnRef.current), res.amount, (a) => releaseWin(a), res.day === 7 ? 26 : undefined);
  };

  const shownCount = s.claimedToday ? s.count : s.count + 1;

  return (
    <Modal
      open={modal === "streak"}
      onClose={() => setModal(null)}
      title={
        <span className="inline-flex items-center gap-2">
          <Flame className="h-7 w-7 fill-orange-400 text-amber-200" strokeWidth={2.4} />
          DAILY STREAK
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="text-center">
          <div className="font-display text-gold text-[44px] leading-none tabular">{shownCount}</div>
          <div className="text-[13px] font-bold text-violet-100/80">{shownCount === 1 ? "day in a row" : "days in a row"}</div>
          {s.broken ? <div className="mt-1 text-[12px] text-pink-200/90">Your streak restarted. Come back every day to climb to Day 7.</div> : null}
          {s.best > 1 ? <div className="mt-0.5 text-[11px] text-violet-200/55">Best streak: {s.best} days</div> : null}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {s.rewards.slice(0, 6).map((amt, i) => (
            <DayTile key={i} day={i + 1} amount={amt} state={stateFor(i + 1)} />
          ))}
          <DayTile day={7} amount={s.rewards[6] ?? 0} state={stateFor(7)} big />
        </div>

        {s.claimedToday ? (
          <div className="pill-dark mx-auto rounded-full px-4 py-2 text-center text-[13px] text-violet-100/85">
            Next reward in <span className="font-display tabular text-[15px] text-cyan-200">{formatDuration(s.resetAt - now())}</span>
          </div>
        ) : (
          <GButton ref={btnRef} variant="gold" disabled={claiming} onClick={onClaim} className="glow-pulse mx-auto w-full max-w-[280px] py-3 text-[20px]">
            COLLECT {formatShort(s.rewards[s.cycleDay - 1] ?? 0)}
          </GButton>
        )}
        <p className="text-center text-[11px] text-violet-200/50">Miss a day and your streak starts again at Day 1. Rewards grow with your level.</p>
      </div>
    </Modal>
  );
}
