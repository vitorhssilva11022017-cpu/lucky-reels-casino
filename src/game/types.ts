/** Shared client types mirroring the backend API. The client never computes outcomes. */

export type SymbolKind = "wild" | "scatter" | "high" | "low";

export interface SymbolDef {
  id: string;
  name: string;
  kind: SymbolKind;
}

export interface PublicMachine {
  id: string;
  name: string;
  reels: number;
  rows: number;
  symbols: SymbolDef[];
  wild: string;
  scatter: string;
  paylines: number[][];
  paytable: Record<string, number[]>;
  scatterPays: number[];
  freeSpins: { awards: Record<string, number>; multiplier: number; retrigger: boolean };
  betLevels: number[];
  betUnlockLevels: number[];
  defaultBetIndex: number;
  winTiers: { big: number; mega: number; epic: number };
}

export interface MachineListing {
  id: string;
  name: string;
  unlockLevel: number;
  badge: "new" | "hot" | null;
  playable: boolean;
}

export interface StorePack {
  id: string;
  name: string;
  amount: number;
  cooldownMs: number;
}

export interface GameConfig {
  machines: MachineListing[];
  machineConfigs: Record<string, PublicMachine>;
  wheel: number[];
  store: StorePack[];
  cardSets: CardSetDef[];
  jackpot: { value: number; perSecond: number; serverTime: number };
}

export interface FreeSpinState {
  machineId: string;
  remaining: number;
  total: number;
  totalWin: number;
  bet: number;
  betIndex: number;
}

export type MissionKind = "spins" | "wager" | "win" | "machines" | "bonus" | "freeSpins" | "bigWin";

export interface Mission {
  id: string;
  kind: MissionKind;
  tier: "easy" | "medium" | "hard";
  target: number;
  progress: number;
  reward: number;
  claimed: boolean;
}

export interface MissionsState {
  missions: Mission[];
  chestReward: number;
  chestClaimed: boolean;
  resetAt: number;
}

export interface StreakState {
  count: number;
  best: number;
  claimedToday: boolean;
  broken: boolean;
  cycleDay: number;
  rewards: number[];
  resetAt: number;
}

export interface VipTierInfo {
  id: string;
  name: string;
  minPoints: number;
  gift: number;
}

export interface VipStatus {
  points: number;
  tierIndex: number;
  tierId: string;
  tierName: string;
  gift: number;
  giftReady: boolean;
  nextTierName: string | null;
  pointsToNext: number | null;
  tiers: VipTierInfo[];
  resetsAt: number;
}

export interface RewardTier {
  minRank: number;
  amount: number;
}

export type RaceBoard = "wins" | "wagers";

export interface BoardEntry {
  rank: number;
  name: string;
  level: number;
  /** Ranked metric: biggest single win, or total wagered on the wagered board. */
  win: number;
  /** Total wagered this week (wagered board only). */
  wager?: number;
  /** Paid spins this week (wagered board only). */
  spins?: number;
  /** VIP tier name at record time, if the entry was posted by a VIP-aware backend. */
  vip?: string;
  machine: string;
  ts: number;
}

export interface RaceChampions {
  week: string;
  top: { name: string; level: number; win: number }[];
}

export interface LeaderboardState {
  board: RaceBoard;
  week: string;
  endsAt: number;
  entries: BoardEntry[];
  you: { rank: number; win: number } | null;
  rewardTiers: RewardTier[];
  /** Podium of the previous week, archived at rollover. */
  champions?: RaceChampions | null;
  /** This player's final rank in last week's race, when it earned a prize. Only finished weeks pay out. */
  lastWeek?: { week: string; rank: number; amount: number; claimed: boolean } | null;
}

export interface ReferralInfo {
  /** This player's shareable invite code. */
  code: string;
  /** True once this player has joined through someone's invite. */
  used: boolean;
  /** Friends who joined through this player's code. */
  invited: number;
  /** Coins a friend receives when they claim an invite. */
  welcomeReward: number;
  /** Coins the inviter earns per friend. */
  perFriendReward: number;
  /** Whether this player may still redeem an invite code. */
  eligible: boolean;
}

export type CardRarity = "common" | "rare" | "epic" | "legendary";

export interface CardDef {
  id: string;
  name: string;
  setId: string;
  rarity: CardRarity;
}

export interface CardSetDef {
  id: string;
  machine: string;
  name: string;
  reward: number;
  cards: CardDef[];
}

/** Card drop carried on a paid spin response. */
export interface CardDrop {
  card: string;
  name: string;
  setId: string;
  rarity: CardRarity;
  duplicate: boolean;
  dupCoins: number;
  setComplete: boolean;
}

export interface CollectionState {
  /** Card id -> copies owned. */
  cards: Record<string, number>;
  /** Set ids whose completion jackpot has been claimed. */
  claimed: string[];
}

export interface Player {
  identity: "guest" | "user";
  displayName: string | null;
  balance: number;
  level: number;
  xp: number;
  xpToNext: number;
  nextBonusAt: number;
  bonusAmount: number;
  nextWheelAt: number;
  wheelMultiplier: number;
  storeReadyAt: Record<string, number>;
  settings: { music: boolean; sfx: boolean };
  tutorialDone: boolean;
  freeSpins: FreeSpinState | null;
  totalSpins: number;
  biggestWin: number;
  missions: MissionsState | null;
  boardClaimWeek: string | null;
  wagerClaimWeek: string | null;
  /** Lucky VIP club status; null only against an outdated backend. */
  vip: VipStatus | null;
  streak: StreakState;
  /** Invite-friends program status; null only against an outdated backend. */
  referral: ReferralInfo | null;
  /** Collection album progress; null only against an outdated backend. */
  collection: CollectionState | null;
  serverTime: number;
}

export interface LineWin {
  line: number;
  symbol: string;
  count: number;
  positions: [number, number][];
  amount: number;
}

export interface ScatterResult {
  count: number;
  positions: [number, number][];
  amount: number;
  freeSpinsAwarded: number;
}

export interface SpinOutcome {
  grid: string[][];
  wins: LineWin[];
  scatter: ScatterResult;
  lineWin: number;
  totalWin: number;
  anticipationFrom: number;
}

export type WinTier = "none" | "big" | "mega" | "epic";

export interface LevelUp {
  level: number;
  reward: number;
  unlockedMachines: string[];
  unlockedBets: number[];
}

export interface SpinResponse {
  outcome: SpinOutcome;
  bet: number;
  betIndex: number;
  isFreeSpin: boolean;
  multiplier: number;
  tier: WinTier;
  freeSpinsTriggered: number;
  freeSpinsSummary: { totalWin: number; spins: number; bet: number } | null;
  summaryTier: WinTier;
  levelUps: LevelUp[];
  /** Card drop from this paid spin, if any. */
  cardDrop: CardDrop | null;
  scripted: boolean;
  player: Player;
}
