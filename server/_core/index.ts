import "dotenv/config";
import express from "express";
import http, { createServer } from "http";
import httpProxy from "http-proxy";

const app = express();
const server = createServer(app);

// Create dedicated proxies for each backend service
const s2sCoreProxy = httpProxy.createProxyServer({
  target: "http://127.0.0.1:8765",
  ws: true,
  changeOrigin: true,
});

const telephonyProxy = httpProxy.createProxyServer({
  target: "http://127.0.0.1:5000",
  ws: true,
  changeOrigin: true,
});

const webUiProxy = httpProxy.createProxyServer({
  target: "http://127.0.0.1:7860",
  ws: true,
  changeOrigin: true,
});

// Error handling on proxies
[s2sCoreProxy, telephonyProxy, webUiProxy].forEach(p => {
  p.on("error", (err, req, res) => {
    console.error("[Proxy Error]:", err.message);
    if (res && "writeHead" in res && !res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Bad Gateway to S2S Backend");
    }
  });
});

// 1. Twilio Telephony Routes -> Port 5000
app.all("/twilio/*", (req, res) => telephonyProxy.web(req, res));
app.all("/api/v1/calls/*", (req, res) => telephonyProxy.web(req, res));

// 2. Realtime WebRTC HTTP Routes -> Port 8765
app.all("/v1/realtime/*", (req, res) => s2sCoreProxy.web(req, res));

// 3. All other routes (Frontend UI, static assets, APIs) -> Port 7860
app.all("*", (req, res) => webUiProxy.web(req, res));

// 4. WebSocket Upgrade Handler
server.on("upgrade", (req, socket, head) => {
  const url = req.url || "";
  if (url.startsWith("/v1/realtime")) {
    s2sCoreProxy.ws(req, socket, head);
  } else if (url.startsWith("/media/stream/") || url.startsWith("/api/v1/calls/")) {
    telephonyProxy.ws(req, socket, head);
  } else {
    webUiProxy.ws(req, socket, head);
  }
});

const PORT = parseInt(process.env.PORT || "3500");
server.listen(PORT, () => {
  console.log(`Samvad Unified HTTP-Proxy running on http://localhost:${PORT}`);
});
