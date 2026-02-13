import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

interface Props {
  momentary: number[];
  shortTerm: number[];
  integratedLUFS: number;
  duration: number;
}

export function LoudnessTimeChart({ momentary, shortTerm, integratedLUFS, duration }: Props) {
  if (momentary.length === 0 && shortTerm.length === 0) return null;

  const downsample = (arr: number[], maxPoints: number) => {
    if (arr.length <= maxPoints) return arr;
    const factor = Math.floor(arr.length / maxPoints);
    const result: number[] = [];
    for (let i = 0; i < arr.length; i += factor) {
      const chunk = arr.slice(i, i + factor);
      result.push(Math.max(...chunk));
    }
    return result;
  };

  const maxPoints = 500;
  const dsMomentary = downsample(momentary, maxPoints);
  const dsShortTerm = downsample(shortTerm, maxPoints);
  const numPoints = Math.max(dsMomentary.length, dsShortTerm.length);
  const labels = Array.from({ length: numPoints }, (_, i) =>
    ((i / numPoints) * duration).toFixed(1)
  );

  const integratedLine = isFinite(integratedLUFS)
    ? Array(numPoints).fill(integratedLUFS)
    : undefined;

  return (
    <details className="chart-card collapsible" open>
      <summary className="chart-title">
        Loudness (時系列) — Integrated: {isFinite(integratedLUFS) ? `${integratedLUFS.toFixed(1)} LUFS` : '---'}
      </summary>
      <div className="chart-container tall">
        <Line
          data={{
            labels,
            datasets: [
              ...(dsMomentary.length > 0 ? [{
                label: 'Momentary (LUFS)',
                data: dsMomentary,
                borderColor: 'rgba(99, 102, 241, 0.6)',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                borderWidth: 1,
                pointRadius: 0,
                fill: true,
                tension: 0.2,
              }] : []),
              ...(dsShortTerm.length > 0 ? [{
                label: 'Short-term (LUFS)',
                data: dsShortTerm,
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.05)',
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false,
                tension: 0.2,
              }] : []),
              ...(integratedLine ? [{
                label: 'Integrated (LUFS)',
                data: integratedLine,
                borderColor: '#ef4444',
                borderWidth: 1.5,
                borderDash: [6, 4],
                pointRadius: 0,
                fill: false,
              }] : []),
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
              x: {
                display: true,
                title: { display: true, text: '秒', color: '#71717a', font: { size: 10 } },
                ticks: { color: '#71717a', maxTicksLimit: 10, font: { size: 9 } },
                grid: { color: 'rgba(39,39,42,0.5)' },
              },
              y: {
                display: true,
                title: { display: true, text: 'LUFS', color: '#71717a', font: { size: 10 } },
                ticks: { color: '#71717a', font: { size: 9 } },
                grid: { color: 'rgba(39,39,42,0.5)' },
                max: 0,
                min: -20,
              },
            },
            plugins: {
              tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                  label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) ?? ''} LUFS`,
                },
              },
            },
          }}
        />
      </div>
    </details>
  );
}
