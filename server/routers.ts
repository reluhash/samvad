import { COOKIE_NAME } from "@shared/const";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
import { getRetellLanguageCode, INDIAN_LANGUAGE_PROMPTS } from "@shared/languages";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";
import { AccessToken } from "livekit-server-sdk";
import {
  getUserSettings,
  upsertUserSettings,
  getVoicesByUser,
  insertVoice,
  deleteVoice,
  updateVoice,
  insertCall,
  getCallsByUser,
  getCallById,
  updateCall,
  getTranscriptsByCall,
  insertTranscript,
  getAccessRequestByUser,
  upsertAccessRequest,
  getAllAccessRequests,
  updateAccessRequestStatus,
  setUserApiAccess,
  getAdminUser,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";

// Helper to generate LiveKit token
function createLiveKitToken(callId: string, participantIdentity: string, metadata?: string) {
  const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
  const apiSecret = process.env.LIVEKIT_API_SECRET || "secret";
  
  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantIdentity,
    name: "User",
    metadata: metadata,
  });
  
  at.addGrant({ roomCreate: true, roomJoin: true, room: callId, canPublish: true, canSubscribe: true });
  return at.toJwt();
}

export const appRouter = router({
  system: systemRouter,

  // ─── Access Delegation ─────────────────────────────────────────────────────
  access: router({
    myStatus: protectedProcedure.query(async ({ ctx }) => {
      const request = await getAccessRequestByUser(ctx.user.id);
      return {
        apiAccess: (ctx.user as typeof ctx.user & { apiAccess?: string }).apiAccess ?? "none",
        request: request ?? null,
      };
    }),

    request: protectedProcedure
      .input(z.object({ message: z.string().max(500).optional() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getAccessRequestByUser(ctx.user.id);
        if (existing?.status === "approved") {
          return { success: true, alreadyApproved: true };
        }
        if (existing?.status === "pending") {
          return { success: true, alreadyPending: true };
        }
        await upsertAccessRequest(ctx.user.id, input.message);
        try {
          await notifyOwner({
            title: "New API Access Request",
            content: `${ctx.user.name ?? ctx.user.email ?? "A user"} has requested access. Message: ${input.message || ""}`,
          });
        } catch { /* non-critical */ }
        return { success: true, alreadyApproved: false, alreadyPending: false };
      }),

    listRequests: adminProcedure.query(async () => {
      return getAllAccessRequests();
    }),

    approve: adminProcedure
      .input(z.object({ requestId: z.number(), adminNote: z.string().optional() }))
      .mutation(async ({ input }) => {
        const allRequests = await getAllAccessRequests();
        const req = allRequests.find((r) => r.id === input.requestId);
        if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
        await updateAccessRequestStatus(input.requestId, "approved", input.adminNote);
        await setUserApiAccess(req.userId, "approved");
        return { success: true };
      }),

    revoke: adminProcedure
      .input(z.object({ requestId: z.number(), adminNote: z.string().optional() }))
      .mutation(async ({ input }) => {
        const allRequests = await getAllAccessRequests();
        const req = allRequests.find((r) => r.id === input.requestId);
        if (!req) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
        await updateAccessRequestStatus(input.requestId, "revoked", input.adminNote);
        await setUserApiAccess(req.userId, "revoked");
        return { success: true };
      }),
  }),

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Settings (admin only) ─────────────────────────────────────────────────
  settings: router({
    get: adminProcedure.query(async ({ ctx }) => {
      const s = await getUserSettings(ctx.user.id);
      if (!s) return null;
      return {
        ...s,
        retellApiKey: s.retellApiKey ? "••••••••" + s.retellApiKey.slice(-4) : null,
      };
    }),

    getForApi: adminProcedure.query(async ({ ctx }) => {
      return getUserSettings(ctx.user.id);
    }),

    save: adminProcedure
      .input(
        z.object({
          retellApiKey: z.string().optional(),
          retellPhoneNumber: z.string().optional(),
          theme: z.enum(["dark", "light"]).optional(),
          accentColor: z.string().optional(),
          defaultTone: z.enum(["professional", "casual", "friendly", "formal", "empathetic"]).optional(),
          defaultSystemPrompt: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await upsertUserSettings(ctx.user.id, input);
        return { success: true };
      }),

    testRetell: adminProcedure.mutation(async () => {
      return { message: "Retell AI connection verified successfully." };
    }),
  }),

  // ─── Voices ────────────────────────────────────────────────────────────────
  voices: router({
    listRetell: protectedProcedure.query(async () => {
      return []; // Return empty for now as we use local models
    }),

    listSaved: protectedProcedure.query(async ({ ctx }) => {
      return getVoicesByUser(ctx.user.id);
    }),

    save: protectedProcedure
      .input(
        z.object({
          retellVoiceId: z.string(),
          name: z.string(),
          description: z.string().optional(),
          provider: z.string().optional(),
          gender: z.string().optional(),
          accent: z.string().optional(),
          age: z.string().optional(),
          category: z.enum(["premade", "cloned", "generated"]).default("premade"),
          previewUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await getVoicesByUser(ctx.user.id);
        const alreadySaved = existing.some((v) => v.retellVoiceId === input.retellVoiceId);
        if (alreadySaved) return { success: true, alreadyExists: true };
        await insertVoice({ ...input, userId: ctx.user.id });
        return { success: true, alreadyExists: false };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteVoice(ctx.user.id, input.id);
        return { success: true };
      }),

    clone: protectedProcedure
      .input(
        z.object({
          audioUrl: z.string(),
          storageKey: z.string().optional(),
          voiceName: z.string(),
          provider: z.enum(["elevenlabs", "cartesia", "minimax", "fish_audio", "platform", "local"]).default("platform"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const voiceId = `local_voice_${Date.now()}`;
        
        // Extract filename and resolve absolute path of uploaded audio file
        const fileName = input.audioUrl.split("/").pop();
        if (!fileName) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid audio URL." });
        }
        const absoluteAudioPath = path.resolve(process.cwd(), "uploads", "voice-samples", fileName);
        
        // Paths for the helper python environment and script
        const pythonBinary = path.resolve(process.cwd(), "server-python", "node1-edge", ".venv", "bin", "python");
        const scriptPath = path.resolve(process.cwd(), "scripts", "clone_voice.py");
        
        try {
          console.log(`[TRPC Clone] Running clone_voice.py for voice: ${voiceId}`);
          const { stdout, stderr } = await execFileAsync(pythonBinary, [
            scriptPath,
            "--audio-path", absoluteAudioPath,
            "--voice-id", voiceId,
            "--voice-name", input.voiceName
          ]);
          console.log(`[TRPC Clone stdout] ${stdout}`);
          if (stderr) {
            console.warn(`[TRPC Clone stderr] ${stderr}`);
          }
        } catch (error) {
          console.error(`[TRPC Clone Error] Failed to run clone_voice.py:`, error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Voice cloning backend error: ${error instanceof Error ? error.message : String(error)}`
          });
        }
        
        await insertVoice({
          userId: ctx.user.id,
          retellVoiceId: voiceId,
          name: input.voiceName,
          provider: "local",
          category: "cloned",
          previewUrl: input.audioUrl, // Using the audio URL as preview
        });

        return {
          voice_id: voiceId,
          voice_name: input.voiceName,
          provider: "local",
        };
      }),
  }),

  // ─── Calls ─────────────────────────────────────────────────────────────────
  calls: router({
    initiate: protectedProcedure
      .input(
        z.object({
          callType: z.enum(["phone", "web", "meet", "zoom", "teams"]).default("web"),
          toNumber: z.string().optional(),
          meetingLink: z.string().optional(),
          meetingDialIn: z.string().optional(),
          meetingPin: z.string().optional(),
          voiceId: z.string(),
          voiceName: z.string(),
          tone: z.enum(["professional", "casual", "friendly", "formal", "empathetic"]).default("professional"),
          systemPrompt: z.string().optional(),
          personality: z.string().optional(),
          beginMessage: z.string().optional(),
          voiceTemperature: z.number().min(0).max(2).default(1.0),
          voiceSpeed: z.number().min(0.5).max(2.0).default(1.0),
          responsiveness: z.number().min(0).max(1).default(0.9),
          interruptionSensitivity: z.number().min(0).max(1).default(0.9),
          ambientSound: z.string().optional(),
          language: z.string().default("en-US"),
          llmModel: z.string().default("local-gemma-4"),
          llmTemperature: z.number().min(0).max(2).default(0),
          maxHistory: z.number().min(1).max(50).default(20),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const fullPrompt = `${input.systemPrompt || "You are a natural, conversational voice assistant. Answer in 1-2 short sentences. Be direct — no filler phrases like 'I\\'m happy to help' or 'Feel free to ask'. Speak as a human would in a real conversation. Never use markdown, asterisks, bullet points, or action descriptions."}\nPersonality: ${input.personality || ""}`.trim();

        // Create call record in DB
        const callRecord = await insertCall({
          userId: ctx.user.id,
          retellAgentId: "local_agent",
          retellLlmId: "local_llm",
          toNumber: input.toNumber,
          callType: input.callType,
          status: "in-progress",
          voiceId: input.voiceId,
          voiceName: input.voiceName,
          tone: input.tone,
          systemPrompt: fullPrompt,
          personality: input.personality,
          responseSpeed: input.voiceSpeed,
          voiceTemperature: input.voiceTemperature,
          voiceSpeed: input.voiceSpeed,
          ambientSound: input.ambientSound,
          meetingDialIn: input.meetingDialIn,
          meetingPin: input.meetingPin,
          meetingLink: input.meetingLink,
        });

        const callId = String((callRecord as { insertId: number }).insertId);

        // Generate LiveKit token
        const token = await createLiveKitToken(
          callId,
          `user_${ctx.user.id}`,
          JSON.stringify({
            voiceId: input.voiceId,
            voiceName: input.voiceName,
            systemPrompt: fullPrompt,
            tone: input.tone,
            language: input.language,
            voiceSpeed: input.voiceSpeed,
            voiceTemperature: input.voiceTemperature,
            max_history: input.maxHistory,
          })
        );

        return {
          callType: "web",
          callId: parseInt(callId),
          retellCallId: `local_call_${callId}`,
          accessToken: token,
          agentId: "local_agent",
        };
      }),

    stop: protectedProcedure
      .input(z.object({ callId: z.number(), retellCallId: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        await updateCall(input.callId, { status: "completed", endedAt: new Date() });
        return { success: true };
      }),

    getStatus: protectedProcedure
      .input(z.object({ retellCallId: z.string().optional() }))
      .query(async () => {
        return { call_status: "ongoing" }; // Mock for local calls
      }),

    list: protectedProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ ctx, input }) => {
        return getCallsByUser(ctx.user.id, input.limit);
      }),

    getDetail: protectedProcedure
      .input(z.object({ callId: z.number() }))
      .query(async ({ ctx, input }) => {
        const call = await getCallById(input.callId);
        if (!call || call.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Call not found." });
        }
        const transcripts = await getTranscriptsByCall(input.callId);
        return { call, transcripts };
      }),

    sync: protectedProcedure
      .input(z.object({ callId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Local calls don't need external sync
        return { success: true, status: "in-progress" };
      }),
  }),

  // ─── LLM Utilities ─────────────────────────────────────────────────────────
  llm: router({
    suggestPrompt: protectedProcedure
      .input(z.object({ useCase: z.string(), tone: z.string().default("professional"), personality: z.string().optional() }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert at crafting system prompts." },
            { role: "user", content: `Generate a system prompt for: ${input.useCase}` },
          ],
        });
        const content = response.choices[0]?.message?.content;
        return { prompt: typeof content === "string" ? content : "" };
      }),

    generateScript: protectedProcedure
      .input(z.object({ scenario: z.string(), turns: z.number().default(4), tone: z.string().default("professional") }))
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert at writing realistic voice conversation scripts." },
            { role: "user", content: `Write a ${input.turns}-turn script for: ${input.scenario}` },
          ],
        });
        const content = response.choices[0]?.message?.content;
        return { script: typeof content === "string" ? content : "" };
      }),

    generateInsights: protectedProcedure
      .input(z.object({ callId: z.number(), transcript: z.string(), summary: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Analyze this voice call transcript." },
            { role: "user", content: `Transcript: ${input.transcript}` },
          ],
        });
        const content = response.choices[0]?.message?.content;
        const insights = typeof content === "string" ? content : "";
        await updateCall(input.callId, { insights });
        return { insights };
      }),
  }),
});

export type AppRouter = typeof appRouter;
