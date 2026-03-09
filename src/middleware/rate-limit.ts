import type { Context, Next } from "hono";
import type { RateLimiter } from "../services/rate-limiter";

export function createRateLimitMiddleware(limiter: RateLimiter, limit?: number) {
  return async (c: Context, next: Next): Promise<void | Response> => {
    const clientIp = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown";
    const result = limiter.check(clientIp, limit);

    c.header("X-RateLimit-Remaining", String(result.remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      return c.json({ error: "Rate limit exceeded" }, 429);
    }

    await next();
  };
}
