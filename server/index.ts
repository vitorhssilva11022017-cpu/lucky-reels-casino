// @ts-nocheck
import express from 'express';
import cors from 'cors';
import path from 'path';
import { CARD_SETS } from "./engine/collections.js";
import { MACHINE_LISTINGS, MACHINES, publicMachine } from "./engine/machines.js";
import { STORE_PACKS, WHEEL_SEGMENTS } from "./engine/progression.js";
import { PlayerService, HttpError, playersStore } from "./player-store.js";
import { jackpotState } from "./engine/types.js";
import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;

const app = express();
app.use(cors({ exposedHeaders: ['X-Guest-State'] }));
app.use(express.json());

function jackpotStateFn(now: number) {
  const base = 25847100000;
  const elapsed = now - 1791120000000;
  const perSecond = 2750;
  return { value: base + Math.floor((elapsed / 1000) * perSecond), perSecond, serverTime: now };
}

app.get('/~api/ping', (req, res) => {
  res.json({ ok: true, now: Date.now() });
});

app.get('/~api/config', (req, res) => {
  res.json({
    machines: MACHINE_LISTINGS,
    machineConfigs: Object.fromEntries(Object.values(MACHINES).map((m) => [m.id, publicMachine(m)])),
    wheel: WHEEL_SEGMENTS.map((s) => s.amount),
    store: STORE_PACKS,
    cardSets: CARD_SETS,
    jackpot: jackpotStateFn(Date.now()),
  });
});

app.post('/~api/:route', async (req, res) => {
  const pathRoute = '/' + req.params.route;
  const PLAYER_ROUTES = new Set(["/session", "/spin", "/bonus", "/wheel", "/store", "/missions", "/streak", "/vip", "/referral", "/collectionClaim", "/leaderboard", "/leaderboardClaim", "/settings", "/tutorial"]);
  
  if (!PLAYER_ROUTES.has(pathRoute)) {
    return res.status(404).json({ error: "not_found", message: "Route not found" });
  }

  const guestId = req.headers['x-guest-id'] as string | undefined;
  const guestSecret = req.headers['x-guest-secret'] as string | undefined;

  if (!guestId || !guestSecret) {
    return res.status(401).json({ error: "unauthorized", message: "Missing credentials" });
  }

  const stateHeader = req.headers['x-guest-state'] as string | undefined;
  if (stateHeader) {
    try {
      const stateStr = Buffer.from(stateHeader, 'base64').toString('utf8');
      playersStore.set(guestId, JSON.parse(stateStr));
    } catch {
      /* ignore bad state */
    }
  }

  const service = new PlayerService(guestId);
  try {
    let result: any;
    const body = req.body || {};

    if (pathRoute !== "/session" && pathRoute !== "/leaderboard") {
      await service.verifyGuest(guestSecret);
    }

    switch (pathRoute) {
      case "/session": result = await service.session(true, guestSecret, body); break;
      case "/spin": result = await service.spin(body); break;
      case "/bonus": result = await service.collectBonus(); break;
      case "/wheel": result = await service.spinWheel(); break;
      case "/store": result = await service.claimPack(body.packId); break;
      case "/missions": result = await service.claimMission(body); break;
      case "/streak": result = await service.claimDailyStreak(); break;
      case "/vip": result = await service.claimVipGift(); break;
      case "/referral": result = await service.claimReferral(body); break;
      case "/collectionClaim": result = await service.claimSetReward(body); break;
      case "/leaderboard": result = await service.getLeaderboard(body.boardId || "wins"); break;
      case "/leaderboardClaim": result = await service.claimBoardReward(body.boardId || "wins"); break;
      case "/settings": result = await service.updateSettings(body); break;
      case "/tutorial": result = await service.setTutorial(body.done !== false); break;
    }
    
    const updatedState = playersStore.get(guestId);
    if (updatedState) {
      res.setHeader("X-Guest-State", Buffer.from(JSON.stringify(updatedState)).toString('base64'));
    }

    res.json(result);
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
app.get(/(.*)/, (req, res, next) => {
  if (req.path.startsWith("/~api") || req.path === "/config" || req.path === "/ping") return next();
  res.sendFile(path.join(process.cwd(), "dist", "index.html"));
});

const PORT = process.env.PORT || 8081;
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
