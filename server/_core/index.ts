import "dotenv/config";
import express from "express";
import http, { createServer } from "http";

const app = express();
const server = createServer(app);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

function proxyHttpRequest(targetPort: number, req: express.Request, res: express.Response) {
  const originalHost = req.headers["host"] || "samvad.reluhashai.com";
  const options: http.RequestOptions = {
    hostname: "127.0.0.1",
    port: targetPort,
    path: req.originalUrl,
    method: req.method,
    headers: {
      ...req.headers,
      "x-forwarded-host": originalHost,
      "x-forwarded-proto": "https",
      host: `127.0.0.1:${targetPort}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", (err) => {
    console.error(`[Proxy Error to :${targetPort}]:`, err.message);
    res.status(502).send("Bad Gateway");
  });

  if (req.body && Object.keys(req.body).length > 0) {
    const data = req.headers["content-type"] === "application/x-www-form-urlencoded"
      ? new URLSearchParams(req.body as Record<string, string>).toString()
      : (typeof req.body === "string" ? req.body : JSON.stringify(req.body));
    proxyReq.write(data);
  }
  proxyReq.end();
}

// 1. Twilio Telephony Routes -> Port 5000
app.all("/twilio/*", (req, res) => proxyHttpRequest(5000, req, res));
app.all("/api/v1/calls/*", (req, res) => proxyHttpRequest(5000, req, res));

// 2. Realtime WebRTC HTTP Routes -> Port 8765
app.all("/v1/realtime/*", (req, res) => proxyHttpRequest(8765, req, res));

// 3. All other routes (Frontend UI, static assets, APIs) -> Port 7860
app.all("*", (req, res) => proxyHttpRequest(7860, req, res));

// 4. WebSocket Upgrade Handler
server.on("upgrade", (req, socket, head) => {
  const url = req.url || "";
  let targetPort = 7860;

  if (url.startsWith("/v1/realtime")) {
    targetPort = 8765; // Direct S2S Core WebSocket
  } else if (url.startsWith("/media/stream/")) {
    targetPort = 5000; // Twilio Telephony Audio Stream
  } else if (url.startsWith("/api/v1/calls/")) {
    targetPort = 5000; // Call telemetry events
  }

  const targetReq = http.request({
    hostname: "127.0.0.1",
    port: targetPort,
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
    console.error(`[WS Proxy Error to :${targetPort}]:`, e.message);
    socket.destroy();
  });

  targetReq.end();
});

const PORT = parseInt(process.env.PORT || "3500");
server.listen(PORT, () => {
  console.log(`Samvad Unified Reverse Proxy running on http://localhost:${PORT}`);
});
