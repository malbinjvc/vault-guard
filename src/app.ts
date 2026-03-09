import { Hono } from "hono";
import type { GatewayConfig } from "./types";
import { JwtService } from "./services/jwt";
import { RateLimiter } from "./services/rate-limiter";
import { CircuitBreaker } from "./services/circuit-breaker";
import { RequestLogger } from "./services/request-log";
import { securityHeaders } from "./middleware/security-headers";
import { createAuthMiddleware } from "./middleware/auth";
import { createRateLimitMiddleware } from "./middleware/rate-limit";
import { createAdminRoutes } from "./routes/admin";
import { createGatewayRoutes } from "./routes/gateway";

export function createApp(config: GatewayConfig): Hono {
  const app = new Hono();

  // Services
  const jwtService = new JwtService(config.jwtSecret);
  const rateLimiter = new RateLimiter(config.defaultRateLimit);
  const circuitBreaker = new CircuitBreaker();
  const requestLogger = new RequestLogger();

  // Global middleware
  app.use("*", securityHeaders);
  app.use("*", createRateLimitMiddleware(rateLimiter, config.defaultRateLimit));

  // Health endpoint (no auth required)
  app.get("/health", (c) => c.json({ status: "ok", version: "1.0.0" }));

  // Admin routes
  const adminRoutes = createAdminRoutes(jwtService, requestLogger, circuitBreaker, config.services);
  app.route("/admin", adminRoutes);

  // Gateway routes per service
  const authMiddleware = createAuthMiddleware(jwtService);
  for (const service of config.services) {
    if (service.requireAuth) {
      app.use(`${service.pathPrefix}/*`, authMiddleware);
    }
    if (service.rateLimit) {
      app.use(
        `${service.pathPrefix}/*`,
        createRateLimitMiddleware(rateLimiter, service.rateLimit)
      );
    }
  }

  const gatewayRoutes = createGatewayRoutes(
    config.services,
    circuitBreaker,
    requestLogger,
    config.defaultTimeout
  );
  app.route("", gatewayRoutes);

  return app;
}
