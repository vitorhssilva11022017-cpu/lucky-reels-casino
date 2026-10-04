import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { Redis } from "@upstash/redis";

import { HttpError } from "./errors.js";
import type { PlayerData } from "./player-store.js";

export type BoardKind = "wins" | "wagers";

/** Display details stored next to a leaderboard score. */
export interface BoardInfo {
  name: string;
  level: number;
  machine: string;
  vip: string;
  ts: number;
}

export interface BoardRow extends BoardInfo {
  boardId: string;
  score: number;
  spins?: number;
}

/** Coins and invite counts owed to a player by other players' requests (e.g. referrals). */
export interface Credits {
  balance: number;
  refCount: number;
}

export const NO_CREDITS: Credits = { balance: 0, refCount: 0 };

export interface Lock {
  readonly id: string;
  readonly token: string;
}

/**
 * Persistent game state. Every mutation of a player happens while holding that
 * player's lock, and `save` refuses to write if the lock was lost, so parallel
 * requests can never both spend the same coins.
 */
export interface Storage {
  acquire(id: string): Promise<Lock>;
  release(lock: Lock): Promise<void>;
  load(id: string): Promise<{ player: PlayerData | null; credits: Credits }>;
  /** Writes the player and subtracts the credits it consumed. Throws `busy` if the lock is no longer held. */
  save(lock: Lock, player: PlayerData, consumed: Credits): Promise<void>;
  addCredits(id: string, credits: Credits): Promise<void>;
  /** Registers `code` for `owner` unless already taken; returns the code's owner. */
  claimRefCode(code: string, owner: string): Promise<string>;
  setRefCode(code: string, owner: string): Promise<void>;
  lookupRefCode(code: string): Promise<string | null>;
  /** Keeps the player's best single win for the week. */
  recordWin(week: string, boardId: string, win: number, info: BoardInfo): Promise<void>;
  /** Adds to the player's total wager for the week. */
  recordWager(week: string, boardId: string, bet: number, info: BoardInfo): Promise<void>;
  top(board: BoardKind, week: string, count: number): Promise<BoardRow[]>;
  rank(board: BoardKind, week: string, boardId: string): Promise<{ rank: number; score: number } | null>;
}

export interface LockOptions {
  /** How long a lock lives if its holder dies. */
  ttlMs?: number;
  /** How long a request waits for a busy player before giving up. */
  waitMs?: number;
}

const DEFAULT_TTL_MS = 10_000;
const DEFAULT_WAIT_MS = 10_000;
/** Leaderboard keys outlive their week so last week's board can still be read. */
const BOARD_TTL_S = 35 * 24 * 60 * 60;

