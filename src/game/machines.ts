/**
 * Client-side presentation data for each machine: art, audio and colors.
 * Math and rules come from the server config; this file only describes looks,
 * so adding a machine means adding a server JSON config plus an entry here.
 */

export interface MachineTheme {
  id: string;
  title: string;
  tagline: string;
  tile: string;
  accent: string;
  glow: string;
  titleClass: string;
  symbolArt: Record<string, string>;
  backgrounds?: {
    base: { landscape: string; portrait: string };
    free: { landscape: string; portrait: string };
  };
  music?: { base: string; free: string };
  /** Optional ambient overlay drawn over the background (e.g. rising bubbles). */
  ambient?: "bubbles";
  frame?: {
    base: FramePalette;
    free: FramePalette;
  };
}

export interface FramePalette {
  glow: number;
  panelTop: string;
  panelBottom: string;
  anticipation: number;
  bulb: number;
}

const ET = "/assets/et";
const NF = "/assets/nf";
const DF = "/assets/df";
const OP = "/assets/op";
const WW = "/assets/ww";

export const MACHINE_THEMES: Record<string, MachineTheme> = {
  "egyptian-treasure": {
    id: "egyptian-treasure",
    title: "Egyptian Treasure",
    tagline: "Free spins · 2x wins",
    tile: "/assets/lobby/tile_egyptian-treasure.webp",
    accent: "#ffcf4d",
    glow: "rgba(255, 190, 40, 0.65)",
    titleClass: "font-egypt",
    symbolArt: {
      WILD: `${ET}/sym_WILD.webp`,
      SCAT: `${ET}/sym_SCAT.webp`,
      MASK: `${ET}/sym_MASK.webp`,
      SCARAB: `${ET}/sym_SCARAB.webp`,
      EYE: `${ET}/sym_EYE.webp`,
      ANKH: `${ET}/sym_ANKH.webp`,
      LOTUS: `${ET}/sym_LOTUS.webp`,
      A: `${ET}/sym_A.webp`,
      K: `${ET}/sym_K.webp`,
      Q: `${ET}/sym_Q.webp`,
      J: `${ET}/sym_J.webp`,
      TEN: `${ET}/sym_TEN.webp`,
    },
    backgrounds: {
      base: { landscape: `${ET}/bg_base_land.webp`, portrait: `${ET}/bg_base_port.webp` },
      free: { landscape: `${ET}/bg_free_land.webp`, portrait: `${ET}/bg_free_port.webp` },
    },
    music: { base: "/audio/et_music_base.mp3", free: "/audio/et_music_free.mp3" },
    frame: {
      base: { glow: 0xffb728, panelTop: "rgba(38,14,4,0.86)", panelBottom: "rgba(12,4,24,0.9)", anticipation: 0xffd84a, bulb: 0xfff0a0 },
      free: { glow: 0x3be6ff, panelTop: "rgba(6,20,44,0.86)", panelBottom: "rgba(20,6,44,0.9)", anticipation: 0x7df9ff, bulb: 0xc6fbff },
    },
  },
  "neon-fruits": {
    id: "neon-fruits",
    title: "Neon Fruits",
    tagline: "Free spins · 3x wins",
    tile: "/assets/lobby/tile_neon-fruits.webp",
    accent: "#ff2e9a",
    glow: "rgba(255, 46, 154, 0.65)",
    titleClass: "font-neon",
    symbolArt: {
      WILD: `${NF}/sym_WILD.webp`,
      SCAT: `${NF}/sym_SCAT.webp`,
      BELL: `${NF}/sym_BELL.webp`,
      MELON: `${NF}/sym_MELON.webp`,
      GRAPE: `${NF}/sym_GRAPE.webp`,
      CHERRY: `${NF}/sym_CHERRY.webp`,
      STRAW: `${NF}/sym_STRAW.webp`,
      LEMON: `${NF}/sym_LEMON.webp`,
      ORANGE: `${NF}/sym_ORANGE.webp`,
      PLUM: `${NF}/sym_PLUM.webp`,
    },
    backgrounds: {
      base: { landscape: `${NF}/bg_base_land.webp`, portrait: `${NF}/bg_base_port.webp` },
      free: { landscape: `${NF}/bg_free_land.webp`, portrait: `${NF}/bg_free_port.webp` },
    },
    music: { base: "/audio/nf_music_base.mp3", free: "/audio/nf_music_free.mp3" },
    frame: {
      base: { glow: 0xff2e9a, panelTop: "rgba(40,6,48,0.86)", panelBottom: "rgba(8,4,32,0.9)", anticipation: 0x3be6ff, bulb: 0xffb8e6 },
      free: { glow: 0x7dff4a, panelTop: "rgba(4,30,40,0.86)", panelBottom: "rgba(20,4,40,0.9)", anticipation: 0xff2e9a, bulb: 0xd8ffc0 },
    },
  },
  "dragons-fortune": {
    id: "dragons-fortune",
    title: "Dragon's Fortune",
    tagline: "Free spins · 5x wins",
    tile: "/assets/lobby/tile_dragons-fortune.webp",
    accent: "#ff5a3c",
    glow: "rgba(255, 90, 60, 0.65)",
    titleClass: "font-imperial",
    symbolArt: {
      WILD: `${DF}/sym_WILD.webp`,
      SCAT: `${DF}/sym_SCAT.webp`,
      INGOT: `${DF}/sym_INGOT.webp`,
      KOI: `${DF}/sym_KOI.webp`,
      LANTERN: `${DF}/sym_LANTERN.webp`,
      GONG: `${DF}/sym_GONG.webp`,
      FAN: `${DF}/sym_FAN.webp`,
      DRUM: `${DF}/sym_DRUM.webp`,
      COIN: `${DF}/sym_COIN.webp`,
      FIRE: `${DF}/sym_FIRE.webp`,
    },
    backgrounds: {
      base: { landscape: `${DF}/bg_base_land.webp`, portrait: `${DF}/bg_base_port.webp` },
      free: { landscape: `${DF}/bg_free_land.webp`, portrait: `${DF}/bg_free_port.webp` },
    },
    music: { base: "/audio/df_music_base.mp3", free: "/audio/df_music_free.mp3" },
    frame: {
      base: { glow: 0xff5a3c, panelTop: "rgba(46,10,6,0.86)", panelBottom: "rgba(10,4,24,0.9)", anticipation: 0xffd24a, bulb: 0xffc9a8 },
      free: { glow: 0x3be6ff, panelTop: "rgba(4,22,40,0.86)", panelBottom: "rgba(26,6,30,0.9)", anticipation: 0xff9a2e, bulb: 0xbff0ff },
    },
  },
  "ocean-pearls": {
    id: "ocean-pearls",
    title: "Ocean Pearls",
    tagline: "Free spins · 4x wins",
    tile: "/assets/lobby/tile_ocean-pearls.webp",
    accent: "#22e4ff",
    glow: "rgba(34, 228, 255, 0.65)",
    titleClass: "font-display",
    symbolArt: {
      WILD: `${OP}/sym_WILD.webp`,
      SCAT: `${OP}/sym_SCAT.webp`,
      TRIDENT: `${OP}/sym_TRIDENT.webp`,
      DOLPHIN: `${OP}/sym_DOLPHIN.webp`,
      CRAB: `${OP}/sym_CRAB.webp`,
      CORAL: `${OP}/sym_CORAL.webp`,
      STARFISH: `${OP}/sym_STARFISH.webp`,
      JELLY: `${OP}/sym_JELLY.webp`,
      ANCHOR: `${OP}/sym_ANCHOR.webp`,
      SHELL: `${OP}/sym_SHELL.webp`,
    },
    backgrounds: {
      base: { landscape: `${OP}/bg_base_land.webp`, portrait: `${OP}/bg_base_port.webp` },
      free: { landscape: `${OP}/bg_free_land.webp`, portrait: `${OP}/bg_free_port.webp` },
    },
    music: { base: "/audio/op_music_base.mp3", free: "/audio/op_music_free.mp3" },
    frame: {
      base: { glow: 0x22e4ff, panelTop: "rgba(2,30,46,0.86)", panelBottom: "rgba(4,10,34,0.9)", anticipation: 0xffd84a, bulb: 0xbff6ff },
      free: { glow: 0xff4fd8, panelTop: "rgba(30,6,50,0.86)", panelBottom: "rgba(2,24,44,0.9)", anticipation: 0x7df9ff, bulb: 0xffc6f2 },
    },
    ambient: "bubbles",
  },
  "wild-west-gold": {
    id: "wild-west-gold",
    title: "Wild West Gold",
    tagline: "Free spins · 6x wins",
    tile: "/assets/lobby/tile_wild-west-gold.webp",
    accent: "#ffb020",
    glow: "rgba(255, 176, 32, 0.65)",
    titleClass: "font-western",
    symbolArt: {
      WILD: `${WW}/sym_WILD.webp`,
      SCAT: `${WW}/sym_SCAT.webp`,
      BADGE: `${WW}/sym_BADGE.webp`,
      NUGGET: `${WW}/sym_NUGGET.webp`,
      COACH: `${WW}/sym_COACH.webp`,
      MUSTANG: `${WW}/sym_MUSTANG.webp`,
      HAT: `${WW}/sym_HAT.webp`,
      BOOT: `${WW}/sym_BOOT.webp`,
      DYNAMITE: `${WW}/sym_DYNAMITE.webp`,
      HSHOE: `${WW}/sym_HSHOE.webp`,
    },
    backgrounds: {
      base: { landscape: `${WW}/bg_base_land.webp`, portrait: `${WW}/bg_base_port.webp` },
      free: { landscape: `${WW}/bg_free_land.webp`, portrait: `${WW}/bg_free_port.webp` },
    },
    music: { base: "/audio/ww_music_base.mp3", free: "/audio/ww_music_free.mp3" },
    frame: {
      base: { glow: 0xffb020, panelTop: "rgba(46,20,4,0.86)", panelBottom: "rgba(16,6,26,0.9)", anticipation: 0xffd84a, bulb: 0xffdf9e },
      free: { glow: 0xffd84a, panelTop: "rgba(26,6,46,0.86)", panelBottom: "rgba(30,18,4,0.9)", anticipation: 0xffe07a, bulb: 0xfff0b8 },
    },
  },
};

/** Common sound effects shared by every machine. */
export const SFX = {
  click: "/audio/click.mp3",
  coin: "/audio/coin_collect.mp3",
  levelUp: "/audio/level_up.mp3",
  wheelTick: "/audio/wheel_tick.mp3",
  reelSpin: "/audio/reel_spin.mp3",
  reelStop: "/audio/reel_stop.mp3",
  anticipation: "/audio/anticipation.mp3",
  smallWin: "/audio/small_win.mp3",
  bigWin: "/audio/big_win.mp3",
  scatter: "/audio/scatter_land.mp3",
} as const;

export type SfxName = keyof typeof SFX;

export const LOBBY_MUSIC = "/audio/lobby_music.mp3";

/** Sounds only needed once a machine is opened (lazy-loaded with its art). */
export const MACHINE_SFX: SfxName[] = ["reelSpin", "reelStop", "anticipation", "smallWin", "bigWin", "scatter"];
/** Sounds needed in the lobby right away (tiny files). */
export const CORE_SFX: SfxName[] = ["click", "coin", "levelUp", "wheelTick"];
