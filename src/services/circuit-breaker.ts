import type { CircuitState } from "../types";

export class CircuitBreaker {
  private circuits = new Map<string, CircuitState>();
  private threshold: number;
  private resetTimeoutMs: number;

  constructor(threshold = 5, resetTimeoutMs = 30_000) {
    this.threshold = threshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  canExecute(service: string): boolean {
    const state = this.getState(service);

    if (state.state === "closed") return true;

    if (state.state === "open") {
      if (Date.now() - state.lastFailure >= this.resetTimeoutMs) {
        state.state = "half-open";
        return true;
      }
      return false;
    }

    // half-open: allow one request through
    return true;
  }

  recordSuccess(service: string): void {
    const state = this.getState(service);
    state.failures = 0;
    state.state = "closed";
  }

  recordFailure(service: string): void {
    const state = this.getState(service);
    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= this.threshold) {
      state.state = "open";
    }
  }

  getState(service: string): CircuitState {
    let state = this.circuits.get(service);
    if (!state) {
      state = { failures: 0, lastFailure: 0, state: "closed" };
      this.circuits.set(service, state);
    }
    return state;
  }

  getAllStates(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [service, state] of this.circuits) {
      result[service] = state.state;
    }
    return result;
  }
}
