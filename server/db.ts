import { eq, desc, and, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  userSettings,
  voices,
  calls,
  callTranscripts,
  accessRequests,
  InsertUserSettings,
  InsertVoice,
  InsertCall,
  InsertCallTranscript,
  InsertAccessRequest,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    return {
      id: 1,
      openId,
      name: "Dev Admin",
      email: "admin@localhost",
      loginMethod: "local",
      role: "admin",
      apiAccess: "approved",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date()
    } as any;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── User Settings ────────────────────────────────────────────────────────────

export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) {
    return {
      id: 1,
      userId,
      theme: "dark",
      accentColor: "#6366f1",
      defaultTone: "professional",
      defaultSystemPrompt: "You are a helpful assistant.",
      createdAt: new Date(),
      updatedAt: new Date()
    } as any;
  }
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function upsertUserSettings(userId: number, data: Partial<InsertUserSettings>) {
  const db = await getDb();
  if (!db) return getUserSettings(userId);
  const existing = await getUserSettings(userId);
  if (existing) {
    await db.update(userSettings).set({ ...data, updatedAt: new Date() }).where(eq(userSettings.userId, userId));
  } else {
    await db.insert(userSettings).values({ userId, ...data });
  }
  return getUserSettings(userId);
}

// ─── Voices ───────────────────────────────────────────────────────────────────

