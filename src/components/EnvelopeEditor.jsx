import React, { useRef } from "react";
import { prettyTime } from "../utils/helpers";

export default function EnvelopeEditor({
  points,
  onChange,
  duration,
  theme,
  accentColor,
}) {
  const svgRef = useRef(null);
  const W = 800,
    H = 160;
  const PAD = { top: 12, bottom: 28, left: 40, right: 16 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const colors =
    theme === "dark"
      ? {
          bg: "#070e14",
          grid: "rgba(255,255,255,0.06)",
          text: "#6b8099",
          line: accentColor,
          fill: accentColor + "33",
          pointStroke: accentColor,
        }
      : {
          bg: "#f0f4f8",
          grid: "rgba(0,0,0,0.08)",
          text: "#6b7280",
          line: accentColor,
          fill: accentColor + "33",
          pointStroke: accentColor,
        };

  const tx = (t) => PAD.left + t * innerW;
  const ty = (v) => PAD.top + (1 - v) * innerH;
  const xt = (x) => Math.max(0, Math.min(1, (x - PAD.left) / innerW));
  const yv = (y) => Math.max(0, Math.min(1, 1 - (y - PAD.top) / innerH));

  const pathD = () => {
    if (!points.length) return "";
    const pts = [...points].sort((a, b) => a.t - b.t);
    let d = `M ${tx(pts[0].t)} ${ty(pts[0].v)}`;
    for (let i = 1; i < pts.length; i++)
      d += ` L ${tx(pts[i].t)} ${ty(pts[i].v)}`;
    d += ` L ${tx(pts[pts.length - 1].t)} ${ty(0)} L ${tx(pts[0].t)} ${ty(
      0
    )} Z`;
    return d;
  };

  const linePath = () => {
    if (!points.length) return "";
    const pts = [...points].sort((a, b) => a.t - b.t);
    let d = `M ${tx(pts[0].t)} ${ty(pts[0].v)}`;
    for (let i = 1; i < pts.length; i++)
      d += ` L ${tx(pts[i].t)} ${ty(pts[i].v)}`;
    return d;
  };

  const getSVGCoords = (e) => {
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (W / rect.width),
      y: (e.clientY - rect.top) * (H / rect.height),
    };
  };

  const handleMouseDown = (e, idx) => {
    e.preventDefault();
    e.stopPropagation();
    const onMove = (ev) => {
      const { x, y } = getSVGCoords(ev);
      const newT = idx === 0 ? 0 : idx === points.length - 1 ? 1 : xt(x);
      onChange(
        points
          .map((p, i) => (i === idx ? { t: newT, v: yv(y) } : p))
          .sort((a, b) => a.t - b.t)
      );
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleSVGClick = (e) => {
    if (e.button !== 0) return;
    const { x, y } = getSVGCoords(e);
    for (let i = 0; i < points.length; i++) {
      if (
        Math.abs(x - tx(points[i].t)) < 10 &&
        Math.abs(y - ty(points[i].v)) < 10
      )
        return;
    }
    onChange([...points, { t: xt(x), v: yv(y) }].sort((a, b) => a.t - b.t));
  };

  const handleRightClick = (e, idx) => {
    e.preventDefault();
    if (idx === 0 || idx === points.length - 1) return;
    onChange(points.filter((_, i) => i !== idx));
  };

  const hLines = [0, 0.25, 0.5, 0.75, 1.0];
  const vCount = Math.min(10, Math.ceil(duration || 1));
  const vLines = Array.from({ length: vCount + 1 }, (_, i) => i / vCount);

  return (
    <div style={{ userSelect: "none" }}>
      <div
        style={{
          fontSize: 11,
          color: theme === "dark" ? "#6b8099" : "#6b7280",
          marginBottom: 6,
          display: "flex",
          gap: 16,
        }}
      >
        <span>
          Volume Envelope — <strong>click</strong> to add point •{" "}
          <strong>drag</strong> to move • <strong>right-click</strong> to remove
        </span>
        <span style={{ marginLeft: "auto" }}>
          {points.length} point{points.length !== 1 ? "s" : ""}
        </span>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: "100%",
          background: colors.bg,
          borderRadius: 8,
          cursor: "crosshair",
          display: "block",
          border: `1px solid ${
            theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.1)"
          }`,
        }}
        onClick={handleSVGClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {hLines.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              y1={ty(v)}
              x2={PAD.left + innerW}
              y2={ty(v)}
              stroke={colors.grid}
              strokeWidth={v === 0 || v === 1 ? 1.5 : 1}
            />
            <text
              x={PAD.left - 6}
              y={ty(v) + 4}
              textAnchor="end"
              fill={colors.text}
              fontSize={10}
              fontFamily="ui-monospace,monospace"
            >
              {Math.round(v * 100)}%
            </text>
          </g>
        ))}
        {vLines.map((t, i) => (
          <g key={i}>
            <line
              x1={tx(t)}
              y1={PAD.top}
              x2={tx(t)}
              y2={PAD.top + innerH}
              stroke={colors.grid}
              strokeWidth={1}
            />
            <text
              x={tx(t)}
              y={PAD.top + innerH + 16}
              textAnchor="middle"
              fill={colors.text}
              fontSize={10}
              fontFamily="ui-monospace,monospace"
            >
              {prettyTime(t * (duration || 1))}
            </text>
          </g>
        ))}
        <path d={pathD()} fill={colors.fill} />
        <path
          d={linePath()}
          fill="none"
          stroke={colors.line}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={tx(p.t)}
              cy={ty(p.v)}
              r={7}
              fill={colors.bg}
              stroke={colors.pointStroke}
              strokeWidth={2}
              style={{ cursor: "grab" }}
              onMouseDown={(e) => handleMouseDown(e, i)}
              onContextMenu={(e) => handleRightClick(e, i)}
            />
            <circle
              cx={tx(p.t)}
              cy={ty(p.v)}
              r={3}
              fill={colors.line}
              style={{ pointerEvents: "none" }}
            />
          </g>
        ))}
        <text
          x={PAD.left - 6}
          y={PAD.top - 4}
          textAnchor="middle"
          fill={colors.text}
          fontSize={9}
          fontFamily="ui-monospace,monospace"
        >
          VOL
        </text>
        <text
          x={PAD.left + innerW / 2}
          y={H - 2}
          textAnchor="middle"
          fill={colors.text}
          fontSize={9}
          fontFamily="ui-monospace,monospace"
        >
          TIME
        </text>
      </svg>
    </div>
  );
}
