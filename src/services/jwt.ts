import type { JwtPayload } from "../types";

export class JwtService {
  private secret: string;

  constructor(secret: string) {
    if (!secret || secret.length < 32) {
      throw new Error("JWT secret must be at least 32 characters");
    }
    this.secret = secret;
  }

  async sign(payload: Omit<JwtPayload, "iat" | "exp">, expiresInSec = 3600): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + expiresInSec,
    };

    const header = this.base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = this.base64url(JSON.stringify(fullPayload));
    const signature = await this.hmacSign(`${header}.${body}`);

    return `${header}.${body}.${signature}`;
  }

  async verify(token: string): Promise<JwtPayload> {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid token format");
    }

    const [header, body, signature] = parts;
    const expectedSig = await this.hmacSign(`${header}.${body}`);

    if (!this.timingSafeEqual(signature, expectedSig)) {
      throw new Error("Invalid token signature");
    }

    const payload: JwtPayload = JSON.parse(this.base64urlDecode(body));

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error("Token expired");
    }

    return payload;
  }

  private async hmacSign(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    return this.base64url(String.fromCharCode(...new Uint8Array(sig)));
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  private base64url(str: string): string {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  private base64urlDecode(str: string): string {
    const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
    return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  }
}
