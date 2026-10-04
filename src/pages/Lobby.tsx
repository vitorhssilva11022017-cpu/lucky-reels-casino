import { Album, Flame, Gem, Gift, Lock, Sparkles, Star, Target, Trophy } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Disclaimer } from "@/components/casino/Disclaimer";
import { GButton } from "@/components/casino/GButton";
import { JackpotTicker } from "@/components/casino/JackpotTicker";
import { TopBar } from "@/components/casino/TopBar";
import { audio } from "@/game/audio";
import { MACHINE_THEMES } from "@/game/machines";
import { claimableCount } from "@/game/missions";
import { vipTierStyle } from "@/game/vip";
import type { LeaderboardState, MachineListing, RaceBoard } from "@/game/types";
import { useGame } from "@/game/useGame";
import { useTicker } from "@/hooks/useCountUp";
import { formatDuration, formatShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const MachineTile = memo(function MachineTile({ listing, level, index }: { listing: MachineListing; level: number; index: number }) {
  const navigate = useNavigate();
  const theme = MACHINE_THEMES[listing.id];
  const locked = listing.unlockLevel > level;
  const comingSoon = !listing.playable && !locked;

  const onClick = () => {
    audio.play("click", { volume: 0.7 });
    if (locked) {
      toast(`${listing.name} unlocks at level ${listing.unlockLevel}`, { description: "Spin any machine to earn XP and level up." });
      return;
    }
    if (!listing.playable) {
      toast(`${listing.name} is coming soon`, { description: "This machine is being polished. Check back shortly!" });
      return;
    }
    navigate(`/play/${listing.id}`);
  };

  return (
    <button
      type="button"
      data-tut={`tile-${listing.id}`}
      onClick={onClick}
      className="btn3d group relative aspect-[2/3] w-full overflow-hidden rounded-[22px] text-left pop-in"
      style={{
        animationDelay: `${index * 70}ms`,
        boxShadow: locked ? "0 6px 0 #0a0420, 0 10px 24px rgba(0,0,0,0.6)" : `0 6px 0 #2a0d00, 0 10px 28px rgba(0,0,0,0.6), 0 0 26px ${theme?.glow ?? "rgba(255,190,40,0.5)"}`,
      }}
      aria-label={`${listing.name}${locked ? `, unlocks at level ${listing.unlockLevel}` : comingSoon ? ", coming soon" : ""}`}
    >
      <div className="absolute inset-0 rounded-[22px] p-[3px]" style={{ background: "var(--gold-border)" }}>
        <div className="relative h-full w-full overflow-hidden rounded-[19px] bg-[#12072e]">
          {theme ? (
            <img
              src={theme.tile}
              alt=""
              className={cn("kenburns absolute inset-0 h-full w-full object-cover", locked && "grayscale-[0.7] brightness-50")}
              style={{ animationDelay: `${-index * 3.1}s` }}
              loading={index < 2 ? "eager" : "lazy"}
              decoding="async"
            />
          ) : null}
          {!locked ? <div className="shimmer absolute inset-0" style={{ animationDelay: `${index * 0.6}s` }} /> : null}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#07031a] via-[#07031a]/75 to-transparent" />

          {listing.badge && !locked ? (
            <div
              className={cn(
                "absolute left-2 top-2 flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-[13px] shadow-lg sm:text-[15px]",
                listing.badge === "hot" ? "bg-gradient-to-b from-orange-300 via-red-500 to-red-700 text-white" : "bg-gradient-to-b from-cyan-200 via-sky-400 to-blue-600 text-white",
              )}
            >
              {listing.badge === "hot" ? <Flame className="h-3.5 w-3.5 fill-current" /> : <Sparkles className="h-3.5 w-3.5" />}
              {listing.badge.toUpperCase()}
            </div>
          ) : null}

          {locked ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 ring-2 ring-amber-300/70 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
                <Lock className="h-8 w-8 text-amber-200" strokeWidth={2.6} />
              </div>
              <div className="rounded-full bg-black/70 px-3 py-1 font-display text-[14px] text-amber-100 ring-1 ring-amber-300/50">
                <Star className="mr-1 inline h-3.5 w-3.5 -translate-y-px fill-current text-cyan-300" />
                LEVEL {listing.unlockLevel}
              </div>
            </div>
          ) : null}

          {comingSoon ? (
            <div className="absolute right-[-38px] top-4 rotate-45 bg-gradient-to-b from-fuchsia-400 to-fuchsia-700 px-10 py-1 font-display text-[11px] tracking-wider text-white shadow-lg">
              COMING SOON
            </div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className={cn("text-gold text-[19px] leading-[1.05] sm:text-[24px]", theme?.titleClass ?? "font-display")}>{listing.name}</div>
            <div className="mt-0.5 text-[11px] text-violet-100/75 sm:text-[12px]">{theme?.tagline}</div>
            {listing.playable && !locked ? (
              <div className="mt-2 inline-flex rounded-full bg-gradient-to-b from-lime-300 via-green-500 to-green-700 px-4 py-1 font-display text-[14px] text-white shadow-[0_3px_0_#0a5a22]">PLAY</div>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
});

function WheelBanner() {
  const { player, now, setModal } = useGame();
  useTicker(1000);
  if (!player) return null;
  const remaining = player.nextWheelAt - now();
  const ready = remaining <= 0;
  return (
    <div className="mx-auto w-full max-w-[760px] px-3">
      <button
        type="button"
        onClick={() => {
          audio.play("click", { volume: 0.7 });
          setModal("wheel");
        }}
        className={cn("btn3d relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] px-3 py-2.5 text-left panel-gold", ready && "glow-pulse")}
      >
        <div className="relative h-14 w-14 shrink-0">
          <svg viewBox="0 0 60 60" className={cn("h-full w-full", ready && "spin-slow")}>
            {Array.from({ length: 8 }).map((_, i) => {
              const a0 = (i * Math.PI) / 4;
              const a1 = ((i + 1) * Math.PI) / 4;
              const colors = ["#ff2e9a", "#ffd23d", "#6a3cf0", "#3be6ff"];
              return (
                <path key={i} d={`M30 30 L${30 + 28 * Math.sin(a0)} ${30 - 28 * Math.cos(a0)} A28 28 0 0 1 ${30 + 28 * Math.sin(a1)} ${30 - 28 * Math.cos(a1)} Z`} fill={colors[i % 4]} stroke="#fff3b0" strokeWidth="1" />
              );
            })}
            <circle cx="30" cy="30" r="7" fill="#ffd23d" stroke="#8a4b00" strokeWidth="2" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-gold text-[22px] leading-none sm:text-[26px]">DAILY WHEEL</div>
          <div className="mt-1 text-[12px] text-violet-100/75 sm:text-[13px]">{ready ? "Your free spin is ready. Win up to 5M+ coins!" : "Come back for another free spin"}</div>
        </div>
        <div className={cn("font-display shrink-0 rounded-full px-4 py-2 text-[16px]", ready ? "btn-green" : "pill-dark text-amber-100 tabular")}>{ready ? "SPIN!" : formatDuration(remaining)}</div>
      </button>
    </div>
  );
}

function StreakBanner() {
  const { player, setModal } = useGame();
  const s = player?.streak;
  if (!s) return null;
  const ready = !s.claimedToday;
  const shown = ready ? s.count + 1 : s.count;
  return (
    <div className="mx-auto w-full max-w-[760px] px-3">
      <button
        type="button"
        onClick={() => {
          audio.play("click", { volume: 0.7 });
          setModal("streak");
        }}
        className={cn("btn3d relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] px-3 py-2.5 text-left panel-gold", ready && "glow-pulse")}
      >
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-yellow-200 via-orange-500 to-red-700 shadow-[0_0_16px_rgba(255,140,40,0.6)] ring-2 ring-white/70">
          <Flame className={cn("h-8 w-8 fill-amber-200 text-white", ready && "heartbeat")} strokeWidth={2.2} />
          <span className="absolute -bottom-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-gradient-to-b from-fuchsia-400 to-fuchsia-700 px-1.5 font-display text-[13px] text-white ring-2 ring-white tabular">{shown}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-gold text-[22px] leading-none sm:text-[26px]">DAILY STREAK</div>
          <div className="mt-1.5 flex gap-1">
            {Array.from({ length: 7 }).map((_, i) => {
              const day = i + 1;
              const done = day < s.cycleDay || (day === s.cycleDay && s.claimedToday);
              const today = day === s.cycleDay && !s.claimedToday;
              return (
                <span
                  key={day}
                  className={cn(
                    "h-2.5 flex-1 rounded-full ring-1 ring-white/10",
                    done ? "bg-gradient-to-r from-amber-300 to-orange-500" : today ? "bg-gradient-to-r from-pink-300 to-fuchsia-500 animate-pulse" : "bg-black/50",
                  )}
                />
              );
            })}
          </div>
          <div className="mt-1 text-[12px] text-violet-100/75 sm:text-[13px]">
            {ready ? `Day ${s.cycleDay} reward: ${formatShort(s.rewards[s.cycleDay - 1] ?? 0)} coins` : `Come back tomorrow for Day ${(s.cycleDay % 7) + 1}`}
          </div>
        </div>
        <div className={cn("font-display flex shrink-0 items-center gap-1 rounded-full px-4 py-2 text-[16px]", ready ? "btn-green" : "pill-dark text-amber-100")}>
          {ready ? (
            <>
              <Gift className="h-4 w-4" strokeWidth={3} />
              CLAIM
            </>
          ) : (
            "VIEW"
          )}
        </div>
      </button>
    </div>
  );
}

function VipBanner() {
  const { player, setModal, now } = useGame();
  const toastShown = useRef<boolean>(false);
  useTicker(1000);
  const vip = player?.vip ?? null;

  // One-time heads-up on lobby entry when today's gift is waiting.
  useEffect(() => {
    if (!vip || toastShown.current || !player?.tutorialDone) return;
    if (vip.giftReady) {
      toastShown.current = true;
      toast("Your VIP gift is ready", {
        description: `${vip.tierName} members collect ${formatShort(vip.gift)} coins today.`,
        action: { label: "Open", onClick: () => setModal("vip") },
      });
    }
  }, [vip, player?.tutorialDone, setModal]);

  if (!vip) return null;
  const ready = vip.giftReady;
  const style = vipTierStyle(vip);
  return (
    <div className="mx-auto w-full max-w-[760px] px-3">
      <button
        type="button"
        onClick={() => {
          audio.play("click", { volume: 0.7 });
          setModal("vip");
        }}
        className={cn("btn3d relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] px-3 py-2.5 text-left panel-gold", ready && "glow-pulse")}
      >
        <div className={cn("relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br shadow-[0_0_16px_rgba(120,200,255,0.4)] ring-2 ring-white/70", style.grad)}>
          <Gem className={cn("h-7 w-7 text-white drop-shadow", ready && "heartbeat")} strokeWidth={2.4} />
          {ready ? <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-gradient-to-b from-pink-400 to-pink-700 ring-2 ring-white" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-gold text-[22px] leading-none sm:text-[26px]">VIP CLUB</div>
          <div className="mt-1 truncate text-[12px] text-violet-100/75 sm:text-[13px]">
            {ready
              ? `${vip.tierName} gift ready · ${formatShort(vip.gift)} coins`
              : vip.pointsToNext !== null
                ? `${vip.tierName} status · ${formatShort(vip.pointsToNext)} points to ${vip.nextTierName}`
                : `${vip.tierName} status · top tier reached`}
          </div>
        </div>
        <div className={cn("font-display shrink-0 rounded-full px-4 py-2 text-[16px]", ready ? "btn-green" : "pill-dark text-amber-100 tabular")}>
          {ready ? "COLLECT" : formatDuration(vip.resetsAt - now())}
        </div>
      </button>
    </div>
  );
}

function CollectionBanner() {
  const { config, player, setModal } = useGame();
  const cards = player?.collection?.cards ?? {};
  const claimed = player?.collection?.claimed ?? [];
  const sets = config?.cardSets ?? [];
  if (!sets.length) return null;
  const owned = sets.reduce((s, x) => s + x.cards.filter((c) => (cards[c.id] ?? 0) > 0).length, 0);
  const total = sets.reduce((s, x) => s + x.cards.length, 0);
  const claimable = sets.filter((s) => !claimed.includes(s.id) && s.cards.every((c) => (cards[c.id] ?? 0) > 0)).length;
  const next = sets.find((s) => !claimed.includes(s.id));
  const nextOwned = next ? next.cards.filter((c) => (cards[c.id] ?? 0) > 0).length : 0;
  const nextTotal = next?.cards.length ?? 0;
  return (
    <div className="mx-auto w-full max-w-[760px] px-3">
      <button
        type="button"
        onClick={() => {
          audio.play("click", { volume: 0.7 });
          setModal("collection");
        }}
        className={cn("btn3d relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] px-3 py-2.5 text-left panel-gold", claimable > 0 && "glow-pulse")}
      >
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-200 via-orange-500 to-rose-700 shadow-[0_0_16px_rgba(255,170,60,0.55)] ring-2 ring-white/70">
          <Album className={cn("h-7 w-7 text-white", claimable > 0 && "heartbeat")} strokeWidth={2.4} />
          {claimable > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-gradient-to-b from-pink-400 to-pink-700 px-1.5 font-display text-[13px] text-white ring-2 ring-white">{claimable}</span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-gold text-[22px] leading-none sm:text-[26px]">CARD COLLECTION</div>
          <div className="mt-1 truncate text-[12px] text-violet-100/75 sm:text-[13px]">
            {claimable > 0
              ? "A set is complete — claim your jackpot!"
              : next
                ? `Album ${owned}/${total} · ${next.name} ${nextOwned}/${nextTotal}`
                : `Album ${owned}/${total} · every set collected!`}
          </div>
        </div>
        <div className={cn("font-display shrink-0 rounded-full px-4 py-2 text-[16px]", claimable > 0 ? "btn-green" : "pill-dark text-amber-100")}>{claimable > 0 ? "COLLECT" : "VIEW"}</div>
      </button>
    </div>
  );
}

function MissionsBanner() {
  const { player, setModal } = useGame();
  const ms = player?.missions;
  if (!ms) return null;
  const claimable = claimableCount(ms);
  const claimed = ms.missions.filter((m) => m.claimed).length;
  const allDone = ms.chestClaimed;
  const overall = ms.missions.reduce((s, m) => s + Math.min(1, m.progress / Math.max(1, m.target)), 0) / ms.missions.length;
  return (
    <div className="mx-auto w-full max-w-[760px] px-3">
      <button
        type="button"
        onClick={() => {
          audio.play("click", { volume: 0.7 });
          setModal("missions");
        }}
        className={cn("btn3d relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] px-3 py-2.5 text-left panel-gold", claimable > 0 && "glow-pulse")}
      >
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-cyan-200 via-sky-500 to-indigo-700 shadow-[0_0_16px_rgba(34,228,255,0.55)] ring-2 ring-white/70">
          <Target className={cn("h-8 w-8 text-white", claimable > 0 && "heartbeat")} strokeWidth={2.6} />
          {claimable > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-gradient-to-b from-pink-400 to-pink-700 px-1.5 font-display text-[13px] text-white ring-2 ring-white">{claimable}</span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-gold text-[22px] leading-none sm:text-[26px]">DAILY MISSIONS</div>
          <div className="mt-1.5 h-2.5 w-full max-w-[260px] overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-400 to-fuchsia-400 transition-[width] duration-700" style={{ width: `${Math.max(4, overall * 100)}%` }} />
          </div>
          <div className="mt-1 text-[12px] text-violet-100/75 sm:text-[13px]">{allDone ? "All done! New missions tomorrow." : `${claimed}/3 complete · open the chest for ${formatShort(ms.chestReward)}`}</div>
        </div>
        <div className={cn("font-display shrink-0 rounded-full px-4 py-2 text-[16px]", claimable > 0 ? "btn-green" : "pill-dark text-amber-100")}>{claimable > 0 ? "COLLECT" : "VIEW"}</div>
      </button>
    </div>
  );
}

function LeaderboardBanner() {
  const { player, setModal, fetchLeaderboard, now } = useGame();
  const [boards, setBoards] = useState<Partial<Record<RaceBoard, LeaderboardState>>>({});
  const loadedRef = useRef<boolean>(false);
  const toastRef = useRef<boolean>(false);
  useTicker(1000);

  // Load both race boards once per lobby visit for badge + countdown.
  useEffect(() => {
    if (!player || loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      const [wins, wagers] = await Promise.all([fetchLeaderboard("wins"), fetchLeaderboard("wagers")]);
      setBoards({ wins: wins ?? undefined, wagers: wagers ?? undefined });
    })();
  }, [player, fetchLeaderboard]);

  const claimable = (["wins", "wagers"] as RaceBoard[]).filter((b) => {
    // Only last week's finished race pays out.
    const last = boards[b]?.lastWeek;
    if (!last || !player || last.claimed) return false;
    const claimed = b === "wagers" ? player.wagerClaimWeek : player.boardClaimWeek;
    return claimed !== last.week && last.amount > 0;
  }).length;

  const endsAt = boards.wins?.endsAt ?? boards.wagers?.endsAt ?? 0;
  const remaining = endsAt - now();
  const endsSoon = remaining > 0 && remaining < 3 * 3600 * 1000;

  // One-time heads-up when the race enters its final hour.
  useEffect(() => {
    if (!endsAt || toastRef.current) return;
    if (remaining <= 60 * 60 * 1000) {
      toastRef.current = true;
      toast("The weekly race ends soon!", { description: "Check your rank before the boards reset." });
    }
  }, [endsAt, remaining]);

  return (
    <div className="mx-auto w-full max-w-[760px] px-3">
      <button
        type="button"
        onClick={() => {
          audio.play("click", { volume: 0.7 });
          setModal("leaderboard");
        }}
        className={cn("btn3d relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] px-3 py-2.5 text-left panel-gold", claimable > 0 && "glow-pulse")}
      >
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-200 via-fuchsia-500 to-purple-800 shadow-[0_0_16px_rgba(255,90,220,0.55)] ring-2 ring-white/70">
          <Trophy className={cn("h-7 w-7 fill-amber-200 text-white", claimable > 0 && "heartbeat")} strokeWidth={2.2} />
          {claimable > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-gradient-to-b from-pink-400 to-pink-700 px-1.5 font-display text-[13px] text-white ring-2 ring-white">{claimable}</span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-gold text-[22px] leading-none sm:text-[26px]">WEEKLY RACE</div>
          <div className="mt-1 text-[12px] text-violet-100/75 sm:text-[13px]">Two weekly races · 10M top prize each</div>
        </div>
        <div className={cn("font-display shrink-0 rounded-full px-4 py-2 text-[16px]", claimable > 0 ? "btn-green" : endsSoon ? "animate-pulse bg-gradient-to-b from-rose-400 to-red-600 text-white shadow-[0_3px_0_#7f1d1d]" : "pill-dark text-amber-100 tabular")}>
          {claimable > 0 ? "COLLECT" : endsSoon && remaining > 0 ? `ENDS ${formatDuration(remaining)}` : "VIEW"}
        </div>
      </button>
    </div>
  );
}

/** Casino lobby: jackpot, streak, daily wheel, missions and the machine grid. */
export default function Lobby() {
  const { config, player, setLobbyMusic, setModal, now, tutorial, modal } = useGame();
  const autoWheelRef = useRef<boolean>(false);
  const autoStreakRef = useRef<boolean>(false);

  useEffect(() => {
    setLobbyMusic();
  }, [setLobbyMusic]);

  // Offer the streak reward first, then the daily wheel, once per session each.
  useEffect(() => {
    if (!player || tutorial || modal || !player.tutorialDone) return;
    if (!autoStreakRef.current && !player.streak.claimedToday) {
      autoStreakRef.current = true;
      const id = setTimeout(() => setModal("streak"), 700);
      return () => clearTimeout(id);
    }
    if (autoWheelRef.current) return;
    if (player.nextWheelAt <= now()) {
      autoWheelRef.current = true;
      const id = setTimeout(() => setModal("wheel"), 900);
      return () => clearTimeout(id);
    }
  }, [player, tutorial, modal, now, setModal]);

  if (!config || !player) return null;

  return (
    <div className="casino-bg fixed inset-0 flex flex-col overflow-hidden">
      <div className="stars-bg pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className="sparkle-dot" style={{ left: `${(i * 37) % 100}%`, top: `${40 + ((i * 53) % 60)}%`, animationDelay: `${(i * 0.43) % 3}s` }} />
        ))}
      </div>
      <TopBar />
      <main className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 pb-4 pt-1 sm:gap-4 sm:pt-2">
          <JackpotTicker />
          <StreakBanner />
          <WheelBanner />
          <VipBanner />
          <CollectionBanner />
          <MissionsBanner />
          <LeaderboardBanner />
          <section className="px-3 sm:px-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="font-display text-gold text-[22px] sm:text-[26px]">SLOTS</h2>
              <span className="text-[12px] text-violet-100/60">Level up to unlock more machines</span>
            </div>
            <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {config.machines.map((m, i) => (
                <MachineTile key={m.id} listing={m} level={player.level} index={i} />
              ))}
            </div>
          </section>
          <footer className="mx-auto w-full max-w-[900px] px-3 pb-safe">
            <Disclaimer />
            <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-violet-200/40">
              <span>© {new Date().getFullYear()} Lucky Reels Casino</span>
              <span>·</span>
              <GButton variant="dark" className="rounded-full px-3 py-1 text-[11px]" onClick={() => setModal("settings")}>
                <span>Settings</span>
              </GButton>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
