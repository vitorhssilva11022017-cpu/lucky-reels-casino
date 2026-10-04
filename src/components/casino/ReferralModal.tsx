import { Check, Copy, Gift, Share2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CoinIcon } from "./CoinIcon";
import { GButton } from "./GButton";
import { Modal } from "./Modal";
import { audio } from "@/game/audio";
import { useGame } from "@/game/useGame";
import type { ReferralInfo } from "@/game/types";
import { formatCoins } from "@/lib/format";
import { cn } from "@/lib/utils";

function inviteUrl(code: string): string {
  return `${window.location.origin}/?ref=${code}`;
}

async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    audio.play("click", { volume: 0.7 });
    toast.success(label);
  } catch {
    toast.error("Couldn't copy — long-press the link instead");
  }
}

/** Big shareable code block with a tap-to-copy affordance. */
function CodePanel({ code }: { code: string }) {
  const [copied, setCopied] = useState<boolean>(false);
  return (
    <button
      type="button"
      onClick={() => {
        setCopied(true);
        void copyText(code, "Invite code copied!");
        setTimeout(() => setCopied(false), 1600);
      }}
      className="group relative flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-amber-300/60 bg-black/40 px-4 py-3"
      aria-label={`Copy invite code ${code}`}
    >
      <span className="font-display tabular text-gold text-[32px] tracking-[0.25em] sm:text-[36px]">{code}</span>
      {copied ? <Check className="h-6 w-6 text-green-400" strokeWidth={3} /> : <Copy className="h-6 w-6 text-amber-100/60 transition group-hover:text-amber-100" strokeWidth={2.5} />}
    </button>
  );
}

/** Share-mode body: your code, invite link, rewards and progress. */
function ShareView({ ref: refInfo }: { ref: ReferralInfo }) {
  const url = inviteUrl(refInfo.code);
  const share = async () => {
    const data: ShareData = {
      title: "Lucky Reels Casino",
      text: `Join me at Lucky Reels Casino — we both get ${formatCoins(refInfo.perFriendReward * 2)} free coins!`,
      url,
    };
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(data);
        return;
      } catch {
        return; // user dismissed the share sheet
      }
    }
    await copyText(url, "Invite link copied!");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10">
        <CoinIcon className="h-9 w-9 shrink-0" />
        <p className="text-[13px] leading-snug text-violet-100/85">
          Your friend gets <b className="text-gold">{formatCoins(refInfo.welcomeReward)}</b> coins, you get <b className="text-gold">{formatCoins(refInfo.perFriendReward)}</b> for every friend who joins.
        </p>
      </div>

      <CodePanel code={refInfo.code} />

      <div className="grid grid-cols-2 gap-2">
        <GButton variant="cyan" className="flex items-center justify-center gap-2 py-2.5 text-[17px]" onClick={() => void copyText(url, "Invite link copied!")}>
          <Copy className="h-4.5 w-4.5" strokeWidth={2.6} />
          <span>LINK</span>
        </GButton>
        <GButton variant="green" className="flex items-center justify-center gap-2 py-2.5 text-[17px]" onClick={() => void share()}>
          <Share2 className="h-4.5 w-4.5" strokeWidth={2.6} />
          <span>SHARE</span>
        </GButton>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-3 py-2.5 ring-1 ring-white/10">
        <div className="flex items-center gap-2 text-violet-100/80">
          <UserPlus className="h-5 w-5 text-pink-300" strokeWidth={2.4} />
          <span className="text-[14px]">Friends joined</span>
        </div>
        <span className="font-display tabular text-gold text-[22px]">{refInfo.invited}</span>
      </div>

      <p className="mt-1 text-center text-[11px] leading-relaxed text-violet-100/45">
        Invite codes work for brand-new players only. Free casino coins only — no real money, ever.
      </p>
    </div>
  );
}

/** Welcome-mode body: a friend invited this player; one tap to claim. */
function WelcomeView({ code, reward, claiming, onClaim }: { code: string; reward: number; claiming: boolean; onClaim: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-fuchsia-500/60 to-violet-700/60 blur-md" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-700 shadow-lg ring-2 ring-white/70">
          <Gift className="h-10 w-10 text-white heartbeat" strokeWidth={2.4} />
        </div>
      </div>
      <p className="text-[15px] leading-snug text-violet-100/85">
        A friend invited you to Lucky Reels with code <b className="text-gold tracking-widest">{code}</b> — grab your welcome jackpot!
      </p>
      <div className="flex items-center gap-3 rounded-full px-6 py-2.5 pill-dark">
        <CoinIcon className="h-11 w-11" />
        <span className="font-display tabular text-gold text-[34px]">{formatCoins(reward)}</span>
      </div>
      <GButton variant="green" disabled={claiming} onClick={onClaim} className={cn("w-full py-3.5 text-[26px]", !claiming && "glow-pulse")}>
        <span>{claiming ? "CLAIMING…" : "CLAIM NOW"}</span>
      </GButton>
      <p className="text-[11px] text-violet-100/45">Free casino coins only — no real money, ever.</p>
    </div>
  );
}

/**
 * Invite-friends modal. Opens as a welcome screen when this browser arrived
 * via an invite link (?ref=CODE), otherwise as the share-your-code view.
 */
export function ReferralModal() {
  const { modal, setModal, player, claimReferral, pendingRef, tutorial } = useGame();
  const [claiming, setClaiming] = useState<boolean>(false);
  const open = modal === "referral";
  const refInfo = player?.referral ?? null;
  const welcome = Boolean(pendingRef && refInfo && !refInfo.used && refInfo.eligible);

  // Newcomers arriving through an invite link get the welcome screen right
  // away — held back while the tutorial overlay is up so the two never clash.
  useEffect(() => {
    if (!refInfo || !pendingRef || refInfo.used || !refInfo.eligible) return;
    if (modal || tutorial) return;
    const id = setTimeout(() => setModal("referral"), 700);
    return () => clearTimeout(id);
  }, [refInfo, pendingRef, modal, tutorial, setModal]);

  if (!open || !refInfo) return null;

  const onClaim = async () => {
    if (!pendingRef || claiming) return;
    setClaiming(true);
    const amount = await claimReferral(pendingRef);
    setClaiming(false);
    if (amount !== null) toast.success(`${formatCoins(amount)} coins added!`);
  };

  return (
    <Modal open={open} onClose={() => setModal(null)} title={welcome ? "YOU'RE INVITED" : "INVITE FRIENDS"} className="max-w-sm">
      {welcome && pendingRef ? <WelcomeView code={pendingRef} reward={refInfo.welcomeReward} claiming={claiming} onClaim={() => void onClaim()} /> : <ShareView ref={refInfo} />}
    </Modal>
  );
}
