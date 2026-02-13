/* eslint-disable @typescript-eslint/no-explicit-any */

let essentia: any = null;
let EssentiaModule: any = null;

async function initEssentia() {
  const wasmModule = await import('essentia.js/dist/essentia-wasm.es.js');
  const coreModule = await import('essentia.js/dist/essentia.js-core.es.js');
  const Essentia = coreModule.default || coreModule;

  const RawModule: any = wasmModule.EssentiaWASM || wasmModule.default || wasmModule;

  if (RawModule.ready && typeof RawModule.ready.then === 'function') {
    EssentiaModule = await RawModule.ready;
  } else if (typeof RawModule === 'function') {
    EssentiaModule = await RawModule();
  } else {
    EssentiaModule = RawModule;
  }

  essentia = new Essentia(EssentiaModule);
  return essentia.version;
}

function postProgress(phase: string, percent: number, label: string) {
  self.postMessage({ type: 'progress', phase, percent, label });
}

function postPartial(data: any) {
  self.postMessage({ type: 'partial', data });
}

function computeTruePeak(left: Float32Array, right: Float32Array): number {
  // 4x oversampling via cubic Hermite interpolation (ITU-R BS.1770)
  // Only interpolate near sample-level peaks
  let maxSample = 0;
  const channels = [left, right];

  for (const samples of channels) {
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > maxSample) maxSample = abs;
    }
  }

  if (maxSample === 0) return -Infinity;

  const threshold = maxSample * 0.707;
  let maxAbs = maxSample;

  for (const samples of channels) {
    for (let i = 1; i < samples.length - 2; i++) {
      if (Math.abs(samples[i]) < threshold && Math.abs(samples[i + 1]) < threshold) continue;

      const y0 = samples[i - 1];
      const y1 = samples[i];
      const y2 = samples[i + 1];
      const y3 = samples[i + 2];
      const a = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
      const b = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
      const c = -0.5 * y0 + 0.5 * y2;
      const d = y1;
      for (const t of [0.25, 0.5, 0.75]) {
        const val = ((a * t + b) * t + c) * t + d;
        const abs = Math.abs(val);
        if (abs > maxAbs) maxAbs = abs;
      }
    }
  }
  return 20 * Math.log10(maxAbs);
}

function runAnalysis(sampleRate: number, leftChannel: Float32Array, rightChannel: Float32Array) {
  postProgress('phase1', 5, 'LUFS解析中...');

  // EBU R128 Loudness
  const leftVector = essentia.arrayToVector(leftChannel);
  const rightVector = essentia.arrayToVector(rightChannel);
  let ebuResult: any = null;
  try {
    ebuResult = essentia.LoudnessEBUR128(leftVector, rightVector, 0.1, sampleRate, false);
  } catch (e) {
    console.warn('LoudnessEBUR128 failed:', e);
  }

  let integratedLUFS = -Infinity;
  let loudnessRange = 0;
  let momentaryLoudness: number[] = [];
  let shortTermLoudness: number[] = [];

  if (ebuResult) {
    integratedLUFS = ebuResult.integratedLoudness ?? -Infinity;
    loudnessRange = ebuResult.loudnessRange ?? 0;
    if (ebuResult.momentaryLoudness) {
      momentaryLoudness = Array.from(essentia.vectorToArray(ebuResult.momentaryLoudness)) as number[];
      ebuResult.momentaryLoudness.delete();
    }
    if (ebuResult.shortTermLoudness) {
      shortTermLoudness = Array.from(essentia.vectorToArray(ebuResult.shortTermLoudness)) as number[];
      ebuResult.shortTermLoudness.delete();
    }
  }
  leftVector.delete();
  rightVector.delete();

  postProgress('phase1', 40, 'True Peak解析中...');

  // True Peak (4x oversampled)
  const truePeakDBTP = computeTruePeak(leftChannel, rightChannel);

  // Stereo width (Mid/Side ratio)
  const len = Math.min(leftChannel.length, rightChannel.length);
  let midSumSq = 0, sideSumSq = 0;
  for (let i = 0; i < len; i++) {
    const mid = (leftChannel[i] + rightChannel[i]) * 0.5;
    const side = (leftChannel[i] - rightChannel[i]) * 0.5;
    midSumSq += mid * mid;
    sideSumSq += side * side;
  }
  const midRMS = Math.sqrt(midSumSq / len);
  const sideRMS = Math.sqrt(sideSumSq / len);
  const stereoWidth = midRMS > 0 ? sideRMS / midRMS : 0;

  postProgress('phase1', 70, '解析結果まとめ中...');

  postPartial({
    loudness: { integratedLUFS, loudnessRange, truePeakDBTP, momentaryLoudness, shortTermLoudness },
    stereo: { width: stereoWidth },
  });
}

function runQualityCheck(audioData: Float32Array, sampleRate: number) {
  const THRESHOLD = 0.001;

  const startAmplitude = Math.abs(audioData[0] ?? 0);
  const endAmplitude = Math.abs(audioData[audioData.length - 1] ?? 0);

  let headSilenceSamples = 0;
  for (let i = 0; i < audioData.length; i++) {
    if (Math.abs(audioData[i]) > THRESHOLD) break;
    headSilenceSamples++;
  }

  let tailSilenceSamples = 0;
  for (let i = audioData.length - 1; i >= 0; i--) {
    if (Math.abs(audioData[i]) > THRESHOLD) break;
    tailSilenceSamples++;
  }

  postPartial({
    quality: {
      startAmplitude, endAmplitude,
      startIsZero: startAmplitude < THRESHOLD,
      endIsZero: endAmplitude < THRESHOLD,
      headSilence: headSilenceSamples / sampleRate,
      tailSilence: tailSilenceSamples / sampleRate,
    },
  });
}

self.onmessage = async (event: MessageEvent) => {
  const { type, audioData, leftChannel, rightChannel, sampleRate } = event.data;

  if (type === 'init') {
    try {
      const version = await initEssentia();
      self.postMessage({ type: 'ready', version });
    } catch (e: any) {
      self.postMessage({ type: 'error', message: `WASM初期化エラー: ${e.message}` });
    }
    return;
  }

  if (type === 'analyze' && sampleRate) {
    try {
      const left: Float32Array = leftChannel ?? audioData;
      const right: Float32Array = rightChannel ?? left;

      runAnalysis(sampleRate, left, right);
      runQualityCheck(left, sampleRate);

      postProgress('done', 100, '解析完了');
      self.postMessage({ type: 'complete' });
    } catch (e: any) {
      self.postMessage({ type: 'error', message: `解析エラー: ${e.message}` });
    }
  }
};
