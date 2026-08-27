module.exports = {
  apps: [
    {
      name: "voicekit-backend",
      script: "node",
      args: "dist/index.js",
      cwd: "/home/ubuntu/voice-kit",
      env: {
        NODE_ENV: "production",
        PORT: "3500",
        DATABASE_URL: "mysql://voicekit:vk_pass_2024@127.0.0.1:3306/voicekit",
        JWT_SECRET: "voicekit-jwt-secret-2024-change-in-prod",
        LIVEKIT_URL: "ws://localhost:7880",
        LIVEKIT_API_KEY: "devkey",
        LIVEKIT_API_SECRET: "secret"
      },
      watch: false,
      autorestart: true,
      max_restarts: 10
    },
    {
      name: "voicekit-edge-agent",
      script: "/home/ubuntu/voice-kit/server-python/node1-edge/.venv/bin/python3",
      args: "bridge_agent.py dev",
      cwd: "/home/ubuntu/voice-kit/server-python/node1-edge",
      interpreter: "none",
      env: {
        GPU_AGENT_WS: "ws://127.0.0.1:8765/v1/realtime",
        LIVEKIT_URL: "ws://localhost:7880",
        LIVEKIT_API_KEY: "devkey",
        LIVEKIT_API_SECRET: "secret"
      },
      watch: false,
      autorestart: true,
      max_restarts: 5,
      min_uptime: "10s"
    }
  ]
};
