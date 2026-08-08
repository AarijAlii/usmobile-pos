import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

/** 5 attempts per minute per key — covers both login (key = email/IP) and the AI diagnosis route (key = staff id). Fails open (allows the request) if Redis isn't configured, so local dev without Upstash still works. */
export async function checkRateLimit(
  key: string,
  { limit = 5, windowSeconds = 60 }: { limit?: number; windowSeconds?: number } = {},
): Promise<{ success: boolean }> {
  if (!redis) return { success: true };

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
  });

  const { success } = await ratelimit.limit(key);
  return { success };
}
