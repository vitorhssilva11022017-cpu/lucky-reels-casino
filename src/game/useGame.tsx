import createContextHook from "@nkzw/create-context-hook";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { ApiError, apiGet, apiPost, currentGuest, resetGuest } from "@/lib/backend";

import { audio, vibrate } from "./audio";
import { CORE_SFX, LOBBY_MUSIC } from "./machines";
import { missionLabel } from "./missions";
import type { GameConfig, LeaderboardState, LevelUp, Player, RaceBoard, SpinResponse } from "./types";
import { formatShort } from "@/lib/format";

export type ModalName = "store" | "settings" | "wheel" | "outOfCoins" | "missions" | "streak" | "vip" | "referral" | "collection" | "leaderboard" | null;
export type TutorialStep = "lobby" | "spin" | "spinning" | "bonus" | "finish" | null;

const AGE_KEY = "lr:age18";
const AUDIO_KEY = "lr:audio";
const REF_KEY = "lr:ref";

function readPendingRef(): string | null {
  try {
    return localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

interface LocalAudio {
  music: boolean;
  sfx: boolean;
}

function readLocalAudio(): LocalAudio {
  try {
    const raw = localStorage.getItem(AUDIO_KEY);
    if (raw) return JSON.parse(raw) as LocalAudio;
  } catch {
    /* ignore */
  }
  return { music: true, sfx: true };
}

/**
 * Central game state. The server owns every number; this provider only mirrors
 * the latest player snapshot and "holds back" freshly won coins so the balance
 * can roll up after the reels finish and the celebration plays.
 */
export const [GameProvider, useGame] = createContextHook(() => {
  const { user, isLoading: authLoading } = useAuth();
  const [ageConfirmed, setAgeConfirmed] = useState<boolean>(() => localStorage.getItem(AGE_KEY) === "1");
  const [player, setPlayer] = useState<Player | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [clockOffset, setClockOffset] = useState<number>(0);
  const [pendingBet, setPendingBet] = useState<number>(0);
  const [heldWin, setHeldWin] = useState<number>(0);
  const [heldLevel, setHeldLevel] = useState<number>(0);
  const [modal, setModal] = useState<ModalName>(null);
  const [levelUps, setLevelUps] = useState<LevelUp[]>([]);
  const [tutorial, setTutorial] = useState<TutorialStep>(null);
  const [music, setMusic] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  /** Invite code this browser arrived with (?ref=), waiting to be claimed. */
  const [pendingRef, setPendingRef] = useState<string | null>(readPendingRef);
  const sessionKeyRef = useRef<string>("");
  const localAudio = useRef<LocalAudio>(readLocalAudio());

  // Capture ?ref=CODE from an invite link, then strip it from the address bar.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get("ref");
      if (ref) {
        const clean = ref.trim().toUpperCase().slice(0, 12);
        if (/^[A-Z2-9]{6,12}$/.test(clean)) {
          localStorage.setItem(REF_KEY, clean);
          setPendingRef(clean);
        }
        url.searchParams.delete("ref");
        window.history.replaceState({}, "", url.pathname + url.search);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const configQuery = useQuery({
    queryKey: ["config"],
    queryFn: () => apiGet<GameConfig>("/config"),
    staleTime: Infinity,
    retry: 3,
  });

  const playerRef = useRef<Player | null>(null);

  const applyPlayer = useCallback((p: Player) => {
    playerRef.current = p;
    setPlayer(p);
    setClockOffset(p.serverTime - Date.now());
    audio.setMusicEnabled(p.settings.music);
    audio.setSfxEnabled(p.settings.sfx);
    localAudio.current = { music: p.settings.music, sfx: p.settings.sfx };
    localStorage.setItem(AUDIO_KEY, JSON.stringify(localAudio.current));
  }, []);

  useEffect(() => {
    audio.setMusicEnabled(localAudio.current.music);
    audio.setSfxEnabled(localAudio.current.sfx);
    void audio.load(CORE_SFX);
    const unlock = () => audio.unlock();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const startSession = useCallback(async () => {
    const key = user?.id ?? "guest";
    sessionKeyRef.current = key;
    setSessionError(null);
    try {
      let res: { player: Player; merged?: boolean };
      try {
        // Signed-in players name this browser's guest profile; the server moves it into the
        // account only if the account is new and the guest secret matches.
        res = await apiPost<{ player: Player; merged?: boolean }>("/session", user ? { import: currentGuest() } : {});
      } catch (err) {
        if (err instanceof ApiError && (err.code === "merged" || err.code === "bad_guest") && !user) {
          resetGuest();
          res = await apiPost<{ player: Player }>("/session");
        } else {
          throw err;
        }
      }
      if (user && res.merged) resetGuest();
      if (sessionKeyRef.current !== key) return;
      applyPlayer(res.player);
    } catch (err) {
      console.warn("Session failed", err instanceof Error ? err.message : "unknown");
      setSessionError(err instanceof ApiError ? err.message : "Can't reach the casino right now.");
    }
  }, [user, applyPlayer]);

  useEffect(() => {
    if (authLoading) return;
    void startSession();
  }, [authLoading, startSession]);

  useEffect(() => {
    if (player && !player.tutorialDone && tutorial === null && ageConfirmed) setTutorial("lobby");
  }, [player, tutorial, ageConfirmed]);

  useEffect(() => {
    audio.setMusic(music);
  }, [music]);

  const confirmAge = useCallback(() => {
    localStorage.setItem(AGE_KEY, "1");
    setAgeConfirmed(true);
    audio.unlock();
  }, []);

  const now = useCallback(() => Date.now() + clockOffset, [clockOffset]);

  const displayBalance = player ? Math.max(0, player.balance - heldWin - heldLevel - pendingBet) : 0;

  const handleError = useCallback((err: unknown, fallback = "Something went wrong") => {
    const msg = err instanceof ApiError ? err.message : fallback;
    if (err instanceof ApiError && err.code === "insufficient_balance") {
      setModal("outOfCoins");
      return;
    }
    toast.error(msg);
  }, []);

  /** Asks the server for a spin. The caller (the machine) animates the result. */
  const requestSpin = useCallback(
    async (machineId: string, betIndex: number, isTutorial: boolean): Promise<SpinResponse> => {
      return apiPost<SpinResponse>("/spin", { machineId, betIndex, tutorial: isTutorial });
    },
    [],
  );

  /** Applies a finished spin: new snapshot, with wins held back until presented. */
  const commitSpin = useCallback(
    (res: SpinResponse) => {
      const levelCoins = res.levelUps.reduce((s, l) => s + l.reward, 0);
      setHeldWin((h) => h + res.outcome.totalWin);
      setHeldLevel((h) => h + levelCoins);
      setPendingBet(0);
      const before = playerRef.current?.missions?.missions ?? [];
      const finished = (res.player.missions?.missions ?? []).filter((m) => {
        const prev = before.find((b) => b.id === m.id);
        return m.progress >= m.target && prev !== undefined && prev.progress < prev.target;
      });
      applyPlayer(res.player);
      if (res.levelUps.length > 0) setLevelUps((q) => [...q, ...res.levelUps]);
      const drop = res.cardDrop;
      if (drop) {
        if (drop.duplicate) {
          toast(`${drop.name} — duplicate card`, { description: `Auto-converted to ${formatShort(drop.dupCoins)} coins.` });
        } else {
          audio.play("levelUp", { volume: 0.55 });
          toast.success(`New card: ${drop.name}!`, {
            description: drop.setComplete ? "Set complete — claim your jackpot in Collections!" : "Added to your collection.",
            action: { label: "View", onClick: () => setModal("collection") },
          });
        }
      }
      if (finished.length > 0) {
        audio.play("levelUp", { volume: 0.5 });
        toast.success("Mission complete!", {
          description: `${missionLabel(finished[0])} - collect your reward in Missions.`,
          action: { label: "Collect", onClick: () => setModal("missions") },
        });
      }
    },
    [applyPlayer],
  );

  const releaseWin = useCallback((amount?: number) => {
    setHeldWin((h) => (amount === undefined ? 0 : Math.max(0, h - amount)));
  }, []);

  const collectLevelUp = useCallback(() => {
    setLevelUps((q) => {
      const [first, ...rest] = q;
      if (first) setHeldLevel((h) => Math.max(0, h - first.reward));
      return rest;
    });
  }, []);

  const collectBonus = useCallback(async (): Promise<number | null> => {
    try {
      const res = await apiPost<{ amount: number; player: Player }>("/bonus");
      setHeldWin((h) => h + res.amount);
      applyPlayer(res.player);
      vibrate([20, 40, 20]);
      return res.amount;
    } catch (err) {
      handleError(err);
      return null;
    }
  }, [applyPlayer, handleError]);

  const spinWheel = useCallback(async (): Promise<{ index: number; amount: number } | null> => {
    try {
      const res = await apiPost<{ index: number; amount: number; player: Player }>("/wheel");
      setHeldWin((h) => h + res.amount);
      applyPlayer(res.player);
      return { index: res.index, amount: res.amount };
    } catch (err) {
      handleError(err);
      return null;
    }
  }, [applyPlayer, handleError]);

  const claimPack = useCallback(
    async (packId: string): Promise<number | null> => {
      try {
        const res = await apiPost<{ amount: number; player: Player }>("/store", { packId });
        setHeldWin((h) => h + res.amount);
        applyPlayer(res.player);
        return res.amount;
      } catch (err) {
        handleError(err);
        return null;
      }
    },
    [applyPlayer, handleError],
  );

  const claimMission = useCallback(
    async (target: { missionId: string } | { chest: true }): Promise<number | null> => {
      try {
        const res = await apiPost<{ amount: number; player: Player }>("/missions", target);
        setHeldWin((h) => h + res.amount);
        applyPlayer(res.player);
        vibrate([20, 40, 20]);
        return res.amount;
      } catch (err) {
        handleError(err);
        return null;
      }
    },
    [applyPlayer, handleError],
  );

  const claimStreak = useCallback(async (): Promise<{ amount: number; day: number } | null> => {
    try {
      const res = await apiPost<{ amount: number; day: number; player: Player }>("/streak");
      setHeldWin((h) => h + res.amount);
      applyPlayer(res.player);
      vibrate([20, 40, 20, 40, 60]);
      return { amount: res.amount, day: res.day };
    } catch (err) {
      handleError(err);
      return null;
    }
  }, [applyPlayer, handleError]);

  const claimReferral = useCallback(
    async (code: string): Promise<number | null> => {
      try {
        const res = await apiPost<{ amount: number; player: Player }>("/referral", { code });
        setHeldWin((h) => h + res.amount);
        applyPlayer(res.player);
        try {
          localStorage.removeItem(REF_KEY);
        } catch {
          /* ignore */
        }
        setPendingRef(null);
        vibrate([20, 40, 20, 40, 60]);
        return res.amount;
      } catch (err) {
        handleError(err);
        return null;
      }
    },
    [applyPlayer, handleError],
  );

  const claimCollectionSet = useCallback(
    async (setId: string): Promise<number | null> => {
      try {
        const res = await apiPost<{ amount: number; player: Player }>("/collectionClaim", { setId });
        setHeldWin((h) => h + res.amount);
        applyPlayer(res.player);
        vibrate([20, 40, 20, 40, 60]);
        return res.amount;
      } catch (err) {
        handleError(err);
        return null;
      }
    },
    [applyPlayer, handleError],
  );

  const claimVip = useCallback(async (): Promise<number | null> => {
    try {
      const res = await apiPost<{ amount: number; player: Player }>("/vip");
      setHeldWin((h) => h + res.amount);
      applyPlayer(res.player);
      vibrate([20, 40, 20, 40, 60]);
      return res.amount;
    } catch (err) {
      handleError(err);
      return null;
    }
  }, [applyPlayer, handleError]);

  const fetchLeaderboard = useCallback((board: RaceBoard = "wins"): Promise<LeaderboardState | null> => {
    return apiPost<LeaderboardState>("/leaderboard", { board }).catch(() => null);
  }, []);

  const claimLeaderboard = useCallback(async (board: RaceBoard = "wins"): Promise<{ amount: number; rank: number } | null> => {
    try {
      const res = await apiPost<{ amount: number; rank: number; player: Player }>("/leaderboardClaim", { board });
      setHeldWin((h) => h + res.amount);
      applyPlayer(res.player);
      vibrate([20, 40, 20, 40, 60]);
      return { amount: res.amount, rank: res.rank };
    } catch (err) {
      handleError(err);
      return null;
    }
  }, [applyPlayer, handleError]);

  const updateSettings = useCallback(
    async (patch: Partial<{ music: boolean; sfx: boolean }>) => {
      if (patch.music !== undefined) audio.setMusicEnabled(patch.music);
      if (patch.sfx !== undefined) audio.setSfxEnabled(patch.sfx);
      setPlayer((p) => (p ? { ...p, settings: { ...p.settings, ...patch } } : p));
      localAudio.current = { ...localAudio.current, ...patch };
      localStorage.setItem(AUDIO_KEY, JSON.stringify(localAudio.current));
      try {
        const res = await apiPost<{ player: Player }>("/settings", patch);
        setPlayer((p) => (p ? { ...p, settings: res.player.settings } : res.player));
      } catch (err) {
        handleError(err, "Couldn't save settings");
      }
    },
    [handleError],
  );

  const finishTutorial = useCallback(async () => {
    setTutorial(null);
    setPlayer((p) => (p ? { ...p, tutorialDone: true } : p));
    try {
      await apiPost("/tutorial", { done: true });
    } catch {
      /* non-critical */
    }
  }, []);

  const replayTutorial = useCallback(() => {
    setModal(null);
    setTutorial("lobby");
  }, []);

  const setLobbyMusic = useCallback(() => setMusic(LOBBY_MUSIC), []);

  const config = configQuery.data ?? null;
  const configError = configQuery.error ? "Can't load the casino." : null;
  const refetchConfig = configQuery.refetch;
  const retryConfig = useCallback(() => void refetchConfig(), [refetchConfig]);
  const ready = Boolean(config && player);

  return useMemo(
    () => ({
      config,
      configError,
      retryConfig,
      player,
      ready,
      sessionError,
      retrySession: startSession,
      ageConfirmed,
      confirmAge,
      now,
      displayBalance,
      heldWin,
      setPendingBet,
      requestSpin,
      commitSpin,
      releaseWin,
      levelUps,
      collectLevelUp,
      collectBonus,
      spinWheel,
      claimPack,
      claimMission,
      claimStreak,
      claimVip,
      claimReferral,
      claimCollectionSet,
      fetchLeaderboard,
      claimLeaderboard,
      updateSettings,
      modal,
      setModal,
      pendingRef,
      tutorial,
      setTutorial,
      finishTutorial,
      replayTutorial,
      setMusic,
      setLobbyMusic,
      handleError,
      busy,
      setBusy,
    }),
    [
      config,
      configError,
      retryConfig,
      player,
      ready,
      sessionError,
      startSession,
      ageConfirmed,
      confirmAge,
      now,
      displayBalance,
      heldWin,
      requestSpin,
      commitSpin,
      releaseWin,
      levelUps,
      collectLevelUp,
      collectBonus,
      spinWheel,
      claimPack,
      claimMission,
      claimStreak,
      claimVip,
      claimReferral,
      claimCollectionSet,
      fetchLeaderboard,
      claimLeaderboard,
      updateSettings,
      modal,
      pendingRef,
      tutorial,
      finishTutorial,
      replayTutorial,
      setLobbyMusic,
      handleError,
      busy,
    ],
  );
});
