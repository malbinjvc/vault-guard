import { describe, expect, test } from "bun:test";
import { JwtService } from "./jwt";

const SECRET = "this-is-a-very-long-secret-key-for-testing-purposes-only";

describe("JwtService", () => {
  test("rejects short secret", () => {
    expect(() => new JwtService("short")).toThrow("at least 32 characters");
  });

  test("signs and verifies token", async () => {
    const jwt = new JwtService(SECRET);
    const token = await jwt.sign({ sub: "user1", role: "admin" });
    const payload = await jwt.verify(token);

    expect(payload.sub).toBe("user1");
    expect(payload.role).toBe("admin");
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  test("rejects expired token", async () => {
    const jwt = new JwtService(SECRET);
    const token = await jwt.sign({ sub: "user1", role: "user" }, -1);

    expect(jwt.verify(token)).rejects.toThrow("Token expired");
  });

  test("rejects tampered token", async () => {
    const jwt = new JwtService(SECRET);
    const token = await jwt.sign({ sub: "user1", role: "user" });
    const tampered = token.slice(0, -5) + "XXXXX";

    expect(jwt.verify(tampered)).rejects.toThrow("Invalid token signature");
  });

  test("rejects invalid format", async () => {
    const jwt = new JwtService(SECRET);
    expect(jwt.verify("not.a.valid.token.with.too.many.parts")).rejects.toThrow("Invalid token format");
    expect(jwt.verify("noparts")).rejects.toThrow("Invalid token format");
  });

  test("different secrets produce different signatures", async () => {
    const jwt1 = new JwtService(SECRET);
    const jwt2 = new JwtService("another-very-long-secret-key-for-different-signing");

    const token1 = await jwt1.sign({ sub: "user1", role: "admin" });
    expect(jwt2.verify(token1)).rejects.toThrow("Invalid token signature");
  });

  test("custom expiration time", async () => {
    const jwt = new JwtService(SECRET);
    const token = await jwt.sign({ sub: "user1", role: "admin" }, 7200);
    const payload = await jwt.verify(token);

    expect(payload.exp - payload.iat).toBe(7200);
  });
});
