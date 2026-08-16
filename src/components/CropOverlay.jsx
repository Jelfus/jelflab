import React, { useRef, useEffect } from "react";
import { prettyTime } from "../utils/helpers";

export default function CropOverlay({ region, onChange, duration }) {
  const wrapRef = useRef(null);
  const regionRef = useRef(region);
  useEffect(() => {
    regionRef.current = region;
  }, [region]);

  const getFrac = (clientX) => {
    const wrap = wrapRef.current;
    if (!wrap) return 0;
    const rect = wrap.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const onBodyMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startFrac = getFrac(e.clientX);
    const startRegion = { ...regionRef.current };
    const onMove = (ev) => {
      const delta = getFrac(ev.clientX) - startFrac;
      const span = startRegion.end - startRegion.start;
      let ns = Math.max(0, startRegion.start + delta);
      let ne = ns + span;
      if (ne > 1) {
        ne = 1;
        ns = 1 - span;
      }
      onChange({ start: ns, end: ne });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "grabbing";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onLeftMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const onMove = (ev) => {
      const frac = getFrac(ev.clientX);
      const cur = regionRef.current;
      onChange({ start: Math.min(frac, cur.end - 0.01), end: cur.end });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const onRightMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const onMove = (ev) => {
      const frac = getFrac(ev.clientX);
      const cur = regionRef.current;
      onChange({ start: cur.start, end: Math.max(frac, cur.start + 0.01) });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const regionWidth = `${(region.end - region.start) * 100}%`;
  const regionLeft = `${region.start * 100}%`;
  const handleW = 7;
  const handleColor = "#ef4444";
  const outsideColor = "rgba(0,0,0,0.35)";

  return (
    <div
      ref={wrapRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        borderRadius: 8,
      }}
    >
      {/* Darkened areas outside the selection */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: regionLeft,
          background: outsideColor,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: `${(1 - region.end) * 100}%`,
          background: outsideColor,
          pointerEvents: "none",
        }}
      />

      {/* Region body */}
      <div
        style={{
          position: "absolute",
          left: regionLeft,
          width: regionWidth,
          top: 0,
          bottom: 0,
          background: "rgba(239,68,68,0.22)",
          border: `2px solid ${handleColor}`,
          boxSizing: "border-box",
          cursor: "grab",
          pointerEvents: "all",
        }}
        onMouseDown={onBodyMouseDown}
      >
        {/* Time labels */}
        <div
          style={{
            position: "absolute",
            bottom: 4,
            left: handleW + 4,
            right: handleW + 4,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "rgba(255,255,255,0.85)",
            fontFamily: "ui-monospace, monospace",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <span>{prettyTime(region.start * duration)}</span>
          <span>{prettyTime(region.end * duration)}</span>
        </div>
      </div>

      {/* Left handle — sibling of region body so it's never clipped */}
      <div
        style={{
          position: "absolute",
          left: regionLeft,
          top: 0,
          bottom: 0,
          width: handleW,
          background: handleColor,
          cursor: "col-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.92,
          pointerEvents: "all",
          zIndex: 2,
        }}
        onMouseDown={onLeftMouseDown}
      >
        <span
          style={{
            color: "white",
            fontSize: 9,
            userSelect: "none",
            lineHeight: 1,
          }}
        >
          ‹
        </span>
      </div>

      {/* Right handle */}
      <div
        style={{
          position: "absolute",
          left: `calc(${region.end * 100}% - ${handleW}px)`,
          top: 0,
          bottom: 0,
          width: handleW,
          background: handleColor,
          cursor: "col-resize",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.92,
          pointerEvents: "all",
          zIndex: 2,
        }}
        onMouseDown={onRightMouseDown}
      >
        <span
          style={{
            color: "white",
            fontSize: 9,
            userSelect: "none",
            lineHeight: 1,
          }}
        >
          ›
        </span>
      </div>
    </div>
  );
}
