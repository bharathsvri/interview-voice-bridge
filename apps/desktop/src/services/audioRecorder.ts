export interface AudioDevice {
  deviceId: string;
  label: string;
}

export type AudioChunkCallback = (pcmData: ArrayBuffer, base64: string) => void;
export type AudioLevelCallback = (level: number) => void;

export class AudioRecorderService {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isRecording = false;
  private selectedDeviceId: string = 'default';

  private onChunk: AudioChunkCallback | null = null;
  private onLevel: AudioLevelCallback | null = null;

  public setCallbacks(callbacks: { onChunk?: AudioChunkCallback; onLevel?: AudioLevelCallback }): void {
    if (callbacks.onChunk) this.onChunk = callbacks.onChunk;
    if (callbacks.onLevel) this.onLevel = callbacks.onLevel;
  }

  public async getAvailableMicrophones(): Promise<AudioDevice[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return [{ deviceId: 'default', label: 'Default Microphone' }];
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices
      .filter((d) => d.kind === 'audioinput')
      .map((d, index) => ({
        deviceId: d.deviceId || `mic-${index}`,
        label: d.label || `Microphone ${index + 1}`,
      }));
    return mics.length > 0 ? mics : [{ deviceId: 'default', label: 'Default Microphone' }];
  }

  public setMicrophone(deviceId: string): void {
    this.selectedDeviceId = deviceId;
    if (this.isRecording) {
      // Restart recording with newly selected device
      this.stop();
      this.start();
    }
  }

  public async start(): Promise<boolean> {
    if (this.isRecording) return true;

    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: this.selectedDeviceId !== 'default' ? { exact: this.selectedDeviceId } : undefined,
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create AudioContext with 16kHz sample rate
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      // Buffer size 4096 gives ~256ms frames at 16kHz
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.isRecording) return;

        const inputData = event.inputBuffer.getChannelData(0);

        // 1. Calculate RMS audio level (0 - 100)
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const level = Math.min(100, Math.round(rms * 400));
        if (this.onLevel) {
          this.onLevel(level);
        }

        // 2. Convert Float32 to 16-bit Linear PCM
        const pcmBuffer = this.floatTo16BitPCM(inputData);
        const base64 = this.arrayBufferToBase64(pcmBuffer);

        if (this.onChunk) {
          this.onChunk(pcmBuffer, base64);
        }
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      this.isRecording = true;
      return true;
    } catch (err) {
      console.error('Failed to start audio recording:', err);
      this.stop();
      return false;
    }
  }

  public stop(): void {
    this.isRecording = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.onLevel) {
      this.onLevel(0);
    }
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  // Float32 [-1.0, 1.0] -> Int16 [-32768, 32767]
  private floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); // little-endian
    }
    return buffer;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

export const audioRecorder = new AudioRecorderService();
