import { describe, it, expect, vi } from 'vitest';
import { DeepgramService } from '../deepgram/deepgram.service';

describe('DeepgramService Unit Tests', () => {
  it('should initialize and connect in mock/offline mode without failing', async () => {
    const service = new DeepgramService({ mockMode: true });
    const connected = await service.connect();
    expect(connected).toBe(true);

    service.startTranscription();
    service.stopTranscription();
    service.close();
  });

  it('should handle interim and final transcript callbacks correctly', () => {
    const service = new DeepgramService({ mockMode: true });
    const interimSpy = vi.fn();
    const finalSpy = vi.fn();

    service.setCallbacks({
      onInterim: interimSpy,
      onFinal: finalSpy,
    });

    // Simulate interim result
    service.handleInterimTranscript({
      text: 'Hello world',
      isFinal: false,
      confidence: 0.95,
      language: 'en',
      timestamp: Date.now(),
    });

    expect(interimSpy).toHaveBeenCalledTimes(1);
    expect(interimSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Hello world', isFinal: false })
    );

    // Simulate final result
    service.handleFinalTranscript({
      text: 'Hello world!',
      isFinal: true,
      confidence: 0.99,
      language: 'en',
      timestamp: Date.now(),
    });

    expect(finalSpy).toHaveBeenCalledTimes(1);
    expect(finalSpy).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Hello world!', isFinal: true })
    );
  });

  it('should prevent duplicated final transcripts with identical text', () => {
    const service = new DeepgramService({ mockMode: true });
    const finalSpy = vi.fn();

    service.setCallbacks({ onFinal: finalSpy });

    service.handleFinalTranscript({
      text: 'Identical sentence.',
      isFinal: true,
      confidence: 0.99,
      language: 'en',
      timestamp: Date.now(),
    });

    service.handleFinalTranscript({
      text: 'Identical sentence.',
      isFinal: true,
      confidence: 0.99,
      language: 'en',
      timestamp: Date.now(),
    });

    expect(finalSpy).toHaveBeenCalledTimes(1);
  });
});
