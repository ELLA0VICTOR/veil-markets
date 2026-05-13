import { useId } from "react";

function hashString(input = "") {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildSeries(seedInput) {
  const seed = hashString(seedInput);
  return Array.from({ length: 18 }, (_, index) => {
    const wave = Math.sin((index + 1) * ((seed % 7) + 2)) * 11;
    const texture = (((seed >> (index % 15)) & 7) - 3) * 3;
    const drift = ((seed % 11) - 5) * index * 0.38;
    return clamp(52 + wave + texture + drift, 14, 86);
  });
}

function buildVolume(seedInput) {
  const seed = hashString(`${seedInput}:volume`);
  return Array.from({ length: 18 }, (_, index) => {
    const wave = Math.cos((index + 2) * ((seed % 5) + 2)) * 18;
    const texture = ((seed >> (index % 16)) & 15) * 2.4;
    return clamp(34 + wave + texture, 12, 92);
  });
}

function pointFor(value, index, total) {
  const left = 10;
  const top = 12;
  const width = 200;
  const height = 52;
  const x = left + (index / (total - 1)) * width;
  const y = top + height - (value / 100) * height;
  return [x, y];
}

function linePath(points) {
  return points
    .map((point, index) => {
      const [x, y] = pointFor(point, index, points.length);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function areaPath(points) {
  const path = linePath(points);
  const [lastX] = pointFor(points.at(-1), points.length - 1, points.length);
  const [firstX] = pointFor(points[0], 0, points.length);
  return `${path} L ${lastX.toFixed(1)} 68 L ${firstX.toFixed(1)} 68 Z`;
}

export default function MarketActivityVisual({ seedKey, label = "Encrypted activity" }) {
  const chartId = useId().replace(/:/g, "");
  const series = buildSeries(seedKey);
  const volume = buildVolume(seedKey);
  const barWidth = 7.2;

  return (
    <div className="market-activity-visual" onClick={(event) => event.stopPropagation()}>
      <div className="activity-chart-head">
        <span>{label}</span>
        <span>PRIVATE ODDS</span>
      </div>

      <svg className="activity-chart" viewBox="0 0 220 96" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`${chartId}-area`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(251, 191, 36, 0.34)" />
            <stop offset="100%" stopColor="rgba(251, 191, 36, 0.02)" />
          </linearGradient>
        </defs>

        {[18, 34, 50, 66].map((y) => (
          <line key={y} className="activity-grid" x1="8" x2="212" y1={y} y2={y} />
        ))}

        {volume.map((value, index) => {
          const x = 11 + index * 11.65;
          const height = (value / 100) * 22;
          return (
            <rect
              key={`${value}-${index}`}
              className="activity-volume"
              x={x.toFixed(1)}
              y={(84 - height).toFixed(1)}
              width={barWidth}
              height={height.toFixed(1)}
              rx="1.8"
            />
          );
        })}

        <path d={areaPath(series)} className="activity-area" fill={`url(#${chartId}-area)`} />
        <path d={linePath(series)} className="activity-line" />
      </svg>

      <div className="activity-axis-labels">
        <span>OPEN</span>
        <span>MID</span>
        <span>NOW</span>
      </div>
    </div>
  );
}
