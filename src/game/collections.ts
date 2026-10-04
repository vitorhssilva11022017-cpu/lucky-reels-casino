import {
  Bug,
  Caravan,
  Cherry,
  Citrus,
  Coins,
  Crown,
  Eye,
  Fish,
  Flame,
  Flower,
  Flower2,
  Shell,
  Shield,
  Shrub,
  Sparkles,
  Star,
  VenetianMask,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { CardRarity } from "./types";

/** Per-card art: a lucide glyph standing in for the collectible. */
export const CARD_ART: Record<string, LucideIcon> = {
  "et-mask": VenetianMask,
  "et-scarab": Bug,
  "et-eye": Eye,
  "et-lotus": Flower2,
  "nf-crown": Crown,
  "nf-cherry": Cherry,
  "nf-melon": Citrus,
  "nf-berry": Sparkles,
  "op-pearl": Shell,
  "op-seahorse": Fish,
  "op-trident": Waves,
  "op-starfish": Star,
  "df-eye": Flame,
  "df-jade": Coins,
  "df-cracker": Zap,
  "df-blossom": Flower,
  "ww-badge": Shield,
  "ww-nugget": Coins,
  "ww-coach": Caravan,
  "ww-cactus": Shrub,
};

export interface RarityStyle {
  label: string;
  /** Border + icon tint. */
  color: string;
  /** Soft glow for the owned state. */
  glow: string;
  /** Tile background gradient (owned). */
  bg: string;
}

export const RARITY_STYLE: Record<CardRarity, RarityStyle> = {
  common: { label: "COMMON", color: "#9fb4d8", glow: "rgba(159,180,216,0.45)", bg: "linear-gradient(160deg, #2c3654 0%, #161c30 100%)" },
  rare: { label: "RARE", color: "#3fd6ff", glow: "rgba(63,214,255,0.55)", bg: "linear-gradient(160deg, #0e3a5c 0%, #0c1c3a 100%)" },
  epic: { label: "EPIC", color: "#e879f9", glow: "rgba(232,121,249,0.55)", bg: "linear-gradient(160deg, #43126b 0%, #22103c 100%)" },
  legendary: { label: "LEGENDARY", color: "#ffd23d", glow: "rgba(255,210,61,0.6)", bg: "linear-gradient(160deg, #6b430a 0%, #3a2408 100%)" },
};
