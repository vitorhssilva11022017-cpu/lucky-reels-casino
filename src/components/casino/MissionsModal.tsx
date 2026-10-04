import { Check, Gift, Target } from "lucide-react";
import { useRef, useState } from "react";

import { centerOf, flyCoinsToBalance } from "@/game/collect";
import { missionLabel, missionProgressText } from "@/game/missions";
import type { Mission } from "@/game/types";
import { useGame } from "@/game/useGame";
import { useTicker } from "@/hooks/useCountUp";
import { formatDuration, formatShort } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CoinIcon } from "./CoinIcon";
import { GButton } from "./GButton";
import { Modal } from "./Modal";

const TIER_STYLE: Record<Mission["tier"], { label: string; ring: string; chip: string }> = {
  easy: { label: "EASY", ring: "from-cyan-500/30 to-indigo-800/40", chip: "from-cyan-200 via-sky-400 to-blue-600" },
  medium: { label: "MEDIUM", ring: "from-fuchsia-500/35 to-violet-800/40", chip: "from-pink-300 via-fuchsia-500 to-purple-700" },
  hard: { label: "HARD", ring: "from-amber-400/40 to-orange-800/40", chip: "from-yellow-200 via-amber-400 to-orange-600" },
};

function MissionRow({ mission }: { mission: Mission }) {
  const { claimMission, releaseWin } = useGame();
  const [claiming, setClaiming] = useState<boolean>(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const done = mission.progress >= mission.target;
  const pct = Math.min(100, (mission.progress / Math.max(1, mission.target)) * 100);
  const style = TIER_STYLE[mission.tier];

  const onClaim = async () => {
    if (!done || mission.claimed || claiming) return;
    setClaiming(true);
    const got = await claimMission({ missionId: mission.id });
    setClaiming(false);
    if (got !== null) flyCoinsToBalance(centerOf(btnRef.current), got, (a) => releaseWin(a));
  };

  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br p-3 ring-1 ring-white/15", style.ring, mission.claimed && "opacity-60")}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <span className={cn("inline-block rounded-full bg-gradient-to-b px-2 py-0.5 font-display text-[10px] tracking-wider text-white", style.chip)}>{style.label}</span>
          <div className="mt-1 text-[15px] font-extrabold leading-tight text-white">{missionLabel(mission)}</div>
          <div className="mt-1 flex items-center gap-1 text-[12px] text-amber-100/90">
            <CoinIcon className="h-4 w-4" />
            <span className="font-display text-gold-flat text-[15px]">{formatShort(mission.reward)}</span>
          </div>
        </div>
        {mission.claimed ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-500/25 ring-2 ring-green-300/60">
            <Check className="h-6 w-6 text-green-200" strokeWidth={3.5} />
          </div>
        ) : (
          <GButton
            ref={btnRef}
            variant={done ? "green" : "dark"}
            disabled={!done || claiming}
            onClick={onClaim}
            className={cn("min-w-[92px] px-3 py-2.5 text-[15px]", done && "glow-pulse")}
          >
            {done ? "COLLECT" : <span className="tabular text-[13px]">{missionProgressText(mission)}</span>}
          </GButton>
        )}
      </div>
      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-fuchsia-400 shadow-[0_0_8px_rgba(34,228,255,0.8)] transition-[width] duration-700"
          style={{ width: `${Math.max(3, pct)}%` }}
        />
      </div>
    </div>
  );
}

function ChestRow() {
  const { player, claimMission, releaseWin } = useGame();
  const [claiming, setClaiming] = useState<boolean>(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const ms = player?.missions;
  if (!ms) return null;
  const doneCount = ms.missions.filter((m) => m.claimed).length;
  const ready = doneCount === ms.missions.length && !ms.chestClaimed;

  const onClaim = async () => {
    if (!ready || claiming) return;
    setClaiming(true);
    const got = await claimMission({ chest: true });
    setClaiming(false);
    if (got !== null) flyCoinsToBalance(centerOf(btnRef.current), got, (a) => releaseWin(a), 26);
  };

  return (
    <div className={cn("relative flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-300/40 via-orange-500/25 to-fuchsia-700/40 p-3 ring-2 ring-amber-300/60", ready && "glow-pulse")}>
      <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-yellow-200 via-amber-400 to-orange-600 shadow-[0_4px_0_#7a3a00]", ready && "heartbeat")}>
        <Gift className="h-8 w-8 text-white drop-shadow" strokeWidth={2.6} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-gold text-[19px] leading-none">DAILY CHEST</div>
        <div className="mt-1 text-[12px] text-amber-50/85">{ms.chestClaimed ? "Opened! Come back tomorrow." : `Finish all 3 missions (${doneCount}/3)`}</div>
        <div className="mt-0.5 flex items-center gap-1">
          <CoinIcon className="h-4 w-4" />
          <span className="font-display text-gold-flat text-[16px]">{formatShort(ms.chestReward)}</span>
        </div>
      </div>
      {ms.chestClaimed ? (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-500/25 ring-2 ring-green-300/60">
          <Check className="h-6 w-6 text-green-200" strokeWidth={3.5} />
        </div>
      ) : (
        <GButton ref={btnRef} variant={ready ? "gold" : "dark"} disabled={!ready || claiming} onClick={onClaim} className="min-w-[92px] px-3 py-2.5 text-[15px]">
          {ready ? "OPEN" : "LOCKED"}
        </GButton>
      )}
    </div>
  );
}

/** Three daily goals plus a bonus chest. Progress and rewards are tracked on the server. */
export function MissionsModal() {
  const { modal, setModal, player, now } = useGame();
  useTicker(1000);
  const ms = player?.missions;
  return (
    <Modal
      open={modal === "missions"}
      onClose={() => setModal(null)}
      title={
        <span className="inline-flex items-center gap-2">
          <Target className="h-6 w-6 text-cyan-300" strokeWidth={3} />
          DAILY MISSIONS
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        {ms ? (
          <>
            <div className="pill-dark mx-auto rounded-full px-4 py-1 text-center text-[12px] text-violet-100/85">
              New missions in <span className="font-display tabular text-[14px] text-cyan-200">{formatDuration(ms.resetAt - now())}</span>
            </div>
            {ms.missions.map((m) => (
              <MissionRow key={m.id} mission={m} />
            ))}
            <ChestRow />
          </>
        ) : (
          <p className="py-6 text-center text-[14px] text-violet-100/80">Spin any machine to start today's missions.</p>
        )}
      </div>
    </Modal>
  );
}
