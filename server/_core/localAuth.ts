import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

// Simple constant-time comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function registerLocalAuthRoutes(app: Express) {
  // POST /api/auth/local-login  { email, password }
  app.post("/api/auth/local-login", async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    // Pull the admin password from env (LOCAL_ADMIN_PASSWORD), default "admin123"
    const adminEmail = process.env.LOCAL_ADMIN_EMAIL ?? "admin@voiceforge.local";
    const adminPassword = process.env.LOCAL_ADMIN_PASSWORD ?? "admin123";

    if (!safeCompare(email, adminEmail) || !safeCompare(password, adminPassword)) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const openId = "local-admin-openid";

    // Ensure user exists in DB with admin role
    await db.upsertUser({
      openId,
      name: "Admin",
      email: adminEmail,
      loginMethod: "local",
      role: "admin",
      lastSignedIn: new Date(),
    } as any);

    const sessionToken = await sdk.createSessionToken(openId, {
      name: "Admin",
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ ok: true });
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });
}
