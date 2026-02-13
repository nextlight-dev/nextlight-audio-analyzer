import { useCallback, useState } from 'react';
import { DropZone } from './DropZone';
import { ProgressBar } from './ProgressBar';
import { WaveformPlayer } from './WaveformPlayer';
import { useAudioFile, audioBufferToMono, getFileFormat, getOriginalSampleRate } from '../hooks/useAudioFile';
import { useBpmKeyAnalysis } from '../hooks/useBpmKeyAnalysis';
import type { FileInfo } from '../analysis/types';

const KEY_DISPLAY: Record<string, string> = {
  C: 'C', 'C#': 'C#/Db', D: 'D', 'D#': 'D#/Eb', E: 'E', F: 'F',
  'F#': 'F#/Gb', G: 'G', 'G#': 'G#/Ab', A: 'A', 'A#': 'A#/Bb', B: 'B',
  Db: 'C#/Db', Eb: 'D#/Eb', Gb: 'F#/Gb', Ab: 'G#/Ab', Bb: 'A#/Bb',
};

const SCALE_DISPLAY: Record<string, string> = {
  major: 'Major',
  minor: 'Minor',
};

function roundBpm(bpm: number): number {
  if (bpm <= 0) return 0;
  // 整数BPMに丸める（音楽制作では整数BPMが標準）
  return Math.round(bpm);
}

function formatBpm(bpm: number): string {
  if (bpm <= 0) return '---';
  return String(roundBpm(bpm));
}

function bpmComment(bpm: number): string {
  if (bpm <= 0) return '';
  if (bpm < 70) return 'Very Slow — バラード、アンビエント向き';
  if (bpm < 100) return 'Slow — バラード、R&B向き';
  if (bpm < 120) return 'Moderate — Pop、Hip-Hop向き';
  if (bpm < 140) return 'Upbeat — Pop、Dance向き';
  if (bpm < 160) return 'Fast — EDM、Rock向き';
  return 'Very Fast — Drum & Bass、ハードコア向き';
}

// BPM confidence: RhythmExtractor2013 のビート強度スコア（0〜5+）
function bpmConfidenceLabel(c: number): { text: string; className: string } {
  if (c >= 3) return { text: '高信頼度', className: 'safe' };
  if (c >= 1.5) return { text: '中信頼度', className: 'warning' };
  return { text: '低信頼度', className: 'danger' };
}

// Key strength: 0〜1 の確率値
function keyStrengthLabel(s: number): { text: string; className: string } {
  if (s >= 0.7) return { text: '高信頼度', className: 'safe' };
  if (s >= 0.4) return { text: '中信頼度', className: 'warning' };
  return { text: '低信頼度', className: 'danger' };
}

export function BpmKeyView() {
  const { file, isDecoding, decode } = useAudioFile();
  const { progress, result, isAnalyzing, error, analyze } = useBpmKeyAnalysis();
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [monoData, setMonoData] = useState<Float32Array | null>(null);

  const handleFile = useCallback(async (f: File) => {
    try {
      const [buf, originalSR] = await Promise.all([
        decode(f),
        getOriginalSampleRate(f),
      ]);
      const mono = audioBufferToMono(buf);
      setMonoData(mono);

      const info: FileInfo = {
        name: f.name,
        duration: buf.duration,
        sampleRate: originalSR,
        channels: buf.numberOfChannels,
        format: getFileFormat(f.name),
      };
      setFileInfo(info);

      analyze(mono, buf.sampleRate);
    } catch {
      // Error is already set in useAudioFile
    }
  }, [decode, analyze]);

  const isProcessing = isDecoding || isAnalyzing;

  const keyDisplay = result?.key ? (KEY_DISPLAY[result.key] ?? result.key) : '---';
  const scaleDisplay = result?.scale ? (SCALE_DISPLAY[result.scale] ?? result.scale) : '';
  const keyStrength = result ? keyStrengthLabel(result.keyStrength) : null;
  const bpmStrength = result ? bpmConfidenceLabel(result.bpmConfidence) : null;

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

      {result && (
        <div className="bpmkey-results">
          <div className="bpmkey-hero">
            <div className="bpmkey-hero-item">
              <div className="bpmkey-hero-label">BPM</div>
              <div className="bpmkey-hero-value bpmkey-bpm">{formatBpm(result.bpm)}</div>
              {result.bpm > 0 && (
                <>
                  <div className="bpmkey-hero-comment">{bpmComment(roundBpm(result.bpm))}</div>
                  {bpmStrength && (
                    <div className={`bpmkey-hero-comment badge-inline badge-${bpmStrength.className}`}>
                      {bpmStrength.text}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="bpmkey-hero-divider" />
            <div className="bpmkey-hero-item">
              <div className="bpmkey-hero-label">Key</div>
              <div className="bpmkey-hero-value bpmkey-key">
                {keyDisplay}
                {scaleDisplay && <span className="bpmkey-scale">{scaleDisplay}</span>}
              </div>
              {keyStrength && (
                <div className={`bpmkey-hero-comment badge-inline badge-${keyStrength.className}`}>
                  {keyStrength.text} ({(result.keyStrength * 100).toFixed(0)}%)
                </div>
              )}
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-title">詳細情報</div>
            <div className="metric-grid">
              <div className="metric">
                <div className="metric-label">ファイル名</div>
                <div className="metric-value" style={{ fontSize: '0.85rem' }}>{fileInfo?.name ?? '---'}</div>
              </div>
              <div className="metric">
                <div className="metric-label">長さ</div>
                <div className="metric-value">{fileInfo ? formatDuration(fileInfo.duration) : '---'}</div>
              </div>
              <div className="metric">
                <div className="metric-label">サンプルレート</div>
                <div className="metric-value">{fileInfo ? `${(fileInfo.sampleRate / 1000).toFixed(1)} kHz` : '---'}</div>
              </div>
              <div className="metric">
                <div className="metric-label">フォーマット</div>
                <div className="metric-value">{fileInfo?.format ?? '---'}</div>
              </div>
              <div className="metric">
                <div className="metric-label">BPM (raw)</div>
                <div className="metric-value">{result.bpm > 0 ? result.bpm.toFixed(2) : '---'}</div>
              </div>
              <div className="metric">
                <div className="metric-label">BPM信頼度</div>
                <div className="metric-value">{result.bpmConfidence.toFixed(2)}</div>
              </div>
              <div className="metric">
                <div className="metric-label">Key信頼度</div>
                <div className="metric-value">{(result.keyStrength * 100).toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
