# Project: Interview Voice Transcription & ChatGPT Input Bridge

## ROLE

Act as a Senior Full-Stack Software Architect, Electron Developer, Android Kotlin Developer, Node.js Backend Engineer, WebSocket Specialist, Deepgram Speech-to-Text Engineer, QA Automation Engineer, and Security Engineer.

Develop a complete, production-quality application that connects a computer desktop application and an Android mobile application over the internet.

Do not create a demo-only implementation. Implement the actual frontend, backend, database, real-time communication, authentication, speech recognition, Android integration, and automated tests.

Do not stop after generating the project structure or UI.

Your responsibility is to implement, run, test, debug, and verify the complete application.

# 1. PROJECT OBJECTIVE

Build an application with the following workflow:

1. Start the Computer Desktop Application.
2. Start the Android Mobile Application.
3. Authenticate both applications.
4. Pair the computer and Android devices securely.
5. Connect both devices through the internet.
6. Computer application captures the interviewer's voice using the computer microphone.
7. Backend forwards the audio stream to Deepgram.
8. Deepgram converts speech into text in real time.
9. Backend receives interim and finalized transcription results.
10. Backend sends the recognized text to the paired Android application through WebSocket.
11. Android application displays the incoming transcription in real time.
12. Android application automatically populates the ChatGPT input field with the recognized text using an explicitly enabled Android Accessibility Service.
13. User can review and edit the text.
14. User manually decides whether to submit the message.

Never automatically submit the transcribed text to ChatGPT.

# 2. TECHNOLOGY STACK

## Computer Application

- Electron
- React
- TypeScript
- Vite
- Web Audio API
- Electron IPC
- Secure Electron preload architecture
- Zustand or Redux Toolkit
- Tailwind CSS

## Android Application

- Kotlin
- Jetpack Compose
- Android MVVM architecture
- Kotlin Coroutines
- StateFlow
- OkHttp WebSocket
- Retrofit
- Room Database
- Android Accessibility Service
- Android Foreground Service
- Android Notification Manager

## Backend

- Node.js
- TypeScript
- Express.js
- Socket.IO or WebSocket
- Deepgram official JavaScript SDK
- PostgreSQL
- Prisma ORM
- Redis
- JWT authentication
- Zod validation
- Pino logging

## Testing

- Vitest
- Jest
- Supertest
- Playwright
- React Testing Library
- Android JUnit
- MockK
- Espresso
- WebSocket integration tests

# 3. PROJECT STRUCTURE

Create a monorepo with the following structure:

interview-voice-bridge/
│
├── apps/
│   ├── desktop/
│   │   ├── electron/
│   │   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── stores/
│   │   ├── pages/
│   │   └── tests/
│   │
│   └── android/
│       ├── app/
│       ├── data/
│       ├── domain/
│       ├── presentation/
│       ├── services/
│       ├── accessibility/
│       └── tests/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── websocket/
│   │   ├── deepgram/
│   │   ├── auth/
│   │   ├── database/
│   │   ├── models/
│   │   ├── utils/
│   │   └── tests/
│   ├── prisma/
│   ├── Dockerfile
│   └── package.json
│
├── packages/
│   └── shared-types/
│
├── docker-compose.yml
├── .env.example
├── README.md
├── package.json
└── SECURITY.md

# 4. DEEPGRAM SPEECH-TO-TEXT IMPLEMENTATION

Implement real-time speech transcription using Deepgram's streaming API.

Deepgram endpoint:
wss://api.deepgram.com/v1/listen

Use the Deepgram Nova-3 streaming model.

Configuration:
- model=nova-3
- language=en
- punctuate=true
- smart_format=true
- interim_results=true
- utterance_end_ms=1000
- vad_events=true
- encoding appropriate for the captured audio
- sample_rate matching the actual audio stream

Support configurable language selection, including English and supported multilingual transcription.

Deepgram API credentials must be loaded from backend environment variables.

Environment variable:
DEEPGRAM_API_KEY

Do not expose the Deepgram API key in:
- React frontend
- Electron renderer
- Android source code
- APK
- Desktop installer
- WebSocket messages
- Logs
- Git repository

The previously supplied credential must not be reused in source code. Assume it has been exposed and use a newly rotated credential.

