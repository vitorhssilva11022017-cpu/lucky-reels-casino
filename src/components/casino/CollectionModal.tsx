import { Album } from "lucide-react";
import { toast } from "sonner";

import { GButton } from "./GButton";
import { Modal } from "./Modal";
import { CoinIcon } from "./CoinIcon";
import { CARD_ART, RARITY_STYLE } from "@/game/collections";
import { MACHINE_THEMES } from "@/game/machines";
import { useGame } from "@/game/useGame";
import type { CardSetDef } from "@/game/types";
import { formatCoins, formatShort } from "@/lib/format";
import { cn } from "@/lib/utils";

function CardTile({ setId, cardId, count }: { setId: string; cardId: string; count: number }) {
  const { config } = useGame();
  const card = config?.cardSets.flatMap((s) => s.cards).find((c) => c.id === cardId);
  const owned = count > 0;
  const style = card ? RARITY_STYLE[card.rarity] : RARITY_STYLE.common;
  const Icon = CARD_ART[cardId] ?? Album;
  return (
    <div
      className={cn("relative flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-1.5 text-center", owned ? "" : "border-white/10 bg-black/45")}
      style={owned ? { borderColor: style.color, background: style.bg, boxShadow: `0 0 12px ${style.glow}` } : undefined}
    >
      {owned ? (
        <>
          <Icon className="h-7 w-7 sm:h-9 sm:w-9" style={{ color: style.color, filter: `drop-shadow(0 0 6px ${style.glow})` }} strokeWidth={2.2} />
          <span className="text-[9px] font-bold leading-tight text-white/90 sm:text-[11px]">{card?.name}</span>
          <span className="font-display rounded-full px-1.5 text-[8px] tracking-wider sm:text-[9px]" style={{ color: style.color }}>
            {style.label}
          </span>
          {count > 1 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-b from-pink-400 to-pink-700 px-1 font-display text-[10px] text-white ring-2 ring-[#12072e] tabular">
              ×{count}
            </span>
          ) : null}
        </>
      ) : (
        <>
          <span className="font-display text-[26px] text-white/25 sm:text-[32px]">?</span>
          <span className="text-[9px] leading-tight text-white/35 sm:text-[10px]">UNKNOWN</span>
        </>
      )}
      <span className="sr-only">{setId}</span>
    </div>
  );
}

function SetPanel({ set }: { set: CardSetDef }) {
  const { player, claimCollectionSet } = useGame();
  const cards = player?.collection?.cards ?? {};
  const claimed = player?.collection?.claimed ?? [];
  const isClaimed = claimed.includes(set.id);
  const owned = set.cards.filter((c) => (cards[c.id] ?? 0) > 0).length;
  const complete = owned === set.cards.length;
  const theme = MACHINE_THEMES[set.machine];
  const accent = theme?.accent ?? "#ffd23d";

  const claim = async () => {
    const amount = await claimCollectionSet(set.id);
    if (amount !== null) toast.success(`${formatCoins(amount)} coins collected!`);
  };

  return (
    <section className="relative overflow-hidden rounded-[20px] bg-black/35 p-3 ring-1 ring-white/10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 opacity-25" style={{ background: `radial-gradient(ellipse at 50% 0%, ${accent} 0%, transparent 70%)` }} />
      <div className="relative mb-2.5 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-display truncate text-[19px] leading-none sm:text-[22px]" style={{ color: accent }}>
            {set.name}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-violet-100/60 sm:text-[12px]">
            <CoinIcon className="h-3.5 w-3.5" />
            <span>{formatShort(set.reward)} jackpot</span>
            <span>·</span>
            <span className="tabular">{owned}/{set.cards.length}</span>
          </div>
        </div>
        {isClaimed ? (
          <div className="font-display flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-b from-lime-300 via-green-500 to-green-700 px-3 py-1.5 text-[13px] text-white">
            ✓ COLLECTED
          </div>
        ) : complete ? (
          <GButton variant="green" className="glow-pulse shrink-0 rounded-full px-4 py-1.5 text-[14px]" onClick={() => void claim()}>
            <span>CLAIM</span>
          </GButton>
        ) : null}
      </div>
      <div className="relative grid grid-cols-4 gap-2">
        {set.cards.map((c) => (
          <CardTile key={c.id} setId={set.id} cardId={c.id} count={cards[c.id] ?? 0} />
        ))}
      </div>
    </section>
  );
}

/** Collection album: five machine-themed card sets with one-time jackpots. */
export function CollectionModal() {
  const { modal, setModal, config, player } = useGame();
  const open = modal === "collection";
  const sets = config?.cardSets ?? [];
  const cards = player?.collection?.cards ?? {};
  const ownedTotal = sets.reduce((s, x) => s + x.cards.filter((c) => (cards[c.id] ?? 0) > 0).length, 0);
  const totalCards = sets.reduce((s, x) => s + x.cards.length, 0);

  return (
    <Modal open={open} onClose={() => setModal(null)} title="CARD COLLECTION" className="max-w-md">
      <div className="mb-3 flex items-center justify-center gap-2 rounded-full bg-white/[0.06] px-4 py-1.5 ring-1 ring-white/10">
        <Album className="h-4 w-4 text-amber-200" strokeWidth={2.4} />
        <span className="text-[12px] text-violet-100/80">
          <b className="text-gold tabular">{ownedTotal}</b> of <b className="text-gold tabular">{totalCards}</b> cards found · win cards on every paid spin
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {sets.map((s) => (
          <SetPanel key={s.id} set={s} />
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-violet-100/45">
        Duplicate cards auto-convert to coins. Free casino coins only — no real money, ever.
      </p>
    </Modal>
  );
}
