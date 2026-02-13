declare module 'essentia.js/dist/essentia.js-core.es.js' {
  class Essentia {
    constructor(wasmModule: unknown);
    version: string;
    algorithmNames: string[];
    arrayToVector(arr: Float32Array): EssentiaVector;
    vectorToArray(vec: EssentiaVector): Float32Array;
    shutdown(): void;
    reinstantiate(): void;
    PercivalBpmEstimator(signal: EssentiaVector): { bpm: number };
    KeyExtractor(signal: EssentiaVector, ...args: unknown[]): { key: string; scale: string; strength: number };
    Loudness(signal: EssentiaVector): { loudness: number };
    DynamicComplexity(signal: EssentiaVector, ...args: unknown[]): { dynamicComplexity: number; loudness: number };
    BeatTrackerMultiFeature(signal: EssentiaVector, ...args: unknown[]): { ticks: EssentiaVector; confidence: number };
    Danceability(signal: EssentiaVector, ...args: unknown[]): { danceability: number };
    OnsetRate(signal: EssentiaVector, ...args: unknown[]): { onsets: EssentiaVector; onsetRate: number };
    Windowing(frame: EssentiaVector, normalized?: boolean, size?: number, type?: string, ...args: unknown[]): { frame: EssentiaVector };
    Spectrum(frame: EssentiaVector, ...args: unknown[]): { spectrum: EssentiaVector };
    SpectralPeaks(spectrum: EssentiaVector, ...args: unknown[]): { frequencies: EssentiaVector; magnitudes: EssentiaVector };
    HPCP(frequencies: EssentiaVector, magnitudes: EssentiaVector, ...args: unknown[]): { hpcp: EssentiaVector };
    Centroid(spectrum: EssentiaVector, ...args: unknown[]): { centroid: number };
    RollOff(spectrum: EssentiaVector, cutoff?: number, ...args: unknown[]): { rollOff: number };
    MFCC(spectrum: EssentiaVector, ...args: unknown[]): { bands: EssentiaVector; mfcc: EssentiaVector };
    SilenceRate(signal: EssentiaVector, ...args: unknown[]): { threshold_0: number; threshold_1: number; threshold_2: number };
    [key: string]: unknown;
  }

  interface EssentiaVector {
    size: number;
    get(i: number): number;
    delete(): void;
  }

  export default Essentia;
}

declare module 'essentia.js/dist/essentia-wasm.es.js' {
  function EssentiaWASM(): Promise<unknown>;
  export default EssentiaWASM;
  export { EssentiaWASM };
}

declare module 'essentia.js/dist/essentia-wasm.web.js' {
  function EssentiaWASM(): Promise<unknown>;
  export default EssentiaWASM;
}
