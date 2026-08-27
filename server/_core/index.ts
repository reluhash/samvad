import "dotenv/config";
import express from "express";
import http, { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import net from "net";
import path from "path";
import fs from "fs";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerLocalAuthRoutes } from "./localAuth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

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

  // ─── Telephony & PSTN Proxy (Routes to forwarded GPU bridge on :5000) ──────
  app.all("/twilio/*", (req, res) => {
    const originalHost = req.headers["host"] || "samvad.reluhashai.com";
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: 5000,
      path: req.originalUrl,
      method: req.method,
      headers: {
        ...req.headers,
        "x-forwarded-host": originalHost,
        "x-forwarded-proto": "https",
        host: originalHost
      },
    };
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", (err) => {
      console.error("[Telephony Proxy Error]:", err.message);
      res.status(502).send("Bad Gateway to Telephony Bridge");
    });
    if (req.body && Object.keys(req.body).length > 0) {
      const data = req.headers["content-type"] === "application/x-www-form-urlencoded"
        ? new URLSearchParams(req.body as Record<string, string>).toString()
        : JSON.stringify(req.body);
      proxyReq.write(data);
    }
    proxyReq.end();
  });

  app.all("/api/v1/calls/*", (req, res) => {
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: 5000,
      path: req.originalUrl,
      method: req.method,
      headers: { ...req.headers, host: "127.0.0.1:5000" },
    };
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", (err) => {
      console.error("[Calls Proxy Error]:", err.message);
      res.status(502).json({ error: err.message });
    });
    if (req.body && Object.keys(req.body).length > 0) {
      proxyReq.write(JSON.stringify(req.body));
    }
    proxyReq.end();
  });

  // ─── Local Uploads Directory ──────────────────────────────────────────────
  const uploadsDir = path.resolve(process.cwd(), "uploads/voice-samples");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

  // ─── File Upload Route ────────────────────────────────────────────────────
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

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ─── WebSocket Server & Telephony Media Stream Proxy ──────────────────────
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "", "http://localhost");
    if (url.pathname === "/api/ws/call") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else if (url.pathname.startsWith("/media/stream/")) {
      // Forward Twilio media stream WebSocket directly to bridge on :5000
      const targetReq = http.request({
        hostname: "127.0.0.1",
        port: 5000,
        path: req.url,
        method: "GET",
        headers: req.headers,
      });
      targetReq.on("upgrade", (targetRes, targetSocket, targetHead) => {
        socket.write(
          `HTTP/1.1 101 Switching Protocols\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Accept: ${targetRes.headers["sec-websocket-accept"]}\r\n\r\n`
        );
        targetSocket.pipe(socket);
        socket.pipe(targetSocket);
      });
      targetReq.on("error", (e) => {
        console.error("[Telephony WS Proxy Error]:", e.message);
        socket.destroy();
      });
      targetReq.end();
    }
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
