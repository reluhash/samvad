import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import net from "net";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerLocalAuthRoutes } from "./localAuth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb } from "../db";
import { calls, callTranscripts } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./llm";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// Active call sessions: callId -> WebSocket clients for real-time transcript push
const callSessions = new Map<number, Set<WebSocket>>();

// Multer: store uploads in memory (max 20MB for voice samples)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export function broadcastTranscript(callId: number, entry: { speaker: string; text: string; timestamp: number }) {
  const clients = callSessions.get(callId);
  if (!clients) return;
  const msg = JSON.stringify({ type: "transcript", ...entry });
  for (const ws of Array.from(clients)) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerLocalAuthRoutes(app);

  // Twilio webhooks removed for local LiveKit architecture

  // ─── Local Uploads Directory ──────────────────────────────────────────────
  const uploadsDir = path.resolve(process.cwd(), "uploads/voice-samples");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  // Serve uploaded files statically
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  // ─── File Upload Route ────────────────────────────────────────────────────
  // Accepts multipart/form-data with a "file" field (audio sample for voice cloning)
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded. Send a multipart/form-data request with a 'file' field." });
      }
      const { buffer, originalname } = req.file;
      const safeName = originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${Date.now()}-${safeName}`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, buffer);
      const url = `/uploads/voice-samples/${fileName}`;
      const key = `voice-samples/${fileName}`;
      console.log(`[Upload] Saved locally: ${filePath}`);
      res.json({ url, key });
    } catch (e) {
      console.error("[Upload] Error:", e);
      res.status(500).json({ error: "Upload failed" });
    }
  });


  // Retell cloning endpoint removed for local architecture

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ─── WebSocket Server for real-time transcript streaming ──────────────────
  // Use noServer:true to avoid intercepting Vite HMR WebSocket upgrades.
  // We manually route only /api/ws/call upgrades to our WSS.
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "", "http://localhost");
    if (url.pathname === "/api/ws/call") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
    // All other upgrade requests (e.g. Vite HMR) are left for Vite's own listener
  });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", "http://localhost");
    const callId = parseInt(url.searchParams.get("callId") || "0");

    if (!callId) {
      ws.close(1008, "Missing callId");
      return;
    }

    if (!callSessions.has(callId)) callSessions.set(callId, new Set());
    callSessions.get(callId)!.add(ws);

    ws.send(JSON.stringify({ type: "connected", callId }));

    ws.on("close", () => {
      callSessions.get(callId)?.delete(ws);
      if (callSessions.get(callId)?.size === 0) callSessions.delete(callId);
    });

    ws.on("error", () => {
      callSessions.get(callId)?.delete(ws);
    });
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
