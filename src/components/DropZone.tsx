import { useCallback, useRef, useState, type DragEvent } from 'react';

interface DropZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const ACCEPT = '.wav,.mp3,.flac,.ogg,.aac,.m4a,.webm,.opus';

export function DropZone({ onFile, disabled }: DropZoneProps) {
  const [dragover, setDragover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragover(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile, disabled]);

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  }, [onFile]);

  return (
    <div
      className={`dropzone ${dragover ? 'dragover' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragover(true); }}
      onDragLeave={() => setDragover(false)}
      onDrop={handleDrop}
      onClick={handleClick}
      style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      <div className="dropzone-label">
        音源ファイルをドロップ、またはクリックして選択
      </div>
      <div className="dropzone-hint">
        WAV / MP3 / FLAC / OGG / AAC / M4A 対応
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