// In-memory voice store for local dev (no DATABASE_URL)
let _nextVoiceId = 3;
const _inMemoryVoices: any[] = [
  {
    id: 1,
    userId: 1,
    retellVoiceId: "default",
    name: "Default (Fish Speech)",
    description: "Fish Speech S2-Pro model",
    provider: "local",
    gender: null,
    accent: null,
    age: null,
    category: "premade",
    previewUrl: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    userId: 1,
    retellVoiceId: "kokoro",
    name: "Kokoro (Fallback)",
    description: "Kokoro ONNX fallback model",
    provider: "local",
    gender: null,
    accent: null,
    age: null,
    category: "premade",
    previewUrl: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export async function getVoicesByUser(userId: number) {
  const db = await getDb();
  if (!db) {
    return _inMemoryVoices.filter((v) => v.userId === userId || userId === 1);
  }
  return db.select().from(voices).where(eq(voices.userId, userId)).orderBy(desc(voices.createdAt));
}

export async function insertVoice(data: InsertVoice) {
  const db = await getDb();
  if (!db) {
    const newVoice = {
      id: _nextVoiceId++,
      userId: data.userId,
      retellVoiceId: data.retellVoiceId,
      name: data.name,
      description: data.description ?? null,
      provider: data.provider ?? "local",
      gender: data.gender ?? null,
      accent: data.accent ?? null,
      age: data.age ?? null,
      category: data.category ?? "cloned",
      previewUrl: data.previewUrl ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    _inMemoryVoices.push(newVoice);
    console.log(`[Voices] In-memory: added "${newVoice.name}" (id=${newVoice.id}, voiceId=${newVoice.retellVoiceId})`);
    return;
  }
  await db.insert(voices).values(data);
}

export async function deleteVoice(userId: number, voiceId: number) {
  const db = await getDb();
  if (!db) {
    const idx = _inMemoryVoices.findIndex((v) => v.id === voiceId && (v.userId === userId || userId === 1));
    if (idx !== -1) {
      const removed = _inMemoryVoices.splice(idx, 1);
      console.log(`[Voices] In-memory: removed "${removed[0]?.name}" (id=${voiceId})`);
    }
    return;
  }
  await db.delete(voices).where(and(eq(voices.id, voiceId), eq(voices.userId, userId)));
}

export async function updateVoice(userId: number, voiceId: number, data: Partial<InsertVoice>) {
  const db = await getDb();
  if (!db) {
    const voice = _inMemoryVoices.find((v) => v.id === voiceId && (v.userId === userId || userId === 1));
    if (voice) Object.assign(voice, data, { updatedAt: new Date() });
    return;
  }
  await db.update(voices).set({ ...data, updatedAt: new Date() }).where(and(eq(voices.id, voiceId), eq(voices.userId, userId)));
}

// ─── Calls ────────────────────────────────────────────────────────────────────

// In-memory calls list for local dev/testing
const _inMemoryCalls: any[] = [];

export async function insertCall(data: InsertCall) {
  const db = await getDb();
  if (!db) {
    const id = Date.now();
    const newCall = {
      id,
      userId: data.userId,
      retellCallId: data.retellCallId ?? `local_call_${id}`,
      retellAgentId: data.retellAgentId ?? "local_agent",
      retellLlmId: data.retellLlmId ?? "local_llm",
      toNumber: data.toNumber ?? null,
      callType: data.callType ?? "web",
      status: data.status ?? "in-progress",
      voiceId: data.voiceId ?? "default",
      voiceName: data.voiceName ?? "Default (Fish Speech)",
      tone: data.tone ?? "professional",
      systemPrompt: data.systemPrompt ?? "You are a helpful assistant.",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    _inMemoryCalls.push(newCall);
    return { insertId: id } as any;
  }
  const result = await db.insert(calls).values(data);
  return result[0];
}

export async function getCallsByUser(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) {
    return _inMemoryCalls.filter((c) => c.userId === userId).slice(0, limit);
  }
  return db.select().from(calls).where(eq(calls.userId, userId)).orderBy(desc(calls.createdAt)).limit(limit);
}

export async function getCallById(callId: number) {
  const db = await getDb();
  if (!db) {
    return _inMemoryCalls.find((c) => c.id === callId);
  }
  const result = await db.select().from(calls).where(eq(calls.id, callId)).limit(1);
  return result[0];
}

export async function updateCall(callId: number, data: Partial<InsertCall>) {
  const db = await getDb();
  if (!db) {
    const call = _inMemoryCalls.find((c) => c.id === callId);
    if (call) {
      Object.assign(call, data, { updatedAt: new Date() });
    }
    return;
  }
  await db.update(calls).set({ ...data, updatedAt: new Date() }).where(eq(calls.id, callId));
}

// ─── Access Delegation ───────────────────────────────────────────────────────

export async function getAccessRequestByUser(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(accessRequests).where(eq(accessRequests.userId, userId)).orderBy(desc(accessRequests.createdAt)).limit(1);
  return result[0] ?? null;
}

export async function upsertAccessRequest(userId: number, message?: string) {
  const db = await getDb();
  if (!db) return null;
  const existing = await getAccessRequestByUser(userId);
  if (existing && existing.status === "pending") {
    // Already has a pending request — return it
    return existing;
  }
  // Insert a new request (even if previously revoked, allow re-request)
  await db.insert(accessRequests).values({ userId, message: message ?? null, status: "pending", requestedAt: new Date() });
  return getAccessRequestByUser(userId);
}

export async function getAllAccessRequests() {
  const db = await getDb();
  if (!db) return [];
  // Join with users to get name/email
  const result = await db
    .select({
      id: accessRequests.id,
      userId: accessRequests.userId,
      status: accessRequests.status,
      message: accessRequests.message,
      adminNote: accessRequests.adminNote,
      requestedAt: accessRequests.requestedAt,
      reviewedAt: accessRequests.reviewedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(accessRequests)
    .leftJoin(users, eq(accessRequests.userId, users.id))
    .orderBy(desc(accessRequests.requestedAt));
  return result;
}

export async function updateAccessRequestStatus(
  requestId: number,
  status: "approved" | "revoked",
  adminNote?: string
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(accessRequests)
    .set({ status, adminNote: adminNote ?? null, reviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(accessRequests.id, requestId));
}

export async function setUserApiAccess(userId: number, access: "none" | "approved" | "revoked") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ apiAccess: access, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function getAdminUser() {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  return result[0] ?? null;
}

export async function getAllUsersWithAccess() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(ne(users.role, "admin")).orderBy(desc(users.createdAt));
}

// ─── Transcripts ──────────────────────────────────────────────────────────────

export async function insertTranscript(data: InsertCallTranscript) {
  const db = await getDb();
  if (!db) return;
  await db.insert(callTranscripts).values(data);
}

export async function getTranscriptsByCall(callId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(callTranscripts).where(eq(callTranscripts.callId, callId)).orderBy(callTranscripts.timestamp);
}