Implement:

DeepgramService:
- connect()
- startTranscription()
- sendAudio()
- receiveTranscription()
- handleInterimTranscript()
- handleFinalTranscript()
- handleError()
- reconnect()
- stopTranscription()
- close()

The Deepgram connection must be created on the backend.

The backend should receive audio chunks from the computer application and forward them to Deepgram.

Interim transcription should be used for live display.

Finalized transcription should be used for reliable ChatGPT input population.

Do not duplicate words when interim results are replaced by final results.

# 5. COMPUTER APPLICATION IMPLEMENTATION

Create a professional desktop application with the following screens.

## Dashboard

Display:
- Application name
- Backend connection status
- Deepgram connection status
- Paired Android device
- Microphone status
- Current transcription session
- Start Listening button
- Stop Listening button
- Disconnect Device button

## Microphone Management

Implement:
- Request microphone permission
- Enumerate available microphones
- Select microphone
- Test microphone
- Show audio input level
- Start and stop audio capture
- Capture audio using Web Audio API
- Convert captured audio into the correct format
- Stream audio chunks to backend
- Handle microphone permission denial
- Handle device removal
- Handle microphone switching

Do not send empty or invalid audio chunks.

Use bounded buffering to avoid memory leaks.

## Transcription Window

Display:
- Live interim text
- Finalized text
- Transcript history
- Timestamp
- Connection status
- Clear transcript button

Provide a setting to enable or disable forwarding transcription to the Android device.

# 6. ANDROID APPLICATION IMPLEMENTATION

Develop a native Android application using Kotlin and Jetpack Compose.

## Main Screens

### Home Screen

Display:
- Backend connection status
- Computer device status
- Device pairing status
- Live transcription status
- ChatGPT input integration status
- Start receiving button
- Stop receiving button
- Disconnect button
- Settings

### Device Pairing

Implement secure device pairing.

Features:
- QR code pairing
- Short-lived pairing code
- Expiration time
- One-time pairing token
- Device name
- Device identity
- Pairing approval
- Revoke paired device

Never use a permanent shared pairing secret.

### Live Transcription Screen

Display:
- Incoming interim transcription
- Final transcription
- Transcript history
- Timestamp
- Computer device name
- Connection status

Ensure the UI updates smoothly without freezing.

## Android ChatGPT Input Integration

Implement an Accessibility Service with explicit user consent.

Service:
InterviewInputAccessibilityService

Required functionality:
- Detect the ChatGPT application package and its visible input field.
- Locate an editable text field.
- Populate the editable field with finalized transcription text.
- Support multi-line text.
- Avoid duplicate insertion.
- Preserve existing text according to a configurable append/replace preference.
- Avoid changing unrelated applications or fields.
- Provide a visible enabled/disabled status.
- Handle ChatGPT UI changes gracefully.
- Never click the Send button.
- Never automatically submit the message.
- Allow the user to stop input population immediately.

Do not use hidden APIs, root access, or unauthorized UI manipulation.

If the ChatGPT input field cannot be detected:
- Keep the transcription in the Android application.
- Show a clear error.
- Allow copying the text manually.

# 7. BACKEND API IMPLEMENTATION

Implement the following REST endpoints.

Authentication:

POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout

Device pairing:

POST /api/v1/devices/pair/initiate
POST /api/v1/devices/pair/approve
POST /api/v1/devices/pair/complete
GET /api/v1/devices
DELETE /api/v1/devices/:deviceId

Session:

POST /api/v1/sessions
GET /api/v1/sessions/:sessionId
POST /api/v1/sessions/:sessionId/start
POST /api/v1/sessions/:sessionId/stop
DELETE /api/v1/sessions/:sessionId

Transcription:

GET /api/v1/transcriptions/:sessionId
DELETE /api/v1/transcriptions/:sessionId

Health:

GET /health
GET /ready

Implement proper:
- HTTP status codes
- Request validation
- Error responses
- Authentication middleware
- Authorization middleware
- Rate limiting
- Request ID
- Logging
- Graceful shutdown

# 8. WEBSOCKET IMPLEMENTATION

Create a secure WebSocket gateway.

The desktop client connects to the backend and sends audio frames.

The Android client connects to the backend and receives transcription events.

