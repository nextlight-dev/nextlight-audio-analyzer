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

/**
 * ファイルヘッダーを直接パースしてオリジナルのサンプルレートを取得する。
 * AudioContext.decodeAudioData はコンテキストの SR にリサンプリングするため使えない。
 */
export async function getOriginalSampleRate(file: File): Promise<number> {
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);

  // ── WAV: "RIFF"..."WAVE", walk chunks to find "fmt " ──
  if (u8.length > 44
    && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46   // RIFF
    && u8[8] === 0x57 && u8[9] === 0x41 && u8[10] === 0x56 && u8[11] === 0x45) { // WAVE
    let pos = 12;
    while (pos + 8 < u8.length) {
      const id = String.fromCharCode(u8[pos], u8[pos + 1], u8[pos + 2], u8[pos + 3]);
      const size = dv.getUint32(pos + 4, true);
      if (id === 'fmt ' && pos + 12 + 4 <= u8.length) {
        // fmt chunk: +8 audioFormat(2) +10 channels(2) +12 sampleRate(4)
        return dv.getUint32(pos + 12, true);
      }
      pos += 8 + size;
      if (size % 2 !== 0) pos++; // RIFF chunks are word-aligned
    }
  }

  // ── FLAC: "fLaC", STREAMINFO sample rate = 20 bits @ byte 18 ──
  if (u8.length > 21
    && u8[0] === 0x66 && u8[1] === 0x4C && u8[2] === 0x61 && u8[3] === 0x43) { // fLaC
    return (u8[18] << 12) | (u8[19] << 4) | (u8[20] >> 4);
  }

  // ── MP3: skip ID3v2 tag, then find frame sync ──
  let mp3Off = 0;
  if (u8.length > 10 && u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) { // "ID3"
    mp3Off = 10 + ((u8[6] & 0x7F) << 21 | (u8[7] & 0x7F) << 14 | (u8[8] & 0x7F) << 7 | u8[9] & 0x7F);
  }
  const mp3End = Math.min(u8.length - 4, mp3Off + 4096);
  for (let i = mp3Off; i < mp3End; i++) {
    if (u8[i] === 0xFF && (u8[i + 1] & 0xE0) === 0xE0) {
      const ver = (u8[i + 1] >> 3) & 3;
      const layer = (u8[i + 1] >> 1) & 3;
      const srIdx = (u8[i + 2] >> 2) & 3;
      if (layer > 0 && srIdx < 3 && ver !== 1) {
        const table: Record<number, number[]> = {
          3: [44100, 48000, 32000],   // MPEG1
          2: [22050, 24000, 16000],   // MPEG2
          0: [11025, 12000, 8000],    // MPEG2.5
        };
        if (table[ver]) return table[ver][srIdx];
      }
    }
  }

  // ── OGG Vorbis: find "\x01vorbis", sample rate = uint32 LE @ +12 ──
  const oggEnd = Math.min(u8.length - 16, 8192);
  for (let i = 0; i < oggEnd; i++) {
    if (u8[i] === 0x01
      && u8[i + 1] === 0x76 && u8[i + 2] === 0x6F && u8[i + 3] === 0x72
      && u8[i + 4] === 0x62 && u8[i + 5] === 0x69 && u8[i + 6] === 0x73) { // \x01vorbis
      return dv.getUint32(i + 12, true);
    }
  }

  // ── Fallback: AudioContext (ハードウェアSRに依存、不正確な場合あり) ──
  const ctx = new AudioContext();
  const decoded = await ctx.decodeAudioData(buf.slice(0));
  const sr = decoded.sampleRate;
  await ctx.close();
  return sr;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
