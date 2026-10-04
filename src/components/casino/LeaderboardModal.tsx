import { Coins, RefreshCw, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { audio } from "@/game/audio";
import { centerOf, flyCoinsToBalance } from "@/game/collect";
import { MACHINE_THEMES } from "@/game/machines";
import type { BoardEntry, LeaderboardState, RaceBoard } from "@/game/types";
import { useGame } from "@/game/useGame";
import { useTicker } from "@/hooks/useCountUp";
import { formatShort } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CoinIcon } from "./CoinIcon";
import { GButton } from "./GButton";
import { Modal } from "./Modal";

/** The two weekly races: biggest single win and total amount wagered. */
const TABS: { id: RaceBoard; label: string; blurb: string; empty: string }[] = [
  { id: "wins", label: "TOP WINS", blurb: "Biggest win this week", empty: "No entries yet this week.\nLand a big win to take the crown!" },
  { id: "wagers", label: "WAGERED", blurb: "Total wagered · every spin counts", empty: "No entries yet this week.\nEvery spin puts you on the board!" },
];

/** Countdown in days/hours for the weekly race. */
function weekCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    const styles = ["from-yellow-100 via-amber-300 to-amber-600 text-amber-950", "from-slate-50 via-slate-300 to-slate-500 text-slate-800", "from-orange-200 via-orange-400 to-orange-700 text-orange-950"];
    return (
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b font-display text-[16px] shadow-md ring-2 ring-white/70", styles[rank - 1])}>{rank}</span>
    );
  }
  return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/50 font-display text-[14px] text-amber-100/80 ring-1 ring-white/15 tabular">{rank}</span>;
}

/** VIP tier dot colors, keyed by tier name as stored on board entries. */
const VIP_DOT: Record<string, string> = {
  Bronze: "#cd7f32",
  Silver: "#cbd5e1",
  Gold: "#fbbf24",
  Platinum: "#a5f3fc",
  Diamond: "#38bdf8",
  "Royal Diamond": "#e879f9",
  Noir: "#a1a1aa",
};