Implement the following event types:

desktop:connect
desktop:audio:start
desktop:audio:chunk
desktop:audio:stop

android:connect
android:transcription:subscribe
android:transcription:unsubscribe

transcription:interim
transcription:final
transcription:error

session:started
session:stopped

device:connected
device:disconnected

connection:heartbeat
connection:reconnect

Each event should contain:
- eventId
- sessionId
- deviceId
- timestamp
- eventType
- payload

Implement:
- Authentication on connection
- Device authorization
- Session authorization
- Heartbeats
- Reconnection
- Exponential backoff
- Ping/pong
- Message validation
- Rate limiting
- Backpressure handling
- Duplicate event detection

Do not broadcast transcription data to unrelated devices.

Only send data to the authenticated, paired Android device assigned to the active session.

# 9. REAL-TIME TRANSCRIPTION PIPELINE

Implement the complete pipeline:

Computer Microphone
    ↓
Web Audio API
    ↓
Audio Chunk
    ↓
Authenticated WebSocket
    ↓
Node.js Backend
    ↓
Deepgram Streaming API
    ↓
Interim / Final Transcription
    ↓
Backend WebSocket Gateway
    ↓
Paired Android Device
    ↓
Android Transcription UI
    ↓
ChatGPT Accessibility Input

Implement low-latency streaming.

Use the appropriate audio format and sample rate.

Handle:
- No speech detected
- Silence
- Background noise
- Multiple sentences
- Long conversations
- Interim result corrections
- Final result processing
- Deepgram connection errors
- Network interruptions
- Desktop reconnection
- Android reconnection
- Backend restart

Do not lose finalized transcript segments during temporary network interruptions where recovery is possible.

# 10. DATABASE IMPLEMENTATION

Use PostgreSQL and Prisma.

Create the following entities:

User
Device
DevicePairing
TranscriptionSession
TranscriptSegment
RefreshToken

Implement:
- Database migrations
- Relations
- Indexes
- Constraints
- Transaction handling
- Pagination

TranscriptSegment should contain:
- id
- sessionId
- sequenceNumber
- text
- isFinal
- timestamp
- confidence
- language

Avoid storing raw audio by default.

Provide an option to disable transcript persistence.

Provide a delete session feature.

# 11. SECURITY REQUIREMENTS

Implement the following:

- HTTPS and WSS in production
- JWT authentication
- Secure refresh tokens
- Token rotation
- Device pairing expiration
- One-time pairing tokens
- Deepgram API key protection
- Rate limiting
- Input validation
- SQL injection prevention
- WebSocket origin validation
- Device-level authorization
- Session-level authorization
- Secure Electron preload
- contextIsolation=true
- nodeIntegration=false
- sandbox=true where compatible
- Android encrypted token storage
- No secrets in Git
- No secrets in logs

Use environment variables.

Create .env.example containing placeholders only.

Never use real credentials in .env.example.

Do not store passwords as plaintext.

Require explicit microphone permission and Accessibility Service activation.

Provide a visible indicator when transcription is active.

# 12. TESTING REQUIREMENTS

Do not claim that tests passed without executing them.

Create and execute a complete test suite.

## Backend Unit Tests

Test:
- Authentication
- JWT expiration
- Device pairing
- Session creation
- Session authorization
- Deepgram connection
- Interim transcript handling
- Final transcript handling
- Duplicate transcript prevention
- WebSocket event validation
- Rate limiting
- Error handling

## Backend Integration Tests

Test:
- Desktop connection
- Android connection
- Device pairing
- Audio streaming
- Deepgram mocked transcription
- Transcript delivery
- Session stopping
- Disconnection
- Reconnection

## Desktop Tests

Test:
- Microphone permission
- Microphone selection
- Start listening
- Stop listening
- Audio streaming
- Backend disconnection
- Deepgram error handling
- UI state transitions

## Android Tests

Test:
- Login
- Device pairing
- WebSocket connection
- Transcription reception
- Transcript display
- Accessibility Service enabled
- Input field detection
- Text population
- Append mode
- Replace mode
- Duplicate prevention
- Stop receiving
- Connection loss
- Reconnection

## End-to-End Tests

Test the entire workflow:

