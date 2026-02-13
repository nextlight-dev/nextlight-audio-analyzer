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

  // 色分け: OK=緑, 警告=黄, NG=赤
  const ok = 'var(--success)';
  const warn = 'var(--warning)';
  const ng = 'var(--danger)';

  // 基本情報
  const durationColor = fileInfo
    ? (fileInfo.duration >= 120 && fileInfo.duration <= 210 ? ok : warn)
    : undefined;
  const srColor = fileInfo
    ? (fileInfo.sampleRate === 48000 ? ok : warn)
    : undefined;
  const chColor = fileInfo
    ? (fileInfo.channels >= 2 ? ok : warn)
    : undefined;
  const fmtColor = fileInfo
    ? (fileInfo.format === 'WAV' ? ok : warn)
    : undefined;

  // オーディオ解析
  const lufsColor = loudness
    ? (loudness.integratedLUFS > -6 ? ng
      : loudness.integratedLUFS < -9 ? warn
      : ok)
    : undefined;
  const tpColor = loudness
    ? (loudness.truePeakDBTP > 1.5 ? ng : ok)
    : undefined;
  const lrColor = loudness
    ? (loudness.loudnessRange < 2.5 || loudness.loudnessRange > 6.0 ? warn : ok)
    : undefined;
  const widthPercent = stereo ? Math.min(stereo.width * 100, 200) : null;
  const swColor = stereo
    ? (widthPercent! < 20 || widthPercent! > 60 ? warn : ok)
    : undefined;

  // クオリティチェック
  const startColor = quality
    ? (quality.startIsZero ? ok : warn)
    : undefined;
  const endColor = quality
    ? (quality.endIsZero ? ok : warn)
    : undefined;
  const headColor = quality
    ? (quality.headSilence > 1.0 ? warn : ok)
    : undefined;
  const tailColor = quality
    ? (quality.tailSilence > 1.0 ? warn : ok)
    : undefined;

  // 分析結果コメント収集
  const comments: { level: 'safe' | 'danger' | 'warning'; msg: string }[] = [];
  if (fileInfo) {
    // 曲の長さ: 2:00 - 3:30
    if (fileInfo.duration < 120) {
      comments.push({ level: 'warning', msg: `曲がちょっと短めかも...! (${formatDuration(fileInfo.duration)}) 2:00〜3:30 くらいが目安` });
    } else if (fileInfo.duration > 210) {
      comments.push({ level: 'warning', msg: `曲がちょっと長めかも...! (${formatDuration(fileInfo.duration)}) 2:00〜3:30 くらいが目安` });
    } else {
      comments.push({ level: 'safe', msg: `曲の長さはいい感じ! (${formatDuration(fileInfo.duration)})` });
    }
    // サンプルレート: 48000Hz
    if (fileInfo.sampleRate !== 48000) {
      comments.push({ level: 'warning', msg: `サンプルレートが ${fileInfo.sampleRate.toLocaleString()} Hz になってる...! 48,000 Hz が推奨` });
    } else {
      comments.push({ level: 'safe', msg: `サンプルレートは 48,000 Hz でOK!` });
    }
    // チャンネル: Stereo
    if (fileInfo.channels < 2) {
      comments.push({ level: 'warning', msg: `モノラルになってるかも...! ステレオが推奨` });
    } else {
      comments.push({ level: 'safe', msg: `ステレオでOK!` });
    }
    // フォーマット: WAV
    if (fileInfo.format !== 'WAV') {
      comments.push({ level: 'warning', msg: `フォーマットが ${fileInfo.format} になってる...! WAV が推奨` });
    } else {
      comments.push({ level: 'safe', msg: `WAV フォーマットでOK!` });
    }
  }
  if (loudness) {
    // LUFS: -9 ~ -6
    if (loudness.integratedLUFS > -6) {
      comments.push({ level: 'danger', msg: `かなり音圧高めかも...! (${loudness.integratedLUFS.toFixed(1)} LUFS) -9〜-6 LUFS くらいが目安` });
    } else if (loudness.integratedLUFS < -9) {
      comments.push({ level: 'warning', msg: `ちょっと音圧低めかも...! (${loudness.integratedLUFS.toFixed(1)} LUFS) -9〜-6 LUFS くらいが目安` });
    } else {
      comments.push({ level: 'safe', msg: `音圧はいい感じ! (${loudness.integratedLUFS.toFixed(1)} LUFS)` });
    }
    // True Peak: +1.5以内
    if (loudness.truePeakDBTP > 1.5) {
      comments.push({ level: 'danger', msg: `True Peak が +1.5 dBTP 超えちゃってる...! (${loudness.truePeakDBTP.toFixed(1)} dBTP)` });
    } else {
      comments.push({ level: 'safe', msg: `True Peak は範囲内でOK! (${loudness.truePeakDBTP.toFixed(1)} dBTP)` });
    }
    // Loudness Range: 2.5 ~ 6.0
    if (loudness.loudnessRange < 2.5) {
      comments.push({ level: 'warning', msg: `ちょっとダイナミクス少ないかも...! (${loudness.loudnessRange.toFixed(1)} LU) 2.5〜6.0 LU くらいが目安` });
    } else if (loudness.loudnessRange > 6.0) {
      comments.push({ level: 'warning', msg: `ダイナミクスがちょっと広めかも...! (${loudness.loudnessRange.toFixed(1)} LU) 2.5〜6.0 LU くらいが目安` });
    } else {
      comments.push({ level: 'safe', msg: `ダイナミクスもいい感じ! (${loudness.loudnessRange.toFixed(1)} LU)` });
    }
  }
  if (stereo) {
    // Stereo Width: 20 ~ 60%
    const w = Math.min(stereo.width * 100, 200);
    if (w < 20) {
      comments.push({ level: 'warning', msg: `ステレオ幅がちょっと狭いかも...! (${w.toFixed(0)}%) 20〜60% くらいが目安` });
    } else if (w > 60) {
      comments.push({ level: 'warning', msg: `ステレオ幅がちょっと広めかも...! (${w.toFixed(0)}%) 20〜60% くらいが目安` });
    } else {
      comments.push({ level: 'safe', msg: `ステレオ幅もいい感じ! (${w.toFixed(0)}%)` });
    }
  }
  if (quality) {
    // 先頭サンプル
    if (!quality.startIsZero) {
      comments.push({ level: 'warning', msg: `先頭のサンプルがゼロじゃないかも...! (${quality.startAmplitude.toFixed(4)}) クリックノイズの原因になるかも` });
    } else {
      comments.push({ level: 'safe', msg: `先頭サンプルはゼロでOK!` });
    }
    // 末尾サンプル
    if (!quality.endIsZero) {
      comments.push({ level: 'warning', msg: `末尾のサンプルがゼロじゃないかも...! (${quality.endAmplitude.toFixed(4)}) クリックノイズの原因になるかも` });
    } else {
      comments.push({ level: 'safe', msg: `末尾サンプルもゼロでOK!` });
    }
    // 冒頭無音: 1秒以内
    if (quality.headSilence > 1.0) {
      comments.push({ level: 'warning', msg: `冒頭に ${quality.headSilence.toFixed(2)} 秒の無音があるかも...! 1秒以内が目安` });
    }
    // 末尾無音: 1秒以内
    if (quality.tailSilence > 1.0) {
      comments.push({ level: 'warning', msg: `末尾に ${quality.tailSilence.toFixed(2)} 秒の無音があるかも...! 1秒以内が目安` });
    }
  }

  return (
    <div className="panel">
      {/* ── 基本情報 ── */}
      <section className="panel-section">
        <div className="panel-title">基本情報</div>
        <div className="metric-grid">
          <div className="metric">
            <Label text="長さ" tip="オーディオファイルの総再生時間" />
            <div className="metric-value" style={{ color: durationColor }}>{fileInfo ? formatDuration(fileInfo.duration) : DASH}</div>
          </div>
          <div className="metric">
            <Label text="サンプルレート" tip="1秒あたりのサンプル数。値が高いほど高音質" />
            <div className="metric-value" style={{ color: srColor }}>
              {fileInfo ? <>{fileInfo.sampleRate.toLocaleString()}<span className="metric-unit">Hz</span></> : DASH}
            </div>
          </div>
          <div className="metric">
            <Label text="チャンネル" tip="Mono: 1チャンネル、Stereo: 左右2チャンネル" />
            <div className="metric-value" style={{ color: chColor }}>{fileInfo ? (fileInfo.channels === 1 ? 'Mono' : 'Stereo') : DASH}</div>
          </div>
          <div className="metric">
            <Label text="フォーマット" tip="オーディオファイルの形式（WAV, MP3, FLAC等）" />
            <div className="metric-value" style={{ color: fmtColor }}>{fileInfo?.format ?? DASH}</div>
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
          </div>
          <div className="metric">
            <Label text="Loudness Range" tip="楽曲内の音量変動幅。値が大きいほどダイナミクスが豊か" />
            <div className="metric-value" style={{ color: lrColor }}>
              {loudness ? <>{loudness.loudnessRange.toFixed(1)}<span className="metric-unit">LU</span></> : DASH}
            </div>
          </div>
          <div className="metric">
            <Label text="Stereo Width" tip="ステレオの広がり。Mid/Side比率で算出。0%=モノラル、100%=フルステレオ" />
            <div className="metric-value" style={{ color: swColor }}>
              {widthPercent != null ? <>{widthPercent.toFixed(1)}<span className="metric-unit">%</span></> : DASH}
            </div>
          </div>
        </div>
      </section>

      {/* ── クオリティチェック ── */}
      <section className="panel-section">
        <div className="panel-title">クオリティチェック</div>
        <div className="metric-grid">
          <div className="metric">
            <Label text="先頭サンプル" tip="最初のサンプルがゼロか確認。非ゼロだとクリックノイズの原因に" />
            <div className="metric-value" style={{ color: startColor }}>
              {quality
                ? (quality.startIsZero ? 'OK' : quality.startAmplitude.toFixed(4))
                : DASH
              }
            </div>
          </div>
          <div className="metric">
            <Label text="末尾サンプル" tip="最後のサンプルがゼロか確認。非ゼロだとクリックノイズの原因に" />
            <div className="metric-value" style={{ color: endColor }}>
              {quality
                ? (quality.endIsZero ? 'OK' : quality.endAmplitude.toFixed(4))
                : DASH
              }
            </div>
          </div>
          <div className="metric">
            <Label text="冒頭無音" tip="ファイル先頭の無音区間の長さ" />
            <div className="metric-value" style={{ color: headColor }}>
              {quality ? <>{quality.headSilence.toFixed(3)}<span className="metric-unit">秒</span></> : DASH}
            </div>
          </div>
          <div className="metric">
            <Label text="末尾無音" tip="ファイル末尾の無音区間の長さ" />
            <div className="metric-value" style={{ color: tailColor }}>
              {quality ? <>{quality.tailSilence.toFixed(3)}<span className="metric-unit">秒</span></> : DASH}
            </div>
          </div>
        </div>
      </section>

      {/* ── 分析結果 ── */}
      {comments.length > 0 && (
        <section className="panel-section">
          <div className="panel-title">分析結果</div>
          <ul className="warning-list">
            {comments.map((c, i) => (
              <li key={i} className={`warning-item warning-${c.level}`}>{c.msg}</li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}
