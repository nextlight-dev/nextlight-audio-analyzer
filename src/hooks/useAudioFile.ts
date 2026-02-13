import { useCallback, useRef, useState } from 'react';

interface AudioFileState {
  file: File | null;
  audioBuffer: AudioBuffer | null;
  error: string | null;
  isDecoding: boolean;
}

export function useAudioFile() {
  const [state, setState] = useState<AudioFileState>({
    file: null,
    audioBuffer: null,
    error: null,
    isDecoding: false,
  });
  const audioCtxRef = useRef<AudioContext | null>(null);

  const decode = useCallback(async (file: File): Promise<AudioBuffer> => {
    setState(prev => ({ ...prev, file, audioBuffer: null, error: null, isDecoding: true }));

    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx = new AudioContext({ sampleRate: 44100 });
      audioCtxRef.current = audioCtx;
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      await audioCtx.close();
      setState(prev => ({ ...prev, audioBuffer, isDecoding: false }));
      return audioBuffer;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'デコードに失敗しました';
      setState(prev => ({ ...prev, error: msg, isDecoding: false }));
      throw e;
    }
  }, []);

  return { ...state, decode };
}

export function audioBufferToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const mono = new Float32Array(left.length);
  for (let i = 0; i < left.length; i++) {
    mono[i] = (left[i] + right[i]) / 2;
  }
  return mono;
}

export function getFileFormat(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const formats: Record<string, string> = {
    wav: 'WAV', mp3: 'MP3', flac: 'FLAC', ogg: 'OGG',
    aac: 'AAC', m4a: 'M4A', webm: 'WebM', opus: 'Opus',
  };
  return formats[ext] ?? ext.toUpperCase();
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
