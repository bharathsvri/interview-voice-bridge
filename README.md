# Interview Voice Bridge

> **Interview Voice Transcription & ChatGPT Input Bridge**  
> A production-quality, end-to-end distributed system connecting an Electron desktop application and an Android mobile application over the internet to transcribe speech via Deepgram Nova-3 and automatically populate the ChatGPT input field via Android Accessibility Services.

---

## 1. System Architecture

```mermaid
flowchart TD
    subgraph DesktopApp ["Computer Desktop Application (Electron + React)"]
        Mic["Microphone Input (16kHz PCM)"]
        WebAudio["Web Audio API Processor"]
        DesktopWS["Desktop WebSocket Client"]
        DesktopUI["Dashboard & Transcription UI"]
        Mic --> WebAudio --> DesktopWS
        DesktopWS -.-> DesktopUI
    end

    subgraph BackendGateway ["Node.js Real-Time Gateway & Server"]
        HTTP["Express REST API (/api/v1)"]
        WSGateway["WebSocket Gateway (/ws)"]
        AuthService["JWT & Device Authorization"]
        DB[(PostgreSQL / Prisma)]
        DeepgramClient["Deepgram Streaming Client (Nova-3)"]
        
        DesktopWS <==>|WSS: desktop:audio:chunk| WSGateway
        WSGateway <==> DeepgramClient
        HTTP <==> AuthService <==> DB
    end

    subgraph CloudSTT ["Deepgram Cloud"]
        Nova3["Nova-3 Streaming STT Engine"]
        DeepgramClient <==>|wss://api.deepgram.com/v1/listen| Nova3
    end

    subgraph AndroidApp ["Android Application (Kotlin + Jetpack Compose)"]
        AndroidWS["OkHttp WebSocket Client"]
        RoomDB[(Room SQLite DB)]
        AndroidUI["Live Transcription UI"]
        AccService["InterviewInputAccessibilityService"]
        ChatGPT["ChatGPT App Input Field"]

        WSGateway ==>|WSS: transcription:final| AndroidWS
        AndroidWS --> RoomDB
        AndroidWS --> AndroidUI
        AndroidWS --> AccService
        AccService -->|ACTION_SET_TEXT (Never Auto-Submit)| ChatGPT
    end
```

---

## 2. Key Features

- **Real-Time Speech-to-Text**: Captures interviewer audio directly from any selected microphone using the Web Audio API at 16kHz linear PCM, streaming to Deepgram Nova-3.
- **Interim & Finalized Segments**: Interim transcripts provide zero-latency live visual feedback; finalized segments ensure 100% accurate text formatting without word duplication.
- **Secure Device Pairing**: Computer desktop and Android devices pair securely using short-lived (5-minute) 6-digit numeric codes and dynamic QR codes with one-time tokens.
- **Automated ChatGPT Input Population**: Dedicated `InterviewInputAccessibilityService` detects ChatGPT app's editable text field and populates it with finalized interview text.
- **Absolute Zero-Auto-Submit Guarantee**: The accessibility service is strictly prohibited from ever clicking "Send" or submitting messages. The candidate always retains full control to review, edit, and manually submit.
- **Dual Offline & Production Database Support**: Full PostgreSQL Prisma schema with migrations and automated, resilient in-memory fallback for local offline testing.
- **Enterprise-Grade Security**: Isolated Electron preload bridge (`contextIsolation=true`, `nodeIntegration=false`, `sandbox=true`), JWT token rotation, rate limiting, and Deepgram API key protection.

---

## 3. Monorepo Structure

```
interview-voice-bridge/
├── apps/
│   ├── desktop/                         # Electron + React + Vite + Tailwind CSS
│   │   ├── electron/                    # Main process and secure preload script
│   │   ├── src/                         # React UI, audio recorder, and WebSocket client
│   │   └── tests/                       # Desktop unit & store tests
│   │
│   └── android/                         # Native Android Application (Kotlin + Compose)
│       ├── app/src/main/kotlin/         # Jetpack Compose UI, MVVM, Room DB, OkHttp
│       ├── app/src/main/kotlin/.../accessibility/ # ChatGPT Accessibility Service
│       └── app/src/test/kotlin/         # Android unit tests
│
├── backend/                             # Express + WebSocket + Deepgram Gateway
│   ├── src/controllers/                 # REST controllers (auth, devices, sessions)
│   ├── src/routes/                      # Express routes
│   ├── src/websocket/                   # Real-time WebSocket Gateway
│   ├── src/deepgram/                    # Deepgram Nova-3 streaming client
│   ├── src/database/                    # Prisma & resilient repository layer
│   ├── prisma/                          # Prisma schema & PostgreSQL models
│   └── tests/                           # Vitest unit and integration test suite
│
├── packages/
│   └── shared-types/                    # Shared TypeScript interfaces & DTOs
│
├── docker-compose.yml                   # Containerized PostgreSQL, Redis, and Backend
├── .env.example                         # Environment configuration template
├── README.md                            # Comprehensive documentation
└── SECURITY.md                          # Security policy & threat protections
```

---

## 4. Getting Started

