import { useState } from 'react';
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
  momentaryA: number[];
  momentaryB: number[];
  durationA: number;
  durationB: number;
  labelA?: string;
  labelB?: string;
}

const resampleTo = (arr: number[], target: number): number[] => {
  if (arr.length === 0 || target === 0) return [];
  if (arr.length === target) return arr;
  const result: number[] = [];
  for (let i = 0; i < target; i++) {
    const pos = (i / (target - 1)) * (arr.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, arr.length - 1);
    const frac = pos - lo;
    result.push(arr[lo] * (1 - frac) + arr[hi] * frac);
  }
  return result;
};

export function RefLoudnessChart({ momentaryA, momentaryB, durationA, durationB, labelA = '自分', labelB = 'Ref' }: Props) {
  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);

  if (momentaryA.length === 0 && momentaryB.length === 0) return null;

  const maxPoints = 500;
  const maxDuration = Math.max(durationA, durationB);
  const numPoints = Math.min(maxPoints, Math.max(momentaryA.length, momentaryB.length));

  const dsA = momentaryA.length > 0 ? resampleTo(momentaryA, numPoints) : [];
  const dsB = momentaryB.length > 0 ? resampleTo(momentaryB, numPoints) : [];

  const labels = Array.from({ length: numPoints }, (_, i) =>
    ((i / numPoints) * maxDuration).toFixed(1)
  );

  return (
    <details className="chart-card collapsible" open>
      <summary className="chart-title">
        Momentary Loudness 比較
      </summary>
      <div className="chart-toggles">
        {dsA.length > 0 && (
          <button
            className={`chart-toggle ${showA ? 'active' : ''}`}
            style={{ '--toggle-color': 'rgba(99, 102, 241, 0.7)' } as React.CSSProperties}
            onClick={() => setShowA(v => !v)}
          >{labelA}</button>
        )}
        {dsB.length > 0 && (
          <button
            className={`chart-toggle ${showB ? 'active' : ''}`}
            style={{ '--toggle-color': 'rgba(161, 161, 170, 0.6)' } as React.CSSProperties}
            onClick={() => setShowB(v => !v)}
          >{labelB}</button>
        )}
      </div>
      <div className="chart-container tall">
        <Line
          data={{
            labels,
            datasets: [
              ...(showA && dsA.length > 0 ? [{
                label: `${labelA} (LUFS)`,
                data: dsA,
                borderColor: 'rgba(99, 102, 241, 0.7)',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                borderWidth: 1.2,
                pointRadius: 0,
                fill: true,
                tension: 0.2,
              }] : []),
              ...(showB && dsB.length > 0 ? [{
                label: `${labelB} (LUFS)`,
                data: dsB,
                borderColor: 'rgba(161, 161, 170, 0.5)',
                backgroundColor: 'rgba(161, 161, 170, 0.06)',
                borderWidth: 1,
                pointRadius: 0,
                fill: true,
                tension: 0.2,
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
