import { create } from 'zustand';
import { DeviceInfo, SessionInfo, TranscriptSegment } from '@interview-voice-bridge/shared-types';

export type BackendConnectionStatus = 'connected' | 'connecting' | 'disconnected';
export type DeepgramStatus = 'ready' | 'streaming' | 'error' | 'disconnected';

interface AppState {
  backendStatus: BackendConnectionStatus;
  deepgramStatus: DeepgramStatus;
  thisDevice: DeviceInfo | null;
  pairedDevice: DeviceInfo | null;
  activeSession: SessionInfo | null;
  isListening: boolean;
  audioLevel: number;
  interimTranscript: string;
  finalSegments: TranscriptSegment[];
  forwardToAndroid: boolean;
  pairingModal: {
    isOpen: boolean;
    pairingCode: string;
    qrCodeData: string;
    expiresAt: string;
    expiresInSeconds: number;
  };

  setBackendStatus: (status: BackendConnectionStatus) => void;
  setDeepgramStatus: (status: DeepgramStatus) => void;
  setThisDevice: (device: DeviceInfo | null) => void;
  setPairedDevice: (device: DeviceInfo | null) => void;
  setActiveSession: (session: SessionInfo | null) => void;
  setIsListening: (listening: boolean) => void;
  setAudioLevel: (level: number) => void;
  setInterimTranscript: (text: string) => void;
  addFinalSegment: (segment: TranscriptSegment) => void;
  clearTranscripts: () => void;
  setForwardToAndroid: (forward: boolean) => void;
  openPairingModal: (data: { pairingCode: string; qrCodeData: string; expiresAt: string; expiresInSeconds: number }) => void;
  closePairingModal: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  backendStatus: 'disconnected',
  deepgramStatus: 'disconnected',
  thisDevice: null,
  pairedDevice: null,
  activeSession: null,
  isListening: false,
  audioLevel: 0,
  interimTranscript: '',
  finalSegments: [],
  forwardToAndroid: true,
  pairingModal: {
    isOpen: false,
    pairingCode: '',
    qrCodeData: '',
    expiresAt: '',
    expiresInSeconds: 0,
  },

  setBackendStatus: (status) => set({ backendStatus: status }),
  setDeepgramStatus: (status) => set({ deepgramStatus: status }),
  setThisDevice: (device) => set({ thisDevice: device }),
  setPairedDevice: (device) => set({ pairedDevice: device }),
  setActiveSession: (session) => set({ activeSession: session }),
  setIsListening: (isListening) => set({ isListening }),
  setAudioLevel: (audioLevel) => set({ audioLevel }),
  setInterimTranscript: (interimTranscript) => set({ interimTranscript }),
  addFinalSegment: (segment) =>
    set((state) => {
      // Prevent duplicate segments by ID or identical text
      if (state.finalSegments.some((s) => s.id === segment.id || (s.text === segment.text && s.sequenceNumber === segment.sequenceNumber))) {
        return state;
      }
      return {
        finalSegments: [...state.finalSegments, segment],
        interimTranscript: '', // Reset interim when finalized
      };
    }),
  clearTranscripts: () => set({ interimTranscript: '', finalSegments: [] }),
  setForwardToAndroid: (forwardToAndroid) => set({ forwardToAndroid }),
  openPairingModal: (data) =>
    set({
      pairingModal: {
        isOpen: true,
        pairingCode: data.pairingCode,
        qrCodeData: data.qrCodeData,
        expiresAt: data.expiresAt,
        expiresInSeconds: data.expiresInSeconds,
      },
    }),
  closePairingModal: () =>
    set((state) => ({
      pairingModal: { ...state.pairingModal, isOpen: false },
    })),
}));
