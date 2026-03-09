export interface ServiceConfig {
  name: string;
  target: string;
  pathPrefix: string;
  rateLimit?: number;
  timeout?: number;
  requireAuth?: boolean;
  circuitBreaker?: {
    threshold: number;
    resetTimeout: number;
  };
}

export interface GatewayConfig {
  port: number;
  jwtSecret: string;
  defaultRateLimit: number;
  defaultTimeout: number;
  services: ServiceConfig[];
}

export interface RequestLog {
  id: string;
  method: string;
  path: string;
  service: string;
  statusCode: number;
  latencyMs: number;
  clientIp: string;
  timestamp: string;
  error?: string;
}

export interface JwtPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
}

export interface CircuitState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half-open";
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface HealthStatus {
  service: string;
  status: "healthy" | "unhealthy" | "unknown";
  latencyMs: number;
  lastCheck: string;
}

export interface StatsResponse {
  totalRequests: number;
  requestsByService: Record<string, number>;
  requestsByStatus: Record<string, number>;
  avgLatencyMs: number;
  circuitStates: Record<string, string>;
  uptime: string;
}
