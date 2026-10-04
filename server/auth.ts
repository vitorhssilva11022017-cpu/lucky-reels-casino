import { createRemoteJWKSet, jwtVerify } from "jose";

/** Returns the verified user id for a bearer token, or null when the token is invalid. */
export type TokenVerifier = (token: string) => Promise<{ sub: string } | null>;

/**
 * Verifies Rork Auth access tokens against the provider's published keys.
 * Disabled (returns null) until RORK_AUTH_URL is configured; while disabled the
 * server ignores bearer tokens and everyone plays as a guest.
 * RORK_AUTH_JWKS_URL overrides the key location if Rork publishes it elsewhere.
 */
export function verifierFromEnv(env: Record<string, string | undefined> = process.env): TokenVerifier | null {
  const base = env.RORK_AUTH_URL?.replace(/\/+$/, "");
  const jwksUrl = env.RORK_AUTH_JWKS_URL ?? (base ? `${base}/.well-known/jwks.json` : null);
  if (!jwksUrl) return null;
  const keys = createRemoteJWKSet(new URL(jwksUrl));
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys);
      return payload.sub ? { sub: String(payload.sub) } : null;
    } catch {
      return null;
    }
  };
}
