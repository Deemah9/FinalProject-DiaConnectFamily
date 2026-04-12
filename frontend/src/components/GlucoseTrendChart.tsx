import React from "react";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

// ── Catmull-Rom → cubic bezier smooth path ────────────────────────────────────
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function segmentControlPoints(pts: { x: number; y: number }[], i: number) {
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(pts.length - 1, i + 2)];
  return {
    cp1x: p1.x + (p2.x - p0.x) / 6,
    cp1y: p1.y + (p2.y - p0.y) / 6,
    cp2x: p2.x - (p3.x - p1.x) / 6,
    cp2y: p2.y - (p3.y - p1.y) / 6,
  };
}

// ── GlucoseTrendChart ─────────────────────────────────────────────────────────
export default function GlucoseTrendChart({
  readings,
  width,
}: {
  readings: any[];
  width: number;
}) {
  const HIGH = 140;
  const LOW  = 70;

  const H    = 220;
  const padL = 46;
  const padR = 14;
  const padT = 16;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = H - padT - padB;

  const parsed = readings
    .map((r) => {
      const v   = Number(r?.value || 0);
      const raw = r?.measuredAt || r?.timestamp || r?.createdAt || "";
      const d   = new Date(raw);
      return { t: d.getTime(), v, date: d };
    })
    .filter((r) => r.v > 0 && !Number.isNaN(r.t));

  if (parsed.length === 0) return null;

  const dataMax = Math.max(...parsed.map((r) => r.v));
  const yMin = 40;
  const yMax = Math.max(dataMax + 25, HIGH + 65);
  const yRange = yMax - yMin;

  const tMin = Math.min(...parsed.map((r) => r.t));
  const tMax = Math.max(...parsed.map((r) => r.t));
  const tRange = Math.max(tMax - tMin, 1);

  const toX = (t: number) => padL + ((t - tMin) / tRange) * plotW;
  const toY = (v: number) => padT + plotH - ((v - yMin) / yRange) * plotH;

  const points = parsed.map((r) => ({ x: toX(r.t), y: toY(r.v), v: r.v }));
  const linePath = smoothPath(points);
  const bottomY  = padT + plotH;

  const bands = points.slice(0, -1).map((p1, i) => {
    const p2 = points[i + 1];
    const { cp1x, cp1y, cp2x, cp2y } = segmentControlPoints(points, i);
    const avgV = (p1.v + p2.v) / 2;
    const zone  = avgV < LOW ? "low" : avgV > HIGH ? "high" : "normal";
    const color = zone === "high" ? "#EF4444" : zone === "low" ? "#F59E0B" : "#22C55E";
    const topY  = Math.min(p1.y, p2.y, cp1y, cp2y);
    const path =
      `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}` +
      ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)},` +
      ` ${cp2x.toFixed(1)} ${cp2y.toFixed(1)},` +
      ` ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}` +
      ` L ${p2.x.toFixed(1)} ${bottomY}` +
      ` L ${p1.x.toFixed(1)} ${bottomY} Z`;
    return { path, zone, color, topY, id: `sg_${i}` };
  });

  const yHighPx = toY(HIGH);
  const yLowPx  = toY(LOW);

  const topLabel = Math.ceil(yMax / 20) * 20;
  const yLabels = [
    { v: topLabel, px: toY(topLabel) },
    { v: HIGH,     px: yHighPx },
    { v: LOW,      px: yLowPx  },
  ];

  const MAX_X_LABELS = 3;
  const step  = Math.max(1, Math.round((parsed.length - 1) / (MAX_X_LABELS - 1)));
  const xLabelIndices = new Set<number>();
  for (let i = 0; i < parsed.length; i += step) xLabelIndices.add(i);
  xLabelIndices.add(parsed.length - 1);

  const xLabels = Array.from(xLabelIndices)
    .sort((a, b) => a - b)
    .map((idx) => {
      const d    = parsed[idx].date;
      const h    = d.getHours(), m = d.getMinutes();
      const ampm = h >= 12 ? "PM" : "AM";
      const h12  = h % 12 || 12;
      return {
        label: m === 0
          ? `${h12} ${ampm}`
          : `${h12}:${m.toString().padStart(2, "0")} ${ampm}`,
        x: toX(parsed[idx].t),
      };
    });

  const last = points[points.length - 1];
  const activeColor = last.v < LOW ? "#F59E0B" : last.v > HIGH ? "#EF4444" : "#22C55E";

  return (
    <Svg width={width} height={H}>
      <Defs>
        {bands.map(({ id, color, topY }) => (
          <SvgGradient
            key={id}
            id={id}
            x1={0} y1={topY} x2={0} y2={bottomY}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%"   stopColor={color} stopOpacity={0.50} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.04} />
          </SvgGradient>
        ))}
      </Defs>

      {bands.map(({ path, id }) => (
        <Path key={id} d={path} fill={`url(#${id})`} />
      ))}

      <Path
        d={`M ${padL} ${yHighPx.toFixed(1)} L ${(width - padR).toFixed(1)} ${yHighPx.toFixed(1)}`}
        stroke="#D1D5DB" strokeWidth={1} strokeDasharray="5,4"
      />
      <Path
        d={`M ${padL} ${yLowPx.toFixed(1)} L ${(width - padR).toFixed(1)} ${yLowPx.toFixed(1)}`}
        stroke="#D1D5DB" strokeWidth={1} strokeDasharray="5,4"
      />
      <Path d={`M ${padL} ${padT} L ${padL} ${bottomY}`} stroke="#E5E7EB" strokeWidth={1} />
      <Path d={`M ${padL} ${bottomY} L ${width - padR} ${bottomY}`} stroke="#E5E7EB" strokeWidth={1} />

      {yLabels.map(({ v, px }) => (
        <React.Fragment key={v}>
          <Path
            d={`M ${padL - 4} ${px.toFixed(1)} L ${padL} ${px.toFixed(1)}`}
            stroke="#9CA3AF" strokeWidth={1}
          />
          <SvgText
            x={padL - 7}
            y={px + 4}
            textAnchor="end"
            fontSize={10}
            fill={v === HIGH ? "#EF4444" : v === LOW ? "#F59E0B" : "#9CA3AF"}
            fontWeight={v === HIGH || v === LOW ? "600" : "400"}
          >
            {v}
          </SvgText>
        </React.Fragment>
      ))}

      <Path
        d={linePath}
        fill="none"
        stroke="#1F2937"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={`M ${last.x.toFixed(1)} ${last.y.toFixed(1)} L ${last.x.toFixed(1)} ${bottomY}`}
        stroke="#9CA3AF" strokeWidth={1} strokeDasharray="4,3"
      />
      <Circle cx={last.x} cy={last.y} r={8}   fill="white" stroke={activeColor} strokeWidth={2} />
      <Circle cx={last.x} cy={last.y} r={3.5} fill={activeColor} />

      {xLabels.map(({ label, x }, i) => (
        <SvgText key={i} x={x} y={H - 6} textAnchor="middle" fontSize={9.5} fill="#9CA3AF">
          {label}
        </SvgText>
      ))}
    </Svg>
  );
}
