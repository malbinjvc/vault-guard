import { describe, expect, test } from "bun:test";
import { createApp } from "./app";
import type { GatewayConfig } from "./types";

const TEST_SECRET = "this-is-a-very-long-secret-key-for-testing-purposes-only";

function testApp(overrides: Partial<GatewayConfig> = {}) {
  const config: GatewayConfig = {
    port: 0,
    jwtSecret: TEST_SECRET,
    defaultRateLimit: 1000,
    defaultTimeout: 5000,
    services: [],
    ...overrides,
  };
  return createApp(config);
}

describe("Health", () => {
  test("returns ok", async () => {
    const app = testApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});

describe("Security Headers", () => {
  test("includes security headers", async () => {
    const app = testApp();
    const res = await app.request("/health");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
    expect(res.headers.get("Strict-Transport-Security")).toBeTruthy();
  });
});

describe("Admin - Token", () => {
  test("generates token", async () => {
    const app = testApp();
    const res = await app.request("/admin/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sub: "user1", role: "admin" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; expiresIn: number };
    expect(body.token).toBeTruthy();
    expect(body.expiresIn).toBe(3600);
  });

  test("rejects missing fields", async () => {
    const app = testApp();
    const res = await app.request("/admin/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sub: "user1" }),
    });
    expect(res.status).toBe(400);
  });

  test("verifies valid token", async () => {
    const app = testApp();
    // Generate token
    const genRes = await app.request("/admin/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sub: "user1", role: "admin" }),
    });
    const { token } = (await genRes.json()) as { token: string };

    // Verify token
    const verifyRes = await app.request("/admin/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(verifyRes.status).toBe(200);
    const body = (await verifyRes.json()) as { valid: boolean; payload: { sub: string } };
    expect(body.valid).toBe(true);
    expect(body.payload.sub).toBe("user1");
  });

  test("rejects invalid token", async () => {
    const app = testApp();
    const res = await app.request("/admin/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invalid.token.here" }),
    });
    const body = (await res.json()) as { valid: boolean };
    expect(body.valid).toBe(false);
  });
});

describe("Admin - Logs & Stats", () => {
  test("returns empty logs", async () => {
    const app = testApp();
    const res = await app.request("/admin/logs");
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  test("returns stats", async () => {
    const app = testApp();
    const res = await app.request("/admin/stats");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { totalRequests: number; uptime: string };
    expect(body.totalRequests).toBe(0);
    expect(body.uptime).toBeTruthy();
  });
});

describe("Admin - Services", () => {
  test("lists configured services", async () => {
    const app = testApp({
      services: [
        { name: "api", target: "http://localhost:8080", pathPrefix: "/api", requireAuth: true },
      ],
    });
    const res = await app.request("/admin/services");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; requireAuth: boolean }[];
    expect(body.length).toBe(1);
    expect(body[0]!.name).toBe("api");
    expect(body[0]!.requireAuth).toBe(true);
  });

  test("returns empty when no services", async () => {
    const app = testApp();
    const res = await app.request("/admin/services");
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body.length).toBe(0);
  });
});

describe("Admin - Health Check", () => {
  test("returns healthy when no services", async () => {
    const app = testApp();
    const res = await app.request("/admin/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { gateway: string; overall: string };
    expect(body.gateway).toBe("healthy");
    expect(body.overall).toBe("healthy");
  });
});

describe("Rate Limiting", () => {
  test("includes rate limit headers", async () => {
    const app = testApp({ defaultRateLimit: 100 });
    const res = await app.request("/health");
    expect(res.headers.get("X-RateLimit-Remaining")).toBeTruthy();
  });
});
