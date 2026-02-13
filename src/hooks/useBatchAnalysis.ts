import { useCallback, useRef, useState } from 'react';
import { AudioAnalyzer } from '../analysis/analyzer';
import { audioBufferToMono, getFileFormat } from './useAudioFile';
import type { AnalysisResult, FileInfo } from '../analysis/types';

export type BatchStatus = 'pending' | 'decoding' | 'analyzing' | 'done' | 'error';

export interface BatchItem {
  id: string;
  file: File;
  fileInfo: FileInfo | null;
  result: AnalysisResult | null;
  status: BatchStatus;
  error: string | null;
}

const MAX_FILES = 20;

export function useBatchAnalysis() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const itemsRef = useRef<BatchItem[]>([]);
  const abortRef = useRef(false);

  // ref を即座に更新してから setState（レンダー待ちなし）
  function updateItems(updater: (prev: BatchItem[]) => BatchItem[]) {
    const next = updater(itemsRef.current);
    itemsRef.current = next;
    setItems(next);
  }

  const addFiles = useCallback((files: File[]) => {
    updateItems(prev => {
      const remaining = MAX_FILES - prev.length;
      const toAdd = files.slice(0, remaining);
      const newItems: BatchItem[] = toAdd.map(file => ({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        fileInfo: null,
        result: null,
        status: 'pending',
        error: null,
      }));
      return [...prev, ...newItems];
    });
  }, []);

  const startAnalysis = useCallback(async () => {
    setIsRunning(true);
    abortRef.current = false;

    const analyzer = new AudioAnalyzer(() => {}, () => {});
    try {
      await analyzer.init();
    } catch {
      setIsRunning(false);
      return;
    }

    // ref から最新の items を取得してループ
    const snapshot = itemsRef.current;

    for (const item of snapshot) {
      if (abortRef.current) break;
      if (item.status !== 'pending') continue;

      updateItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'decoding' } : i));

      try {
        // Decode
        const arrayBuffer = await item.file.arrayBuffer();
        const audioCtx = new AudioContext({ sampleRate: 44100 });
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        await audioCtx.close();

        const fileInfo: FileInfo = {
          name: item.file.name,
          duration: audioBuffer.duration,
          sampleRate: audioBuffer.sampleRate,
          channels: audioBuffer.numberOfChannels,
          format: getFileFormat(item.file.name),
        };

        updateItems(prev => prev.map(i => i.id === item.id ? { ...i, fileInfo, status: 'analyzing' } : i));

        // Analyze
        const mono = audioBufferToMono(audioBuffer);
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left;

        let partialResult: Partial<AnalysisResult> = {};
        const batchAnalyzer = new AudioAnalyzer(
          () => {},
          (partial) => { partialResult = { ...partialResult, ...partial }; },
        );
        await batchAnalyzer.init();
        await batchAnalyzer.analyze(mono, audioBuffer.sampleRate, left, right);

        const fullResult: AnalysisResult = {
          fileInfo,
          loudness: partialResult.loudness ?? null,
          stereo: partialResult.stereo ?? null,
          quality: partialResult.quality ?? null,
        };

        updateItems(prev => prev.map(i => i.id === item.id
          ? { ...i, result: fullResult, status: 'done' }
          : i
        ));
      } catch (e) {
        const msg = e instanceof Error ? e.message : '解析に失敗しました';
        updateItems(prev => prev.map(i => i.id === item.id
          ? { ...i, status: 'error', error: msg }
          : i
        ));
      }
    }

    setIsRunning(false);
  }, []);

  const clear = useCallback(() => {
    abortRef.current = true;
    updateItems(() => []);
    setIsRunning(false);
  }, []);

  const removeItem = useCallback((id: string) => {
    updateItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const doneCount = items.filter(i => i.status === 'done').length;
  const errorCount = items.filter(i => i.status === 'error').length;

  return { items, isRunning, addFiles, startAnalysis, clear, removeItem, doneCount, errorCount, maxFiles: MAX_FILES };
}
