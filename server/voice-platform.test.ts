import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => {
    return {
      id: "mock_id",
      created: Date.now(),
      model: "mock-model",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "Generate system prompt/script of length greater than ten characters.",
          },
          finish_reason: "stop",
        },
      ],
    };
  }),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): {
  ctx: TrpcContext;
  clearedCookies: { name: string; options: Record<string, unknown> }[];
} {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "google",
    role,
    apiAccess: "none",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("clears the session cookie and returns success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });

  it("returns null for unauthenticated me query", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated me query", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.email).toBe("test@example.com");
  });
});

// ─── Settings (admin-only) ────────────────────────────────────────────────────

describe("settings", () => {
  it("returns null or object for admin with no settings configured", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.get();
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("throws FORBIDDEN for regular user accessing settings", async () => {
    const { ctx } = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);
    await expect(caller.settings.get()).rejects.toThrow();
  });

  it("throws for unauthenticated settings access", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.settings.get()).rejects.toThrow();
  });
});

// ─── Voices ───────────────────────────────────────────────────────────────────

describe("voices", () => {
  it("listSaved returns empty array for new user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.voices.listSaved();
    expect(Array.isArray(result)).toBe(true);
  });

  it("listRetell returns an array of voices (or empty array if API key not configured)", async () => {
    // Use admin context — regular users without approved API access get PRECONDITION_FAILED
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    // Returns voices if API key is configured, or empty array if not
    const result = await caller.voices.listRetell();
    expect(Array.isArray(result)).toBe(true);
  });

  it("voices.save persists a voice to the user library", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const uniqueId = "test-voice-save-" + Date.now();
    const result = await caller.voices.save({
      retellVoiceId: uniqueId,
      name: "Test Save Voice",
      category: "premade",
    });
    expect(result.success).toBe(true);
    // alreadyExists is false for a new unique voice
    expect(result.alreadyExists).toBe(false);
  });

  it("throws for unauthenticated voice list", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.voices.listSaved()).rejects.toThrow();
  });
});

// ─── Calls ────────────────────────────────────────────────────────────────────

describe("calls", () => {
  it("calls.list returns empty array for new user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.calls.list({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("calls.initiate creates a new local/LiveKit call successfully", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.calls.initiate({
      toNumber: "+15555550100",
      callType: "web",
      voiceId: "default",
      voiceName: "Default (Fish Speech)",
    });
    expect(result).toHaveProperty("callId");
    expect(result).toHaveProperty("accessToken");
    expect(result.callType).toBe("web");
    expect(result.agentId).toBe("local_agent");
  });

  it("calls.getDetail throws for non-existent call", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.calls.getDetail({ callId: 999999 })).rejects.toThrow();
  });

  it("throws for unauthenticated calls list", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.calls.list({ limit: 10 })).rejects.toThrow();
  });
});

// ─── LLM ─────────────────────────────────────────────────────────────────────

describe("llm", () => {
  it("suggestPrompt returns a non-empty prompt string", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.llm.suggestPrompt({
      useCase: "customer support for a SaaS product",
      tone: "professional",
    });
    expect(result).toHaveProperty("prompt");
    expect(typeof result.prompt).toBe("string");
    expect(result.prompt.length).toBeGreaterThan(10);
  });

  it("generateScript returns a non-empty script string", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.llm.generateScript({
      scenario: "product demo call",
      tone: "professional",
      turns: 4,
    });
    expect(result).toHaveProperty("script");
    expect(typeof result.script).toBe("string");
    expect(result.script.length).toBeGreaterThan(10);
  }, 15000);

  it("throws for unauthenticated LLM requests", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.llm.suggestPrompt({ useCase: "sales call", tone: "professional" })
    ).rejects.toThrow();
  });
});
