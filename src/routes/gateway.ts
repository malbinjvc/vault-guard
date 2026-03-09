import { Hono } from "hono";
import type { ServiceConfig } from "../types";
import type { CircuitBreaker } from "../services/circuit-breaker";
import type { RequestLogger } from "../services/request-log";

export function createGatewayRoutes(
  services: ServiceConfig[],
  circuitBreaker: CircuitBreaker,
  logger: RequestLogger,
  defaultTimeout: number
): Hono {
  const app = new Hono();

  for (const service of services) {
    const pattern = `${service.pathPrefix}/*`;

    app.all(pattern, async (c) => {
      const start = Date.now();
      const requestId = crypto.randomUUID();
      const path = c.req.path;
      const method = c.req.method;
      const clientIp = c.req.header("x-forwarded-for") ?? "unknown";

      // Circuit breaker check
      if (!circuitBreaker.canExecute(service.name)) {
        const latency = Date.now() - start;
        logger.log({
          id: requestId,
          method,
          path,
          service: service.name,
          statusCode: 503,
          latencyMs: latency,
          clientIp,
          timestamp: new Date().toISOString(),
          error: "Circuit breaker open",
        });

        return c.json(
          { error: `Service ${service.name} is temporarily unavailable` },
          503
        );
      }

      try {
        // Build target URL
        const targetPath = path.replace(service.pathPrefix, "");
        const targetUrl = `${service.target}${targetPath}`;

        // Proxy request
        const timeout = service.timeout ?? defaultTimeout;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const headers = new Headers(c.req.raw.headers);
        headers.set("X-Request-ID", requestId);
        headers.set("X-Forwarded-For", clientIp);
        headers.delete("host");

        const proxyResponse = await fetch(targetUrl, {
          method,
          headers,
          body: method !== "GET" && method !== "HEAD" ? c.req.raw.body : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const latency = Date.now() - start;
        circuitBreaker.recordSuccess(service.name);

        logger.log({
          id: requestId,
          method,
          path,
          service: service.name,
          statusCode: proxyResponse.status,
          latencyMs: latency,
          clientIp,
          timestamp: new Date().toISOString(),
        });

        // Forward response
        const responseHeaders = new Headers(proxyResponse.headers);
        responseHeaders.set("X-Request-ID", requestId);
        responseHeaders.set("X-Response-Time", `${latency}ms`);
        responseHeaders.set("X-Proxied-By", "VaultGuard");

        return new Response(proxyResponse.body, {
          status: proxyResponse.status,
          headers: responseHeaders,
        });
      } catch (err) {
        const latency = Date.now() - start;
        circuitBreaker.recordFailure(service.name);

        const errorMsg = err instanceof Error ? err.message : "Proxy error";
        const status = errorMsg.includes("abort") ? 504 : 502;

        logger.log({
          id: requestId,
          method,
          path,
          service: service.name,
          statusCode: status,
          latencyMs: latency,
          clientIp,
          timestamp: new Date().toISOString(),
          error: errorMsg,
        });

        return c.json(
          { error: status === 504 ? "Gateway timeout" : "Bad gateway" },
          status
        );
      }
    });
  }

  return app;
}
