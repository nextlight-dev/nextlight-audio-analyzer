import { useCallback, useState } from 'react';
import { DropZone } from './DropZone';
import { ProgressBar } from './ProgressBar';
import { WaveformPlayer } from './WaveformPlayer';
import { AnalysisPanel } from './AnalysisPanel';
import { LoudnessTimeChart } from '../charts/LoudnessTimeChart';
import { useAudioFile, audioBufferToMono, getFileFormat } from '../hooks/useAudioFile';
import { useAnalysis } from '../hooks/useAnalysis';
import type { FileInfo } from '../analysis/types';

export function DetailView() {
  const { file, isDecoding, decode } = useAudioFile();
  const { progress, result, isAnalyzing, error, analyze } = useAnalysis();
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [monoData, setMonoData] = useState<Float32Array | null>(null);

  const handleFile = useCallback(async (f: File) => {
    try {
      const buf = await decode(f);
      const mono = audioBufferToMono(buf);
      setMonoData(mono);

      const left = buf.getChannelData(0);
      const right = buf.numberOfChannels > 1 ? buf.getChannelData(1) : left;

      const info: FileInfo = {
        name: f.name,
        duration: buf.duration,
        sampleRate: buf.sampleRate,
        channels: buf.numberOfChannels,
        format: getFileFormat(f.name),
      };
      setFileInfo(info);

      analyze(mono, buf.sampleRate, left, right);
    } catch {
      // Error is already set in useAudioFile
    }
  }, [decode, analyze]);

  const isProcessing = isDecoding || isAnalyzing;

  return (
    <>
      <DropZone onFile={handleFile} disabled={isProcessing} />

      {isProcessing && <ProgressBar progress={isDecoding ? { phase: 'decoding', percent: 0, label: 'デコード中...' } : progress} />}

      {error && (
        <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: 8, marginBottom: 20, color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {fileInfo && <div className="file-name-bar">{fileInfo.name}</div>}

      <WaveformPlayer file={file} audioData={monoData} />

      {result?.loudness && (result.loudness.momentaryLoudness.length > 0 || result.loudness.shortTermLoudness.length > 0) && fileInfo && (
        <div style={{ marginBottom: 20 }}>
          <LoudnessTimeChart
            momentary={result.loudness.momentaryLoudness}
            shortTerm={result.loudness.shortTermLoudness}
            integratedLUFS={result.loudness.integratedLUFS}
            duration={fileInfo.duration}
          />
        </div>
      )}

      <AnalysisPanel result={result} fileInfo={fileInfo} />
    </>
  );
}
