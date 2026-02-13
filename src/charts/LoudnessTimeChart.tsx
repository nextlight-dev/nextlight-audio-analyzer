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
  momentary: number[];
  shortTerm: number[];
  integratedLUFS: number;
  duration: number;
}

export function LoudnessTimeChart({ momentary, shortTerm, integratedLUFS, duration }: Props) {
  const [showMomentary, setShowMomentary] = useState(true);
  const [showShortTerm, setShowShortTerm] = useState(true);
  const [showIntegrated, setShowIntegrated] = useState(true);

  if (momentary.length === 0 && shortTerm.length === 0) return null;

  // 全データセットを同じ点数にリサンプル（線形補間）
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

  const maxPoints = 500;
  const numPoints = Math.min(maxPoints, Math.max(momentary.length, shortTerm.length));
  const dsMomentary = momentary.length > 0 ? resampleTo(momentary, numPoints) : [];
  const dsShortTerm = shortTerm.length > 0 ? resampleTo(shortTerm, numPoints) : [];
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
      <div className="chart-toggles">
        <button
          className={`chart-toggle ${showMomentary ? 'active' : ''}`}
          style={{ '--toggle-color': 'rgba(99, 102, 241, 0.6)' } as React.CSSProperties}
          onClick={() => setShowMomentary(v => !v)}
        >Momentary</button>
        <button
          className={`chart-toggle ${showShortTerm ? 'active' : ''}`}
          style={{ '--toggle-color': '#22c55e' } as React.CSSProperties}
          onClick={() => setShowShortTerm(v => !v)}
        >Short-term</button>
        <button
          className={`chart-toggle ${showIntegrated ? 'active' : ''}`}
          style={{ '--toggle-color': '#ef4444' } as React.CSSProperties}
          onClick={() => setShowIntegrated(v => !v)}
        >Integrated</button>
      </div>
      <div className="chart-container tall">
        <Line
          data={{
            labels,
            datasets: [
              ...(showMomentary && dsMomentary.length > 0 ? [{
                label: 'Momentary (LUFS)',
                data: dsMomentary,
                borderColor: 'rgba(99, 102, 241, 0.6)',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                borderWidth: 1,
                pointRadius: 0,
                fill: true,
                tension: 0.2,
              }] : []),
              ...(showShortTerm && dsShortTerm.length > 0 ? [{
                label: 'Short-term (LUFS)',
                data: dsShortTerm,
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.05)',
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false,
                tension: 0.2,
              }] : []),
              ...(showIntegrated && integratedLine ? [{
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
