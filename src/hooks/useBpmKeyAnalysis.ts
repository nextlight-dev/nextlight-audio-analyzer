import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioAnalyzer } from '../analysis/analyzer';
import type { BpmKeyResult, ProgressState } from '../analysis/types';

export function useBpmKeyAnalysis() {
  const [progress, setProgress] = useState<ProgressState>({
    phase: 'init',
    percent: 0,
    label: '',
  });
  const [result, setResult] = useState<BpmKeyResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);

  function getAnalyzer() {
    if (!analyzerRef.current) {
      analyzerRef.current = new AudioAnalyzer(
        (phase, percent, label) => {
          setProgress({ phase: phase as ProgressState['phase'], percent, label });
        },
        () => {}, // no partial results for BPM/Key
      );
    }
    return analyzerRef.current;
  }

  useEffect(() => {
    getAnalyzer().init();
  }, []);

  const analyze = useCallback(async (audioData: Float32Array, sampleRate: number) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setProgress({ phase: 'init', percent: 0, label: 'WASM読み込み中...' });

    const analyzer = getAnalyzer();

    try {
      await analyzer.init();
      setProgress({ phase: 'phase1', percent: 5, label: 'BPM/Key解析開始...' });
      const bpmKeyResult = await analyzer.analyzeBpmKey(audioData, sampleRate);
      setResult(bpmKeyResult);
      setProgress({ phase: 'done', percent: 100, label: '解析完了' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'BPM/Key解析に失敗しました';
      setError(msg);
      setProgress({ phase: 'error', percent: 0, label: msg });
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return { progress, result, isAnalyzing, error, analyze };
}
