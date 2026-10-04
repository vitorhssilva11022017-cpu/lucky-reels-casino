import express, { type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import { CARD_SETS } from "./engine/collections.js";
import { MACHINE_LISTINGS, MACHINES, publicMachine } from "./engine/machines.js";
import { STORE_PACKS, WHEEL_SEGMENTS } from "./engine/progression.js";
import type { Rng } from "./engine/types.js";
import { type TokenVerifier, verifierFromEnv } from "./auth.js";
import { HttpError } from "./errors.js";
import {
  GUEST_PREFIX,
  type Identity,
  isValidGuestId,
  isValidGuestSecret,
  PlayerService,
  USER_PREFIX,
} from "./player-store.js";
import { redisFromEnv } from "./redis.js";
import { JsonStorage, RedisStorage, type Storage } from "./store.js";

/** Cosmetic, time-based jackpot display. It is not a real prize pool and nothing pays out from it. */
function jackpotStateFn(now: number) {
  const base = 25847100000;
  const elapsed = now - 1791120000000;
  const perSecond = 2750;
  return { value: base + Math.floor((elapsed / 1000) * perSecond), perSecond, serverTime: now };
}

const PLAYER_ROUTES = new Set([
  "/session", "/spin", "/bonus", "/wheel", "/store", "/missions", "/streak", "/vip",
  "/referral", "/collectionClaim", "/leaderboard", "/leaderboardClaim", "/settings", "/tutorial",
]);

export interface AppDeps {
  /** Returns null when no durable storage is configured (requests then fail with 503). */
  storage: () => Storage | null;
  verifier?: TokenVerifier | null;
  rng?: Rng;
}

/**
 * Production storage: Upstash Redis. JSON files are only a local-dev fallback;
 * on Vercel they would live in a per-instance /tmp, so we refuse to use them there.
 */
let defaultStorage: Storage | null | undefined;
function storageFromEnv(): Storage | null {
  if (defaultStorage !== undefined) return defaultStorage;
  const redis = redisFromEnv();
  if (redis) defaultStorage = new RedisStorage(redis);
  else if (process.env.VERCEL) defaultStorage = null;
  else defaultStorage = new JsonStorage(process.env.DATA_DIR ?? path.join(process.cwd(), ".data"));
  return defaultStorage;
}

function header(req: Request, name: string): string {
  const v = req.headers[name];
  return typeof v === "string" ? v : "";
}

async function resolveIdentity(req: Request, verifier: TokenVerifier | null): Promise<Identity> {
  const auth = header(req, "authorization");
  if (verifier && auth.startsWith("Bearer ")) {
    const user = await verifier(auth.slice(7));
    if (!user) throw new HttpError(401, "auth_invalid", "Your sign-in expired. Please sign in again.");
    return { playerId: USER_PREFIX + user.sub, isGuest: false, guestSecret: null };
  }
  const guestId = header(req, "x-guest-id");
  const guestSecret = header(req, "x-guest-secret");
  if (!guestId || !guestSecret) throw new HttpError(401, "unauthorized", "Missing credentials");
  if (!isValidGuestId(guestId) || !isValidGuestSecret(guestSecret)) {
    throw new HttpError(400, "bad_guest", "Invalid guest credentials");
  }
  return { playerId: GUEST_PREFIX + guestId, isGuest: true, guestSecret };
}

export function createApp(deps: AppDeps) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/~api/ping", (_req: Request, res: Response) => {
    res.json({ ok: true, now: Date.now() });
  });

  app.get("/~api/config", (_req: Request, res: Response) => {
    res.json({
      machines: MACHINE_LISTINGS,
      machineConfigs: Object.fromEntries(Object.values(MACHINES).map((m) => [m.id, publicMachine(m)])),
      wheel: WHEEL_SEGMENTS.map((s) => s.amount),
      store: STORE_PACKS,
      cardSets: CARD_SETS,
      jackpot: jackpotStateFn(Date.now()),
    });
  });

  app.post("/~api/:route", async (req: Request, res: Response) => {
    const pathRoute = "/" + String(req.params.route);
    if (!PLAYER_ROUTES.has(pathRoute)) {
      res.status(404).json({ error: "not_found", message: "Route not found" });
      return;
    }
    try {
      const storage = deps.storage();
      if (!storage) throw new HttpError(503, "storage_unavailable", "The casino is under maintenance. Try again soon.");
      const identity = await resolveIdentity(req, deps.verifier ?? null);
      const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
      const service = new PlayerService(storage, identity, deps.rng);
      res.json(await service.handle(pathRoute, body));
    } catch (err: unknown) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.code, message: err.message });
      } else {
        console.error("route error", pathRoute, err instanceof Error ? err.message : String(err));
        res.status(500).json({ error: "server_error", message: "Something went wrong" });
      }
    }
  });

  app.use(express.static("dist"));
  app.get(/(.*)/, (req: Request, res: Response, next: () => void) => {
    if (req.path.startsWith("/~api") || req.path === "/config" || req.path === "/ping") return next();
    res.sendFile(path.join(process.cwd(), "dist", "index.html"));
  });

  return app;
}

const app = createApp({ storage: storageFromEnv, verifier: verifierFromEnv() });

const PORT = process.env.PORT || 8081;
if (!process.env.VERCEL && !process.env.VITEST) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
