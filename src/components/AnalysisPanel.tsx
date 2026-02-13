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

function InlineComment({ comment }: { comment: { level: 'safe' | 'danger' | 'warning'; msg: string } | null }) {
  if (!comment) return null;
  return (
    <div className={`metric-comment metric-comment-${comment.level}`}>{comment.msg}</div>
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

  // 各メトリクスのインラインコメント
  type Comment = { level: 'safe' | 'danger' | 'warning'; msg: string };

  // 基本情報コメント
  const durationComment: Comment | null = fileInfo
    ? fileInfo.duration < 120 ? { level: 'warning', msg: 'ちょっと短めかも — 2:00〜3:30 が目安' }
    : fileInfo.duration > 210 ? { level: 'warning', msg: 'ちょっと長めかも — 2:00〜3:30 が目安' }
    : { level: 'safe', msg: 'いい感じ!' }
    : null;
  const srComment: Comment | null = fileInfo
    ? fileInfo.sampleRate !== 48000 ? { level: 'warning', msg: '48,000 Hz が推奨' }
    : { level: 'safe', msg: 'OK!' }
    : null;
  const chComment: Comment | null = fileInfo
    ? fileInfo.channels < 2 ? { level: 'warning', msg: 'モノラル — ステレオが推奨' }
    : { level: 'safe', msg: 'OK!' }
    : null;
  const fmtComment: Comment | null = fileInfo
    ? fileInfo.format !== 'WAV' ? { level: 'warning', msg: 'WAV が推奨' }
    : { level: 'safe', msg: 'OK!' }
    : null;

  // オーディオ解析コメント
  const lufsComment: Comment | null = loudness
    ? loudness.integratedLUFS > -6 ? { level: 'danger', msg: '音圧高め — -9〜-6 LUFS が目安' }
    : loudness.integratedLUFS < -9 ? { level: 'warning', msg: '音圧低め — -9〜-6 LUFS が目安' }
    : { level: 'safe', msg: 'いい感じ!' }
    : null;
  const tpComment: Comment | null = loudness
    ? loudness.truePeakDBTP > 1.5 ? { level: 'danger', msg: '+1.5 dBTP 超え' }
    : { level: 'safe', msg: 'OK!' }
    : null;
  const lrComment: Comment | null = loudness
    ? loudness.loudnessRange < 2.5 ? { level: 'warning', msg: 'ダイナミクス少なめ — 2.5〜6.0 LU が目安' }
    : loudness.loudnessRange > 6.0 ? { level: 'warning', msg: 'ダイナミクス広め — 2.5〜6.0 LU が目安' }
    : { level: 'safe', msg: 'いい感じ!' }
    : null;
  const swComment: Comment | null = stereo
    ? (widthPercent! < 20 ? { level: 'warning', msg: 'ちょっと狭め — 20〜60% が目安' }
    : widthPercent! > 60 ? { level: 'warning', msg: 'ちょっと広め — 20〜60% が目安' }
    : { level: 'safe', msg: 'いい感じ!' })
    : null;

  // クオリティコメント
  const startComment: Comment | null = quality
    ? !quality.startIsZero ? { level: 'warning', msg: 'ゼロじゃない — クリックノイズの原因に' }
    : { level: 'safe', msg: 'OK!' }
    : null;
  const endComment: Comment | null = quality
    ? !quality.endIsZero ? { level: 'warning', msg: 'ゼロじゃない — クリックノイズの原因に' }
    : { level: 'safe', msg: 'OK!' }
    : null;
  const headComment: Comment | null = quality
    ? quality.headSilence > 1.0 ? { level: 'warning', msg: `${quality.headSilence.toFixed(2)} 秒 — 1秒以内が目安` }
    : { level: 'safe', msg: 'OK!' }
    : null;
  const tailComment: Comment | null = quality
    ? quality.tailSilence > 1.0 ? { level: 'warning', msg: `${quality.tailSilence.toFixed(2)} 秒 — 1秒以内が目安` }
    : { level: 'safe', msg: 'OK!' }
    : null;

  return (
    <div className="panel">
      {/* ── 基本情報 ── */}
      <section className="panel-section">
        <div className="panel-title">基本情報</div>
        <div className="metric-grid">
          <div className="metric">
            <Label text="長さ" tip="オーディオファイルの総再生時間" />
            <div className="metric-value" style={{ color: durationColor }}>{fileInfo ? formatDuration(fileInfo.duration) : DASH}</div>
            <InlineComment comment={durationComment} />
          </div>
          <div className="metric">
            <Label text="サンプルレート" tip="1秒あたりのサンプル数。値が高いほど高音質" />
            <div className="metric-value" style={{ color: srColor }}>
              {fileInfo ? <>{fileInfo.sampleRate.toLocaleString()}<span className="metric-unit">Hz</span></> : DASH}
            </div>
            <InlineComment comment={srComment} />
          </div>
          <div className="metric">
            <Label text="チャンネル" tip="Mono: 1チャンネル、Stereo: 左右2チャンネル" />
            <div className="metric-value" style={{ color: chColor }}>{fileInfo ? (fileInfo.channels === 1 ? 'Mono' : 'Stereo') : DASH}</div>
            <InlineComment comment={chComment} />
          </div>
          <div className="metric">
            <Label text="フォーマット" tip="オーディオファイルの形式（WAV, MP3, FLAC等）" />
            <div className="metric-value" style={{ color: fmtColor }}>{fileInfo?.format ?? DASH}</div>
            <InlineComment comment={fmtComment} />
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
            <InlineComment comment={lufsComment} />
          </div>
          <div className="metric">
            <Label text="True Peak" tip="4倍オーバーサンプリングによる真のピーク値。DA変換時の実際の最大振幅" />
            <div className="metric-value" style={{ color: tpColor }}>
              {loudness ? (isFinite(loudness.truePeakDBTP) ? loudness.truePeakDBTP.toFixed(1) : '---') : DASH}
              {loudness && <span className="metric-unit">dBTP</span>}
            </div>
            <InlineComment comment={tpComment} />
          </div>
          <div className="metric">
            <Label text="Loudness Range" tip="楽曲内の音量変動幅。値が大きいほどダイナミクスが豊か" />
            <div className="metric-value" style={{ color: lrColor }}>
              {loudness ? <>{loudness.loudnessRange.toFixed(1)}<span className="metric-unit">LU</span></> : DASH}
            </div>
            <InlineComment comment={lrComment} />
          </div>
          <div className="metric">
            <Label text="Stereo Width" tip="ステレオの広がり。Mid/Side比率で算出。0%=モノラル、100%=フルステレオ" />
            <div className="metric-value" style={{ color: swColor }}>
              {widthPercent != null ? <>{widthPercent.toFixed(1)}<span className="metric-unit">%</span></> : DASH}
            </div>
            <InlineComment comment={swComment} />
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
            <InlineComment comment={startComment} />
          </div>
          <div className="metric">
            <Label text="末尾サンプル" tip="最後のサンプルがゼロか確認。非ゼロだとクリックノイズの原因に" />
            <div className="metric-value" style={{ color: endColor }}>
              {quality
                ? (quality.endIsZero ? 'OK' : quality.endAmplitude.toFixed(4))
                : DASH
              }
            </div>
            <InlineComment comment={endComment} />
          </div>
          <div className="metric">
            <Label text="冒頭無音" tip="ファイル先頭の無音区間の長さ" />
            <div className="metric-value" style={{ color: headColor }}>
              {quality ? <>{quality.headSilence.toFixed(3)}<span className="metric-unit">秒</span></> : DASH}
            </div>
            <InlineComment comment={headComment} />
          </div>
          <div className="metric">
            <Label text="末尾無音" tip="ファイル末尾の無音区間の長さ" />
            <div className="metric-value" style={{ color: tailColor }}>
              {quality ? <>{quality.tailSilence.toFixed(3)}<span className="metric-unit">秒</span></> : DASH}
            </div>
            <InlineComment comment={tailComment} />
          </div>
        </div>
      </section>

    </div>
  );
}
