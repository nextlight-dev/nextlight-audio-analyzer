import type { AnalysisResult, FileInfo } from '../analysis/types';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

function Label({ text, tip }: { text: string; tip: string }) {
  return (
    <div className="metric-label">
      {text}
      <span className="metric-help" data-tip={tip}>?</span>
    </div>
  );
}

const DASH = '—';

interface Props {
  result?: AnalysisResult | null;
  fileInfo?: FileInfo | null;
}

export function AnalysisPanel({ result, fileInfo }: Props) {
  const loudness = result?.loudness ?? null;
  const stereo = result?.stereo ?? null;
  const quality = result?.quality ?? null;

  const lufsColor = loudness
    ? (loudness.integratedLUFS > -8 ? 'var(--danger)'
      : loudness.integratedLUFS > -14 ? 'var(--warning)'
      : 'var(--success)')
    : undefined;

  const tpColor = loudness
    ? (loudness.truePeakDBTP > -1.0 ? 'var(--danger)'
      : loudness.truePeakDBTP > -2.0 ? 'var(--warning)'
      : 'var(--text-primary)')
    : undefined;

  const widthPercent = stereo ? Math.min(stereo.width * 100, 200) : null;
  const widthLabel = stereo
    ? (stereo.width < 0.05 ? 'Mono'
      : stereo.width < 0.3 ? 'Narrow'
      : stereo.width < 0.7 ? 'Moderate'
      : stereo.width < 1.0 ? 'Wide'
      : 'Very Wide')
    : '';

  // 警告収集
  const warnings: { level: 'danger' | 'warning'; msg: string }[] = [];
  if (loudness) {
    if (loudness.truePeakDBTP > 0) {
      warnings.push({ level: 'danger', msg: `True Peak が 0 dBTP を超過 (${loudness.truePeakDBTP.toFixed(1)} dBTP) — クリッピングの可能性` });
    } else if (loudness.truePeakDBTP > -1.0) {
      warnings.push({ level: 'danger', msg: `True Peak が -1.0 dBTP を超過 (${loudness.truePeakDBTP.toFixed(1)} dBTP) — 配信規格を満たしません` });
    }
    if (loudness.integratedLUFS > -8) {
      warnings.push({ level: 'danger', msg: `Integrated LUFS が非常に高い (${loudness.integratedLUFS.toFixed(1)} LUFS) — 過度なコンプレッション` });
    } else if (loudness.integratedLUFS > -14) {
      warnings.push({ level: 'warning', msg: `Integrated LUFS がストリーミング推奨値 (-14 LUFS) を超過 (${loudness.integratedLUFS.toFixed(1)} LUFS)` });
    }
    if (loudness.loudnessRange < 3) {
      warnings.push({ level: 'warning', msg: `Loudness Range が非常に狭い (${loudness.loudnessRange.toFixed(1)} LU) — ダイナミクス不足` });
    }
  }
  if (quality) {
    if (!quality.startIsZero) {
      warnings.push({ level: 'warning', msg: `先頭サンプルが非ゼロ (${quality.startAmplitude.toFixed(4)}) — クリックノイズの原因に` });
    }
    if (!quality.endIsZero) {
      warnings.push({ level: 'warning', msg: `末尾サンプルが非ゼロ (${quality.endAmplitude.toFixed(4)}) — クリックノイズの原因に` });
    }
    if (quality.headSilence > 0.5) {
      warnings.push({ level: 'warning', msg: `冒頭に ${quality.headSilence.toFixed(2)} 秒の無音区間` });
    }
    if (quality.tailSilence > 2.0) {
      warnings.push({ level: 'warning', msg: `末尾に ${quality.tailSilence.toFixed(2)} 秒の無音区間` });
    }
  }

  return (
    <div className="panel">
      {/* ── 警告 ── */}
      {warnings.length > 0 && (
        <section className="panel-section">
          <div className="panel-title">警告</div>
          <ul className="warning-list">
            {warnings.map((w, i) => (
              <li key={i} className={`warning-item warning-${w.level}`}>{w.msg}</li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 基本情報 ── */}
      <section className="panel-section">
        <div className="panel-title">基本情報</div>
        <div className="metric-grid">
          <div className="metric">
            <Label text="長さ" tip="オーディオファイルの総再生時間" />
            <div className="metric-value small">{fileInfo ? formatDuration(fileInfo.duration) : DASH}</div>
          </div>
          <div className="metric">
            <Label text="サンプルレート" tip="1秒あたりのサンプル数。値が高いほど高音質" />
            <div className="metric-value small">
              {fileInfo ? <>{fileInfo.sampleRate.toLocaleString()}<span className="metric-unit">Hz</span></> : DASH}
            </div>
          </div>
          <div className="metric">
            <Label text="チャンネル" tip="Mono: 1チャンネル、Stereo: 左右2チャンネル" />
            <div className="metric-value small">{fileInfo ? (fileInfo.channels === 1 ? 'Mono' : 'Stereo') : DASH}</div>
          </div>
          <div className="metric">
            <Label text="フォーマット" tip="オーディオファイルの形式（WAV, MP3, FLAC等）" />
            <div className="metric-value small">{fileInfo?.format ?? DASH}</div>
          </div>
        </div>
      </section>

      {/* ── オーディオ解析 ── */}
      <section className="panel-section">
        <div className="panel-title">オーディオ解析</div>
        <div className="metric-grid">
          <div className="metric">
            <Label text="Integrated (EBU R128)" tip="EBU R128規格に基づく統合ラウドネス。楽曲全体の平均的な音量を示す" />
            <div className="metric-value" style={{ color: lufsColor }}>
              {loudness ? (isFinite(loudness.integratedLUFS) ? loudness.integratedLUFS.toFixed(1) : '---') : DASH}
              {loudness && <span className="metric-unit">LUFS</span>}
            </div>
          </div>
          <div className="metric">
            <Label text="True Peak" tip="4倍オーバーサンプリングによる真のピーク値。DA変換時の実際の最大振幅" />
            <div className="metric-value" style={{ color: tpColor }}>
              {loudness ? (isFinite(loudness.truePeakDBTP) ? loudness.truePeakDBTP.toFixed(1) : '---') : DASH}
              {loudness && <span className="metric-unit">dBTP</span>}
            </div>
            {loudness && loudness.truePeakDBTP > -1.0 && (
              <div className="metric-sub" style={{ color: 'var(--danger)' }}>Exceeds -1.0 dBTP</div>
            )}
          </div>
          <div className="metric">
            <Label text="Loudness Range" tip="楽曲内の音量変動幅。値が大きいほどダイナミクスが豊か" />
            <div className="metric-value small">
              {loudness ? <>{loudness.loudnessRange.toFixed(1)}<span className="metric-unit">LU</span></> : DASH}
            </div>
          </div>
          <div className="metric">
            <Label text="Stereo Width" tip="ステレオの広がり。Mid/Side比率で算出。0%=モノラル、100%=フルステレオ" />
            <div className="metric-value">
              {widthPercent != null ? <>{widthPercent.toFixed(1)}<span className="metric-unit">%</span></> : DASH}
            </div>
            {widthLabel && <div className="metric-sub">{widthLabel}</div>}
          </div>
        </div>
      </section>

      {/* ── クオリティチェック ── */}
      <section className="panel-section">
        <div className="panel-title">クオリティチェック</div>
        <div className="metric-grid">
          <div className="metric">
            <Label text="先頭サンプル" tip="最初のサンプルがゼロか確認。非ゼロだとクリックノイズの原因に" />
            <div className="metric-value small">
              {quality
                ? (quality.startIsZero
                  ? <span style={{ color: 'var(--success)' }}>OK</span>
                  : <span style={{ color: 'var(--warning)' }}>注意: {quality.startAmplitude.toFixed(4)}</span>)
                : DASH
              }
            </div>
          </div>
          <div className="metric">
            <Label text="末尾サンプル" tip="最後のサンプルがゼロか確認。非ゼロだとクリックノイズの原因に" />
            <div className="metric-value small">
              {quality
                ? (quality.endIsZero
                  ? <span style={{ color: 'var(--success)' }}>OK</span>
                  : <span style={{ color: 'var(--warning)' }}>注意: {quality.endAmplitude.toFixed(4)}</span>)
                : DASH
              }
            </div>
          </div>
          <div className="metric">
            <Label text="冒頭無音" tip="ファイル先頭の無音区間の長さ" />
            <div className="metric-value small">
              {quality ? <>{quality.headSilence.toFixed(3)}<span className="metric-unit">秒</span></> : DASH}
            </div>
          </div>
          <div className="metric">
            <Label text="末尾無音" tip="ファイル末尾の無音区間の長さ" />
            <div className="metric-value small">
              {quality ? <>{quality.tailSilence.toFixed(3)}<span className="metric-unit">秒</span></> : DASH}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
