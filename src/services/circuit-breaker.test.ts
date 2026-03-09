import { describe, expect, test } from "bun:test";
import { CircuitBreaker } from "./circuit-breaker";

describe("CircuitBreaker", () => {
  test("starts in closed state", () => {
    const cb = new CircuitBreaker(3, 1000);
    expect(cb.canExecute("svc")).toBe(true);
    expect(cb.getState("svc").state).toBe("closed");
  });

  test("opens after threshold failures", () => {
    const cb = new CircuitBreaker(3, 60_000);
    cb.recordFailure("svc");
    cb.recordFailure("svc");
    expect(cb.canExecute("svc")).toBe(true);

    cb.recordFailure("svc");
    expect(cb.canExecute("svc")).toBe(false);
    expect(cb.getState("svc").state).toBe("open");
  });

  test("resets on success", () => {
    const cb = new CircuitBreaker(3, 60_000);
    cb.recordFailure("svc");
    cb.recordFailure("svc");
    cb.recordSuccess("svc");

    expect(cb.getState("svc").failures).toBe(0);
    expect(cb.getState("svc").state).toBe("closed");
  });

  test("half-open after reset timeout", async () => {
    const cb = new CircuitBreaker(1, 50); // 50ms reset
    cb.recordFailure("svc");
    expect(cb.canExecute("svc")).toBe(false);

    await new Promise((r) => setTimeout(r, 60));
    expect(cb.canExecute("svc")).toBe(true);
    expect(cb.getState("svc").state).toBe("half-open");
  });

  test("independent circuits per service", () => {
    const cb = new CircuitBreaker(2, 60_000);
    cb.recordFailure("svc1");
    cb.recordFailure("svc1");

    expect(cb.canExecute("svc1")).toBe(false);
    expect(cb.canExecute("svc2")).toBe(true);
  });

  test("getAllStates returns all circuits", () => {
    const cb = new CircuitBreaker(2, 60_000);
    cb.recordFailure("svc1");
    cb.recordFailure("svc1");
    cb.canExecute("svc2");

    const states = cb.getAllStates();
    expect(states.svc1).toBe("open");
    expect(states.svc2).toBe("closed");
  });
});
