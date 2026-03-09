import { Hono } from "hono";
import type { JwtService } from "../services/jwt";
import type { RequestLogger } from "../services/request-log";
import type { CircuitBreaker } from "../services/circuit-breaker";
import type { ServiceConfig, HealthStatus } from "../types";

export function createAdminRoutes(
  jwtService: JwtService,
  logger: RequestLogger,
  circuitBreaker: CircuitBreaker,
  services: ServiceConfig[]
): Hono {
  const app = new Hono();

  // Generate a token (for demo/testing)
  app.post("/auth/token", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.sub || !body?.role) {
      return c.json({ error: "Missing 'sub' and 'role' fields" }, 400);
    }

    const expiresIn = typeof body.expiresIn === "number" ? body.expiresIn : 3600;
    const token = await jwtService.sign(
      { sub: String(body.sub), role: String(body.role) },
      expiresIn
    );

    return c.json({ token, expiresIn });
  });

  // Verify a token
  app.post("/auth/verify", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body?.token) {
      return c.json({ error: "Missing 'token' field" }, 400);
    }

    try {
      const payload = await jwtService.verify(body.token);
      return c.json({ valid: true, payload });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      return c.json({ valid: false, error: message });
    }
  });

  // Request logs
  app.get("/logs", (c) => {
    const limit = Number(c.req.query("limit")) || 50;
    return c.json(logger.getRecent(limit));
  });

  // Stats
  app.get("/stats", (c) => {
    return c.json(logger.getStats(circuitBreaker.getAllStates()));
  });

  // Health check for all services
  app.get("/health", async (c) => {
    const checks: HealthStatus[] = [];

    for (const service of services) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(`${service.target}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);

        checks.push({
          service: service.name,
          status: resp.ok ? "healthy" : "unhealthy",
          latencyMs: Date.now() - start,
          lastCheck: new Date().toISOString(),
        });
      } catch {
        checks.push({
          service: service.name,
          status: "unhealthy",
          latencyMs: Date.now() - start,
          lastCheck: new Date().toISOString(),
        });
      }
    }

    const allHealthy = checks.every((c) => c.status === "healthy");
    return c.json({
      gateway: "healthy",
      services: checks,
      overall: allHealthy || checks.length === 0 ? "healthy" : "degraded",
    });
  });

  // Service list
  app.get("/services", (c) => {
    return c.json(
      services.map((s) => ({
        name: s.name,
        pathPrefix: s.pathPrefix,
        requireAuth: s.requireAuth ?? false,
        rateLimit: s.rateLimit,
        circuitState: circuitBreaker.getState(s.name).state,
      }))
    );
  });

  return app;
}
