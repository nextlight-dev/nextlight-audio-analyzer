import { useCallback, useState } from 'react';
import { DropZone } from './DropZone';
import { ProgressBar } from './ProgressBar';
import { WaveformPlayer } from './WaveformPlayer';
import { RefLoudnessChart } from '../charts/RefLoudnessChart';
import { useAudioFile, audioBufferToMono, getFileFormat, getOriginalSampleRate } from '../hooks/useAudioFile';
import { useAnalysis } from '../hooks/useAnalysis';
import type { FileInfo, ProgressState } from '../analysis/types';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

const DASH = '—';

function DiffBadge({ a, b, unit, precision = 1 }: { a: number | null; b: number | null; unit?: string; precision?: number }) {
  if (a == null || b == null) return null;
  const diff = a - b;
  const sign = diff > 0 ? '+' : '';
  const level = Math.abs(diff) < 0.05 ? 'neutral' : diff > 0 ? 'plus' : 'minus';
  return (
    <span className={`ref-diff ref-diff-${level}`}>
      {sign}{diff.toFixed(precision)}{unit ? ` ${unit}` : ''}
    </span>
  );
}

function StrDiffBadge({ a, b }: { a: string | null; b: string | null }) {
  if (!a || !b) return null;
  return (
    <span className={`ref-diff ${a === b ? 'ref-diff-neutral' : 'ref-diff-differ'}`}>
      {a === b ? '同一' : '異なる'}
    </span>
  );
}

