import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { MACHINES } from "./engine/machines.js";
import { START_BALANCE } from "./engine/progression.js";
import { REFERRAL_PER_FRIEND } from "./engine/referral.js";
import { playSpin } from "./engine/slot.js";
import type { Rng } from "./engine/types.js";
import type { TokenVerifier } from "./auth.js";
import { createApp } from "./index.js";
import { redisFromEnv } from "./redis.js";
import { JsonStorage, NO_CREDITS, RedisStorage, type Storage } from "./store.js";

const MACHINE = "egyptian-treasure";
const BET_INDEX = 0;
const BET = MACHINES[MACHINE].betLevels[BET_INDEX];

/**
 * A constant RNG that never drops a card (needs rng(100) >= 10) and lands on a
 * grid with no win and no free spins, so a spin costs exactly one bet.
 */
function losingRng(): Rng {
  for (let c = 10; c < 500; c++) {
    const rng: Rng = (max) => Math.min(c, max - 1);
    const o = playSpin(MACHINES[MACHINE], rng, BET, 1);
    if (o.totalWin === 0 && o.scatter.freeSpinsAwarded === 0) return rng;
  }
  throw new Error("no losing constant rng found");
}

/** Test sign-in: the token "tok-<name>" belongs to user <name>. */
const fakeVerifier: TokenVerifier = async (token) => (token.startsWith("tok-") ? { sub: token.slice(4) } : null);

interface Backend {
  name: string;
  /** A fresh client for the same underlying data, like a new serverless instance after a redeploy. */
  open(): Storage;
  cleanup(): Promise<void>;
}

/**
 * Adds a random delay before every storage call, like a network round trip to Redis.
 * Without it the in-memory JSON store finishes each request in one tick and races could never show up.
 */
function withLatency(inner: Storage): Storage {
  return new Proxy(inner, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        await new Promise((r) => setTimeout(r, Math.random() * 5));
        return value.apply(target, args);
      };
    },
  });
}

