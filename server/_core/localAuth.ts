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
  // POST /api/auth/local-login (Admin credentials)
  app.post("/api/auth/local-login", async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const adminEmail = process.env.LOCAL_ADMIN_EMAIL ?? "admin@voiceforge.local";
    const adminPassword = process.env.LOCAL_ADMIN_PASSWORD ?? "admin123";

    if (!safeCompare(email, adminEmail) || !safeCompare(password, adminPassword)) {
      res.status(401).json({ error: "Invalid admin credentials" });
      return;
    }

    const openId = "local-admin-openid";

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
    res.json({ ok: true, role: "admin" });
  });

  // POST /api/auth/user-login (Third-party users / Guests with email & optional invite code)
  app.post("/api/auth/user-login", async (req: Request, res: Response) => {
    const { email, name, inviteCode } = req.body ?? {};

    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      res.status(400).json({ error: "A valid email address is required" });
      return;
    }

    const displayName = (name || "").trim() || cleanEmail.split("@")[0];
    const openId = `user_${cleanEmail.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

    // Check if user already exists
    let existingUser = await db.getUserByOpenId(openId);
    let apiAccess = existingUser?.apiAccess || "none";
    let role = existingUser?.role || "user";

    // If invite code provided, validate and approve
    if (inviteCode && inviteCode.trim()) {
      const codeStr = inviteCode.trim().toUpperCase();
      const codes = await db.listInviteCodes();
      const matched = codes.find((c) => c.code === codeStr);
      if (matched && matched.usesCount < matched.maxUses) {
        matched.usesCount += 1;
        apiAccess = "approved";
        if (matched.role === "admin") role = "admin";
      }
    }

    await db.upsertUser({
      openId,
      name: displayName,
      email: cleanEmail,
      loginMethod: "email_login",
      role: role as any,
      apiAccess: apiAccess as any,
      lastSignedIn: new Date(),
    } as any);

    const sessionToken = await sdk.createSessionToken(openId, {
      name: displayName,
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
    res.json({ ok: true, role, apiAccess, name: displayName });
  });

  // POST /api/auth/logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });
}

