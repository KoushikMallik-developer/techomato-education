// Small dependency-free SVG charts. Every chart prints its numbers, so nothing relies on color alone.
import { Card, H3 } from './ui.jsx';
const W = 520, H = 190, PAD = { l: 30, r: 10, t: 22, b: 28 };
const niceMax = v => { const m = Math.max(v, 1); const p = 10 ** Math.floor(Math.log10(m)); return Math.ceil(m / p) * p; };

function Frame({ label, max, children }) {
  const ticks = max % 2 ? [0, max] : [0, max / 2, max]; // whole numbers only
  return (
    <svg className="block [overflow:visible]" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}>
      {ticks.map(t => {
        const y = PAD.t + (1 - t / max) * (H - PAD.t - PAD.b);
        return (
          <g key={t}>
            <line className="[stroke:var(--line)]" x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} strokeWidth="1" />
            <text className="[fill:var(--muted)]" x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="11">{Math.round(t)}</text>
          </g>
        );
      })}
      {children}
    </svg>
  );
}

// data: [{ label, value }]
export function BarChart({ data, label, color = 'var(--accent)', max = niceMax(Math.max(0, ...data.map(d => d.value))) }) {
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b, step = iw / data.length, bw = Math.min(48, step * 0.62);
  return (
    <Frame label={`${label}: ${data.map(d => `${d.label} ${d.value}`).join(', ')}`} max={max}>
      {data.map((d, i) => {
        const h = (d.value / max) * ih, x = PAD.l + step * i + (step - bw) / 2, y = PAD.t + ih - h;
        return (
          <g key={d.label + i}>
            <rect x={x} y={d.value ? y : PAD.t + ih - 2} width={bw} height={d.value ? h : 2} rx="4" style={{ fill: d.value ? color : 'var(--line)' }} />
            {d.value > 0 && <text className="[fill:var(--ink)]" x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="12" fontWeight="700">{d.value}</text>}
            <text className="[fill:var(--muted)]" x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11">{d.label}</text>
          </g>
        );
      })}
    </Frame>
  );
}

export function LineChart({ data, label, color = 'var(--pass-strong)' }) {
  const max = niceMax(Math.max(0, ...data.map(d => d.value))), iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const pt = (d, i) => [PAD.l + (data.length < 2 ? iw / 2 : (iw * i) / (data.length - 1)), PAD.t + (1 - d.value / max) * ih];
  const pts = data.map(pt), path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <Frame label={`${label}: ${data.map(d => `${d.label} ${d.value}`).join(', ')}`} max={max}>
      {pts.length > 1 && <path d={`${path} L${last[0]} ${PAD.t + ih} L${pts[0][0]} ${PAD.t + ih} Z`} style={{ fill: color }} opacity="0.12" />}
      <path d={path} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" style={{ stroke: color }} />
      {pts.map((p, i) => <circle className="[fill:var(--surface)]" key={i} cx={p[0]} cy={p[1]} r="3.5" style={{ stroke: color }} strokeWidth="2" />)}
      {data.map((d, i) => (i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) && <text className="[fill:var(--muted)]" key={i} x={pts[i][0]} y={H - 8} textAnchor="middle" fontSize="11">{d.label}</text>)}
      {last && <text className="[fill:var(--ink)]" x={last[0]} y={last[1] - 10} textAnchor="end" fontSize="12" fontWeight="700">{data[data.length - 1].value}</text>}
    </Frame>
  );
}

export const ChartCard = ({ title, hint, children }) => (
  <Card as="section" className="flex flex-col gap-2.5">
    <div><H3 className="text-[18px]">{title}</H3>{hint && <p className="text-[13px] text-muted m-[2px_0_0]">{hint}</p>}</div>
    {children}
  </Card>
);
