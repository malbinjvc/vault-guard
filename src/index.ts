import { createApp } from "./app";
import type { GatewayConfig } from "./types";

const config: GatewayConfig = {
  port: Number(process.env.PORT) || 3000,
  jwtSecret: process.env.JWT_SECRET ?? "",
  defaultRateLimit: Number(process.env.RATE_LIMIT) || 100,
  defaultTimeout: Number(process.env.TIMEOUT) || 10_000,
  services: JSON.parse(process.env.SERVICES ?? "[]"),
};

if (!config.jwtSecret) {
  console.error("JWT_SECRET environment variable is required (min 32 chars)");
  process.exit(1);
}

const app = createApp(config);

export default {
  port: config.port,
  fetch: app.fetch,
};

console.log(`VaultGuard API Gateway running on port ${config.port}`);
