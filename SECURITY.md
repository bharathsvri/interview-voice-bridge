# Security Architecture & Policies

## 1. Overview

Interview Voice Bridge is designed with security, privacy, and user safety as primary architectural constraints. The system streams audio from a computer microphone, performs real-time speech transcription using Deepgram Nova-3, and populates the ChatGPT Android input field via Android Accessibility Services.

---

## 2. Security Boundaries & Protections

### 2.1 Zero-Auto-Submit Guarantee
- **Absolute Rule**: The Android Accessibility Service (`InterviewInputAccessibilityService`) is programmatically restricted from ever triggering the "Send" or submit action on the ChatGPT interface.
- **Human in the Loop**: Transcribed text is populated into the editable field for review and editing only. The candidate/user retains 100% control over whether, when, and what to submit to the model.

### 2.2 Deepgram API Key Isolation
- The Deepgram API key (`DEEPGRAM_API_KEY`) is strictly confined to the backend server environment.
- It is **never** bundled or exposed in:
  - React desktop frontend
  - Electron main or preload scripts
  - Android application APK or source code
  - WebSocket payloads or REST responses
  - Application logs (Pino redaction rules enforce masking)
  - Git repository or example files (`.env.example` contains placeholders only)
- Credential rotation: If any API key is suspected to be exposed, rotate the key in the Deepgram dashboard and update the backend environment variable immediately.

### 2.3 Secure Electron Architecture
The desktop application adheres to Electron's security recommendations:
- `contextIsolation: true`: Prevents renderer scripts from accessing Node.js runtime primitives.
- `nodeIntegration: false`: Disables Node.js access in the browser renderer window.
- `sandbox: true`: Runs the renderer in a restricted Chromium sandbox.
- `preload.js`: Exposes only explicitly validated IPC functions via `contextBridge.exposeInMainWorld`.

### 2.4 Device Pairing & One-Time Tokens
- Devices pair using a temporary 6-digit numeric pairing code generated cryptographically (`crypto.randomBytes`).
- Codes expire automatically after 300 seconds (5 minutes).
- Each pairing generates a unique one-time token (`crypto.randomBytes(32)`).
- Reusing expired or previously consumed pairing codes is rejected with HTTP 410 / 400.
- Devices can be unpaired or revoked at any time.

### 2.5 Authentication & Token Rotation
- **Access Tokens**: Short-lived JWTs (default 15 minutes) signed with HMAC-SHA256 (`JWT_ACCESS_SECRET`).
- **Refresh Tokens**: Long-lived tokens (7 days) stored as SHA-256 hashes in the database.
- **Rotation**: Every time `/api/v1/auth/refresh` is called, the old refresh token is permanently revoked and a new refresh token with unique `jti` is issued. Replaying an old token results in immediate rejection.
- Password hashes use `bcrypt` with work factor 10.

### 2.6 WebSocket Isolation & Authorization
- Connections must provide a valid JWT access token during handshake or connect envelope.
- Audio and transcription events are strictly isolated by session ID and device IDs.
- Transcriptions are routed **only** to the authenticated paired Android device and desktop device belonging to the active session. Unrelated devices cannot receive or intercept session transcripts.

### 2.7 Android Accessibility & Permissions
- Explicit user activation is required in Android System Settings -> Accessibility.
- The service monitors `com.openai.chatgpt` package window events and only targets editable text nodes (`isEditable == true`).
- Duplicate insertion prevention is implemented via sequence numbers and text hash tracking.
- If the ChatGPT field cannot be located, transcription is kept in-app and can be copied manually.

---

## 3. Vulnerability Reporting

If you discover a security vulnerability in this project, please open a private security advisory or contact the security maintainers. Do not disclose vulnerabilities in public issues.
