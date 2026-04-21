import React, { useRef, useState } from "react";
import { View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Line,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

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
  const padL = 8;
  const padR = 8;
  const padT = 20;
  const padB = 32;
  const plotW = width - padL - padR;
  const plotH = H - padT - padB;

  const [selected, setSelected] = useState<{ x: number; y: number; v: number; label: string } | null>(null);
  const svgRef = useRef<any>(null);

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

  const points = parsed.map((r) => ({
    x: toX(r.t), y: toY(r.v), v: r.v,
    label: (() => {
      const h = r.date.getHours(), m = r.date.getMinutes();
      const ampm = h >= 12 ? "PM" : "AM";
      return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
    })(),
  }));

  const linePath = smoothPath(points);
  const bottomY  = padT + plotH;

  const bands = points.slice(0, -1).map((p1, i) => {
    const p2 = points[i + 1];
    const { cp1x, cp1y, cp2x, cp2y } = segmentControlPoints(points, i);
    const avgV = (p1.v + p2.v) / 2;
    const color = avgV < LOW ? "#F59E0B" : avgV > HIGH ? "#EF4444" : "#22C55E";
    const path =
      `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}` +
      ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}` +
      ` L ${p2.x.toFixed(1)} ${bottomY} L ${p1.x.toFixed(1)} ${bottomY} Z`;
    return { path, color, id: `sg_${i}`, topY: Math.min(p1.y, p2.y, cp1y, cp2y) };
  });

  const yHighPx = toY(HIGH);
  const yLowPx  = toY(LOW);

  // Y labels on the right side

  // X labels
  const MAX_X = 4;
  const step = Math.max(1, Math.round((parsed.length - 1) / (MAX_X - 1)));
  const xIdxSet = new Set<number>();
  for (let i = 0; i < parsed.length; i += step) xIdxSet.add(i);
  xIdxSet.add(parsed.length - 1);
  const LABEL_HALF = 26;
  const xLabels = Array.from(xIdxSet).sort((a, b) => a - b).map((idx) => {
    const rawX = points[idx].x;
    const x = Math.min(Math.max(rawX, padL + LABEL_HALF), width - padR - LABEL_HALF);
    return { label: points[idx].label, x };
  });

  const last = points[points.length - 1];
  const lastColor = last.v < LOW ? "#F59E0B" : last.v > HIGH ? "#EF4444" : "#22C55E";

  // Touch handler — find nearest point
  const handleTouch = (evt: any) => {
    const touchX = evt.nativeEvent.locationX;
    let nearest = points[0];
    let minDist = Math.abs(points[0].x - touchX);
    for (const p of points) {
      const d = Math.abs(p.x - touchX);
      if (d < minDist) { minDist = d; nearest = p; }
    }
    setSelected(nearest);
  };

  // Tooltip positioning
  const tooltipW = 100;
  const tooltipH = 40;
  const tipX = selected
    ? Math.min(Math.max(selected.x - tooltipW / 2, padL), width - padR - tooltipW)
    : 0;
  const tipY = selected ? Math.max(selected.y - tooltipH - 10, padT) : 0;
  const selColor = selected
    ? selected.v < LOW ? "#F59E0B" : selected.v > HIGH ? "#EF4444" : "#22C55E"
    : "#22C55E";

  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      onResponderRelease={() => setTimeout(() => setSelected(null), 1800)}
    >
      <Svg width={width} height={H} ref={svgRef}>
        <Defs>
          {bands.map(({ id, color, topY }) => (
            <SvgGradient key={id} id={id} x1={0} y1={topY} x2={0} y2={bottomY} gradientUnits="userSpaceOnUse">
              <Stop offset="0%"   stopColor={color} stopOpacity={0.45} />
              <Stop offset="100%" stopColor={color} stopOpacity={0.03} />
            </SvgGradient>
          ))}
          <SvgGradient id="tooltipBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#1E3A52" stopOpacity={0.95} />
            <Stop offset="100%" stopColor="#0B1A2E" stopOpacity={0.95} />
          </SvgGradient>
        </Defs>

        {/* Fill bands */}
        {bands.map(({ path, id }) => (
          <Path key={id} d={path} fill={`url(#${id})`} />
        ))}

        {/* Y axis line */}
        <Line x1={padL} y1={padT} x2={padL} y2={bottomY} stroke="#94A3B8" strokeWidth={1.5} />
        {/* X axis line */}
        <Line x1={padL} y1={bottomY} x2={width - padR} y2={bottomY} stroke="#94A3B8" strokeWidth={1.5} />

        {/* Reference lines */}
        <Line x1={padL} y1={yHighPx} x2={width - padR} y2={yHighPx} stroke="#EF4444" strokeWidth={1} strokeDasharray="5,4" strokeOpacity={0.4} />
        <Line x1={padL} y1={yLowPx}  x2={width - padR} y2={yLowPx}  stroke="#F59E0B" strokeWidth={1} strokeDasharray="5,4" strokeOpacity={0.4} />

        {/* Y tick marks + labels — right of Y axis */}
        <Line x1={padL - 4} y1={yHighPx} x2={padL} y2={yHighPx} stroke="#EF4444" strokeWidth={1.5} />
        <Line x1={padL - 4} y1={yLowPx}  x2={padL} y2={yLowPx}  stroke="#F59E0B" strokeWidth={1.5} />
        <SvgText x={padL + 5} y={yHighPx - 4} fontSize={10} fill="#EF4444" fontWeight="700" textAnchor="start">{HIGH}</SvgText>
        <SvgText x={padL + 5} y={yLowPx  - 4} fontSize={10} fill="#F59E0B" fontWeight="700" textAnchor="start">{LOW}</SvgText>

        {/* Smooth line */}
        <Path d={linePath} fill="none" stroke="#1A6FA8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Crosshair for selected */}
        {selected && (
          <>
            <Line x1={selected.x} y1={padT} x2={selected.x} y2={bottomY} stroke="#1A6FA8" strokeWidth={1} strokeDasharray="4,3" strokeOpacity={0.6} />
            <Circle cx={selected.x} cy={selected.y} r={10} fill={selColor} fillOpacity={0.2} />
            <Circle cx={selected.x} cy={selected.y} r={5} fill="white" stroke={selColor} strokeWidth={2} />
          </>
        )}

        {/* Last point indicator (when nothing selected) */}
        {!selected && (
          <>
            <Line x1={last.x} y1={last.y} x2={last.x} y2={bottomY} stroke="#9CA3AF" strokeWidth={1} strokeDasharray="4,3" />
            <Circle cx={last.x} cy={last.y} r={9}   fill="white" stroke={lastColor} strokeWidth={2} />
            <Circle cx={last.x} cy={last.y} r={3.5} fill={lastColor} />
          </>
        )}

        {/* Tooltip */}
        {selected && (
          <>
            <Rect x={tipX} y={tipY} width={tooltipW} height={tooltipH} rx={8} fill="url(#tooltipBg)" />
            <SvgText x={tipX + tooltipW / 2} y={tipY + 15} textAnchor="middle" fontSize={12} fontWeight="700" fill={selColor}>
              {Math.round(selected.v)}{" "}
              <SvgText fontSize={10} fontWeight="400" fill="#94A3B8">mg/dL</SvgText>
            </SvgText>
            <SvgText x={tipX + tooltipW / 2} y={tipY + 30} textAnchor="middle" fontSize={10} fill="#94A3B8">
              {selected.label}
            </SvgText>
          </>
        )}

        {/* X labels */}
        {xLabels.map(({ label, x }, i) => (
          <SvgText
            key={i} x={x} y={H - 6} fontSize={9.5} fill="#9CA3AF"
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
