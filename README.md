# Samvad AI (संवाद)
### Ultra Low-Latency Conversational Voice AI & Zero-Shot Cloning Platform for Indic & Global Languages

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Latency](https://img.shields.io/badge/E2E%20Latency-450--750ms-brightgreen.svg)]()
[![Hardware](https://img.shields.io/badge/GPU-NVIDIA%20RTX%20A6000%20%7C%20A100-orange.svg)]()
[![Voice Cloning](https://img.shields.io/badge/Voice%20Cloning-Zero--Shot%20Neural-purple.svg)]()
[![Telephony](https://img.shields.io/badge/Telephony-Fonoster%20Voice%20Bridge-blueviolet.svg)]()

Samvad AI is a full-duplex, streaming speech-to-speech conversational platform engineered for real-time voice interactions over standard PSTN/SIP telephone networks and web browsers. It combines the **Fonoster Programmable Telephony Bridge**, zero-shot neural voice cloning, streaming speech recognition, high-throughput LLM reasoning, and natural barge-in (interruption) handling.

---

## 🏗️ High-Level Architecture

```
                                  ┌───────────────────────────────┐
                                  │      Client Applications      │
                                  ├───────────────┬───────────────┤
                                  │  Web Browser  │  Phone (PSTN) │
                                  │ (Mic/Speaker) │(SIP / Mobile) │
                                  └───────┬───────┴───────┬───────┘
                                          │               │
                            WebRTC/WSS    │               │  μ-law (8kHz PCM)
                                          ▼               ▼
                        ┌──────────────────────────────────────────────────┐
                        │      Fonoster Programmable Telephony Bridge      │
                        │    - SIP Trunking & Outbound PSTN Dispatcher     │
                        │    - μ-law 8kHz <-> 24kHz PCM16 Transcoding      │
                        │    - Full-Duplex Media Stream WebSockets         │
                        │    - Active Barge-In & Telemetry Event Broadcast │
                        └─────────────────────────┬────────────────────────┘
                                                  │
                                                  ▼ (ws://localhost:8765/v1/realtime)
                        ┌──────────────────────────────────────────────────┐
                        │          Speech-to-Speech (S2S) Core             │
                        ├──────────────────────────────────────────────────┤
                        │  1. Voice Activity Detection (Silero VAD)        │
                        │  2. Streaming STT (Whisper large-v3-turbo)       │
                        │  3. Reasoning Engine (Gemma 4 26B AWQ / vLLM)    │
                        │  4. Zero-Shot TTS & Cloning (IndicF5 / Neural)   │
                        │  5. Full-Duplex Interruption & Barge-In Handler  │
                        └─────────────────────────┬────────────────────────┘
                                                  │
                                                  ▼
                        ┌──────────────────────────────────────────────────┐
                        │           Management & Analytics Hub             │
                        │    - Call Studio (Dual Web/Fonoster Phone Dial)  │
                        │    - Neural Voice Cloning & Library Manager      │
                        │    - Real-Time Waveform & Live Transcripts       │
                        │    - Direct Whitelisting & Invite Codes System   │
                        │    - Local AI Script Generator (vLLM powered)    │
                        └──────────────────────────────────────────────────┘
```

---

## 🎙️ Zero-Shot Neural Voice Cloning Pipeline

Samvad features a zero-shot voice cloning engine capable of replicating any human speaker persona from a 3–5 second audio reference without model fine-tuning or retraining:

```
[Uploaded Audio Sample] (5s WAV/MP3)
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ 1. Audio Ingestion & Acoustic Normalization            │
│    - Resampling to 24kHz 16-bit Mono PCM               │
│    - Dynamic range compression & silence trimming      │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 2. Automated Acoustic-Phonetic Alignment               │
│    - faster-whisper transcription                      │
│    - Generation of reference token text (.lab)         │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 3. Latent Conditioning & Cluster Distribution          │
│    - Synchronizes acoustic prompt (ref.wav + ref_text) │
│      across GPU inference worker nodes                 │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│ 4. Real-Time Zero-Shot Synthesis (F5-TTS / IndicF5)    │
│    - Conditioned flow matching on target text          │
│    - First audio chunk generated in < 180ms            │
│    - Immediate availability across Call Studio dialer  │
└────────────────────────────────────────────────────────┘
```

### Cloning Capabilities
- **Instant Activation**: Uploaded voice profiles are registered in real-time and immediately callable via the Studio dialer or API.
- **Multilingual Generalization**: Cloned voice profiles can speak in Hindi, Hinglish, English, Tamil, Telugu, and other Indic languages while preserving original speaker timbre, cadence, and vocal acoustics.

---

## ⚡ Latency Budget & Performance Benchmarks

The entire pipeline is tuned for sub-second conversational turn-taking:

| Pipeline Stage | Technology / Module | Target Latency | Notes |
|---|---|---|---|
| **Audio Ingestion** | Fonoster Bridge / WebRTC | ~15 – 30 ms | Low-jitter buffer |
| **VAD & Endpointing** | Silero VAD (Chunk: 32ms) | ~60 – 100 ms | Adaptive silence threshold |
| **Speech-to-Text** | Whisper large-v3-turbo (FP16) | ~150 – 220 ms | Streaming partials & final tokens |
| **LLM Reasoning (TTFT)** | Gemma 4 26B AWQ-4bit (vLLM Engine) | ~80 – 150 ms | PagedAttention & chunked prefill |
| **Zero-Shot TTS (TTFB)** | IndicF5 / Fast Neural TTS | ~100 – 180 ms | First audio chunk dispatched |
| **Transcoding & Streaming**| Fonoster μ-law / PCM16 Resampling| ~20 – 40 ms | Zero-copy memory streaming |
| **Total End-to-End (E2E)**| **Full Conversational Turn** | **~450 – 780 ms** | **Real-time conversational threshold** |

### Concurrency & Hardware Sizing
- **Single NVIDIA RTX A6000 (48GB VRAM)**:
  - Supports **50+ concurrent LLM conversational streams** with AWQ-4bit quantization.
  - Streaming STT + TTS accommodates **15–25 concurrent full-duplex audio channels** per GPU.
- **Scaling to 1,000+ Concurrent Calls**:
  - Horizontal scaling with a worker pool of isolated STT/TTS microservices and a multi-GPU vLLM inference backend.

---

## 💻 Hardware & Infrastructure Requirements

### Recommended Server Specifications
- **GPU**: 1x NVIDIA RTX A6000 (48GB VRAM) or NVIDIA A100 / H100 (80GB)
- **Host CPU**: 8+ cores (x86_64 or aarch64)
- **RAM**: 32 GB+ system memory
- **Storage**: NVMe SSD with 100 GB+ for model checkpoints and cache
- **Operating System**: Linux (Ubuntu 22.04 LTS recommended)
- **Runtime Environment**:
  - NVIDIA Driver 535+ & CUDA 12.1+
  - Node.js 20+ & npm / pnpm
  - Python 3.10+ with PyTorch, faster-whisper, and vLLM

---

## 🌟 Core Features & Modules

### 1. Dual-Mode Call Studio
- **💻 Web Call (Mic)**: Browser-based speech test with live pulsing orb, VAD, and bidirectional speech.
- **📱 Phone Call (Fonoster PSTN Bridge)**: Direct mobile phone dialer. Enter any phone number (`+91 98765 43210`) to dispatch live outbound phone calls.

### 2. Neural Voice Persona Library
- **🇮🇳 Indic Neural Voices**:
  - `Aanchal` (Hindi Female - Expressive & Conversational)
  - `Rohit` (Hindi Male - Clear & Balanced)
  - `Ananya` (Indic Multilingual Female)
  - `Aarav` (Indic Multilingual Male)
  - `Chhavi`, `Divya`, `Amol` (Warm, Professional, Energetic)
- **🌐 Global English Voices**:
  - `Bella` (US Female - Crisp & Cheerful)
  - `Adam` (US Male - Deep & Confident)
  - `Emma` (UK Female - Articulate & Formal)
- **🎙️ Zero-Shot Cloned Voices**: Custom profiles synthesized from short reference audio.

### 3. Linked Presets & 5-Minute Long-Form Mode
- **Quick Language Toggles**: 1-click switcher between **`🇮🇳 Hindi Default`** and **`🌐 English Default`**.
- **Hindi Sales & Support**: Optimized for high conversion and customer problem resolution.
- **📖 5-Minute Storytelling Bot**: High-token creative narrative generator capable of sustained multi-minute speech.
- **Regional Indic Presets**: Native Tamil and Telugu support.

### 4. Local AI Script Generator (vLLM Powered)
- Multi-turn voice dialogue generator running on the local **vLLM reasoning engine (Gemma 4 AWQ)**.
- Generates scripts in Hindi, English, Hinglish, Tamil, or Telugu.
- **1-Click Apply**: Automatically injects generated dialogue context into the active session prompt.
- **Zero Third-Party Dependencies**: No external OpenAI API keys required.

### 5. Access Management & Security
- **Direct Email Whitelisting**: Pre-approve team members before their first login.
- **Invite Codes / Access PINs**: Self-service activation codes (e.g. `SAMVAD-VIP-2026`).
- **Role-Based Feature Gating**: Protects PSTN calling and GPU-intensive cloning.

### 6. Live Infrastructure Health Monitoring
- Real-time telemetry dashboard checking:
  - Fonoster Telephony Bridge status (`Port 5000`)
  - Speech-to-Speech Core status (`Port 8765`)
  - vLLM Inference Gateway status (`Port 8100`)

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/reluhash/samvad.git
cd samvad

# Install dependencies
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

# Fonoster Telephony Bridge Gateway
TELEPHONY_BRIDGE_URL=http://127.0.0.1:5000

# S2S Core & vLLM Inference Engine
S2S_CORE_WS_URL=ws://127.0.0.1:8765/v1/realtime
VLLM_API_URL=http://127.0.0.1:8100/v1
```

### 3. Build & Run
```bash
# Build production bundle
npm run build

# Start the application
npm run start
```

---

## 📡 Telephony & Streaming Endpoints

| Protocol | Endpoint | Purpose |
|---|---|---|
| **HTTP POST** | `/api/v1/calls/dispatch` | Dispatches outbound phone call via Fonoster Telephony Bridge |
| **WebSocket** | `/media/stream/:callId` | Bidirectional 8kHz μ-law audio stream with Telephony Trunk |
| **WebSocket** | `/v1/realtime` | Low-latency PCM16 audio stream for web browsers |
| **tRPC API** | `/api/trpc/*` | Type-safe RPC for session management, voices, cloning, and scripts |

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

