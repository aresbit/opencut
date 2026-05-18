export interface AsrWord {
  text: string;
  start: number;
  end: number;
}

export interface AsrResult {
  text: string;
  words: AsrWord[];
}

export interface AsrBackend {
  transcribe(audioPath: string, opts: { sourceLang: string }): Promise<AsrResult>;
  unload(): Promise<void>;
}

export interface VadSpan {
  start: number;
  end: number;
}

export interface VadBackend {
  detectSpeech(audioPath: string): Promise<VadSpan[]>;
  unload(): Promise<void>;
}

export interface AudioSlice {
  path: string;
  cleanup(): Promise<void>;
}

export interface AudioSlicer {
  slice(audioPath: string, startSec: number, endSec: number): Promise<AudioSlice>;
}

export interface AsrHelperLogger {
  info(message: string): void;
}

export const DEFAULT_MIN_SPEECH_SAMPLES = 1600;
export const DEFAULT_MAX_CHARS = 60;
