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

function runBpmKeyAnalysis(audioData: Float32Array, sampleRate: number) {
  postProgress('phase1', 10, 'BPM解析中...');

  const signal = essentia.arrayToVector(audioData);

  // ── BPM detection ──
  // RhythmExtractor2013 を第一候補（信頼度付き）
  let bpm = 0;
  let bpmConfidence = 0;
  try {
    const rhythmResult = essentia.RhythmExtractor2013(signal, 208, 'multifeature', 40);
    bpm = rhythmResult.bpm ?? 0;
    bpmConfidence = rhythmResult.confidence ?? 0;
    if (rhythmResult.ticks) rhythmResult.ticks.delete();
    if (rhythmResult.estimates) rhythmResult.estimates.delete();
    if (rhythmResult.bpmIntervals) rhythmResult.bpmIntervals.delete();
  } catch (e) {
    console.warn('RhythmExtractor2013 failed, trying PercivalBpmEstimator:', e);
    try {
      const bpmResult = essentia.PercivalBpmEstimator(signal, 1024, 2048, 128, 128, 210, 50, sampleRate);
      bpm = bpmResult.bpm ?? 0;
    } catch (e2) {
      console.warn('PercivalBpmEstimator also failed:', e2);
    }
  }

  postProgress('phase1', 50, 'Key解析中...');

  // ── Key detection ──
  // KeyExtractor: 正しいパラメータ順序で呼び出し
  // KeyExtractor(audio, averageDetuningCorrection, frameSize, hopSize, hpcpSize,
  //   maxFrequency, maximumSpectralPeaks, minFrequency, pcpThreshold,
  //   profileType, sampleRate, spectralPeaksThreshold, tuningFrequency,
  //   weightType, windowType)
  let key = '';
  let scale = '';
  let keyStrength = 0;
  try {
    const keyResult = essentia.KeyExtractor(
      signal,
      true,       // averageDetuningCorrection
      4096,       // frameSize
      4096,       // hopSize
      12,         // hpcpSize
      3500,       // maxFrequency
      60,         // maximumSpectralPeaks
      25,         // minFrequency
      0.2,        // pcpThreshold
      'bgate',    // profileType
      sampleRate, // sampleRate
      0.0001,     // spectralPeaksThreshold (was 0.5 — too high!)
      440,        // tuningFrequency (was 500 — wrong!)
      'cosine',   // weightType
      'hann',     // windowType (was 'cosine' — invalid!)
    );
    key = keyResult.key ?? '';
    scale = keyResult.scale ?? '';
    keyStrength = keyResult.strength ?? 0;
  } catch (e) {
    console.warn('KeyExtractor failed, trying frame-by-frame HPCP+Key:', e);
    try {
      // Fallback: フレーム単位で HPCP を計算して平均 → Key
      const frameSize = 4096;
      const hopSize = 2048;
      const numFrames = Math.floor((audioData.length - frameSize) / hopSize) + 1;
      const hpcpSize = 12;
      const avgHpcp = new Float32Array(hpcpSize);
      let validFrames = 0;

      for (let f = 0; f < numFrames; f++) {
        const start = f * hopSize;
        const frameData = audioData.slice(start, start + frameSize);

        // Apply Hann window
        for (let i = 0; i < frameData.length; i++) {
          frameData[i] *= 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameData.length - 1)));
        }

        const frameVec = essentia.arrayToVector(frameData);
        const spec = essentia.Spectrum(frameVec);
        const peaks = essentia.SpectralPeaks(spec.spectrum);
        const hpcp = essentia.HPCP(peaks.frequencies, peaks.magnitudes,
          true, 500, 0, 5000, false, 40, false, 'unitMax', 440, sampleRate, hpcpSize, 'squaredCosine', 1);

        const hpcpArr = essentia.vectorToArray(hpcp.hpcp);
        for (let i = 0; i < hpcpSize; i++) {
          avgHpcp[i] += hpcpArr[i];
        }
        validFrames++;

        frameVec.delete();
        spec.spectrum.delete();
        peaks.frequencies.delete();
        peaks.magnitudes.delete();
        hpcp.hpcp.delete();

        // 進捗更新（重いので間引き）
        if (f % 50 === 0) {
          postProgress('phase1', 50 + Math.round((f / numFrames) * 30), 'HPCP計算中...');
        }
      }

      if (validFrames > 0) {
        for (let i = 0; i < hpcpSize; i++) {
          avgHpcp[i] /= validFrames;
        }
        const avgVec = essentia.arrayToVector(avgHpcp);
        const keyOut = essentia.Key(avgVec, 4, 36, 'bgate', 0.6, false, true, true);
        key = keyOut.key ?? '';
        scale = keyOut.scale ?? '';
        keyStrength = keyOut.strength ?? 0;
        avgVec.delete();
      }
    } catch (e2) {
      console.warn('Frame-by-frame HPCP+Key also failed:', e2);
    }
  }

  signal.delete();
  postProgress('phase1', 90, '結果まとめ中...');

  self.postMessage({
    type: 'bpmKeyComplete',
    bpmKeyData: { bpm, bpmConfidence, key, scale, keyStrength },
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

  if (type === 'analyzeBpmKey' && audioData && sampleRate) {
    try {
      runBpmKeyAnalysis(audioData, sampleRate);
      postProgress('done', 100, '解析完了');
      self.postMessage({ type: 'complete' });
    } catch (e: any) {
      self.postMessage({ type: 'error', message: `BPM/Key解析エラー: ${e.message}` });
    }
  }
};
