// @ts-nocheck
/**
 * Collections album: five machine-themed card sets, four cards each.
 * Paid spins can drop cards (server-decided). Duplicates auto-convert to
 * coins; completing a set pays a one-time jackpot. Purely virtual rewards.
 */

export type CardRarity = "common" | "rare" | "epic" | "legendary";

export interface CardDef {
  id: string;
  name: string;
  setId: string;
  rarity: CardRarity;
}

export interface CardSetDef {
  id: string;
  /** Machine that inspires the set; the client uses its theme colors. */
  machine: string;
  name: string;
  reward: number;
  cards: CardDef[];
}

function set(
  id: string,
  machine: string,
  name: string,
  reward: number,
  cards: [string, string, CardRarity][],
): CardSetDef {
  return {
    id,
    machine,
    name,
    reward,
    cards: cards.map(([cardId, cardName, rarity]) => ({ id: cardId, name: cardName, setId: id, rarity })),
  };
}

export const CARD_SETS: CardSetDef[] = [
  set("et-set", "egyptian-treasure", "Egyptian Treasure", 3_000_000, [
    ["et-mask", "Pharaoh's Mask", "legendary"],
    ["et-scarab", "Golden Scarab", "epic"],
    ["et-eye", "Eye of Ra", "rare"],
    ["et-lotus", "Lotus Charm", "common"],
  ]),
  set("nf-set", "neon-fruits", "Neon Fruits", 4_000_000, [
    ["nf-crown", "Neon Crown", "legendary"],
    ["nf-cherry", "Laser Cherry", "epic"],
    ["nf-melon", "Glow Melon", "rare"],
    ["nf-berry", "Star Berry", "common"],
  ]),
  set("op-set", "ocean-pearls", "Ocean Pearls", 8_000_000, [
    ["op-pearl", "Great Pearl", "legendary"],
    ["op-seahorse", "Golden Seahorse", "epic"],
    ["op-trident", "Trident of Tides", "rare"],
    ["op-starfish", "Lucky Starfish", "common"],
  ]),
  set("df-set", "dragons-fortune", "Dragon's Fortune", 12_000_000, [
    ["df-eye", "Dragon's Eye", "legendary"],
    ["df-jade", "Jade Coin", "epic"],
    ["df-cracker", "Firecracker", "rare"],
    ["df-blossom", "Peach Blossom", "common"],
  ]),
  set("ww-set", "wild-west-gold", "Wild West Gold", 20_000_000, [
    ["ww-badge", "Sheriff's Badge", "legendary"],
    ["ww-nugget", "Gold Nugget", "epic"],
    ["ww-coach", "Stagecoach", "rare"],
    ["ww-cactus", "Cactus Flower", "common"],
  ]),
];

const CARDS: CardDef[] = CARD_SETS.flatMap((s) => s.cards);

const CARDS_BY_RARITY: Record<CardRarity, CardDef[]> = {
  common: CARDS.filter((c) => c.rarity === "common"),
  rare: CARDS.filter((c) => c.rarity === "rare"),
  epic: CARDS.filter((c) => c.rarity === "epic"),
  legendary: CARDS.filter((c) => c.rarity === "legendary"),
};

/** Coins a duplicate card converts to, by rarity. */
export const DUPLICATE_VALUE: Record<CardRarity, number> = {
  common: 25_000,
  rare: 100_000,
  epic: 500_000,
  legendary: 2_500_000,
};

/** Chance per paid spin to drop a card (percent). */
export const DROP_CHANCE = 10;

/** Rarity weights in percent, most to least common. */
const RARITY_WEIGHTS: [CardRarity, number][] = [
  ["common", 70],
  ["rare", 22],
  ["epic", 7],
  ["legendary", 1],
];

/** Number of cards in a set the player owns at least one of. */
export function setProgress(owned: Record<string, number>, setId: string): number {
  const s = CARD_SETS.find((x) => x.id === setId);
  if (!s) return 0;
  return s.cards.filter((c) => (owned[c.id] ?? 0) > 0).length;
}

/** Whether every card of the set has been found at least once. */
export function setComplete(owned: Record<string, number>, setId: string): boolean {
  const s = CARD_SETS.find((x) => x.id === setId);
  return Boolean(s) && setProgress(owned, setId) === (s as CardSetDef).cards.length;
}

/**
 * Rolls a card drop for a paid spin. Unowned cards are 3x more likely, so the
 * album keeps moving forward while duplicates still happen and pay coins.
 * `rng(max)` must return an integer in [0, max).
 */
export function rollCardDrop(rng: (max: number) => number, owned: Record<string, number>): CardDef | null {
  if (rng(100) >= DROP_CHANCE) return null;
  let roll = rng(100);
  let rarity: CardRarity = "common";
  for (const [r, w] of RARITY_WEIGHTS) {
    if (roll < w) {
      rarity = r;
      break;
    }
    roll -= w;
  }
  const pool = CARDS_BY_RARITY[rarity];
  const weights = pool.map((c) => ((owned[c.id] ?? 0) > 0 ? 1 : 3));
  let pick = rng(weights.reduce((s, w) => s + w, 0));
  for (let i = 0; i < pool.length; i++) {
    pick -= weights[i];
    if (pick < 0) return pool[i];
  }
  return pool[pool.length - 1];
}
