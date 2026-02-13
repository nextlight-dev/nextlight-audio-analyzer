import type { ProgressState } from '../analysis/types';

interface ProgressBarProps {
  progress: ProgressState;
}

export function ProgressBar({ progress }: ProgressBarProps) {
  if (progress.phase === 'init' && progress.percent === 0 && !progress.label) {
    return null;
  }

  return (
    <div className="progress-container">
      <div className="progress-label">{progress.label}</div>
      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{
            width: `${progress.percent}%`,
            background: progress.phase === 'error' ? 'var(--danger)' : undefined,
          }}
        />
      </div>
    </div>
  );
}
