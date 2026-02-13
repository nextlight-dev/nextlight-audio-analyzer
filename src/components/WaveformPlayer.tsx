import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  file: File | null;
  audioData: Float32Array | null;
}

export function WaveformPlayer({ file, audioData }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);

  // Precomputed waveform peaks (min/max per pixel column)
  const peaksRef = useRef<{ min: number; max: number }[]>([]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setCurrentTime(0);
    setIsPlaying(false);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  }, []);

  const handleEnded = useCallback(() => setIsPlaying(false), []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  // Compute peaks when audioData or canvas size changes
  const computePeaks = useCallback((width: number) => {
    if (!audioData || audioData.length === 0 || width === 0) return;
    const samplesPerPixel = Math.floor(audioData.length / width);
    const peaks: { min: number; max: number }[] = [];
    for (let x = 0; x < width; x++) {
      const start = x * samplesPerPixel;
      let min = 1, max = -1;
      for (let j = 0; j < samplesPerPixel; j++) {
        const val = audioData[start + j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      peaks.push({ min, max });
    }
    peaksRef.current = peaks;
  }, [audioData]);

  // Draw waveform with playback progress overlay
  const draw = useCallback((progress: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.scale(dpr, dpr);
      computePeaks(Math.floor(width));
    }

    const mid = height / 2;
    const peaks = peaksRef.current;
    const playedX = Math.floor(progress * width);

    // Background
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, width, height);

    if (peaks.length === 0) return;

    // Draw unplayed portion (dim glow)
    ctx.save();
    ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = playedX; x < peaks.length; x++) {
      const y1 = mid + peaks[x].min * mid;
      const y2 = mid + peaks[x].max * mid;
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();
    ctx.restore();

    // Draw played portion (bright glow)
    ctx.save();
    ctx.shadowColor = '#818cf8';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#a5b4fc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < playedX && x < peaks.length; x++) {
      const y1 = mid + peaks[x].min * mid;
      const y2 = mid + peaks[x].max * mid;
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();
    // Second pass for extra bloom
    ctx.shadowBlur = 24;
    ctx.shadowColor = 'rgba(129, 140, 248, 0.4)';
    ctx.strokeStyle = 'rgba(165, 180, 252, 0.5)';
    ctx.stroke();
    ctx.restore();

    // Playhead line (glowing)
    if (progress > 0 && progress < 1) {
      ctx.save();
      ctx.shadowColor = '#e4e4e7';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#e4e4e7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playedX, 0);
      ctx.lineTo(playedX, height);
      ctx.stroke();
      ctx.restore();
    }

    // Zero line
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(width, mid);
    ctx.stroke();
  }, [computePeaks]);

  // Animation loop for smooth playhead
  useEffect(() => {
    if (!isPlaying) return;

    const tick = () => {
      if (audioRef.current && duration > 0) {
        const progress = audioRef.current.currentTime / duration;
        setCurrentTime(audioRef.current.currentTime);
        draw(progress);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, duration, draw]);

  // Initial draw + redraw on data/time change when paused
  useEffect(() => {
    if (!audioData) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    computePeaks(Math.floor(rect.width));
    const progress = duration > 0 ? currentTime / duration : 0;
    draw(progress);
  }, [audioData, currentTime, duration, draw, computePeaks]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      computePeaks(Math.floor(rect.width));
      const progress = duration > 0 ? currentTime / duration : 0;
      draw(progress);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [duration, currentTime, draw, computePeaks]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const restart = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    draw(0);
  }, [draw]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    const time = progress * duration;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
    draw(progress);
  }, [duration, draw]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!file || !objectUrl || !audioData) return null;

  return (
    <div className="waveform-player" ref={containerRef}>
      <audio
        ref={audioRef}
        src={objectUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      <div className="waveform-canvas-wrap">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{ width: '100%', height: '100%', cursor: 'pointer' }}
        />
      </div>

      <div className="player-toolbar">
        <div className="player-toolbar-left">
          <button className="player-btn" onClick={restart} title="最初に戻す">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="19,20 9,12 19,4" />
              <line x1="5" y1="4" x2="5" y2="20" />
            </svg>
          </button>
          <button className="player-btn player-btn-play" onClick={togglePlay} title={isPlaying ? '一時停止' : '再生'}>
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="3" width="5" height="18" rx="1" />
                <rect x="14" y="3" width="5" height="18" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6,3 20,12 6,21" />
              </svg>
            )}
          </button>
        </div>

        <span className="player-time">
          {fmt(currentTime)} <span className="player-time-sep">/</span> {fmt(duration)}
        </span>

        <div className="player-toolbar-right">
          <button
            className="player-btn player-btn-vol"
            onClick={() => {
              const next = volume > 0 ? 0 : 1;
              setVolume(next);
              if (audioRef.current) audioRef.current.volume = next;
            }}
            title={volume === 0 ? 'ミュート解除' : 'ミュート'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none" />
              {volume === 0 ? (
                <>
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </>
              ) : volume < 0.5 ? (
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              ) : (
                <>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </>
              )}
            </svg>
          </button>
          <input
            type="range"
            className="volume-slider"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
          />
        </div>
      </div>
    </div>
  );
}
