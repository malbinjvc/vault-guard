import type { RateLimitEntry } from "../types";

export class RateLimiter {
  private entries = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private defaultLimit: number;

  constructor(defaultLimit = 100, windowMs = 60_000) {
    this.defaultLimit = defaultLimit;
    this.windowMs = windowMs;

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), this.windowMs);
  }

  check(key: string, limit?: number): { allowed: boolean; remaining: number; resetAt: number } {
    const maxRequests = limit ?? this.defaultLimit;
    const now = Date.now();

    let entry = this.entries.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.entries.set(key, entry);
    }

    entry.count++;

    return {
      allowed: entry.count <= maxRequests,
      remaining: Math.max(0, maxRequests - entry.count),
      resetAt: entry.resetAt,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}
