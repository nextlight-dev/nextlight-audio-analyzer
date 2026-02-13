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

    // Draw unplayed portion (dim)
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = playedX; x < peaks.length; x++) {
      const y1 = mid + peaks[x].min * mid;
      const y2 = mid + peaks[x].max * mid;
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();

    // Draw played portion (bright)
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < playedX && x < peaks.length; x++) {
      const y1 = mid + peaks[x].min * mid;
      const y2 = mid + peaks[x].max * mid;
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();

    // Playhead line
    if (progress > 0 && progress < 1) {
      ctx.strokeStyle = '#e4e4e7';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(playedX, 0);
      ctx.lineTo(playedX, height);
      ctx.stroke();
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

      <div className="waveform-controls">
        <button className="play-btn" onClick={togglePlay}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <span className="audio-time">
          {fmt(currentTime)} / {fmt(duration)}
        </span>
      </div>

      <div className="waveform-canvas-wrap">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{ width: '100%', height: '100%', cursor: 'pointer', borderRadius: 4 }}
        />
      </div>
    </div>
  );
}