### 4.1 Prerequisites
- **Node.js**: v20 or higher (`node -v`)
- **npm**: v10 or higher (`npm -v`)
- **Java**: JDK 17 or higher (`java -version`)
- **Android SDK**: API level 34 (`ANDROID_HOME` configured)
- **Deepgram API Key**: [Sign up at Deepgram](https://deepgram.com) to obtain a Nova-3 streaming API key.

### 4.2 Installation

Clone the repository and install all monorepo dependencies:
```bash
git clone https://github.com/your-username/interview-voice-bridge.git
cd interview-voice-bridge
npm install
```

Build the shared types package:
```bash
npm --workspace=packages/shared-types run build
```

Configure your environment variables:
```bash
cp .env.example .env
# Edit .env and enter your DEEPGRAM_API_KEY
```

---

## 5. Running the Applications

### 5.1 Backend Server
```bash
npm run dev:backend
```
The server will start on `http://localhost:5000` with the WebSocket gateway at `ws://localhost:5000/ws`.

Alternatively, launch using Docker Compose:
```bash
docker-compose up -d
```

### 5.2 Desktop Application (Electron)
In a new terminal window:
```bash
npm run dev:desktop
```
This starts the Vite React dev server and launches Electron.

To produce a production desktop build:
```bash
npm --workspace=apps/desktop run build
```

### 5.3 Android Mobile Application
In a new terminal:
```bash
cd apps/android
./gradlew assembleDebug
```
Install the generated APK onto your connected Android phone or emulator:
```bash
./gradlew installDebug
```

---

## 6. End-to-End Workflow

1. **Launch Desktop App**: Open the desktop application on your computer.
2. **Launch Android App**: Open the Interview Voice Bridge app on your Android device.
3. **Pair Devices**:
   - In the Desktop app, click **Pair New Android Phone**. A 6-digit code and QR code will appear.
   - In the Android app, tap **Pair with Computer** and enter the 6-digit code (or scan the QR code).
   - Devices are paired over secure WebSocket.
4. **Enable Accessibility Service**:
   - On Android, navigate to **Settings -> Accessibility -> Interview Voice Bridge Accessibility Service** and enable it.
5. **Start Audio Capture**:
   - On the Desktop app, select your preferred microphone and click **Start Listening**.
   - Speak your interview question.
6. **Live Transcription**:
   - Deepgram Nova-3 converts your speech into interim and finalized text.
   - The desktop app displays interim and final text in real time.
   - The backend routes the finalized text directly to the paired Android phone.
7. **Populate ChatGPT**:
   - Switch to the official ChatGPT application on Android.
   - As interview speech is finalized, it automatically populates ChatGPT's input prompt field.
   - **Review & Submit**: Review or edit the populated question and manually press Send when ready!

---

## 7. REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Register a new user account |
| `POST` | `/api/v1/auth/login` | Authenticate user and receive access/refresh tokens |
| `POST` | `/api/v1/auth/refresh` | Rotate and issue new access & refresh tokens |
| `POST` | `/api/v1/auth/logout` | Revoke active refresh token |
| `POST` | `/api/v1/devices/pair/initiate` | Generate 6-digit code, QR code data, and one-time token |
| `POST` | `/api/v1/devices/pair/approve` | Approve pairing from secondary device |
| `POST` | `/api/v1/devices/pair/complete` | Complete pairing handshake |
| `GET` | `/api/v1/devices` | List all registered user devices and status |
| `DELETE` | `/api/v1/devices/:deviceId` | Unpair and delete device |
| `POST` | `/api/v1/sessions` | Create new transcription session between paired devices |
| `GET` | `/api/v1/sessions/:sessionId` | Retrieve session information |
| `POST` | `/api/v1/sessions/:sessionId/start` | Start session |
| `POST` | `/api/v1/sessions/:sessionId/stop` | Stop session |
| `DELETE` | `/api/v1/sessions/:sessionId` | Delete session and associated transcripts |
| `GET` | `/api/v1/transcriptions/:sessionId` | Retrieve transcript segments and combined final text |
| `GET` | `/health` | System health check |
| `GET` | `/ready` | System readiness check |

---

## 8. WebSocket Event Specification

All WebSocket messages adhere to the standard envelope format:
```json
{
  "eventId": "evt_abc123",
  "sessionId": "sess_xyz789",
  "deviceId": "dev_456",
  "timestamp": 1731405000000,
  "eventType": "desktop:audio:chunk",
  "payload": { ... }
}
```

### Event Catalog:
- `desktop:connect`: Desktop client authentication handshake.
- `desktop:audio:start`: Informs backend that audio capture has started.
- `desktop:audio:chunk`: Audio frame (base64 or raw PCM) streamed from desktop.
- `desktop:audio:stop`: Desktop halts audio streaming.
- `android:connect`: Android client authentication handshake.
- `android:transcription:subscribe`: Android client subscribes to active session events.
- `transcription:interim`: Live, non-final interim transcription update.
- `transcription:final`: Finalized, punctuated, smart-formatted transcript segment.
- `session:started` / `session:stopped`: Lifecycle state transitions.
- `device:connected` / `device:disconnected`: Live peer online status notifications.
- `connection:heartbeat`: 25s ping/pong keep-alive frames.

---

## 9. Automated Test Suite

Run tests across the monorepo:

### Backend Tests (16 unit & integration tests)
```bash
npm run test:backend
```
Tests authentication, JWT rotation, device pairing expiration, session authorization, Deepgram interim/final handling, duplicate prevention, and real-time WebSocket pipelines.

### Desktop Tests (6 tests)
```bash
npm run test:desktop
```
Tests Web Audio API enumeration, microphone configuration, audio visualizer levels, and Zustand store state transitions.

### Android Tests (Unit & Accessibility Tests)
```bash
cd apps/android
./gradlew testDebugUnitTest
```
Tests duplicate transcript prevention algorithms, append versus replace mode string transformations, and Room database entities.

---

## 10. License

This project is licensed under the MIT License.
