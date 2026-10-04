// @ts-nocheck
import { MACHINE_LISTINGS, MACHINES } from "./engine/machines.js";
import {
  BONUS_INTERVAL_MS,
  freeBonusAmount,
  levelUpReward,
  MAX_LEVEL,
  START_BALANCE,
  STORE_PACKS,
  WHEEL_INTERVAL_MS,
  WHEEL_SEGMENTS,
  wheelMultiplier,
  xpForBet,
  xpToNext,
} from "./engine/progression.js";
import { CARD_SETS, DUPLICATE_VALUE, rollCardDrop, setComplete } from "./engine/collections.js";
import { createDailyMissions, type DailyMissions, dayKey, nextResetAt, trackMission } from "./engine/missions.js";
import { secureRng } from "./engine/rng.js";
import { REFERRAL_PER_FRIEND, REFERRAL_WELCOME, newReferralCode, referralEligible } from "./engine/referral.js";
import { claimStreak, emptyStreak, type StreakData, streakStatus } from "./engine/streak.js";
import { pointsForWager, tierFor, vipStatus } from "./engine/vip.js";
import { BOARD_SIZE, boardReward, REWARD_TIERS, weekEnd, weekKey } from "./engine/week.js";
import { evaluateGrid, playSpin, winTier } from "./engine/slot.js";
import type { SpinOutcome } from "./engine/types.js";
import { JsonStore } from "./store.js";
import crypto from "crypto";

interface FreeSpinState {
  machineId: string;
  remaining: number;
  total: number;
  totalWin: number;
  bet: number;
  betIndex: number;
}

export interface PlayerData {
  id: string;
  createdAt: number;
  balance: number;
  level: number;
  xp: number;
  tutorialDone: boolean;
  tutorialScriptUsed: boolean;
  nextBonusAt: number;
  nextWheelAt: number;
  storeReadyAt: Record<string, number>;
  settings: { music: boolean; sfx: boolean };
  freeSpins: FreeSpinState | null;
  totalSpins: number;
  biggestWin: number;
  displayName: string | null;
  guestSecretHash: string | null;
  mergedInto: string | null;
  missions?: DailyMissions | null;
  streak?: StreakData;
  boardId: string;
  boardClaimWeek: string | null;
  wagerClaimWeek: string | null;
  vipPoints: number;
  vipGiftDay: string | null;
  refCode?: string;
  refBy?: string | null;
  refCount?: number;
  cards?: Record<string, number>;
  setClaimed?: string[];
}

