import type { AnalysisResult, BpmKeyResult, WorkerResponse } from './types';

// Singleton Worker — WASM initialization happens only once
let sharedWorker: Worker | null = null;
let workerReady = false;
let initPromise: Promise<string> | null = null;

function getWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL('../workers/essentia.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }
  return sharedWorker;
}

function ensureInit(): Promise<string> {
  if (workerReady) return Promise.resolve('cached');
  if (initPromise) return initPromise;

  const worker = getWorker();
  initPromise = new Promise<string>((resolve, reject) => {
    const handler = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === 'ready') {
        worker.removeEventListener('message', handler);
        workerReady = true;
        resolve(e.data.version ?? 'unknown');
      } else if (e.data.type === 'error') {
        worker.removeEventListener('message', handler);
        initPromise = null;
        reject(new Error(e.data.message));
      }
    };
    worker.addEventListener('message', handler);
    worker.postMessage({ type: 'init' });
  });
  return initPromise;
}

export class AudioAnalyzer {
  private onProgress: (phase: string, percent: number, label: string) => void;
  private onPartial: (data: Partial<AnalysisResult>) => void;

  constructor(
    onProgress: (phase: string, percent: number, label: string) => void,
    onPartial: (data: Partial<AnalysisResult>) => void,
  ) {
    this.onProgress = onProgress;
    this.onPartial = onPartial;
  }

  init(): Promise<string> {
    return ensureInit();
  }

  analyzeBpmKey(audioData: Float32Array, sampleRate: number): Promise<BpmKeyResult> {
    if (!workerReady) {
      return Promise.reject(new Error('Analyzer not initialized'));
    }

    const worker = getWorker();

    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          this.onProgress(msg.phase ?? '', msg.percent ?? 0, msg.label ?? '');
        } else if (msg.type === 'bpmKeyComplete' && msg.bpmKeyData) {
          worker.removeEventListener('message', handler);
          resolve(msg.bpmKeyData);
        } else if (msg.type === 'error') {
          worker.removeEventListener('message', handler);
          reject(new Error(msg.message));
        }
      };
      worker.addEventListener('message', handler);

      const data = new Float32Array(audioData);
      worker.postMessage(
        { type: 'analyzeBpmKey', audioData: data, sampleRate },
        [data.buffer],
      );
    });
  }

  analyze(audioData: Float32Array, sampleRate: number, leftChannel?: Float32Array, rightChannel?: Float32Array): Promise<void> {
    if (!workerReady) {
      return Promise.reject(new Error('Analyzer not initialized'));
    }

    const worker = getWorker();

    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          this.onProgress(msg.phase ?? '', msg.percent ?? 0, msg.label ?? '');
        } else if (msg.type === 'partial' && msg.data) {
          this.onPartial(msg.data);
        } else if (msg.type === 'complete') {
          worker.removeEventListener('message', handler);
          resolve();
        } else if (msg.type === 'error') {
          worker.removeEventListener('message', handler);
          reject(new Error(msg.message));
        }
      };
      worker.addEventListener('message', handler);

      // Copy buffers for transfer (postMessage transfers ownership)
      const left = new Float32Array(leftChannel ?? audioData);
      const right = new Float32Array(rightChannel ?? audioData);
      worker.postMessage(
        { type: 'analyze', leftChannel: left, rightChannel: right, sampleRate },
        [left.buffer, right.buffer],
      );
    });
  }
}
