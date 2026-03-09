import type { Context, Next } from "hono";
import type { JwtService } from "../services/jwt";

export function createAuthMiddleware(jwtService: JwtService) {
  return async (c: Context, next: Next): Promise<void | Response> => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "Missing or invalid Authorization header" }, 401);
    }

    const token = authHeader.slice(7);

    try {
      const payload = await jwtService.verify(token);
      c.set("user", payload);
      await next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      return c.json({ error: message }, 401);
    }
  };
}