export function ReferenceView() {
  const audioA = useAudioFile();
  const analysisA = useAnalysis();
  const [trackA, setTrackA] = useState<{ file: File | null; fileInfo: FileInfo | null; monoData: Float32Array | null }>({ file: null, fileInfo: null, monoData: null });

  const audioB = useAudioFile();
  const analysisB = useAnalysis();
  const [trackB, setTrackB] = useState<{ file: File | null; fileInfo: FileInfo | null; monoData: Float32Array | null }>({ file: null, fileInfo: null, monoData: null });

  const handleFileA = useCallback(async (f: File) => {
    try {
      const [buf, originalSR] = await Promise.all([audioA.decode(f), getOriginalSampleRate(f)]);
      const mono = audioBufferToMono(buf);
      const left = buf.getChannelData(0);
      const right = buf.numberOfChannels > 1 ? buf.getChannelData(1) : left;
      const info: FileInfo = { name: f.name, duration: buf.duration, sampleRate: originalSR, channels: buf.numberOfChannels, format: getFileFormat(f.name) };
      setTrackA({ file: f, fileInfo: info, monoData: mono });
      analysisA.analyze(mono, buf.sampleRate, left, right);
    } catch { /* error in useAudioFile */ }
  }, [audioA, analysisA]);

  const handleFileB = useCallback(async (f: File) => {
    try {
      const [buf, originalSR] = await Promise.all([audioB.decode(f), getOriginalSampleRate(f)]);
      const mono = audioBufferToMono(buf);
      const left = buf.getChannelData(0);
      const right = buf.numberOfChannels > 1 ? buf.getChannelData(1) : left;
      const info: FileInfo = { name: f.name, duration: buf.duration, sampleRate: originalSR, channels: buf.numberOfChannels, format: getFileFormat(f.name) };
      setTrackB({ file: f, fileInfo: info, monoData: mono });
      analysisB.analyze(mono, buf.sampleRate, left, right);
    } catch { /* error in useAudioFile */ }
  }, [audioB, analysisB]);

  const resA = analysisA.result;
  const resB = analysisB.result;
  const infoA = trackA.fileInfo;
  const infoB = trackB.fileInfo;

  const widthA = resA?.stereo ? Math.min(resA.stereo.width * 100, 200) : null;
  const widthB = resB?.stereo ? Math.min(resB.stereo.width * 100, 200) : null;

  const showProgress = (p: ProgressState) => p.phase !== 'init' || p.percent > 0 || !!p.label;

  return (
    <>
      <div className="ref-dropzones">
        <div className="ref-drop-col">
          <div className="ref-drop-label">自分の曲</div>
          <DropZone onFile={handleFileA} disabled={audioA.isDecoding || analysisA.isAnalyzing} />
          {trackA.fileInfo && <div className="file-name-bar">{trackA.fileInfo.name}</div>}
          {showProgress(analysisA.progress) && <ProgressBar progress={analysisA.progress} />}
          <WaveformPlayer file={trackA.file} audioData={trackA.monoData} />
        </div>
        <div className="ref-drop-col">
          <div className="ref-drop-label">リファレンス曲</div>
          <DropZone onFile={handleFileB} disabled={audioB.isDecoding || analysisB.isAnalyzing} />
          {trackB.fileInfo && <div className="file-name-bar">{trackB.fileInfo.name}</div>}
          {showProgress(analysisB.progress) && <ProgressBar progress={analysisB.progress} />}
          <WaveformPlayer file={trackB.file} audioData={trackB.monoData} />
        </div>
      </div>

      {/* ── Momentary Loudness 比較グラフ ── */}
      {(resA?.loudness?.momentaryLoudness || resB?.loudness?.momentaryLoudness) && (
        <RefLoudnessChart
          momentaryA={resA?.loudness?.momentaryLoudness ?? []}
          momentaryB={resB?.loudness?.momentaryLoudness ?? []}
          durationA={infoA?.duration ?? 0}
          durationB={infoB?.duration ?? 0}
        />
      )}

      {(infoA || infoB) && (
        <div className="panel">
          {/* ── 基本情報 ── */}
          <section className="panel-section">
            <div className="panel-title">基本情報</div>
            <div className="metric-grid">
              <div className="metric">
                <div className="metric-label">長さ</div>
                <div className="ref-compare">
                  <div className="ref-val ref-val-mine">
                    <span className="ref-val-label">自分</span>
                    <span className="metric-value">{infoA ? formatDuration(infoA.duration) : DASH}</span>
                  </div>
                  <div className="ref-val ref-val-ref">
                    <span className="ref-val-label">Ref</span>
                    <span className="metric-value">{infoB ? formatDuration(infoB.duration) : DASH}</span>
                  </div>
                </div>
                <DiffBadge a={infoA?.duration ?? null} b={infoB?.duration ?? null} unit="秒" precision={1} />
              </div>
              <div className="metric">
                <div className="metric-label">サンプルレート</div>
                <div className="ref-compare">
                  <div className="ref-val ref-val-mine">
                    <span className="ref-val-label">自分</span>
                    <span className="metric-value">{infoA ? <>{infoA.sampleRate.toLocaleString()}<span className="metric-unit">Hz</span></> : DASH}</span>
                  </div>
                  <div className="ref-val ref-val-ref">
                    <span className="ref-val-label">Ref</span>
                    <span className="metric-value">{infoB ? <>{infoB.sampleRate.toLocaleString()}<span className="metric-unit">Hz</span></> : DASH}</span>
                  </div>
                </div>
                <StrDiffBadge a={infoA ? String(infoA.sampleRate) : null} b={infoB ? String(infoB.sampleRate) : null} />
              </div>
              <div className="metric">
                <div className="metric-label">チャンネル</div>
                <div className="ref-compare">
                  <div className="ref-val ref-val-mine">
                    <span className="ref-val-label">自分</span>
                    <span className="metric-value">{infoA ? (infoA.channels === 1 ? 'Mono' : 'Stereo') : DASH}</span>
                  </div>
                  <div className="ref-val ref-val-ref">
                    <span className="ref-val-label">Ref</span>
                    <span className="metric-value">{infoB ? (infoB.channels === 1 ? 'Mono' : 'Stereo') : DASH}</span>
                  </div>
                </div>
                <StrDiffBadge a={infoA ? String(infoA.channels) : null} b={infoB ? String(infoB.channels) : null} />
              </div>
              <div className="metric">
                <div className="metric-label">フォーマット</div>
                <div className="ref-compare">
                  <div className="ref-val ref-val-mine">
                    <span className="ref-val-label">自分</span>
                    <span className="metric-value">{infoA?.format ?? DASH}</span>
                  </div>
                  <div className="ref-val ref-val-ref">
                    <span className="ref-val-label">Ref</span>
                    <span className="metric-value">{infoB?.format ?? DASH}</span>
                  </div>
                </div>
                <StrDiffBadge a={infoA?.format ?? null} b={infoB?.format ?? null} />
              </div>
            </div>
          </section>

          {/* ── オーディオ解析 ── */}
          {(resA || resB) && (
            <section className="panel-section">
              <div className="panel-title">オーディオ解析</div>
              <div className="metric-grid">
                <div className="metric">
                  <div className="metric-label">Integrated (EBU R128)</div>
                  <div className="ref-compare">
                    <div className="ref-val ref-val-mine">
                      <span className="ref-val-label">自分</span>
                      <span className="metric-value">
                        {resA?.loudness ? <>{resA.loudness.integratedLUFS.toFixed(1)}<span className="metric-unit">LUFS</span></> : DASH}
                      </span>
                    </div>
                    <div className="ref-val ref-val-ref">
                      <span className="ref-val-label">Ref</span>
                      <span className="metric-value">
                        {resB?.loudness ? <>{resB.loudness.integratedLUFS.toFixed(1)}<span className="metric-unit">LUFS</span></> : DASH}
                      </span>
                    </div>
                  </div>
                  <DiffBadge a={resA?.loudness?.integratedLUFS ?? null} b={resB?.loudness?.integratedLUFS ?? null} unit="LUFS" />
                </div>
                <div className="metric">
                  <div className="metric-label">True Peak</div>
                  <div className="ref-compare">
                    <div className="ref-val ref-val-mine">
                      <span className="ref-val-label">自分</span>
                      <span className="metric-value">
                        {resA?.loudness ? <>{resA.loudness.truePeakDBTP.toFixed(1)}<span className="metric-unit">dBTP</span></> : DASH}
                      </span>
                    </div>
                    <div className="ref-val ref-val-ref">
                      <span className="ref-val-label">Ref</span>
                      <span className="metric-value">
                        {resB?.loudness ? <>{resB.loudness.truePeakDBTP.toFixed(1)}<span className="metric-unit">dBTP</span></> : DASH}
                      </span>
                    </div>
                  </div>
                  <DiffBadge a={resA?.loudness?.truePeakDBTP ?? null} b={resB?.loudness?.truePeakDBTP ?? null} unit="dBTP" />
                </div>
                <div className="metric">
                  <div className="metric-label">Loudness Range</div>
                  <div className="ref-compare">
                    <div className="ref-val ref-val-mine">
                      <span className="ref-val-label">自分</span>
                      <span className="metric-value">
                        {resA?.loudness ? <>{resA.loudness.loudnessRange.toFixed(1)}<span className="metric-unit">LU</span></> : DASH}
                      </span>
                    </div>
                    <div className="ref-val ref-val-ref">
                      <span className="ref-val-label">Ref</span>
                      <span className="metric-value">
                        {resB?.loudness ? <>{resB.loudness.loudnessRange.toFixed(1)}<span className="metric-unit">LU</span></> : DASH}
                      </span>
                    </div>
                  </div>
                  <DiffBadge a={resA?.loudness?.loudnessRange ?? null} b={resB?.loudness?.loudnessRange ?? null} unit="LU" />
                </div>
                <div className="metric">
                  <div className="metric-label">Stereo Width</div>
                  <div className="ref-compare">
                    <div className="ref-val ref-val-mine">
                      <span className="ref-val-label">自分</span>
                      <span className="metric-value">
                        {widthA != null ? <>{widthA.toFixed(1)}<span className="metric-unit">%</span></> : DASH}
                      </span>
                    </div>
                    <div className="ref-val ref-val-ref">
                      <span className="ref-val-label">Ref</span>
                      <span className="metric-value">
                        {widthB != null ? <>{widthB.toFixed(1)}<span className="metric-unit">%</span></> : DASH}
                      </span>
                    </div>
                  </div>
                  <DiffBadge a={widthA} b={widthB} unit="%" />
                </div>
              </div>
            </section>
          )}

          {/* ── クオリティチェック ── */}
          {(resA?.quality || resB?.quality) && (
            <section className="panel-section">
              <div className="panel-title">クオリティチェック</div>
              <div className="metric-grid">
                <div className="metric">
                  <div className="metric-label">先頭サンプル</div>
                  <div className="ref-compare">
                    <div className="ref-val ref-val-mine">
                      <span className="ref-val-label">自分</span>
                      <span className="metric-value">{resA?.quality ? (resA.quality.startIsZero ? 'OK' : resA.quality.startAmplitude.toFixed(4)) : DASH}</span>
                    </div>
                    <div className="ref-val ref-val-ref">
                      <span className="ref-val-label">Ref</span>
                      <span className="metric-value">{resB?.quality ? (resB.quality.startIsZero ? 'OK' : resB.quality.startAmplitude.toFixed(4)) : DASH}</span>
                    </div>
                  </div>
                </div>
                <div className="metric">
                  <div className="metric-label">末尾サンプル</div>
                  <div className="ref-compare">
                    <div className="ref-val ref-val-mine">
                      <span className="ref-val-label">自分</span>
                      <span className="metric-value">{resA?.quality ? (resA.quality.endIsZero ? 'OK' : resA.quality.endAmplitude.toFixed(4)) : DASH}</span>
                    </div>
                    <div className="ref-val ref-val-ref">
                      <span className="ref-val-label">Ref</span>
                      <span className="metric-value">{resB?.quality ? (resB.quality.endIsZero ? 'OK' : resB.quality.endAmplitude.toFixed(4)) : DASH}</span>
                    </div>
                  </div>
                </div>
                <div className="metric">
                  <div className="metric-label">冒頭無音</div>
                  <div className="ref-compare">
                    <div className="ref-val ref-val-mine">
                      <span className="ref-val-label">自分</span>
                      <span className="metric-value">{resA?.quality ? <>{resA.quality.headSilence.toFixed(3)}<span className="metric-unit">秒</span></> : DASH}</span>
                    </div>
                    <div className="ref-val ref-val-ref">
                      <span className="ref-val-label">Ref</span>
                      <span className="metric-value">{resB?.quality ? <>{resB.quality.headSilence.toFixed(3)}<span className="metric-unit">秒</span></> : DASH}</span>
                    </div>
                  </div>
                  <DiffBadge a={resA?.quality?.headSilence ?? null} b={resB?.quality?.headSilence ?? null} unit="秒" precision={3} />
                </div>
                <div className="metric">
                  <div className="metric-label">末尾無音</div>
                  <div className="ref-compare">
                    <div className="ref-val ref-val-mine">
                      <span className="ref-val-label">自分</span>
                      <span className="metric-value">{resA?.quality ? <>{resA.quality.tailSilence.toFixed(3)}<span className="metric-unit">秒</span></> : DASH}</span>
                    </div>
                    <div className="ref-val ref-val-ref">
                      <span className="ref-val-label">Ref</span>
                      <span className="metric-value">{resB?.quality ? <>{resB.quality.tailSilence.toFixed(3)}<span className="metric-unit">秒</span></> : DASH}</span>
                    </div>
                  </div>
                  <DiffBadge a={resA?.quality?.tailSilence ?? null} b={resB?.quality?.tailSilence ?? null} unit="秒" precision={3} />
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