function Row({ entry, isYou, tab }: { entry: BoardEntry; isYou: boolean; tab: RaceBoard }) {
  const wagered = tab === "wagers";
  const dot = entry.vip ? VIP_DOT[entry.vip] ?? "#9ca3af" : null;
  return (
    <li className={cn("flex items-center gap-2.5 rounded-2xl px-2.5 py-2 ring-1", isYou ? "glow-pulse bg-gradient-to-r from-fuchsia-600/45 to-violet-700/45 ring-2 ring-fuchsia-300" : "bg-white/[0.05] ring-white/10")}>
      <RankBadge rank={entry.rank} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold text-white">
          {entry.name}
          {dot ? <span className="ml-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} title={`${entry.vip} VIP`} /> : null}
          {isYou ? <span className="ml-1.5 rounded-full bg-fuchsia-500/80 px-1.5 py-0.5 text-[10px] font-display tracking-wide">YOU</span> : null}
        </div>
        <div className="truncate text-[11px] text-violet-100/60">
          {wagered ? `Lv ${entry.level} · ${formatShort(entry.spins ?? 0)} spins` : `Lv ${entry.level} · ${MACHINE_THEMES[entry.machine]?.title ?? "Slots"}`}
        </div>
      </div>
      <div className="font-display flex shrink-0 items-center gap-1 text-[16px] text-gold tabular">
        <CoinIcon className="h-5 w-5" />
        {formatShort(wagered ? entry.wager ?? entry.win : entry.win)}
      </div>
    </li>
  );
}

/** Weekly races (biggest win & total wagered): server-ranked top 50 with claimable rank prizes. */
export function LeaderboardModal() {
  const { modal, setModal, player, fetchLeaderboard, claimLeaderboard, releaseWin, now } = useGame();
  const [tab, setTab] = useState<RaceBoard>("wins");
  const [boards, setBoards] = useState<Partial<Record<RaceBoard, LeaderboardState>>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [claiming, setClaiming] = useState<boolean>(false);
  const claimRef = useRef<HTMLButtonElement>(null);
  useTicker(1000);

  const data = boards[tab] ?? null;
  const tabCfg = TABS.find((t) => t.id === tab) ?? TABS[0];

  const load = useCallback(
    async (which: RaceBoard) => {
      setLoading(true);
      const res = await fetchLeaderboard(which);
      if (res) setBoards((m) => ({ ...m, [which]: res }));
      setLoading(false);
    },
    [fetchLeaderboard],
  );

  useEffect(() => {
    if (modal === "leaderboard") void load(tab);
  }, [modal, tab, load]);

  if (modal !== "leaderboard") return null;

  const you = data?.you ?? null;
  const claimedWeek = tab === "wagers" ? player?.wagerClaimWeek : player?.boardClaimWeek;
  const claimedThisWeek = player !== null && data !== null && claimedWeek === data.week;
  const claimAmount = you ? (data?.rewardTiers.find((t) => you.rank <= t.minRank)?.amount ?? 0) : 0;

  const onClaim = async () => {
    if (claiming || !you) return;
    setClaiming(true);
    const res = await claimLeaderboard(tab);
    setClaiming(false);
    if (res) flyCoinsToBalance(centerOf(claimRef.current), res.amount, (a) => releaseWin(a), 22);
  };

  const switchTab = (next: RaceBoard) => {
    if (next === tab) return;
    audio.play("click", { volume: 0.6 });
    setTab(next);
  };

  return (
    <Modal
      open
      onClose={() => setModal(null)}
      title={
        <span className="inline-flex items-center gap-2">
          <Trophy className="h-7 w-7 fill-amber-300 text-amber-200" strokeWidth={2.2} />
          WEEKLY RACE
        </span>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2" role="tablist">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchTab(t.id)}
                className={cn(
                  "btn3d flex items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 font-display text-[15px] tracking-wide",
                  active ? "panel-gold text-amber-100" : "bg-white/[0.06] text-violet-100/70 ring-1 ring-white/10",
                )}
              >
                {t.id === "wins" ? <Trophy className="h-4 w-4" strokeWidth={2.4} /> : <Coins className="h-4 w-4" strokeWidth={2.4} />}
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between rounded-full bg-black/40 px-4 py-2 ring-1 ring-white/10">
          <span className="text-[12px] font-bold uppercase tracking-wider text-violet-100/75">{tabCfg.blurb}</span>
          <span className={cn("font-display tabular text-[14px]", data && data.endsAt - now() < 3 * 3600 * 1000 ? "animate-pulse text-rose-300" : "text-cyan-200")}>
            {data ? `Ends in ${weekCountdown(data.endsAt - now())}` : ""}
          </span>
        </div>

        {loading && !data ? (
          <div className="py-10 text-center text-[15px] text-violet-100/70">Counting the chips…</div>
        ) : !data ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-center text-[14px] text-violet-100/70">The leaderboard is out of reach right now.</p>
            <GButton variant="gold" onClick={() => void load(tab)}>
              TRY AGAIN
            </GButton>
          </div>
        ) : data.entries.length === 0 ? (
          <div className="whitespace-pre-line py-8 text-center text-[14px] text-violet-100/70">{tabCfg.empty}</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <ul className="flex flex-col gap-1.5">
              {data.entries.map((e) => (
                <Row key={`${tab}-${e.rank}`} entry={e} isYou={you !== null && you.rank === e.rank} tab={tab} />
              ))}
            </ul>
            {you && you.rank > data.entries.length ? (
              <>
                <div className="text-center text-[12px] tracking-[0.35em] text-violet-100/40">···</div>
                <ul className="flex flex-col gap-1.5">
                  <li className="glow-pulse flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-600/45 to-violet-700/45 px-2.5 py-2 ring-2 ring-fuchsia-300">
                    <RankBadge rank={you.rank} />
                    <div className="min-w-0 flex-1 text-[15px] font-bold text-white">YOU</div>
                    <div className="font-display flex shrink-0 items-center gap-1 text-[16px] text-gold tabular">
                      <CoinIcon className="h-5 w-5" />
                      {formatShort(you.win)}
                    </div>
                  </li>
                </ul>
              </>
            ) : null}
          </div>
        )}

        {data && !you && data.entries.length > 0 ? (
          <div className="rounded-2xl bg-black/30 px-3 py-2 text-center text-[12.5px] text-violet-100/70">
            Not on the board yet — {tab === "wagers" ? "every spin counts" : "a 2x-bet win gets you in"}!
          </div>
        ) : null}

        {you && !claimedThisWeek && claimAmount > 0 ? (
          <GButton ref={claimRef} variant="gold" disabled={claiming} onClick={onClaim} className="glow-pulse mx-auto w-full max-w-[300px] py-3 text-[19px]">
            COLLECT RANK #{you.rank} · {formatShort(claimAmount)}
          </GButton>
        ) : null}
        {you && claimedThisWeek ? <div className="pill-dark mx-auto rounded-full px-4 py-2 text-[13px] text-emerald-100">Weekly prize collected. Good luck next week!</div> : null}

        <div className="rounded-2xl bg-black/30 px-3 py-2.5 ring-1 ring-white/10">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-100/70">Weekly prizes</div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
            {data?.rewardTiers.map((t) => (
              <span key={t.minRank} className="font-display text-[13px] text-gold-flat tabular">
                Top {t.minRank} · {formatShort(t.amount)}
              </span>
            ))}
          </div>
        </div>

        {data?.champions && data.champions.top.length > 0 ? (
          <div className="rounded-2xl bg-black/30 px-3 py-2.5 ring-1 ring-white/10">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-100/70">Previous winners</div>
            <div className="flex flex-col gap-1">
              {data.champions.top.map((c, i) => (
                <div key={`${c.name}-${i}`} className="flex items-center gap-2">
                  <RankBadge rank={i + 1} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white/90">{c.name}</span>
                  <span className="font-display text-[13px] text-gold-flat tabular">{formatShort(c.win)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <button type="button" onClick={() => void load(tab)} disabled={loading} className="mx-auto flex items-center gap-1.5 text-[12px] text-violet-100/60 hover:text-violet-100" aria-label="Refresh leaderboard">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>
    </Modal>
  );
}
