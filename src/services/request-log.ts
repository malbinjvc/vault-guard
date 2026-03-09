import type { RequestLog, StatsResponse } from "../types";

export class RequestLogger {
  private logs: RequestLog[] = [];
  private maxLogs = 10_000;
  private startTime = Date.now();

  log(entry: RequestLog): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  getRecent(limit = 50): RequestLog[] {
    return this.logs.slice(-limit).reverse();
  }

  getStats(circuitStates: Record<string, string>): StatsResponse {
    const total = this.logs.length;
    const byService: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalLatency = 0;

    for (const log of this.logs) {
      byService[log.service] = (byService[log.service] ?? 0) + 1;
      const statusGroup = `${Math.floor(log.statusCode / 100)}xx`;
      byStatus[statusGroup] = (byStatus[statusGroup] ?? 0) + 1;
      totalLatency += log.latencyMs;
    }

    const uptimeMs = Date.now() - this.startTime;
    const hours = Math.floor(uptimeMs / 3_600_000);
    const minutes = Math.floor((uptimeMs % 3_600_000) / 60_000);
    const seconds = Math.floor((uptimeMs % 60_000) / 1000);

    return {
      totalRequests: total,
      requestsByService: byService,
      requestsByStatus: byStatus,
      avgLatencyMs: total > 0 ? Math.round(totalLatency / total) : 0,
      circuitStates,
      uptime: `${hours}h ${minutes}m ${seconds}s`,
    };
  }
}
