export interface AnalysisResult {
  fileInfo: FileInfo;
  loudness: LoudnessResult | null;
  stereo: StereoResult | null;
  quality: QualityResult | null;
}

export interface FileInfo {
  name: string;
  duration: number;
  sampleRate: number;
  channels: number;
  format: string;
}

export interface LoudnessResult {
  integratedLUFS: number;
  loudnessRange: number;
  truePeakDBTP: number;
  momentaryLoudness: number[];
  shortTermLoudness: number[];
}

export interface StereoResult {
  width: number;
}

export interface QualityResult {
  startAmplitude: number;
  endAmplitude: number;
  startIsZero: boolean;
  endIsZero: boolean;
  headSilence: number;
  tailSilence: number;
}

export type AnalysisPhase =
  | 'init'
  | 'decoding'
  | 'phase1'
  | 'done'
  | 'error';

export interface ProgressState {
  phase: AnalysisPhase;
  percent: number;
  label: string;
}

export interface WorkerMessage {
  type: 'init' | 'analyze';
  audioData?: Float32Array;
  leftChannel?: Float32Array;
  rightChannel?: Float32Array;
  sampleRate?: number;
}

export interface WorkerResponse {
  type: 'ready' | 'progress' | 'partial' | 'complete' | 'error';
  phase?: string;
  percent?: number;
  label?: string;
  data?: Partial<AnalysisResult>;
  message?: string;
  version?: string;
}