1. Start backend.
2. Start desktop application.
3. Start Android application.
4. Pair the devices.
5. Start a transcription session.
6. Speak a test sentence into the computer microphone.
7. Verify Deepgram receives audio.
8. Verify transcription is generated.
9. Verify text is sent to Android.
10. Verify text appears in the Android application.
11. Verify text populates the ChatGPT input field when accessibility integration is enabled.
12. Verify the message is not automatically submitted.
13. Stop the session.
14. Verify all connections are properly closed.

Use mocked Deepgram responses for automated tests.

Provide a separate real Deepgram integration test that requires a valid API key and test audio.

Do not make the normal test suite dependent on paid API usage.

# 13. FAILURE HANDLING

The application must handle all these cases:

- Backend is offline.
- Deepgram API key is invalid.
- Deepgram quota is exhausted.
- Deepgram WebSocket connection fails.
- Microphone permission is denied.
- Microphone is disconnected.
- Android device is offline.
- Desktop device is offline.
- Pairing code expires.
- Pairing code is reused.
- User logs out.
- JWT expires.
- WebSocket disconnects unexpectedly.
- Duplicate audio chunks arrive.
- Duplicate transcription events arrive.
- ChatGPT input field is unavailable.
- Accessibility permission is disabled.
- Network latency increases.
- Backend restarts.
- PostgreSQL becomes unavailable.
- Redis becomes unavailable.

Provide useful error messages and recovery actions.

Never leave the application in a false connected state.

# 14. UI DESIGN

Use a modern, clean, professional interface.

Desktop:
- Dark and light themes
- Connection status indicators
- Microphone visualizer
- Live transcription panel
- Device pairing QR code
- Session controls
- Settings
- Error notifications

Android:
- Material 3 design
- Responsive layout
- Live transcription cards
- Device connection indicator
- Pairing screen
- Accessibility status
- Session controls
- Settings

Avoid unnecessary animations.

# 15. DEVELOPMENT EXECUTION PLAN

Work in the following phases.

Phase 1:
Analyze requirements and design architecture.

Phase 2:
Initialize the monorepo and install dependencies.

Phase 3:
Implement backend authentication and database.

Phase 4:
Implement secure device pairing.

Phase 5:
Implement backend WebSocket gateway.

Phase 6:
Implement Deepgram streaming transcription.

Phase 7:
Implement desktop microphone capture and UI.

Phase 8:
Implement Android application and WebSocket client.

Phase 9:
Implement Android Accessibility Service.

Phase 10:
Implement complete real-time transcription pipeline.

Phase 11:
Write unit, integration, and end-to-end tests.

Phase 12:
Run tests, detect bugs, and fix failures.

Phase 13:
Perform security review.

Phase 14:
Build desktop application and Android APK.

Phase 15:
Create setup and deployment documentation.

Do not skip any phase.

# 16. REQUIRED DELIVERABLES

Provide:

- Complete source code
- Working backend
- Working Electron desktop application
- Working Android application
- Deepgram streaming implementation
- PostgreSQL database schema
- Prisma migrations
- Docker Compose
- Automated test suite
- .env.example
- README.md
- SECURITY.md
- API documentation
- WebSocket event documentation
- Local development instructions
- Production deployment instructions
- Desktop build instructions
- Android APK build instructions

# 17. FINAL VERIFICATION

Before declaring the project complete:

- Install dependencies.
- Run type checking.
- Run ESLint.
- Run backend unit tests.
- Run backend integration tests.
- Run desktop tests.
- Run Android tests.
- Build the desktop application.
- Build the Android APK.
- Verify the WebSocket connection.
- Verify the Deepgram streaming implementation.
- Verify transcript delivery.
- Verify ChatGPT input population.
- Verify that automatic message submission is disabled.
- Fix all critical and high-priority bugs.
- Document any remaining limitations.

Provide a final report containing:
- Implemented features
- Test cases executed
- Tests passed
- Tests failed
- Build status
- Bugs fixed
- Remaining limitations
- Commands to start all applications

Do not mark any feature as complete unless it has been implemented and verified.

Start by analyzing the existing project folder. If the folder is empty, initialize the project from scratch. If code already exists, inspect it before modifying it.

Proceed with implementation, not just planning.
