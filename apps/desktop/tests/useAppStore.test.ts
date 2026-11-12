import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../src/stores/useAppStore';

describe('useAppStore Desktop Store Tests', () => {
  beforeEach(() => {
    useAppStore.getState().clearTranscripts();
  });

  it('should initialize with disconnected status and empty transcripts', () => {
    const state = useAppStore.getState();
    expect(state.backendStatus).toBe('disconnected');
    expect(state.isListening).toBe(false);
    expect(state.finalSegments).toHaveLength(0);
  });

  it('should add final segment and reset interim transcript', () => {
    useAppStore.getState().setInterimTranscript('Thinking about...');
    expect(useAppStore.getState().interimTranscript).toBe('Thinking about...');

    useAppStore.getState().addFinalSegment({
      id: 'seg-1',
      sessionId: 'sess-1',
      sequenceNumber: 1,
      text: 'Tell me about yourself.',
      isFinal: true,
      timestamp: Date.now(),
      confidence: 0.99,
      language: 'en',
    });

    const state = useAppStore.getState();
    expect(state.finalSegments).toHaveLength(1);
    expect(state.finalSegments[0].text).toBe('Tell me about yourself.');
    expect(state.interimTranscript).toBe(''); // Reset interim on finalized
  });

  it('should prevent duplicated final segments with same ID or content and sequenceNumber', () => {
    const seg = {
      id: 'seg-dup-test',
      sessionId: 'sess-1',
      sequenceNumber: 1,
      text: 'What is polymorphism?',
      isFinal: true,
      timestamp: Date.now(),
      confidence: 0.99,
      language: 'en',
    };

    useAppStore.getState().addFinalSegment(seg);
    useAppStore.getState().addFinalSegment(seg);

    expect(useAppStore.getState().finalSegments).toHaveLength(1);
  });

  it('should open and close pairing modal with correct data', () => {
    useAppStore.getState().openPairingModal({
      pairingCode: '123456',
      qrCodeData: '{"code":"123456"}',
      expiresAt: '2026-11-12T14:00:00Z',
      expiresInSeconds: 300,
    });

    let state = useAppStore.getState();
    expect(state.pairingModal.isOpen).toBe(true);
    expect(state.pairingModal.pairingCode).toBe('123456');

    useAppStore.getState().closePairingModal();
    state = useAppStore.getState();
    expect(state.pairingModal.isOpen).toBe(false);
  });
});