function jsonBackend(): Backend {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lr-test-"));
  return {
    name: "json",
    open: () => withLatency(new JsonStorage(dir, { waitMs: 30_000 })),
    cleanup: async () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function redisBackend(): Backend | null {
  const redis = redisFromEnv("TEST_");
  if (!redis) return null;
  const prefix = `test:${crypto.randomUUID()}:`;
  return {
    name: "redis",
    open: () => new RedisStorage(redisFromEnv("TEST_")!, prefix, { waitMs: 30_000 }),
    cleanup: async () => {
      let cursor: string | number = 0;
      do {
        const [next, keys]: [string, string[]] = await redis.scan(cursor, { match: `${prefix}*`, count: 500 });
        if (keys.length) await redis.del(...keys);
        cursor = next;
      } while (String(cursor) !== "0");
    },
  };
}

const backends = [jsonBackend(), redisBackend()].filter((b): b is Backend => b !== null);
if (backends.length === 1) console.info("TEST_KV_REST_API_URL not set: Redis tests skipped, JSON storage only");

interface Guest {
  id: string;
  secret: string;
}

function newGuest(): Guest {
  return { id: crypto.randomUUID(), secret: crypto.randomBytes(32).toString("hex") };
}

describe.each(backends)("server state ($name storage)", (backend) => {
  let storage: Storage;
  let server: Server;
  let base: string;

  async function start(s: Storage) {
    const app = createApp({ storage: () => s, verifier: fakeVerifier, rng: losingRng() });
    const srv = await new Promise<Server>((resolve) => {
      const h = app.listen(0, "127.0.0.1", () => resolve(h));
    });
    return { srv, url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}/~api` };
  }

  async function call(
    route: string,
    who: { guest?: Guest; token?: string },
    body: unknown = {},
    extraHeaders: Record<string, string> = {},
    url = base,
  ) {
    const headers: Record<string, string> = { "content-type": "application/json", ...extraHeaders };
    if (who.guest) {
      headers["x-guest-id"] = who.guest.id;
      headers["x-guest-secret"] = who.guest.secret;
    }
    if (who.token) headers.authorization = `Bearer ${who.token}`;
    const res = await fetch(url + route, { method: "POST", headers, body: JSON.stringify(body) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: res.status, data: (await res.json()) as any };
  }

  /** Sets a balance directly in storage, the way an admin tool would. */
  async function setBalance(playerId: string, balance: number) {
    const lock = await storage.acquire(playerId);
    try {
      const { player } = await storage.load(playerId);
      await storage.save(lock, { ...player!, balance }, NO_CREDITS);
    } finally {
      await storage.release(lock);
    }
  }

  beforeAll(async () => {
    storage = backend.open();
    ({ srv: server, url: base } = await start(storage));
  });

  afterAll(async () => {
    await new Promise((r) => server.close(r));
    await backend.cleanup();
  });

  it("ignores client-supplied state: X-Guest-State header, balance fields and fake imports", async () => {
    const guest = newGuest();
    const first = await call("/session", { guest });
    expect(first.data.player.balance).toBe(START_BALANCE);

    const forged = Buffer.from(JSON.stringify({ balance: 999_999_999_999, level: 200 })).toString("base64");
    const r1 = await call("/settings", { guest }, { music: false, balance: 999_999_999_999 }, { "X-Guest-State": forged });
    expect(r1.status).toBe(200);
    expect(r1.data.player.balance).toBe(START_BALANCE);
    expect(r1.data.player.level).toBe(1);

    const r2 = await call("/session", { guest }, { import: { balance: 999_999_999_999, level: 200 } });
    expect(r2.data.player.balance).toBe(START_BALANCE);
    expect(r2.data.merged).toBe(false);

    const back = await call("/session", { guest });
    expect(back.data.player.balance).toBe(START_BALANCE);
  });

  it("rejects requests with the wrong guest secret", async () => {
    const guest = newGuest();
    await call("/session", { guest });
    const res = await call("/spin", { guest: { id: guest.id, secret: "f".repeat(64) } }, { machineId: MACHINE, betIndex: BET_INDEX });
    expect(res.status).toBe(401);
    expect(res.data.error).toBe("bad_guest");
  });

  it("20 parallel spins with balance for 10 give exactly 10 successes", async () => {
    const guest = newGuest();
    await call("/session", { guest });
    await setBalance(`g:${guest.id}`, BET * 10);

    const results = await Promise.all(
      Array.from({ length: 20 }, () => call("/spin", { guest }, { machineId: MACHINE, betIndex: BET_INDEX })),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(10);
    expect(statuses.filter((s) => s === 402)).toHaveLength(10);

    const after = await call("/session", { guest });
    expect(after.data.player.balance).toBe(0);
    expect(after.data.player.totalSpins).toBe(10);
  });

  it("records weekly wagers in the leaderboard", async () => {
    const guest = newGuest();
    await call("/session", { guest });
    for (let i = 0; i < 3; i++) await call("/spin", { guest }, { machineId: MACHINE, betIndex: BET_INDEX });
    const board = await call("/leaderboard", { guest }, { boardId: "wagers" });
    expect(board.status).toBe(200);
    expect(board.data.you.win).toBe(BET * 3);
    const mine = board.data.entries.find((e: { rank: number }) => e.rank === board.data.you.rank);
    expect(mine.spins).toBe(3);
  });

  it("credits the inviter through pending credits", async () => {
    const inviter = newGuest();
    const friend = newGuest();
    const code = (await call("/session", { guest: inviter })).data.player.referral.code;
    await call("/session", { guest: friend });
    const claim = await call("/referral", { guest: friend }, { code });
    expect(claim.status).toBe(200);
    expect(claim.data.amount).toBeGreaterThan(0);

    const later = await call("/session", { guest: inviter });
    expect(later.data.player.balance).toBe(START_BALANCE + REFERRAL_PER_FRIEND);
    expect(later.data.player.referral.invited).toBe(1);
    // Credits are consumed once, not re-applied on every request.
    const again = await call("/session", { guest: inviter });
    expect(again.data.player.balance).toBe(START_BALANCE + REFERRAL_PER_FRIEND);
  });

  it("merges a guest into a new account only with the right guest secret", async () => {
    const guest = newGuest();
    await call("/session", { guest });
    await call("/spin", { guest }, { machineId: MACHINE, betIndex: BET_INDEX });
    const guestBalance = START_BALANCE - BET;

    const wrong = await call("/session", { token: "tok-mallory" }, { import: { guestId: guest.id, guestSecret: "0".repeat(64) } });
    expect(wrong.data.merged).toBe(false);
    expect(wrong.data.player.balance).toBe(START_BALANCE);

    const user = await call("/session", { token: "tok-alice" }, { import: { guestId: guest.id, guestSecret: guest.secret } });
    expect(user.data.merged).toBe(true);
    expect(user.data.player.identity).toBe("user");
    expect(user.data.player.balance).toBe(guestBalance);
    expect(user.data.player.totalSpins).toBe(1);

    const oldGuest = await call("/session", { guest });
    expect(oldGuest.status).toBe(410);

    // An existing account never imports again.
    const other = newGuest();
    await call("/session", { guest: other });
    const repeat = await call("/session", { token: "tok-alice" }, { import: { guestId: other.id, guestSecret: other.secret } });
    expect(repeat.data.merged).toBe(false);
    expect(repeat.data.player.balance).toBe(guestBalance);
  });

  it("rejects invalid sign-in tokens", async () => {
    const res = await call("/session", { token: "forged" });
    expect(res.status).toBe(401);
    expect(res.data.error).toBe("auth_invalid");
  });

  it("keeps progress across a redeploy (fresh instance, same storage)", async () => {
    const guest = newGuest();
    await call("/session", { guest });
    for (let i = 0; i < 2; i++) await call("/spin", { guest }, { machineId: MACHINE, betIndex: BET_INDEX });

    const fresh = await start(backend.open());
    try {
      const res = await call("/session", { guest }, {}, {}, fresh.url);
      expect(res.data.player.balance).toBe(START_BALANCE - 2 * BET);
      expect(res.data.player.totalSpins).toBe(2);
    } finally {
      await new Promise((r) => fresh.srv.close(r));
    }
  });
});