function busy(): HttpError {
  return new HttpError(409, "busy", "Your last action is still finishing. Try again in a moment.");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** FIFO per-key mutex so requests for the same player inside one instance queue instead of polling. */
class KeyedMutex {
  private tails = new Map<string, Promise<void>>();

  async lock(key: string, waitMs: number): Promise<() => void> {
    const prev = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((r) => (release = r));
    const tail = prev.then(() => mine);
    this.tails.set(key, tail);
    const unlock = () => {
      release();
      if (this.tails.get(key) === tail) this.tails.delete(key);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = await Promise.race([
      prev.then(() => false),
      new Promise<boolean>((r) => (timer = setTimeout(() => r(true), waitMs))),
    ]);
    clearTimeout(timer);
    if (timedOut) {
      unlock();
      throw busy();
    }
    return unlock;
  }
}

interface HeldLock extends Lock {
  unlockLocal: () => void;
}

// ---------------------------------------------------------------------------
// Redis (production)
// ---------------------------------------------------------------------------

const RELEASE_LUA = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`;

const SAVE_LUA = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2])
local b = tonumber(ARGV[3])
local r = tonumber(ARGV[4])
if b ~= 0 then redis.call('HINCRBY', KEYS[3], 'balance', -b) end
if r ~= 0 then redis.call('HINCRBY', KEYS[3], 'refCount', -r) end
return 1`;

const BEST_WIN_LUA = `
local cur = redis.call('ZSCORE', KEYS[1], ARGV[1])
if cur and tonumber(cur) >= tonumber(ARGV[2]) then return 0 end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
redis.call('EXPIRE', KEYS[1], ARGV[4])
redis.call('EXPIRE', KEYS[2], ARGV[4])
return 1`;

export class RedisStorage implements Storage {
  private local = new KeyedMutex();
  private ttlMs: number;
  private waitMs: number;

  constructor(
    private redis: Redis,
    private prefix = "",
    opts: LockOptions = {},
  ) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.waitMs = opts.waitMs ?? DEFAULT_WAIT_MS;
  }

  private k(...parts: string[]) {
    return this.prefix + parts.join(":");
  }

  async acquire(id: string): Promise<Lock> {
    const deadline = Date.now() + this.waitMs;
    const unlockLocal = await this.local.lock(id, this.waitMs);
    const token = crypto.randomUUID();
    try {
      for (let attempt = 0; ; attempt++) {
        const ok = await this.redis.set(this.k("lock", id), token, { nx: true, px: this.ttlMs });
        if (ok) return { id, token, unlockLocal } as HeldLock;
        if (Date.now() >= deadline) throw busy();
        await sleep(Math.min(250, 20 * 2 ** attempt) + Math.random() * 20);
      }
    } catch (err) {
      unlockLocal();
      throw err;
    }
  }

  async release(lock: Lock): Promise<void> {
    try {
      await this.redis.eval(RELEASE_LUA, [this.k("lock", lock.id)], [lock.token]);
    } finally {
      (lock as HeldLock).unlockLocal();
    }
  }

  async load(id: string) {
    const p = this.redis.pipeline();
    p.get<PlayerData>(this.k("player", id));
    p.hgetall<Record<string, number>>(this.k("credits", id));
    const [player, credits] = (await p.exec()) as [PlayerData | null, Record<string, number> | null];
    return {
      player: player ?? null,
      credits: { balance: Number(credits?.balance ?? 0), refCount: Number(credits?.refCount ?? 0) },
    };
  }

  async save(lock: Lock, player: PlayerData, consumed: Credits) {
    const ok = await this.redis.eval(
      SAVE_LUA,
      [this.k("lock", lock.id), this.k("player", lock.id), this.k("credits", lock.id)],
      [lock.token, JSON.stringify(player), String(consumed.balance), String(consumed.refCount)],
    );
    if (Number(ok) !== 1) throw busy();
  }

  async addCredits(id: string, credits: Credits) {
    const p = this.redis.pipeline();
    if (credits.balance) p.hincrby(this.k("credits", id), "balance", credits.balance);
    if (credits.refCount) p.hincrby(this.k("credits", id), "refCount", credits.refCount);
    await p.exec();
  }

  async claimRefCode(code: string, owner: string) {
    const p = this.redis.pipeline();
    p.hsetnx(this.k("refcodes"), code, owner);
    p.hget<string>(this.k("refcodes"), code);
    const [, current] = (await p.exec()) as [number, string | null];
    return String(current ?? owner);
  }

  async setRefCode(code: string, owner: string) {
    await this.redis.hset(this.k("refcodes"), { [code]: owner });
  }

  async lookupRefCode(code: string) {
    const owner = await this.redis.hget<string>(this.k("refcodes"), code);
    return owner == null ? null : String(owner);
  }

  async recordWin(week: string, boardId: string, win: number, info: BoardInfo) {
    await this.redis.eval(
      BEST_WIN_LUA,
      [this.k("lb", "wins", week), this.k("lb", "wins", week, "info")],
      [boardId, String(win), JSON.stringify(info), String(BOARD_TTL_S)],
    );
  }

  async recordWager(week: string, boardId: string, bet: number, info: BoardInfo) {
    const z = this.k("lb", "wagers", week);
    const infoKey = this.k("lb", "wagers", week, "info");
    const spins = this.k("lb", "wagers", week, "spins");
    const first = this.k("lb", "wagers", week, "first");
    const p = this.redis.pipeline();
    p.zincrby(z, bet, boardId);
    p.hincrby(spins, boardId, 1);
    p.hsetnx(first, boardId, info.ts);
    p.hset(infoKey, { [boardId]: JSON.stringify(info) });
    for (const key of [z, infoKey, spins, first]) p.expire(key, BOARD_TTL_S);
    await p.exec();
  }

  async top(board: BoardKind, week: string, count: number): Promise<BoardRow[]> {
    const raw = await this.redis.zrange<(string | number)[]>(this.k("lb", board, week), 0, count - 1, {
      rev: true,
      withScores: true,
    });
    const ids: string[] = [];
    const scores: number[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      ids.push(String(raw[i]));
      scores.push(Number(raw[i + 1]));
    }
    if (ids.length === 0) return [];
    const p = this.redis.pipeline();
    p.hmget<Record<string, BoardInfo | null>>(this.k("lb", board, week, "info"), ...ids);
    if (board === "wagers") {
      p.hmget<Record<string, number | null>>(this.k("lb", board, week, "spins"), ...ids);
      p.hmget<Record<string, number | null>>(this.k("lb", board, week, "first"), ...ids);
    }
    const [infos, spins, firsts] = (await p.exec()) as [
      Record<string, BoardInfo | null> | null,
      Record<string, number | null> | null,
      Record<string, number | null> | null,
    ];
    return ids.flatMap((boardId, i) => {
      const info = infos?.[boardId];
      if (!info) return [];
      const row: BoardRow = { ...info, boardId, score: scores[i] };
      if (board === "wagers") {
        row.spins = Number(spins?.[boardId] ?? 0);
        row.ts = Number(firsts?.[boardId] ?? info.ts);
      }
      return [row];
    });
  }

  async rank(board: BoardKind, week: string, boardId: string) {
    const p = this.redis.pipeline();
    p.zrevrank(this.k("lb", board, week), boardId);
    p.zscore(this.k("lb", board, week), boardId);
    const [rank, score] = (await p.exec()) as [number | null, number | null];
    return rank == null ? null : { rank: rank + 1, score: Number(score ?? 0) };
  }
}

// ---------------------------------------------------------------------------
// JSON files (local development only)
// ---------------------------------------------------------------------------

export class JsonStore<T> {
  private data: Map<string, T> = new Map();
  private file: string;

  constructor(filename: string, dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, filename);
    this.load();
  }

  private load() {
    if (!fs.existsSync(this.file)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, "utf-8")) as Record<string, T>;
      for (const key in parsed) this.data.set(key, parsed[key]);
    } catch (e) {
      console.error("Failed to load store", this.file, e);
    }
  }

  private save() {
    fs.writeFileSync(this.file, JSON.stringify(Object.fromEntries(this.data), null, 2));
  }

  get(key: string): T | undefined {
    return this.data.get(key);
  }

  set(key: string, value: T) {
    this.data.set(key, value);
    this.save();
  }

  entries(): [string, T][] {
    return Array.from(this.data.entries());
  }

  delete(key: string) {
    this.data.delete(key);
    this.save();
  }
}

