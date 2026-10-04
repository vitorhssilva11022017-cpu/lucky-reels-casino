import { Redis } from "@upstash/redis";

/**
 * Builds an Upstash client from env vars. Accepts both the Upstash names and the
 * KV_* names that Vercel's Upstash integration sets. `prefix` selects a separate
 * set (e.g. "TEST_" for the test database).
 */
export function redisFromEnv(prefix = "", env: Record<string, string | undefined> = process.env): Redis | null {
  const url = env[`${prefix}UPSTASH_REDIS_REST_URL`] ?? env[`${prefix}KV_REST_API_URL`];
  const token = env[`${prefix}UPSTASH_REDIS_REST_TOKEN`] ?? env[`${prefix}KV_REST_API_TOKEN`];
  return url && token ? new Redis({ url, token }) : null;
}
