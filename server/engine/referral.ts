// @ts-nocheck
/**
 * Referral program: players share an invite link, and both sides win coins.
 * Purely virtual rewards — coins have no real-world value.
 *
 * Flow: every player owns a stable invite code. When a brand-new player joins
 * through `?ref=CODE`, they claim a welcome jackpot and the inviter earns a
 * per-friend reward. Codes are registered in the shared `sys:leaderboard`
 * instance, which acts as the code -> owner registry.
 */

/** Coins the invited friend receives when they claim an invite. */
export const REFERRAL_WELCOME = 1_000_000;

/** Coins the inviter receives for each friend who joins. */
export const REFERRAL_PER_FRIEND = 500_000;

/** Only fresh players can redeem an invite code (anti-farming gate). */
export const REFERRAL_MAX_LEVEL = 5;

/** Unambiguous uppercase alphabet: no I/L/O/0/1 to survive reading aloud. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Generates a short, human-shareable invite code. */
export function newReferralCode(len = 8): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Whether this player may still redeem an invite code. */
export function referralEligible(level: number, used: boolean): boolean {
  return !used && level <= REFERRAL_MAX_LEVEL;
}
