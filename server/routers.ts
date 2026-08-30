import { COOKIE_NAME } from "@shared/const";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import http from "http";

const execFileAsync = promisify(execFile);
import { INDIAN_LANGUAGE_PROMPTS } from "@shared/languages";
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
  getAllUsersList,
  grantDirectAccessByEmail,
  updateUserRoleAndAccess,
  deleteUserAccount,
  listInviteCodes,
  createInviteCode,
  deleteInviteCode,
  redeemInviteCode,
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

  // ─── Access Delegation & User Directory ───────────────────────────────────────
  access: router({
    myStatus: protectedProcedure.query(async ({ ctx }) => {
      const request = await getAccessRequestByUser(ctx.user.id);
      return {
        apiAccess: (ctx.user as typeof ctx.user & { apiAccess?: string }).apiAccess ?? "none",
        role: ctx.user.role,
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
            title: "New Voice Platform Access Request",
            content: `${ctx.user.name ?? ctx.user.email ?? "A user"} has requested access. Message: ${input.message || ""}`,
          });
        } catch { /* non-critical */ }
        return { success: true, alreadyApproved: false, alreadyPending: false };
      }),

    redeemCode: protectedProcedure
      .input(z.object({ code: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const res = await redeemInviteCode(input.code, ctx.user.id);
        if (!res.success) {
          throw new TRPCError({ code: "BAD_REQUEST", message: res.message });
        }
        return res;
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

    // Direct User Whitelisting & Directory
    listUsers: adminProcedure.query(async () => {
      return getAllUsersList();
    }),

    directGrant: adminProcedure
      .input(
        z.object({
          email: z.string().email(),
          name: z.string().optional(),
          role: z.enum(["user", "admin"]).default("user"),
        })
      )
      .mutation(async ({ input }) => {
        const user = await grantDirectAccessByEmail(input);
        return { success: true, user };
      }),

    updateUserRole: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          role: z.enum(["user", "admin"]),
          apiAccess: z.enum(["none", "approved", "revoked"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateUserRoleAndAccess(input.userId, input.role, input.apiAccess);
        return { success: true };
      }),

    deleteUser: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteUserAccount(input.userId);
        return { success: true };
      }),

    // Invite Codes
    listInviteCodes: adminProcedure.query(async () => {
      return listInviteCodes();
    }),

    createInviteCode: adminProcedure
      .input(
        z.object({
          code: z.string().min(3),
          maxUses: z.number().min(1).default(10),
          role: z.enum(["user", "admin"]).default("user"),
          note: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const created = await createInviteCode(input);
        return { success: true, code: created };
      }),

    deleteInviteCode: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteInviteCode(input.id);
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

  // ─── Settings & Telephony Infrastructure ────────────────────────────────────
  settings: router({
    get: publicProcedure.query(async ({ ctx }) => {
      if (ctx.user) {
        const s = await getUserSettings(ctx.user.id);
        if (s) return s;
      }
      return {
        id: 1,
        userId: ctx.user?.id || 1,
        theme: "dark",
        accentColor: "#6366f1",
        defaultTone: "professional",
        defaultSystemPrompt: "आप एक तेज़, स्वाभाविक और विनम्र भारतीय वॉयस कॉल सहायक हैं। केवल 1-2 छोटे और स्वाभाविक हिंदी वाक्यों में उत्तर दें।",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),

    getForApi: publicProcedure.query(async ({ ctx }) => {
      if (ctx.user) {
        const s = await getUserSettings(ctx.user.id);
        if (s) return s;
      }
      return {
        id: 1,
        userId: ctx.user?.id || 1,
        theme: "dark",
        accentColor: "#6366f1",
        defaultTone: "professional",
        defaultSystemPrompt: "आप एक तेज़, स्वाभाविक और विनम्र भारतीय वॉयस कॉल सहायक हैं। केवल 1-2 छोटे और स्वाभाविक हिंदी वाक्यों में उत्तर दें।",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),

    save: publicProcedure
      .input(
        z.object({
          theme: z.enum(["dark", "light"]).optional(),
          accentColor: z.string().optional(),
          defaultTone: z.enum(["professional", "casual", "friendly", "formal", "empathetic"]).optional(),
          defaultSystemPrompt: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user) {
          await upsertUserSettings(ctx.user.id, input);
        }
        return { success: true };
      }),

    getPipelineHealth: publicProcedure.query(async () => {
      return new Promise<{ telephonyBridge: boolean; s2sCore: boolean; callerId: string }>((resolve) => {
        const req = http.get("http://127.0.0.1:5000/health", { timeout: 3000 }, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              resolve({
                telephonyBridge: json.status === "healthy",
                s2sCore: true,
                callerId: "+1 (989) 589-8371",
              });
            } catch {
              resolve({ telephonyBridge: false, s2sCore: false, callerId: "+1 (989) 589-8371" });
            }
          });
        });
        req.on("error", () => {
          resolve({ telephonyBridge: false, s2sCore: false, callerId: "+1 (989) 589-8371" });
        });
      });
    }),
  }),

  // ─── Voices ────────────────────────────────────────────────────────────────
  voices: router({
    listPremade: publicProcedure.query(async () => {
      return [
        {
          voice_id: "Aanchal-hi",
          voice_name: "Aanchal (Hindi Female - Clear & Conversational)",
          provider: "indic-f5",
          accent: "Indian",
          gender: "female",
          age: "young",
          category: "premade",
          preview_audio_url: "",
        },
        {
          voice_id: "Rohit-hi",
          voice_name: "Rohit (Hindi Male - Clear & Balanced)",
          provider: "indic-f5",
          accent: "Indian",
          gender: "male",
          age: "young",
          category: "premade",
          preview_audio_url: "",
        },
        {
          voice_id: "ananya",
          voice_name: "Ananya (Indic Multilingual Female)",
          provider: "indic-f5",
          accent: "Indian",
          gender: "female",
          age: "young",
          category: "premade",
          preview_audio_url: "",
        },
        {
          voice_id: "default_indic",
          voice_name: "Aarav (Indic Multilingual Male)",
          provider: "indic-f5",
          accent: "Indian",
          gender: "male",
          age: "young",
          category: "premade",
          preview_audio_url: "",
        },
        {
          voice_id: "Chhavi-hi",
          voice_name: "Chhavi (Hindi Female - Warm)",
          provider: "indic-f5",
          accent: "Indian",
          gender: "female",
          age: "young",
          category: "premade",
          preview_audio_url: "",
        },
        {
          voice_id: "Divya-hi",
          voice_name: "Divya (Hindi Female - Professional)",
          provider: "indic-f5",
          accent: "Indian",
          gender: "female",
          age: "young",
          category: "premade",
          preview_audio_url: "",
        },
        {
          voice_id: "Amol-hi",
          voice_name: "Amol (Hindi Male - Energetic)",
          provider: "indic-f5",
          accent: "Indian",
          gender: "male",
          age: "young",
          category: "premade",
          preview_audio_url: "",
        },
        {
          voice_id: "af_heart",
          voice_name: "Heart (US Female - Warm & Expressive)",
          provider: "kokoro",
          accent: "American",
          gender: "female",
          age: "young",
          category: "premade",
          preview_audio_url: "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/samples/af_heart.wav",
        },
        {
          voice_id: "af_bella",
          voice_name: "Bella (US Female - Cheerful & Bright)",
          provider: "kokoro",
          accent: "American",
          gender: "female",
          age: "young",
          category: "premade",
          preview_audio_url: "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/samples/af_bella.wav",
        },
        {
          voice_id: "am_adam",
          voice_name: "Adam (US Male - Deep & Confident)",
          provider: "kokoro",
          accent: "American",
          gender: "male",
          age: "middle_aged",
          category: "premade",
          preview_audio_url: "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/samples/am_adam.wav",
        },
        {
          voice_id: "bf_emma",
          voice_name: "Emma (UK Female - Crisp & Articulate)",
          provider: "kokoro",
          accent: "British",
          gender: "female",
          age: "young",
          category: "premade",
          preview_audio_url: "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/samples/bf_emma.wav",
        },
        {
          voice_id: "bm_george",
          voice_name: "George (UK Male - Authoritative)",
          provider: "kokoro",
          accent: "British",
          gender: "male",
          age: "middle_aged",
          category: "premade",
          preview_audio_url: "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/samples/bm_george.wav",
        },
      ];
    }),

    listRetell: publicProcedure.query(async () => {
      const { listPremade } = appRouter.voices as any;
      return [
        {
          voice_id: "Aanchal-hi",
          voice_name: "Aanchal (Hindi Female - Clear & Conversational)",
          provider: "indic-f5",
          accent: "Indian",
          gender: "female",
          age: "young",
          category: "premade",
          preview_audio_url: "",
        },
        {
          voice_id: "Rohit-hi",
          voice_name: "Rohit (Hindi Male - Clear & Balanced)",
          provider: "indic-f5",
          accent: "Indian",
          gender: "male",
          age: "young",
          category: "premade",
          preview_audio_url: "",
        },
        {
          voice_id: "ananya",
          voice_name: "Ananya (Indic Multilingual Female)",
          provider: "indic-f5",
          accent: "Indian",
          gender: "female",
          age: "young",
          category: "premade",
          preview_audio_url: "",
        },
        {
          voice_id: "default_indic",
          voice_name: "Aarav (Indic Multilingual Male)",
          provider: "indic-f5",
          accent: "Indian",
          gender: "male",
          age: "young",
          category: "premade",
          preview_audio_url: "",
        },
        {
          voice_id: "af_heart",
          voice_name: "Heart (US Female - Warm & Expressive)",
          provider: "kokoro",
          accent: "American",
          gender: "female",
          age: "young",
          category: "premade",
          preview_audio_url: "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/samples/af_heart.wav",
        },
        {
          voice_id: "af_bella",
          voice_name: "Bella (US Female - Cheerful & Bright)",
          provider: "kokoro",
          accent: "American",
          gender: "female",
          age: "young",
          category: "premade",
          preview_audio_url: "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/samples/af_bella.wav",
        },
        {
          voice_id: "am_adam",
          voice_name: "Adam (US Male - Deep & Confident)",
          provider: "kokoro",
          accent: "American",
          gender: "male",
          age: "middle_aged",
          category: "premade",
          preview_audio_url: "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/samples/am_adam.wav",
        },
        {
          voice_id: "bf_emma",
          voice_name: "Emma (UK Female - Crisp & Articulate)",
          provider: "kokoro",
          accent: "British",
          gender: "female",
          age: "young",
          category: "premade",
          preview_audio_url: "https://huggingface.co/hexgrad/Kokoro-82M/resolve/main/samples/bf_emma.wav",
        },
      ];
    }),

    listSaved: publicProcedure.query(async ({ ctx }) => {
      const dbVoices = ctx.user ? await getVoicesByUser(ctx.user.id) : [];
      
      const refsDir = path.resolve(process.cwd(), "fish-speech-int4-patch", "references");
      const localCloned: Array<{ id: number; voiceId: string; retellVoiceId: string; name: string; category: string; provider: string; previewUrl: string | null }> = [];
      
      if (fs.existsSync(refsDir)) {
        const dirs = fs.readdirSync(refsDir);
        let idCounter = 9001;
        for (const dir of dirs) {
          if (dir.startsWith("local_voice_") && !dir.includes("test_warmup")) {
            const isAlreadyInDb = dbVoices.some((v) => v.retellVoiceId === dir);
            if (!isAlreadyInDb) {
              const labPath = path.join(refsDir, dir, "sample.lab");
              let voiceLabel = "Custom Cloned Voice";
              if (fs.existsSync(labPath)) {
                const text = fs.readFileSync(labPath, "utf-8").trim();
                if (text.length > 0) {
                  voiceLabel = text.length > 35 ? `${text.slice(0, 35)}...` : text;
                }
              }
              localCloned.push({
                id: idCounter++,
                voiceId: dir,
                retellVoiceId: dir,
                name: voiceLabel,
                category: "cloned",
                provider: "local",
                previewUrl: `/uploads/voice-samples/${dir}.wav`,
              });
            }
          }
        }
      }

      const mappedDb = dbVoices.map((v) => ({
        ...v,
        voiceId: v.retellVoiceId,
      }));

      return [...mappedDb, ...localCloned];
    }),

    save: protectedProcedure
      .input(
        z.object({
          voiceId: z.string().optional(),
          retellVoiceId: z.string().optional(),
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
        const effectiveVoiceId = input.voiceId || input.retellVoiceId || `voice_${Date.now()}`;
        const existing = await getVoicesByUser(ctx.user.id);
        const alreadySaved = existing.some((v) => v.retellVoiceId === effectiveVoiceId);
        if (alreadySaved) {
          return { success: true, alreadyExists: true };
        }
        await insertVoice({
          userId: ctx.user.id,
          retellVoiceId: effectiveVoiceId,
          name: input.name,
          description: input.description,
          provider: input.provider,
          gender: input.gender,
          accent: input.accent,
          age: input.age,
          category: input.category,
          previewUrl: input.previewUrl,
        });
        return { success: true, alreadyExists: false };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number().optional(), voiceId: z.string().optional(), retellVoiceId: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const effectiveVoiceId = input.voiceId || input.retellVoiceId || (input.id ? `local_voice_${input.id}` : null);
        
        if (input.id && input.id < 9000) {
          await deleteVoice(ctx.user.id, input.id);
        }
        
        if (effectiveVoiceId && effectiveVoiceId.startsWith("local_voice_")) {
          const refsDir = path.resolve(process.cwd(), "fish-speech-int4-patch", "references");
          const targetDir = path.join(refsDir, effectiveVoiceId);
          if (fs.existsSync(targetDir)) {
            try {
              fs.rmSync(targetDir, { recursive: true, force: true });
              console.log(`[Voices] Deleted filesystem directory: ${targetDir}`);
            } catch (err) {
              console.error(`[Voices] Failed to remove ${targetDir}:`, err);
            }
          }
        }
        return { success: true };
      }),

    deleteAllCloned: protectedProcedure.mutation(async ({ ctx }) => {
      const dbVoices = await getVoicesByUser(ctx.user.id);
      for (const v of dbVoices) {
        if (v.category === "cloned") {
          await deleteVoice(ctx.user.id, v.id);
        }
      }

      const refsDir = path.resolve(process.cwd(), "fish-speech-int4-patch", "references");
      if (fs.existsSync(refsDir)) {
        const dirs = fs.readdirSync(refsDir);
        for (const dir of dirs) {
          if (dir.startsWith("local_voice_") && !dir.includes("test_warmup")) {
            const fullPath = path.join(refsDir, dir);
            try {
              fs.rmSync(fullPath, { recursive: true, force: true });
              console.log(`[Voices] Purged cloned directory: ${fullPath}`);
            } catch (err) {
              console.error(`[Voices] Failed to delete ${fullPath}:`, err);
            }
          }
        }
      }
      return { success: true };
    }),

    clone: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          audioUrl: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const userRole = ctx.user.role;
        const apiAccess = (ctx.user as any).apiAccess;
        if (userRole !== "admin" && apiAccess !== "approved") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Zero-shot voice cloning requires approved access. Please redeem an invite code or request access.",
          });
        }

        const pythonScript = path.resolve(process.cwd(), "scripts/clone_voice.py");
        let audioRelative = input.audioUrl.startsWith("/") ? input.audioUrl.slice(1) : input.audioUrl;
        const audioPath = path.resolve(process.cwd(), audioRelative);

        if (!fs.existsSync(audioPath)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Audio file not found at ${audioPath}`,
          });
        }

        const voiceId = `local_voice_${Date.now()}`;
        let effectiveName = input.name;

        try {
          const { stdout, stderr } = await execFileAsync("python3", [
            pythonScript,
            "--audio", audioPath,
            "--voice_id", voiceId,
            "--name", input.name
          ]);
          console.log(`[Voice Cloning Output]:`, stdout);
          if (stderr) console.warn(`[Voice Cloning Warnings]:`, stderr);
        } catch (error) {
          console.error(`[Voice Cloning Error]:`, error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Voice cloning backend error: ${error instanceof Error ? error.message : String(error)}`
          });
        }
        
        await insertVoice({
          userId: ctx.user.id,
          retellVoiceId: voiceId,
          name: effectiveName,
          provider: "local",
          category: "cloned",
          previewUrl: input.audioUrl,
        });

        return {
          voice_id: voiceId,
          voice_name: effectiveName,
          provider: "local",
        };
      }),
  }),

  // ─── Telephony Phone Calls ───────────────────────────────────────────────────
  phoneCalls: router({
    dispatch: protectedProcedure
      .input(
        z.object({
          toNumber: z.string(),
          voiceId: z.string().default("Aanchal-hi"),
          systemPrompt: z.string().default(""),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const userRole = ctx.user.role;
        const apiAccess = (ctx.user as any).apiAccess;
        if (userRole !== "admin" && apiAccess !== "approved") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Outbound phone calls require approved platform access. Please enter an invite code or request access from the administrator.",
          });
        }

        const postData = JSON.stringify({
          to: input.toNumber,
          voice_id: input.voiceId,
          system_prompt: input.systemPrompt,
        });

        return new Promise((resolve, reject) => {
          const options: http.RequestOptions = {
            hostname: "127.0.0.1",
            port: 5000,
            path: "/api/v1/calls/dispatch",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(postData),
            },
          };

          const req = http.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", async () => {
              try {
                const data = JSON.parse(body);
                if (data.callId) {
                  await insertCall({
                    userId: ctx.user.id,
                    toNumber: input.toNumber,
                    callType: "phone",
                    status: "in-progress",
                    voice_id: input.voiceId,
                    voice_name: input.voiceId,
                    systemPrompt: input.systemPrompt,
                  });
                }
                resolve(data);
              } catch (e: any) {
                reject(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: e.message || body }));
              }
            });
          });

          req.on("error", (err) => {
            reject(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Telephony Bridge Error: ${err.message}` }));
          });

          req.write(postData);
          req.end();
        });
      }),

    terminate: protectedProcedure
      .input(z.object({ callId: z.string() }))
      .mutation(async ({ input }) => {
        return new Promise((resolve, reject) => {
          const options: http.RequestOptions = {
            hostname: "127.0.0.1",
            port: 5000,
            path: `/api/v1/calls/${input.callId}/terminate`,
            method: "POST",
          };

          const req = http.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
              try {
                resolve(JSON.parse(body));
              } catch {
                resolve({ success: true, status: "TERMINATED" });
              }
            });
          });

          req.on("error", (err) => {
            reject(new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message }));
          });
          req.end();
        });
      }),
  }),

  // ─── Web Calls & History ────────────────────────────────────────────────────
  calls: router({
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteCall } = await import("./db.js");
        await deleteCall(input.id);
        return { success: true };
      }),

    clearHistory: protectedProcedure.mutation(async ({ ctx }) => {
      const { deleteAllCalls } = await import("./db.js");
      await deleteAllCalls(ctx.user?.id);
      return { success: true };
    }),

    initiate: protectedProcedure
      .input(
        z.object({
          callType: z.enum(["phone", "web", "meet", "zoom", "teams"]).default("web"),
          toNumber: z.string().optional(),
          meetingLink: z.string().optional(),
          meetingDialIn: z.string().optional(),
          meetingPin: z.string().optional(),
          voice_id: z.string(),
          voice_name: z.string(),
          tone: z.enum(["professional", "casual", "friendly", "formal", "empathetic"]).default("professional"),
          systemPrompt: z.string().optional(),
          personality: z.string().optional(),
          voiceSpeed: z.number().min(0.5).max(2.0).default(1.0),
          voiceTemperature: z.number().min(0).max(2).default(1.0),
          language: z.string().default("hi-IN"),
          maxHistory: z.number().min(1).max(50).default(20),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const fullPrompt = `${input.systemPrompt || "You are a natural, conversational voice assistant. Answer in 1-2 short sentences. Be direct — speak as a human would in a real conversation. Never use markdown, asterisks, bullet points, or action descriptions."}
Personality: ${input.personality || ""}`.trim();

        const callRecord = await insertCall({
          userId: ctx.user.id,
          toNumber: input.toNumber,
          callType: input.callType,
          status: "in-progress",
          voice_id: input.voiceId,
          voice_name: input.voiceName,
          tone: input.tone,
          systemPrompt: fullPrompt,
          personality: input.personality,
          responseSpeed: input.voiceSpeed,
          voiceTemperature: input.voiceTemperature,
          voiceSpeed: input.voiceSpeed,
        });

        const callId = String((callRecord as { insertId: number }).insertId);

        const token = await createLiveKitToken(
          callId,
          `user_${ctx.user.id}`,
          JSON.stringify({
            voice_id: input.voiceId,
            voice_name: input.voiceName,
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
          accessToken: token,
        };
      }),

    stop: protectedProcedure
      .input(z.object({ callId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await updateCall(input.callId, { status: "completed", endedAt: new Date() });
        return { success: true };
      }),

    getStatus: protectedProcedure
      .input(z.object({ callId: z.number().optional() }))
      .query(async () => {
        return { call_status: "ongoing" };
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
  }),

  // ─── LLM Utilities (Powered by Local vLLM Gemma 4 AWQ on Port 8100) ──────────
  llm: router({
    suggestPrompt: publicProcedure
      .input(
        z.object({
          useCase: z.string(),
          language: z.string().default("Hindi"),
          tone: z.string().default("professional"),
          personality: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert voice AI prompt engineer. Create a concise, conversational system prompt in ${input.language} for a voice assistant specialized in ${input.useCase} with a ${input.tone} tone. Keep the output under 3 sentences. Direct instructions only, no markdown.`,
            },
            { role: "user", content: `Generate system prompt for: ${input.useCase}` },
          ],
        });
        const content = response.choices[0]?.message?.content;
        return { prompt: typeof content === "string" ? content.trim() : "" };
      }),

    generateScript: publicProcedure
      .input(
        z.object({
          scenario: z.string(),
          language: z.string().default("Hindi"),
          turns: z.number().default(4),
          tone: z.string().default("professional"),
        })
      )
      .mutation(async ({ input }) => {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are an expert scriptwriter for phone and voice AI conversations. Write a realistic ${input.turns}-turn voice dialogue in ${input.language} for scenario "${input.scenario}" with a ${input.tone} tone.\nFormat strictly as:\nAgent: <line>\nCustomer: <line>\nAgent: <line>\nCustomer: <line>`,
            },
            { role: "user", content: `Write script for: ${input.scenario}` },
          ],
          max_tokens: 600,
        });
        const content = response.choices[0]?.message?.content;
        return { script: typeof content === "string" ? content.trim() : "" };
      }),

    generateInsights: publicProcedure
      .input(z.object({ callId: z.number(), transcript: z.string(), summary: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Analyze this voice call transcript and provide 2 bullet points on sentiment and action items." },
            { role: "user", content: `Transcript: ${input.transcript}` },
          ],
        });
        const content = response.choices[0]?.message?.content;
        const insights = typeof content === "string" ? content : "";
        if (input.callId) {
          await updateCall(input.callId, { insights });
        }
        return { insights };
      }),
  }),
});

export type AppRouter = typeof appRouter;

