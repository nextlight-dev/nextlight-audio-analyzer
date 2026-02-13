import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioAnalyzer } from '../analysis/analyzer';
import type { AnalysisResult, ProgressState } from '../analysis/types';

export function useAnalysis() {
  const [progress, setProgress] = useState<ProgressState>({
    phase: 'init',
    percent: 0,
    label: '',
  });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);

  function getAnalyzer() {
    if (!analyzerRef.current) {
      analyzerRef.current = new AudioAnalyzer(
        (phase, percent, label) => {
          setProgress({ phase: phase as ProgressState['phase'], percent, label });
        },
        (partial) => {
          setResult(prev => {
            const base = prev ?? {
              fileInfo: { name: '', duration: 0, sampleRate: 0, channels: 0, format: '' },
              loudness: null,
              stereo: null,
              quality: null,
            };
            return { ...base, ...partial };
          });
        },
      );
    }
    return analyzerRef.current;
  }

  // ページ表示時にWASMを先読み
  useEffect(() => {
    getAnalyzer().init();
  }, []);

  const analyze = useCallback(async (audioData: Float32Array, sampleRate: number, leftChannel?: Float32Array, rightChannel?: Float32Array) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setProgress({ phase: 'init', percent: 0, label: 'WASM読み込み中...' });

    const analyzer = getAnalyzer();

    try {
      await analyzer.init(); // 先読み済みなら即resolve
      setProgress({ phase: 'phase1', percent: 5, label: '解析開始...' });
      await analyzer.analyze(audioData, sampleRate, leftChannel, rightChannel);
      setProgress({ phase: 'done', percent: 100, label: '解析完了' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '解析に失敗しました';
      setError(msg);
      setProgress({ phase: 'error', percent: 0, label: msg });
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  return { progress, result, isAnalyzing, error, analyze };
}
