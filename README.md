# Samvad AI (संवाद)
### Ultra Low-Latency Conversational Voice AI Platform for Indic & Global Languages

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Latency](https://img.shields.io/badge/E2E%20Latency-450--750ms-brightgreen.svg)]()
[![Hardware](https://img.shields.io/badge/GPU-NVIDIA%20RTX%20A6000%20%7C%20A100-orange.svg)]()
[![Voice](https://img.shields.io/badge/Languages-Hindi%20%7C%20Hinglish%20%7C%20Indic%20%7C%20English-purple.svg)]()

Samvad AI is a full-duplex, streaming speech-to-speech conversational platform engineered for real-time voice interactions over standard PSTN phone lines and web browsers. It integrates zero-shot voice cloning, streaming speech recognition, high-throughput LLM reasoning, and neural text-to-speech with natural barge-in (interruption) handling.

---

## 🏗️ High-Level Architecture

```
                                  ┌───────────────────────────────┐
                                  │      Client Applications      │
                                  ├───────────────┬───────────────┤
                                  │  Web Browser  │  Phone (PSTN) │
                                  │ (Mic/Speaker) │(Mobile/Twilio)│
                                  └───────┬───────┴───────┬───────┘
                                          │               │
                            WebRTC/WSS    │               │  μ-law (8kHz PCM)
                                          ▼               ▼
                        ┌──────────────────────────────────────────────────┐
                        │              Telephony & Gateway Layer           │
                        │    - Bidirectional Media Streaming               │
                        │    - PCM16 / μ-law 8kHz <-> 24kHz Transcoding    │
                        │    - Session Lifecycle & Telemetry Dispatcher    │
                        └─────────────────────────┬────────────────────────┘
                                                  │
                                                  ▼
                        ┌──────────────────────────────────────────────────┐
                        │          Speech-to-Speech (S2S) Core             │
                        ├──────────────────────────────────────────────────┤
                        │  1. Voice Activity Detection (Silero VAD)        │
                        │  2. Streaming STT (Whisper large-v3-turbo)       │
                        │  3. Reasoning Engine (Gemma 4 26B AWQ / vLLM)    │
                        │  4. Streaming TTS & Cloning (IndicF5 / Neural)   │
                        │  5. Full-Duplex Interruption & Barge-In Handler  │
                        └─────────────────────────┬────────────────────────┘
                                                  │
                                                  ▼
                        ┌──────────────────────────────────────────────────┐
                        │           Management & Analytics Hub             │
                        │    - Call Studio (Dual Web/Phone Dialer)         │
                        │    - Voice Library (Premade & Custom Clones)     │
                        │    - Real-Time Waveform & Live Transcripts       │
                        │    - Direct Whitelisting & Invite Codes System   │
                        └──────────────────────────────────────────────────┘
```

---

## ⚡ Latency Budget & Performance Benchmarks

The pipeline is optimized for sub-second turn-taking to deliver human-like conversational responsiveness:

| Stage | Component / Technology | Target Latency | Notes |
|---|---|---|---|
| **Audio Ingestion** | WebSocket / WebRTC Gateway | ~15 – 30 ms | Low-jitter streaming |
| **VAD & Endpointing** | Silero VAD (Chunk: 32ms) | ~60 – 100 ms | Adaptive silence detection |
| **Speech-to-Text** | Whisper large-v3-turbo (FP16) | ~150 – 220 ms | Streaming partials & final text |
| **LLM Reasoning (TTFT)** | Gemma 4 26B AWQ-4bit (vLLM Engine) | ~80 – 150 ms | PagedAttention, KV-cache reuse |
| **Streaming TTS (TTFB)** | IndicF5 / Fast Neural TTS | ~100 – 180 ms | First audio chunk dispatched |
| **Network & Transcoding**| μ-law / PCM16 Resampling | ~20 – 40 ms | Direct buffer streaming |
| **Total End-to-End (E2E)**| **Full Conversational Loop** | **~450 – 780 ms** | **Real-time conversational speed** |

### Concurrency & Throughput
- **Single NVIDIA RTX A6000 (48GB VRAM)**:
  - Supports **50+ concurrent LLM conversational streams** with AWQ-4bit quantization.
  - Streaming STT + TTS accommodates **15–25 concurrent full-duplex audio channels** per GPU.
- **Scaling to 1,000+ Concurrent Streams**:
  - Horizontal worker pool with isolated STT/TTS microservices and vLLM multi-GPU inference clusters.

---

## 💻 Hardware & Infrastructure Requirements

### Recommended Production Setup
- **GPU**: 1x NVIDIA RTX A6000 (48GB VRAM) or NVIDIA A100 / H100 (80GB)
- **Host CPU**: 8+ cores (x86_64 or aarch64)
- **RAM**: 32 GB+ system memory
- **Storage**: NVMe SSD with 100 GB+ for model weights and cache
- **Operating System**: Linux (Ubuntu 22.04 LTS recommended)
- **Software Stack**:
  - NVIDIA Driver 535+ & CUDA 12.1+
  - Node.js 20+ & npm / pnpm
  - Python 3.10+ with PyTorch & vLLM

---

## 🌟 Core Features & Capabilities

### 1. Dual-Mode Call Studio
- **💻 Web Call (Mic)**: Direct in-browser testing with live pulsing voice orb, bidirectional speech, and real-time transcripts.
- **📱 Phone Call (Twilio PSTN)**: Direct outbound phone dialer. Enter any global or Indian mobile number (`+91 98765 43210`) to place immediate real-world phone calls with caller ID support.

### 2. Multi-Language & Voice Persona Engine
- **🇮🇳 Indic Neural Voices**:
  - `Aanchal` (Hindi Female - Expressive & Conversational)
  - `Rohit` (Hindi Male - Clear & Balanced)
  - `Ananya` (Indic Multilingual Female)
  - `Aarav` (Indic Multilingual Male)
  - `Chhavi`, `Divya`, `Amol` (Warm, Professional, Energetic)
- **🌐 Global English Voices**:
  - `Bella` (US Female - Crisp & Cheerful)
  - `Adam` (US Male - Deep & Authoritative)
  - `Emma` (UK Female - Articulate)
- **🎙️ Zero-Shot Voice Cloning**: Upload 5–10 seconds of reference audio to clone any speaker persona with instant synthesis.

### 3. Linked Presets & 5-Minute Storytelling Mode
- **Hindi Sales & Outreach**: 1-2 sentence high-conversion sales pitches.
- **Hindi Customer Support**: Empathetic troubleshooting and resolution.
- **📖 5-Minute Storytelling Bot**: High-token creative narrative generator capable of sustained multi-minute storytelling.
- **English Growth & Tech Support**: Conversational English assistants.
- **Tamil & Telugu Support**: Native regional Indic language support.

### 4. Local AI Script Generator
- Multi-turn voice conversation generator powered directly by the local **vLLM reasoning engine**.
- Generates realistic dialogues in Hindi, English, Hinglish, Tamil, or Telugu.
- **1-Click Apply**: Instantly injects the generated dialogue context into the active session prompt.
- Completely self-hosted with **zero external third-party API dependencies**.

### 5. Access Management & Security
- **Direct Email Whitelisting**: Pre-approve team members before their first login.
- **Self-Service Invite Codes / PINs**: Issue custom invite codes (e.g. `SAMVAD-VIP-2026`) for 1-click self-service activation.
- **Role-Based Gating**: Restrict expensive PSTN calls and GPU-intensive voice cloning to approved accounts.

### 6. Live Telephony & Infrastructure Health Monitoring
- Real-time telemetry dashboard monitoring:
  - Twilio PSTN Bridge status (`Port 5000`)
  - Speech-to-Speech Core status (`Port 8765`)
  - vLLM Inference Gateway status (`Port 8100`)

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone git@github.com:reluhash/samvad.git
cd samvad

# Install frontend and backend packages
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
# Application Port
PORT=3500

# Authentication & Sessions
JWT_SECRET=your_jwt_secret_key_here
LOCAL_ADMIN_EMAIL=admin@voiceforge.local
LOCAL_ADMIN_PASSWORD=your_secure_password

# Telephony Gateway (Twilio PSTN Bridge)
TELEPHONY_BRIDGE_URL=http://127.0.0.1:5000
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+19895898371

# S2S Core & Inference Engine
S2S_CORE_WS_URL=ws://127.0.0.1:8765/v1/realtime
VLLM_API_URL=http://127.0.0.1:8100/v1
```

### 3. Build & Run
```bash
# Build the production bundle
npm run build

# Start the unified application
npm run start
```

---

## 📡 Telephony & Streaming Endpoints

| Protocol | Endpoint | Purpose |
|---|---|---|
| **HTTP POST** | `/api/v1/calls/dispatch` | Dispatches outbound phone call via Twilio PSTN |
| **HTTP POST** | `/twilio/voice` | Twilio webhook returning TwiML with Media Stream instruction |
| **WebSocket** | `/media/stream/:callId` | Bidirectional 8kHz μ-law audio stream with Twilio |
| **WebSocket** | `/v1/realtime` | Low-latency PCM16 audio stream for web browsers |
| **tRPC API** | `/api/trpc/*` | Type-safe RPC for session management, voices, and scripts |

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

