import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useBatchAnalysis, type BatchItem } from '../hooks/useBatchAnalysis';
import { formatDuration } from '../hooks/useAudioFile';

const ACCEPT = '.wav,.mp3,.flac,.ogg,.aac,.m4a,.webm,.opus';

function statusLabel(status: BatchItem['status']): string {
  switch (status) {
    case 'pending': return '待機中';
    case 'decoding': return 'デコード中';
    case 'analyzing': return '解析中';
    case 'done': return '完了';
    case 'error': return 'エラー';
  }
}

function statusClass(status: BatchItem['status']): string {
  switch (status) {
    case 'pending': return 'batch-status-pending';
    case 'decoding':
    case 'analyzing': return 'batch-status-active';
    case 'done': return 'batch-status-done';
    case 'error': return 'batch-status-error';
  }
}

function lufsColor(lufs: number): string {
  if (lufs > -6) return 'var(--danger)';
  if (lufs < -9) return 'var(--warning)';
  return 'var(--success)';
}

function tpColor(tp: number): string {
  if (tp > 1.5) return 'var(--danger)';
  return 'var(--success)';
}

function lrColor(lr: number): string {
  if (lr < 2.5 || lr > 6.0) return 'var(--warning)';
  return 'var(--success)';
}

function swColor(w: number): string {
  if (w < 20 || w > 60) return 'var(--warning)';
  return 'var(--success)';
}

function durationColor(sec: number): string {
  if (sec >= 120 && sec <= 210) return 'var(--success)';
  return 'var(--warning)';
}

export function BatchView() {
  const { items, isRunning, addFiles, startAnalysis, clear, removeItem, doneCount, errorCount, maxFiles } = useBatchAnalysis();
  const [dragover, setDragover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((fileList: FileList) => {
    const files = Array.from(fileList).filter(f =>
      /\.(wav|mp3|flac|ogg|aac|m4a|webm|opus)$/i.test(f.name)
    );
    if (files.length > 0) {
      addFiles(files);
    }
  }, [addFiles]);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragover(false);
    if (isRunning) return;
    handleFiles(e.dataTransfer.files);
  }, [handleFiles, isRunning]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = '';
  }, [handleFiles]);

  const hasPending = items.some(i => i.status === 'pending');
  const canAdd = items.length < maxFiles && !isRunning;

  return (
    <div>
      {/* Drop zone */}
      <div
        className={`dropzone ${dragover ? 'dragover' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragover(true); }}
        onDragLeave={() => setDragover(false)}
        onDrop={handleDrop}
        onClick={() => canAdd && inputRef.current?.click()}
        style={{ opacity: canAdd ? 1 : 0.5, pointerEvents: canAdd ? 'auto' : 'none' }}
      >
        <div className="dropzone-label">
          複数の音源ファイルをドロップ、またはクリックして選択（最大{maxFiles}曲）
        </div>
        <div className="dropzone-hint">
          WAV / MP3 / FLAC / OGG / AAC / M4A 対応
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          onChange={handleChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* Controls */}
      {items.length > 0 && (
        <div className="batch-controls">
          <div className="batch-summary">
            {items.length}曲{isRunning && ` — 解析中...`}
            {!isRunning && doneCount > 0 && ` — ${doneCount}曲完了`}
            {errorCount > 0 && ` / ${errorCount}エラー`}
          </div>
          <div className="batch-actions">
            {hasPending && !isRunning && (
              <button className="batch-btn batch-btn-primary" onClick={startAnalysis}>
                解析開始
              </button>
            )}
            <button className="batch-btn batch-btn-secondary" onClick={clear} disabled={isRunning}>
              クリア
            </button>
          </div>
        </div>
      )}

      {/* Results table */}
      {items.length > 0 && (
        <div className="batch-table-wrap">
          <table className="batch-table">
            <thead>
              <tr>
                <th>#</th>
                <th>ファイル名</th>
                <th>長さ</th>
                <th>LUFS</th>
                <th>True Peak</th>
                <th>LR</th>
                <th>Stereo Width</th>
                <th>状態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const l = item.result?.loudness;
                const s = item.result?.stereo;
                const fi = item.fileInfo;
                return (
                  <tr key={item.id}>
                    <td className="batch-td-num">{idx + 1}</td>
                    <td className="batch-td-name" title={item.file.name}>{item.file.name}</td>
                    <td className="batch-td-mono" style={fi ? { color: durationColor(fi.duration) } : undefined}>{fi ? formatDuration(fi.duration) : '—'}</td>
                    <td className="batch-td-mono" style={l ? { color: lufsColor(l.integratedLUFS) } : undefined}>
                      {l ? (isFinite(l.integratedLUFS) ? l.integratedLUFS.toFixed(1) : '---') : '—'}
                    </td>
                    <td className="batch-td-mono" style={l ? { color: tpColor(l.truePeakDBTP) } : undefined}>
                      {l ? (isFinite(l.truePeakDBTP) ? l.truePeakDBTP.toFixed(1) : '---') : '—'}
                    </td>
                    <td className="batch-td-mono" style={l ? { color: lrColor(l.loudnessRange) } : undefined}>
                      {l ? `${l.loudnessRange.toFixed(1)}` : '—'}
                    </td>
                    <td className="batch-td-mono" style={s ? { color: swColor(Math.min(s.width * 100, 200)) } : undefined}>
                      {s ? `${Math.min(s.width * 100, 200).toFixed(0)}%` : '—'}
                    </td>
                    <td>
                      <span className={`batch-status ${statusClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td>
                      {!isRunning && (
                        <button className="batch-remove" onClick={() => removeItem(item.id)} title="削除">
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