interface JsonBoardEntry {
  score: number;
  spins: number;
  info: BoardInfo;
}

/** Single-process stand-in for Redis. Never used on Vercel, where /tmp is per-instance. */
export class JsonStorage implements Storage {
  private local = new KeyedMutex();
  private held = new Map<string, string>();
  private players: JsonStore<PlayerData>;
  private credits: JsonStore<Credits>;
  private refs: JsonStore<string>;
  private boards: JsonStore<JsonBoardEntry>;
  private waitMs: number;

  constructor(dir: string, opts: LockOptions = {}) {
    this.players = new JsonStore("players.json", dir);
    this.credits = new JsonStore("credits.json", dir);
    this.refs = new JsonStore("refs.json", dir);
    this.boards = new JsonStore("boards.json", dir);
    this.waitMs = opts.waitMs ?? DEFAULT_WAIT_MS;
  }

  async acquire(id: string): Promise<Lock> {
    const unlockLocal = await this.local.lock(id, this.waitMs);
    const token = crypto.randomUUID();
    this.held.set(id, token);
    return { id, token, unlockLocal } as HeldLock;
  }

  async release(lock: Lock) {
    if (this.held.get(lock.id) === lock.token) this.held.delete(lock.id);
    (lock as HeldLock).unlockLocal();
  }

  async load(id: string) {
    const player = this.players.get(id);
    return {
      player: player ? (structuredClone(player) as PlayerData) : null,
      credits: { ...NO_CREDITS, ...this.credits.get(id) },
    };
  }

  async save(lock: Lock, player: PlayerData, consumed: Credits) {
    if (this.held.get(lock.id) !== lock.token) throw busy();
    this.players.set(lock.id, structuredClone(player));
    if (consumed.balance || consumed.refCount) {
      const cur = { ...NO_CREDITS, ...this.credits.get(lock.id) };
      this.credits.set(lock.id, { balance: cur.balance - consumed.balance, refCount: cur.refCount - consumed.refCount });
    }
  }

  async addCredits(id: string, credits: Credits) {
    const cur = { ...NO_CREDITS, ...this.credits.get(id) };
    this.credits.set(id, { balance: cur.balance + credits.balance, refCount: cur.refCount + credits.refCount });
  }

  async claimRefCode(code: string, owner: string) {
    const cur = this.refs.get(code);
    if (cur) return cur;
    this.refs.set(code, owner);
    return owner;
  }

  async setRefCode(code: string, owner: string) {
    this.refs.set(code, owner);
  }

  async lookupRefCode(code: string) {
    return this.refs.get(code) ?? null;
  }

  private boardKey(board: BoardKind, week: string, boardId: string) {
    return `${board}:${week}:${boardId}`;
  }

  async recordWin(week: string, boardId: string, win: number, info: BoardInfo) {
    const key = this.boardKey("wins", week, boardId);
    const cur = this.boards.get(key);
    if (cur && cur.score >= win) return;
    this.boards.set(key, { score: win, spins: 0, info });
  }

  async recordWager(week: string, boardId: string, bet: number, info: BoardInfo) {
    const key = this.boardKey("wagers", week, boardId);
    const cur = this.boards.get(key);
    this.boards.set(key, {
      score: Math.min((cur?.score ?? 0) + bet, Number.MAX_SAFE_INTEGER),
      spins: (cur?.spins ?? 0) + 1,
      info: { ...info, ts: cur?.info.ts ?? info.ts },
    });
  }

  private sorted(board: BoardKind, week: string): BoardRow[] {
    const prefix = `${board}:${week}:`;
    return this.boards
      .entries()
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, e]) => ({
        ...e.info,
        boardId: key.slice(prefix.length),
        score: e.score,
        spins: board === "wagers" ? e.spins : undefined,
      }))
      .sort((a, b) => b.score - a.score || a.ts - b.ts);
  }

  async top(board: BoardKind, week: string, count: number) {
    return this.sorted(board, week).slice(0, count);
  }

  async rank(board: BoardKind, week: string, boardId: string) {
    const all = this.sorted(board, week);
    const idx = all.findIndex((r) => r.boardId === boardId);
    return idx < 0 ? null : { rank: idx + 1, score: all[idx].score };
  }
}
