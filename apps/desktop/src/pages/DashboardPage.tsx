import React, { useEffect, useState } from 'react';
import { Mic, Square, Smartphone, Unlink, AlertCircle } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { Header } from '../components/Header';
import { MicrophoneSelector } from '../components/MicrophoneSelector';
import { TranscriptionPanel } from '../components/TranscriptionPanel';
import { PairingModal } from '../components/PairingModal';
import { StatusBar } from '../components/StatusBar';
import { audioRecorder } from '../services/audioRecorder';
import { wsClient } from '../services/wsClient';
import { apiClient } from '../services/apiClient';

export const DashboardPage: React.FC = () => {
  const {
    isListening,
    setIsListening,
    setAudioLevel,
    setInterimTranscript,
    addFinalSegment,
    setBackendStatus,
    setDeepgramStatus,
    setThisDevice,
    setPairedDevice,
    pairedDevice,
    activeSession,
    setActiveSession,
    openPairingModal,
    forwardToAndroid,
  } = useAppStore();

  const [desktopDeviceId] = useState<string>(() => {
    let id = localStorage.getItem('desktop_device_id');
    if (!id) {
      id = 'desktop-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('desktop_device_id', id);
    }
    return id;
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize and check auth & connection
  useEffect(() => {
    async function init() {
      try {
        setBackendStatus('connecting');

        // Automatically authenticate with default/demo user if not logged in
        let token = apiClient.getAccessToken();
        if (!token) {
          try {
            const authRes = await apiClient.request('/api/v1/auth/login', {
              method: 'POST',
              body: JSON.stringify({
                email: 'user@example.com',
                password: 'Password123!',
                deviceId: desktopDeviceId,
              }),
            });
            apiClient.setTokens(authRes.tokens.accessToken, authRes.tokens.refreshToken);
            token = authRes.tokens.accessToken;
          } catch {
            // Register if login fails
            const regRes = await apiClient.request('/api/v1/auth/register', {
              method: 'POST',
              body: JSON.stringify({
                email: 'user@example.com',
                password: 'Password123!',
                name: 'Default User',
              }),
            });
            apiClient.setTokens(regRes.tokens.accessToken, regRes.tokens.refreshToken);
            token = regRes.tokens.accessToken;
          }
        }

        // Fetch user devices
        const devices = await apiClient.request('/api/v1/devices');
        const desktop = devices.find((d: any) => d.id === desktopDeviceId);
        if (desktop) {
          setThisDevice(desktop);
          if (desktop.pairedDeviceId) {
            const paired = devices.find((d: any) => d.id === desktop.pairedDeviceId);
            if (paired) setPairedDevice(paired);
          }
        }

        // Connect WebSocket
        wsClient.connect('ws://localhost:5000/ws', token!, desktopDeviceId);
        setBackendStatus('connected');
        setDeepgramStatus('ready');
      } catch (err: any) {
        console.error('Initialization error:', err);
        setBackendStatus('disconnected');
        setErrorMsg('Failed to connect to backend: ' + err.message);
      }
    }

    init();

    // Subscribe to WebSocket events
    const unsubInterim = wsClient.subscribe('transcription:interim', (env) => {
      const payload = env.payload as any;
      if (payload?.text) {
        setInterimTranscript(payload.text);
      }
    });

    const unsubFinal = wsClient.subscribe('transcription:final', (env) => {
      const payload = env.payload as any;
      if (payload?.text) {
        addFinalSegment({
          id: payload.segmentId || Math.random().toString(),
          sessionId: env.sessionId,
          sequenceNumber: payload.sequenceNumber || 1,
          text: payload.text,
          isFinal: true,
          timestamp: payload.timestamp || Date.now(),
          confidence: payload.confidence || 0.98,
          language: payload.language || 'en',
        });
      }
    });

    const unsubDeviceConn = wsClient.subscribe('device:connected', (env) => {
      const payload = env.payload as any;
      if (payload.deviceId !== desktopDeviceId) {
        setPairedDevice({
          id: payload.deviceId,
          userId: '',
          name: 'Android Phone',
          deviceType: 'android',
          isOnline: true,
          lastActiveAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
      }
    });

    const unsubDeviceDisconn = wsClient.subscribe('device:disconnected', (env) => {
      const payload = env.payload as any;
      if (pairedDevice && payload.deviceId === pairedDevice.id) {
        setPairedDevice({ ...pairedDevice, isOnline: false });
      }
    });

    return () => {
      unsubInterim();
      unsubFinal();
      unsubDeviceConn();
      unsubDeviceDisconn();
      wsClient.disconnect();
    };
  }, [desktopDeviceId]);

  // Initiate Pairing Flow
  const handleInitiatePairing = async () => {
    try {
      setErrorMsg(null);
      const res = await apiClient.request('/api/v1/devices/pair/initiate', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: desktopDeviceId,
          name: 'Computer Desktop',
          deviceType: 'desktop',
        }),
      });

      openPairingModal({
        pairingCode: res.pairingCode,
        qrCodeData: res.qrCodeData,
        expiresAt: res.expiresAt,
        expiresInSeconds: res.expiresInSeconds,
      });
    } catch (err: any) {
      setErrorMsg('Failed to initiate pairing: ' + err.message);
    }
  };

  // Unpair device
  const handleUnpair = async () => {
    if (!pairedDevice) return;
    try {
      await apiClient.request(`/api/v1/devices/${pairedDevice.id}`, { method: 'DELETE' });
      setPairedDevice(null);
    } catch (err: any) {
      setErrorMsg('Failed to unpair device: ' + err.message);
    }
  };

  // Start listening & streaming
  const handleStartListening = async () => {
    try {
      setErrorMsg(null);
      let sessionId = activeSession?.id;

      if (!sessionId) {
        // Create session
        const sessionRes = await apiClient.request('/api/v1/sessions', {
          method: 'POST',
          body: JSON.stringify({
            desktopDeviceId,
            androidDeviceId: pairedDevice?.id || 'simulated-android',
            isPersistenceEnabled: true,
          }),
        });
        sessionId = sessionRes.id;
        setActiveSession(sessionRes);
      }

      // Configure audio recorder callbacks
      audioRecorder.setCallbacks({
        onLevel: (level) => setAudioLevel(level),
        onChunk: (_pcmBuffer, base64) => {
          // Stream audio chunk to backend via WebSocket
          wsClient.send('desktop:audio:chunk', sessionId!, {
            audioBase64: base64,
            forwardToAndroid,
          });
        },
      });

      const started = await audioRecorder.start();
      if (!started) {
        setErrorMsg('Microphone access denied or audio device error.');
        return;
      }

      // Inform backend that audio streaming has started
      wsClient.send('desktop:audio:start', sessionId!, {
        sampleRate: 16000,
        channels: 1,
        language: 'en',
      });

      setIsListening(true);
      setDeepgramStatus('streaming');
    } catch (err: any) {
      setErrorMsg('Failed to start session: ' + err.message);
    }
  };

  // Stop listening
  const handleStopListening = async () => {
    audioRecorder.stop();
    setIsListening(false);
    setAudioLevel(0);
    setDeepgramStatus('ready');

    if (activeSession) {
      wsClient.send('desktop:audio:stop', activeSession.id, {});
      try {
        await apiClient.request(`/api/v1/sessions/${activeSession.id}/stop`, { method: 'POST' });
      } catch (e) {
        // ignore
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 overflow-hidden">
      <Header />

      {errorMsg && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      <main className="flex-1 p-6 grid grid-cols-12 gap-6 overflow-hidden">
        {/* Left Column: Controls & Devices */}
        <div className="col-span-5 flex flex-col gap-5 overflow-y-auto pr-1">
          {/* Main Action Card */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white mb-2">Speech Recognition</h2>
            <p className="text-xs text-slate-400 mb-6">
              Captures interviewer speech in real time, converts to text via Deepgram Nova-3, and
              syncs with paired Android phone.
            </p>

            <div className="flex gap-3">
              {!isListening ? (
                <button
                  onClick={handleStartListening}
                  className="flex-1 py-3.5 px-4 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-600/30 transition-all active:scale-[0.98]"
                >
                  <Mic className="w-5 h-5" />
                  Start Listening
                </button>
              ) : (
                <button
                  onClick={handleStopListening}
                  className="flex-1 py-3.5 px-4 rounded-xl font-semibold text-sm bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-2.5 shadow-lg shadow-rose-600/30 transition-all active:scale-[0.98]"
                >
                  <Square className="w-5 h-5 fill-current" />
                  Stop Listening
                </button>
              )}
            </div>
          </div>

          {/* Microphone Management */}
          <MicrophoneSelector />

          {/* Android Device Pairing Card */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-semibold text-slate-200">Paired Android Device</h3>
              </div>
              {pairedDevice && (
                <button
                  onClick={handleUnpair}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                  title="Unpair Android Device"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Unpair
                </button>
              )}
            </div>

            {pairedDevice ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    {pairedDevice.name || 'Android Device'}
                  </p>
                  <p className="text-xs text-slate-500">ID: {pairedDevice.id.substring(0, 12)}...</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      pairedDevice.isOnline
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-700/50 text-slate-400'
                    }`}
                  >
                    {pairedDevice.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-xs text-slate-400 mb-3">
                  No Android phone currently paired. Pair with phone to automatically stream live
                  transcriptions into ChatGPT input.
                </p>
                <button
                  onClick={handleInitiatePairing}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors inline-flex items-center gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  Pair New Android Phone
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Transcription Panel */}
        <div className="col-span-7 flex flex-col h-full">
          <TranscriptionPanel />
        </div>
      </main>

      <StatusBar />
      <PairingModal />
    </div>
  );
};
