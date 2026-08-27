import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // API key delegation access status
  apiAccess: mysqlEnum("apiAccess", ["none", "approved", "revoked"]).default("none").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Access requests — guests requesting to use admin's API key
export const accessRequests = mysqlTable("access_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "revoked"]).default("pending").notNull(),
  message: text("message"), // optional message from the guest when requesting
  adminNote: text("adminNote"), // optional note from admin when approving/revoking
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = typeof accessRequests.$inferInsert;

// User API credentials and settings
export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Retell AI
  retellApiKey: text("retellApiKey"),
  retellPhoneNumber: varchar("retellPhoneNumber", { length: 32 }),
  // Visual preferences
  theme: mysqlEnum("theme", ["dark", "light"]).default("dark").notNull(),
  accentColor: varchar("accentColor", { length: 16 }).default("#6366f1"),
  // Default conversation settings
  defaultTone: mysqlEnum("defaultTone", ["professional", "casual", "friendly", "formal", "empathetic"]).default("professional"),
  defaultSystemPrompt: text("defaultSystemPrompt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

// Voice library — Retell voices (pre-built + cloned)
export const voices = mysqlTable("voices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  retellVoiceId: varchar("retellVoiceId", { length: 128 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  provider: varchar("provider", { length: 64 }).default("elevenlabs"),
  gender: varchar("gender", { length: 32 }),
  accent: varchar("accent", { length: 64 }),
  age: varchar("age", { length: 32 }),
  category: mysqlEnum("category", ["premade", "cloned", "generated"]).default("premade").notNull(),
  previewUrl: text("previewUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Voice = typeof voices.$inferSelect;
export type InsertVoice = typeof voices.$inferInsert;

// Call sessions
export const calls = mysqlTable("calls", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  retellCallId: varchar("retellCallId", { length: 128 }),   // Retell's call_id
  retellAgentId: varchar("retellAgentId", { length: 128 }), // Retell agent used
  retellLlmId: varchar("retellLlmId", { length: 128 }),     // Retell LLM used
  toNumber: varchar("toNumber", { length: 64 }),             // null for web calls
  callType: mysqlEnum("callType", ["phone", "web", "meet", "zoom", "teams"]).default("phone").notNull(),
  status: mysqlEnum("status", ["initiated", "ringing", "in-progress", "completed", "failed", "cancelled"]).default("initiated").notNull(),
  voiceId: varchar("voiceId", { length: 128 }),
  voiceName: varchar("voiceName", { length: 128 }),
  // Conversation config
  tone: mysqlEnum("tone", ["professional", "casual", "friendly", "formal", "empathetic"]).default("professional"),
  systemPrompt: text("systemPrompt"),
  personality: text("personality"),
  responseSpeed: float("responseSpeed").default(1.0),
  // Voice params snapshot
  voiceTemperature: float("voiceTemperature").default(1.0),
  voiceSpeed: float("voiceSpeed").default(1.0),
  ambientSound: varchar("ambientSound", { length: 64 }),
  // Meeting join info (for meet/zoom/teams)
  meetingDialIn: varchar("meetingDialIn", { length: 64 }),
  meetingPin: varchar("meetingPin", { length: 64 }),
  meetingLink: text("meetingLink"),
  // Timing
  startedAt: timestamp("startedAt"),
  endedAt: timestamp("endedAt"),
  durationSeconds: int("durationSeconds"),
  // Post-call analysis (from Retell webhook)
  summary: text("summary"),
  userSentiment: varchar("userSentiment", { length: 64 }),
  callSuccessful: boolean("callSuccessful"),
  insights: text("insights"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Call = typeof calls.$inferSelect;
export type InsertCall = typeof calls.$inferInsert;

// Call transcript entries (populated from Retell webhook)
export const callTranscripts = mysqlTable("call_transcripts", {
  id: int("id").autoincrement().primaryKey(),
  callId: int("callId").notNull(),
  speaker: mysqlEnum("speaker", ["ai", "human"]).notNull(),
  text: text("text").notNull(),
  timestamp: float("timestamp").notNull(), // seconds from call start (Retell format)
  words: text("words"),                    // JSON array of word-level timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CallTranscript = typeof callTranscripts.$inferSelect;
export type InsertCallTranscript = typeof callTranscripts.$inferInsert;
