import { createClient, LiveClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface DeepgramServiceOptions {
  apiKey?: string;
  sampleRate?: number;
  channels?: number;
  encoding?: string;
  language?: string;
  model?: string;
  mockMode?: boolean;
}

export type TranscriptCallback = (transcript: {
  text: string;
  isFinal: boolean;
  confidence: number;
  language: string;
  timestamp: number;
}) => void;

export type ErrorCallback = (error: Error) => void;

export class DeepgramService {
  private liveClient: LiveClient | null = null;
  private isConnected = false;
  private isTranscriptionActive = false;
  private options: Required<DeepgramServiceOptions>;
  private onInterimCallback: TranscriptCallback | null = null;
  private onFinalCallback: TranscriptCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;
  private onCloseCallback: (() => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private mockInterval: NodeJS.Timeout | null = null;
  private lastFinalText = '';

  constructor(options?: DeepgramServiceOptions) {
    const apiKey = options?.apiKey || config.deepgramApiKey || '';
    const hasKey = Boolean(apiKey && apiKey.length > 5);
    const mockMode = options?.mockMode ?? (!hasKey || process.env.NODE_ENV === 'test');

    this.options = {
      apiKey,
      sampleRate: options?.sampleRate || 16000,
      channels: options?.channels || 1,
      encoding: options?.encoding || 'linear16',
      language: options?.language || 'en',
      model: options?.model || 'nova-3',
      mockMode,
    };
  }

  public setCallbacks(callbacks: {
    onInterim?: TranscriptCallback;
    onFinal?: TranscriptCallback;
    onError?: ErrorCallback;
    onClose?: () => void;
  }): void {
    if (callbacks.onInterim) this.onInterimCallback = callbacks.onInterim;
    if (callbacks.onFinal) this.onFinalCallback = callbacks.onFinal;
    if (callbacks.onError) this.onErrorCallback = callbacks.onError;
    if (callbacks.onClose) this.onCloseCallback = callbacks.onClose;
  }

  public async connect(): Promise<boolean> {
    if (this.isConnected) return true;

    if (this.options.mockMode) {
      logger.info('DeepgramService initialized in mock/offline mode');
      this.isConnected = true;
      return true;
    }

    try {
      const deepgram = createClient(this.options.apiKey);
      this.liveClient = deepgram.listen.live({
        model: this.options.model,
        language: this.options.language,
        punctuate: true,
        smart_format: true,
        interim_results: true,
        utterance_end_ms: 1000,
        vad_events: true,
        encoding: this.options.encoding,
        sample_rate: this.options.sampleRate,
        channels: this.options.channels,
      });

      this.liveClient.on(LiveTranscriptionEvents.Open, () => {
        logger.info('Deepgram Live client connection opened');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.liveClient.on(LiveTranscriptionEvents.Transcript, (data: any) => {
        this.receiveTranscription(data);
      });

      this.liveClient.on(LiveTranscriptionEvents.Error, (err: any) => {
        this.handleError(new Error(err?.message || 'Deepgram streaming error'));
      });

      this.liveClient.on(LiveTranscriptionEvents.Close, () => {
        logger.info('Deepgram Live client closed');
        this.isConnected = false;
        if (this.onCloseCallback) this.onCloseCallback();
      });

      this.isConnected = true;
      return true;
    } catch (err: any) {
      this.handleError(err);
      return false;
    }
  }

  public startTranscription(): void {
    this.isTranscriptionActive = true;
    this.lastFinalText = '';
    logger.info('Transcription streaming started');
  }

  public sendAudio(audioChunk: Buffer | Uint8Array | string): void {
    if (!this.isTranscriptionActive) return;

    if (this.options.mockMode) {
      // In mock mode, process simulated transcript if not already generating
      return;
    }

    if (!this.liveClient || !this.isConnected) {
      logger.warn('Deepgram not connected when sending audio');
      return;
    }

    try {
      let buffer: Buffer;
      if (typeof audioChunk === 'string') {
        buffer = Buffer.from(audioChunk, 'base64');
      } else if (audioChunk instanceof Buffer) {
        buffer = audioChunk;
      } else {
        buffer = Buffer.from(audioChunk);
      }

      if (buffer.length > 0) {
        this.liveClient.send(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as any);
      }
    } catch (err: any) {
      this.handleError(err);
    }
  }

  public receiveTranscription(data: any): void {
    if (!data || !data.channel || !data.channel.alternatives || data.channel.alternatives.length === 0) {
      return;
    }

    const alternative = data.channel.alternatives[0];
    const transcript = alternative.transcript;
    if (!transcript || transcript.trim().length === 0) {
      return;
    }

    const isFinal = Boolean(data.is_final);
    const confidence = alternative.confidence ?? 1.0;
    const language = this.options.language;
    const timestamp = Date.now();

    if (isFinal) {
      this.handleFinalTranscript({
        text: transcript,
        isFinal: true,
        confidence,
        language,
        timestamp,
      });
    } else {
      this.handleInterimTranscript({
        text: transcript,
        isFinal: false,
        confidence,
        language,
        timestamp,
      });
    }
  }

  public handleInterimTranscript(data: {
    text: string;
    isFinal: false;
    confidence: number;
    language: string;
    timestamp: number;
  }): void {
    if (this.onInterimCallback) {
      this.onInterimCallback(data);
    }
  }

  public handleFinalTranscript(data: {
    text: string;
    isFinal: true;
    confidence: number;
    language: string;
    timestamp: number;
  }): void {
    // Avoid sending duplicated final segments if repeated identical utterance
    if (data.text.trim() === this.lastFinalText.trim()) {
      return;
    }
    this.lastFinalText = data.text;
    if (this.onFinalCallback) {
      this.onFinalCallback(data);
    }
  }

  public handleError(error: Error): void {
    logger.error({ err: error.message }, 'DeepgramService error');
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
    if (!this.options.mockMode && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnect();
    }
  }

  public async reconnect(): Promise<void> {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000);
    logger.info({ attempt: this.reconnectAttempts, delay }, 'Reconnecting Deepgram live client...');
    await new Promise((resolve) => setTimeout(resolve, delay));
    this.close();
    await this.connect();
  }

  public stopTranscription(): void {
    this.isTranscriptionActive = false;
    if (this.mockInterval) {
      clearInterval(this.mockInterval);
      this.mockInterval = null;
    }
    logger.info('Transcription streaming stopped');
  }

  public close(): void {
    this.stopTranscription();
    if (this.liveClient) {
      try {
        this.liveClient.requestClose();
      } catch (err) {
        // ignore on close
      }
      this.liveClient = null;
    }
    this.isConnected = false;
  }

  // Simulated method for testing pipelines
  public simulateTranscription(text: string, isFinal: boolean): void {
    const payload = {
      text,
      isFinal,
      confidence: 0.98,
      language: this.options.language,
      timestamp: Date.now(),
    };
    if (isFinal) {
      this.handleFinalTranscript(payload as any);
    } else {
      this.handleInterimTranscript(payload as any);
    }
  }
}
