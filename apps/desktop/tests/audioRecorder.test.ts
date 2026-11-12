import { describe, it, expect, vi } from 'vitest';
import { AudioRecorderService } from '../src/services/audioRecorder';

describe('AudioRecorderService Tests', () => {
  it('should initialize and provide default microphone list', async () => {
    const recorder = new AudioRecorderService();
    const mics = await recorder.getAvailableMicrophones();
    expect(mics.length).toBeGreaterThan(0);
    expect(mics[0].deviceId).toBeDefined();
  });

  it('should set microphone device ID and track callbacks', () => {
    const recorder = new AudioRecorderService();
    const levelSpy = vi.fn();
    const chunkSpy = vi.fn();

    recorder.setCallbacks({ onLevel: levelSpy, onChunk: chunkSpy });
    recorder.setMicrophone('custom-mic-id');

    expect(recorder.getIsRecording()).toBe(false);
  });
});