export interface BoardEntryData {
  boardId: string;
  name: string;
  level: number;
  win: number;
  machine: string;
  ts: number;
  spins?: number;
  vip?: string;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const playersStore = new JsonStore<PlayerData>("players.json");
export const boardStore = new JsonStore<{ week: string }>("boardMeta.json");
export const boardEntriesStore = new JsonStore<BoardEntryData>("boardEntries.json");
export const wagerEntriesStore = new JsonStore<BoardEntryData>("wagerEntries.json");
export const refStore = new JsonStore<{ owner: string; name?: string }>("refs.json");

function hashStr(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function freshPlayer(id: string, now: number): PlayerData {
  return {
    id,
    createdAt: now,
    balance: START_BALANCE,
    level: 1,
    xp: 0,
    tutorialDone: false,
    tutorialScriptUsed: false,
    nextBonusAt: now,
    nextWheelAt: now,
    storeReadyAt: {},
    settings: { music: true, sfx: true },
    freeSpins: null,
    totalSpins: 0,
    biggestWin: 0,
    displayName: null,
    guestSecretHash: null,
    mergedInto: null,
    boardId: crypto.randomUUID(),
    boardClaimWeek: null,
    wagerClaimWeek: null,
    vipPoints: 0,
    vipGiftDay: null,
    refCode: newReferralCode(),
    refBy: null,
    refCount: 0,
    cards: {},
    setClaimed: [],
  };
}

export class PlayerService {
  constructor(private playerId: string) {}

  private get data(): PlayerData {
    const d = playersStore.get(this.playerId);
    if (!d) throw new HttpError(409, "no_session", "Start a session first");
    if (d.mergedInto) throw new HttpError(410, "merged", "This guest profile was moved to an account");
    return d;
  }

  private save() {
    playersStore.set(this.playerId, this.data);
  }

  async verifyGuest(secret: string) {
    const d = playersStore.get(this.playerId);
    if (!d) return;
    if (!d.guestSecretHash || hashStr(secret) !== d.guestSecretHash) {
      throw new HttpError(401, "bad_guest", "Guest credentials do not match");
    }
  }

  async session(isGuest: boolean, guestSecret: string, body: Record<string, unknown>) {
    const now = Date.now();
    const displayName = typeof body.displayName === "string" ? body.displayName.slice(0, 40) : null;
    let d = playersStore.get(this.playerId);

    if (d?.mergedInto) {
      throw new HttpError(410, "merged", "This guest profile was moved to an account");
    }

    if (!d) {
      if (isGuest && guestSecret.length < 32) throw new HttpError(400, "bad_guest", "Invalid guest credentials");
      const imported = body.import as PlayerData | null | undefined;
      const next: PlayerData = imported ? { ...imported, id: this.playerId, guestSecretHash: null, mergedInto: null } : freshPlayer(this.playerId, now);
      if (isGuest) next.guestSecretHash = hashStr(guestSecret);
      playersStore.set(this.playerId, next);
      d = next;
    } else if (isGuest) {
      await this.verifyGuest(guestSecret);
    }

    if (!isGuest && displayName) d.displayName = displayName;
    if (!d.boardId) d.boardId = crypto.randomUUID();
    this.ensureMissions(d);
    this.ensureCode(d);
    this.save();
    this.registerCode(d);
    return { player: this.publicPlayer(isGuest), merged: Boolean(body.import) };
  }

  private ensureCode(d: PlayerData) {
    if (!d.refCode) {
      d.refCode = newReferralCode();
      this.save();
    }
    return d.refCode;
  }

  private registerCode(d: PlayerData) {
    if (!d.refCode) return;
    refStore.set(d.refCode, { owner: this.playerId, name: this.boardName(d) });
  }

  private boardName(d: PlayerData): string {
    if (d.displayName) return d.displayName;
    let hash = 0;
    for (const ch of d.boardId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `Player #${1000 + (hash % 9000)}`;
  }

  async claimSetReward(body: Record<string, unknown>) {
    const d = this.data;
    const setId = String(body.setId ?? "");
    const set = CARD_SETS.find((s) => s.id === setId);
    if (!set) throw new HttpError(404, "unknown_set", "Set not found");
    const claimed = d.setClaimed ?? [];
    if (claimed.includes(setId)) throw new HttpError(409, "already_claimed", "This set reward is already collected");
    if (!setComplete(d.cards ?? {}, setId)) throw new HttpError(409, "not_ready", "Collect all cards in this set first");
    claimed.push(setId);
    d.setClaimed = claimed;
    d.balance += set.reward;
    this.save();
    return { amount: set.reward, setId, player: this.publicPlayer(null) };
  }

  async claimReferral(body: Record<string, unknown>) {
    const d = this.data;
    if (d.refBy) throw new HttpError(409, "already_used", "You already joined with an invite");
    if (!referralEligible(d.level, false)) {
      throw new HttpError(403, "not_eligible", "Invite codes are only for new players");
    }
    const code = String(body.code ?? "").trim().toUpperCase().slice(0, 12);
    if (!/^[A-Z2-9]{6,12}$/.test(code)) throw new HttpError(400, "bad_code", "That invite code doesn't look right");
    this.ensureCode(d);
    const rec = refStore.get(code);
    const owner = rec?.owner ?? "";
    if (!owner) throw new HttpError(404, "unknown_code", "Invite code not found");
    if (owner === this.playerId) throw new HttpError(400, "own_code", "You can't use your own invite code");

    d.refBy = owner;
    d.balance += REFERRAL_WELCOME;
    this.save();
    
    // Credit inviter
    const inviter = playersStore.get(owner);
    if (inviter) {
      if (inviter.mergedInto) {
         const accountInviter = playersStore.get(inviter.mergedInto);
         if (accountInviter) {
             accountInviter.refCount = (accountInviter.refCount ?? 0) + 1;
             accountInviter.balance += REFERRAL_PER_FRIEND;
             playersStore.set(inviter.mergedInto, accountInviter);
         }
      } else {
        inviter.refCount = (inviter.refCount ?? 0) + 1;
        inviter.balance += REFERRAL_PER_FRIEND;
        playersStore.set(owner, inviter);
      }
    }
    return { amount: REFERRAL_WELCOME, player: this.publicPlayer(null) };
  }

  async spin(body: Record<string, unknown>) {
    const d = this.data;
    const machineId = String(body.machineId ?? "");
    const cfg = MACHINES[machineId];
    if (!cfg) throw new HttpError(404, "unknown_machine", "Machine not found");
    const listing = MACHINE_LISTINGS.find((m) => m.id === machineId);
    if (listing && listing.unlockLevel > d.level) {
      throw new HttpError(403, "machine_locked", `Unlocks at level ${listing.unlockLevel}`);
    }

    const fs = d.freeSpins;
    if (fs && fs.machineId !== machineId) {
      throw new HttpError(409, "free_spins_pending", "Finish your free spins first");
    }

    const isFreeSpin = Boolean(fs && fs.remaining > 0);
    let bet: number;
    let betIndex: number;
    let multiplier = 1;

    if (isFreeSpin && fs) {
      bet = fs.bet;
      betIndex = fs.betIndex;
      multiplier = cfg.freeSpins.multiplier;
      fs.remaining -= 1;
    } else {
      betIndex = Number(body.betIndex);
      if (!Number.isInteger(betIndex) || betIndex < 0 || betIndex >= cfg.betLevels.length) {
        throw new HttpError(400, "bad_bet", "Invalid bet");
      }
      if ((cfg.betUnlockLevels[betIndex] ?? 1) > d.level) {
        throw new HttpError(403, "bet_locked", `This bet unlocks at level ${cfg.betUnlockLevels[betIndex]}`);
      }
      bet = cfg.betLevels[betIndex];
      if (d.balance < bet) throw new HttpError(402, "insufficient_balance", "Not enough coins");
      d.balance -= bet;
    }

    const useScript = !isFreeSpin && body.tutorial === true && !d.tutorialScriptUsed && Boolean(cfg.tutorialGrid);
    let outcome: SpinOutcome;
    if (useScript && cfg.tutorialGrid) {
      outcome = { stops: [], ...evaluateGrid(cfg, cfg.tutorialGrid, bet, 1) };
      d.tutorialScriptUsed = true;
    } else {
      outcome = playSpin(cfg, secureRng, bet, multiplier);
    }

    d.balance += outcome.totalWin;
    d.totalSpins += 1;
    if (outcome.totalWin > d.biggestWin) d.biggestWin = outcome.totalWin;

    const awarded = outcome.scatter.freeSpinsAwarded;
    let freeSpinsTriggered = 0;
    let freeSpinsSummary: { totalWin: number; spins: number; bet: number } | null = null;

    if (isFreeSpin && fs) {
      fs.totalWin += outcome.totalWin;
      if (awarded > 0 && cfg.freeSpins.retrigger) {
        fs.remaining += awarded;
        fs.total += awarded;
        freeSpinsTriggered = awarded;
      }
      if (fs.remaining <= 0) {
        freeSpinsSummary = { totalWin: fs.totalWin, spins: fs.total, bet: fs.bet };
        d.freeSpins = null;
      }
    } else if (awarded > 0) {
      d.freeSpins = { machineId, remaining: awarded, total: awarded, totalWin: 0, bet, betIndex };
      freeSpinsTriggered = awarded;
    }

    const tier = winTier(cfg, outcome.totalWin, bet);
    const dm = this.ensureMissions(d);
    let cardDrop = null;
    
    if (!isFreeSpin) {
      trackMission(dm, "spins", 1);
      trackMission(dm, "wager", bet);
      trackMission(dm, "machines", 1, machineId);
      if (awarded > 0) trackMission(dm, "freeSpins", 1);
      d.vipPoints = Math.min(Number.MAX_SAFE_INTEGER, (d.vipPoints ?? 0) + pointsForWager(bet));
      d.cards ??= {};
      const drop = rollCardDrop(secureRng, d.cards);
      if (drop) {
        const duplicate = (d.cards[drop.id] ?? 0) > 0;
        d.cards[drop.id] = (d.cards[drop.id] ?? 0) + 1;
        let dupCoins = 0;
        if (duplicate) {
          dupCoins = DUPLICATE_VALUE[drop.rarity];
          d.balance += dupCoins;
        }
        cardDrop = {
          card: drop.id,
          name: drop.name,
          setId: drop.setId,
          rarity: drop.rarity,
          duplicate,
          dupCoins,
          setComplete: !duplicate && setComplete(d.cards, drop.setId),
        };
      }
    }
    trackMission(dm, "win", outcome.totalWin);
    if (tier !== "none") trackMission(dm, "bigWin", 1);

    const levelUps = isFreeSpin ? [] : this.applyXp(d, xpForBet(bet));

    if (outcome.totalWin >= bet * 2) {
      this.reportBoardWin(d, machineId, outcome.totalWin);
    }
    if (!isFreeSpin) {
      this.reportWager(d, machineId, bet);
    }
    this.save();

    return {
      outcome: {
        grid: outcome.grid,
        wins: outcome.wins,
        scatter: outcome.scatter,
        lineWin: outcome.lineWin,
        totalWin: outcome.totalWin,
        anticipationFrom: outcome.anticipationFrom,
      },
      bet,
      betIndex,
      isFreeSpin,
      multiplier,
      tier,
      freeSpinsTriggered,
      freeSpinsSummary,
      summaryTier: freeSpinsSummary ? winTier(cfg, freeSpinsSummary.totalWin, freeSpinsSummary.bet) : "none",
      levelUps,
      cardDrop,
      scripted: useScript,
      player: this.publicPlayer(null),
    };
  }

  private applyXp(d: PlayerData, gained: number) {
    const levelUps: Array<{ level: number; reward: number; unlockedMachines: string[]; unlockedBets: number[] }> = [];
    d.xp += gained;
    while (d.level < MAX_LEVEL && d.xp >= xpToNext(d.level)) {
      d.xp -= xpToNext(d.level);
      d.level += 1;
      const reward = levelUpReward(d.level);
      d.balance += reward;
      const unlockedMachines = MACHINE_LISTINGS.filter((m) => m.unlockLevel === d.level).map((m) => m.name);
      const unlockedBets: number[] = [];
      for (const cfg of Object.values(MACHINES)) {
        cfg.betUnlockLevels.forEach((lvl, i) => {
          if (lvl === d.level && !unlockedBets.includes(cfg.betLevels[i])) unlockedBets.push(cfg.betLevels[i]);
        });
      }
      levelUps.push({ level: d.level, reward, unlockedMachines, unlockedBets });
    }
    return levelUps;
  }

  async collectBonus() {
    const d = this.data;
    const now = Date.now();
    if (now < d.nextBonusAt) throw new HttpError(409, "not_ready", "Bonus is not ready yet");
    const amount = freeBonusAmount(d.level);
    d.balance += amount;
    d.nextBonusAt = now + BONUS_INTERVAL_MS;
    trackMission(this.ensureMissions(d), "bonus", 1);
    this.save();
    return { amount, player: this.publicPlayer(null) };
  }

  async spinWheel() {
    const d = this.data;
    const now = Date.now();
    if (now < d.nextWheelAt) throw new HttpError(409, "not_ready", "The wheel is not ready yet");
    const totalWeight = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);
    let roll = secureRng(totalWeight);
    let index = 0;
    for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
      roll -= WHEEL_SEGMENTS[i].weight;
      if (roll < 0) {
        index = i;
        break;
      }
    }
    const amount = Math.round(WHEEL_SEGMENTS[index].amount * wheelMultiplier(d.level));
    d.balance += amount;
    d.nextWheelAt = now + WHEEL_INTERVAL_MS;
    this.save();
    return { index, amount, player: this.publicPlayer(null) };
  }

  async claimPack(packId: string) {
    const d = this.data;
    const pack = STORE_PACKS.find((p) => p.id === packId);
    if (!pack) throw new HttpError(404, "unknown_pack", "Pack not found");
    const now = Date.now();
    if (now < (d.storeReadyAt[pack.id] ?? 0)) throw new HttpError(409, "not_ready", "This pack is cooling down");
    d.balance += pack.amount;
    d.storeReadyAt[pack.id] = now + pack.cooldownMs;
    this.save();
    return { amount: pack.amount, player: this.publicPlayer(null) };
  }

  private ensureMissions(d: PlayerData): DailyMissions {
    const now = Date.now();
    if (!d.missions || d.missions.day !== dayKey(now)) {
      d.missions = createDailyMissions(now, d.level, this.playerId);
    }
    return d.missions;
  }

  async claimMission(body: Record<string, unknown>) {
    const d = this.data;
    const dm = this.ensureMissions(d);
    let amount = 0;
    if (body.chest === true) {
      if (dm.chestClaimed) throw new HttpError(409, "already_claimed", "Chest already opened today");
      if (!dm.missions.every((m) => m.claimed)) throw new HttpError(409, "not_ready", "Finish all missions first");
      dm.chestClaimed = true;
      amount = dm.chestReward;
    } else {
      const mission = dm.missions.find((m) => m.id === String(body.missionId ?? ""));
      if (!mission) throw new HttpError(404, "unknown_mission", "This mission has expired");
      if (mission.claimed) throw new HttpError(409, "already_claimed", "Reward already collected");
      if (mission.progress < mission.target) throw new HttpError(409, "not_ready", "Mission not complete yet");
      mission.claimed = true;
      amount = mission.reward;
    }
    d.balance += amount;
    this.save();
    return { amount, player: this.publicPlayer(null) };
  }

  private checkBoardWeek() {
    const now = Date.now();
    const week = weekKey(now);
    const meta = boardStore.get("meta");
    if (!meta || meta.week !== week) {
      boardEntriesStore.values().forEach(e => boardEntriesStore.delete(e.boardId));
      wagerEntriesStore.values().forEach(e => wagerEntriesStore.delete(e.boardId));
      boardStore.set("meta", { week });
    }
    return week;
  }

  private reportBoardWin(d: PlayerData, machineId: string, win: number) {
    this.checkBoardWeek();
    const current = boardEntriesStore.get(d.boardId);
    if (current && current.win >= win) return;
    boardEntriesStore.set(d.boardId, {
      boardId: d.boardId,
      name: this.boardName(d),
      level: d.level,
      win,
      machine: machineId,
      ts: Date.now(),
      vip: tierFor(d.vipPoints ?? 0).name,
    });
  }

  private reportWager(d: PlayerData, machineId: string, bet: number) {
    this.checkBoardWeek();
    const current = wagerEntriesStore.get(d.boardId);
    wagerEntriesStore.set(d.boardId, {
      boardId: d.boardId,
      name: this.boardName(d),
      level: d.level,
      win: Math.min((current?.win ?? 0) + bet, Number.MAX_SAFE_INTEGER),
      machine: machineId,
      ts: current?.ts ?? Date.now(),
      spins: (current?.spins ?? 0) + 1,
      vip: tierFor(d.vipPoints ?? 0).name,
    });
  }

  async getLeaderboard(board: "wins" | "wagers") {
    const d = this.data;
    const week = this.checkBoardWeek();
    const store = board === "wagers" ? wagerEntriesStore : boardEntriesStore;
    const all = store.values().sort((a, b) => b.win - a.win || a.ts - b.ts);
    const idx = all.findIndex(e => e.boardId === d.boardId);
    
    return {
      board,
      week,
      endsAt: weekEnd(Date.now()),
      entries: all.slice(0, BOARD_SIZE).map((e, i) => ({
        rank: i + 1,
        name: e.name,
        level: e.level,
        win: e.win,
        wager: board === "wagers" ? e.win : undefined,
        spins: board === "wagers" ? e.spins ?? 0 : undefined,
        machine: e.machine,
        ts: e.ts,
        vip: e.vip,
      })),
      you: idx >= 0 ? { rank: idx + 1, win: all[idx].win } : null,
      rewardTiers: REWARD_TIERS,
      champions: null,
    };
  }

  async claimBoardReward(board: "wins" | "wagers") {
    const d = this.data;
    const now = Date.now();
    const week = weekKey(now);
    const wagered = board === "wagers";
    if ((wagered ? d.wagerClaimWeek : d.boardClaimWeek) === week) {
      throw new HttpError(409, "already_claimed", "This week's reward is already collected");
    }
    
    this.checkBoardWeek();
    const store = wagered ? wagerEntriesStore : boardEntriesStore;
    const all = store.values().sort((a, b) => b.win - a.win || a.ts - b.ts);
    const idx = all.findIndex(e => e.boardId === d.boardId);
    const rank = idx >= 0 ? idx + 1 : null;
    
    if (!rank || rank < 1 || rank > BOARD_SIZE) throw new HttpError(409, "not_ready", "Reach a paid rank to claim a weekly prize");
    const amount = boardReward(rank);
    if (amount <= 0) throw new HttpError(409, "not_ready", "No reward for this rank");
    
    d.balance += amount;
    if (wagered) d.wagerClaimWeek = week;
    else d.boardClaimWeek = week;
    this.save();
    return { amount, rank, board, player: this.publicPlayer(null) };
  }

  async claimVipGift() {
    const d = this.data;
    const now = Date.now();
    const day = dayKey(now);
    if (d.vipGiftDay === day) throw new HttpError(409, "already_claimed", "Today's VIP gift is already collected");
    const amount = vipStatus(d.vipPoints ?? 0, d.vipGiftDay ?? null, now).gift;
    d.vipGiftDay = day;
    d.balance += amount;
    this.save();
    return { amount, player: this.publicPlayer(null) };
  }

  async claimDailyStreak() {
    const d = this.data;
    d.streak ??= emptyStreak();
    const res = claimStreak(d.streak, d.level, Date.now());
    if (!res) throw new HttpError(409, "already_claimed", "Today's reward is already collected");
    d.balance += res.amount;
    this.save();
    return { amount: res.amount, day: res.day, player: this.publicPlayer(null) };
  }

  async updateSettings(body: Record<string, unknown>) {
    const d = this.data;
    if (typeof body.music === "boolean") d.settings.music = body.music;
    if (typeof body.sfx === "boolean") d.settings.sfx = body.sfx;
    this.save();
    return { player: this.publicPlayer(null) };
  }

  async setTutorial(done: boolean) {
    const d = this.data;
    d.tutorialDone = done;
    this.save();
    return { player: this.publicPlayer(null) };
  }

  publicPlayer(isGuest: boolean | null) {
    const d = this.data;
    const name = this.playerId;
    return {
      identity: isGuest === null ? (name.startsWith("g:") ? "guest" : "user") : isGuest ? "guest" : "user",
      displayName: d.displayName,
      balance: d.balance,
      level: d.level,
      xp: d.xp,
      xpToNext: xpToNext(d.level),
      nextBonusAt: d.nextBonusAt,
      bonusAmount: freeBonusAmount(d.level),
      nextWheelAt: d.nextWheelAt,
      wheelMultiplier: wheelMultiplier(d.level),
      storeReadyAt: d.storeReadyAt,
      settings: d.settings,
      tutorialDone: d.tutorialDone,
      freeSpins: d.freeSpins,
      totalSpins: d.totalSpins,
      biggestWin: d.biggestWin,
      missions: d.missions
        ? {
            missions: d.missions.missions,
            chestReward: d.missions.chestReward,
            chestClaimed: d.missions.chestClaimed,
            resetAt: nextResetAt(Date.now()),
          }
        : null,
      boardClaimWeek: d.boardClaimWeek ?? null,
      wagerClaimWeek: d.wagerClaimWeek ?? null,
      vip: vipStatus(d.vipPoints ?? 0, d.vipGiftDay ?? null, Date.now()),
      streak: streakStatus(d.streak ?? emptyStreak(), d.level, Date.now()),
      referral: {
        code: d.refCode ?? "",
        used: Boolean(d.refBy),
        invited: d.refCount ?? 0,
        welcomeReward: REFERRAL_WELCOME,
        perFriendReward: REFERRAL_PER_FRIEND,
        eligible: referralEligible(d.level, Boolean(d.refBy)),
      },
      collection: {
        cards: d.cards ?? {},
        claimed: d.setClaimed ?? [],
      },
      serverTime: Date.now(),
    };
  }
}
