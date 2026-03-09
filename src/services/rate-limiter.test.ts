import { describe, expect, test } from "bun:test";
import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  test("allows requests under limit", () => {
    const limiter = new RateLimiter(5, 60_000);
    for (let i = 0; i < 5; i++) {
      const result = limiter.check("client1");
      expect(result.allowed).toBe(true);
    }
  });

  test("blocks requests over limit", () => {
    const limiter = new RateLimiter(3, 60_000);
    limiter.check("client1");
    limiter.check("client1");
    limiter.check("client1");

    const result = limiter.check("client1");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test("tracks remaining requests", () => {
    const limiter = new RateLimiter(5, 60_000);
    expect(limiter.check("client1").remaining).toBe(4);
    expect(limiter.check("client1").remaining).toBe(3);
    expect(limiter.check("client1").remaining).toBe(2);
  });

  test("different clients have separate limits", () => {
    const limiter = new RateLimiter(2, 60_000);
    limiter.check("client1");
    limiter.check("client1");

    const result1 = limiter.check("client1");
    const result2 = limiter.check("client2");

    expect(result1.allowed).toBe(false);
    expect(result2.allowed).toBe(true);
  });

  test("custom limit overrides default", () => {
    const limiter = new RateLimiter(100, 60_000);
    limiter.check("client1", 1);

    const result = limiter.check("client1", 1);
    expect(result.allowed).toBe(false);
  });

  test("returns reset time", () => {
    const limiter = new RateLimiter(5, 60_000);
    const result = limiter.check("client1");
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });
});
