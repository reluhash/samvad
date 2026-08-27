import "dotenv/config";
import express from "express";
import http, { createServer } from "http";
import path from "path";
import fs from "fs";
import multer from "multer";
import httpProxy from "http-proxy";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerLocalAuthRoutes } from "./localAuth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";

const app = express();
const server = createServer(app);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Proxies to GPU Backend
const s2sCoreProxy = httpProxy.createProxyServer({
  target: "http://127.0.0.1:8765",
  ws: true,
  changeOrigin: true,
});

const telephonyProxy = httpProxy.createProxyServer({
  target: "http://127.0.0.1:5000",
  ws: true,
  changeOrigin: true,
  headers: {
    "x-forwarded-host": "samvad.reluhashai.com",
    "x-forwarded-proto": "https",
  },
});

[s2sCoreProxy, telephonyProxy].forEach((p) => {
  p.on("error", (err, req, res) => {
    console.error("[Proxy Error]:", err.message);
    if (res && "writeHead" in res && !res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Bad Gateway to S2S Backend");
    }
  });
});

// 1. Telephony Webhooks & Dispatcher
app.all("/twilio/*", (req, res) => {
  req.headers["x-forwarded-host"] = "samvad.reluhashai.com";
  req.headers["x-forwarded-proto"] = "https";
  telephonyProxy.web(req, res);
});

app.all("/api/v1/calls/*", (req, res) => {
  req.headers["x-forwarded-host"] = "samvad.reluhashai.com";
  req.headers["x-forwarded-proto"] = "https";
  telephonyProxy.web(req, res);
});

// 2. Realtime WebRTC HTTP
app.all("/v1/realtime/*", (req, res) => s2sCoreProxy.web(req, res));

// 3. Local VoiceKit Authentication & Storage
registerStorageProxy(app);
registerOAuthRoutes(app);
registerLocalAuthRoutes(app);

// 4. Voice Sample Uploads (Voice Cloning)
const uploadsDir = path.resolve(process.cwd(), "uploads/voice-samples");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
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

// 5. tRPC API (Voice Library, Agents, Call Logs, DB)
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// 6. Serve Built React Frontend SPA
const clientDist = path.resolve(process.cwd(), "dist/public");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/twilio") || req.path.startsWith("/v1")) {
    return next();
  }
  res.sendFile(path.join(clientDist, "index.html"));
});

// 7. WebSocket Upgrade Handler
server.on("upgrade", (req, socket, head) => {
  const url = req.url || "";
  if (url.startsWith("/v1/realtime")) {
    // Stream directly to crazycrab:8765
    s2sCoreProxy.ws(req, socket, head);
  } else if (url.startsWith("/media/stream/") || url.startsWith("/api/v1/calls/")) {
    // Stream directly to crazycrab:5000
    req.headers["x-forwarded-host"] = "samvad.reluhashai.com";
    req.headers["x-forwarded-proto"] = "https";
    telephonyProxy.ws(req, socket, head);
  } else {
    socket.destroy();
  }
});

const PORT = parseInt(process.env.PORT || "3500");
server.listen(PORT, () => {
  console.log(`Samvad Restored Voice-Kit UI & Backend running on http://localhost:${PORT}`);
});
