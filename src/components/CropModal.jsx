import React from "react";
import CropOverlay from "./CropOverlay";
import EnvelopeEditor from "./EnvelopeEditor";
import { prettyTime, hexToRgba } from "../utils/helpers";

const ENVELOPE_PRESETS = {
  flat: [
    { t: 0, v: 1 },
    { t: 1, v: 1 },
  ],
  fadeIn: [
    { t: 0, v: 0 },
    { t: 1, v: 1 },
  ],
  fadeOut: [
    { t: 0, v: 1 },
    { t: 1, v: 0 },
  ],
  fadeBoth: [
    { t: 0, v: 0 },
    { t: 0.15, v: 1 },
    { t: 0.85, v: 1 },
    { t: 1, v: 0 },
  ],
  swell: [
    { t: 0, v: 0.3 },
    { t: 0.5, v: 1 },
    { t: 1, v: 0.3 },
  ],
  duck: [
    { t: 0, v: 1 },
    { t: 0.2, v: 0.2 },
    { t: 0.8, v: 0.2 },
    { t: 1, v: 1 },
  ],
};

export default function CropModal({
  // visibility
  cropOpen,
  cropIndex,
  // cue data
  cropCue,
  cues,
  // waveform
  waveformContainerRef,
  wavesurferRef,
  wfLoading,
  wfDuration,
  // crop region
  cropRegion,
  setCropRegion,
  // envelope
  cropTab,
  setCropTab,
  envelopePoints,
  setEnvelopePoints,
  // actions
  applyCropFromWave,
  applyEnvelopeToSave,
  clearEnvelope,
  closeCrop,
  // theme
  theme,
  colors,
  audioColor,
}) {
  if (!cropOpen || cropIndex == null) return null;

  const cropDuration = cropCue
    ? (cropCue.cropEnd ?? cropCue.duration ?? 0) - (cropCue.cropStart ?? 0)
    : 0;

  const tabStyle = (active) => ({
    padding: "8px 20px",
    borderRadius: "8px 8px 0 0",
    border: "none",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    background: active
      ? theme === "dark"
        ? "#0f1417"
        : "#ffffff"
      : theme === "dark"
      ? "#060c10"
      : "#e9ecef",
    color: active ? audioColor : colors.muted,
    borderBottom: active ? `2px solid ${audioColor}` : "2px solid transparent",
    transition: "all 0.15s",
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={closeCrop}
    >
      <div
        style={{
          width: "92%",
          maxWidth: 980,
          maxHeight: "92vh",
          background: theme === "dark" ? "#0a1018" : "#ffffff",
          borderRadius: 12,
          border: `1px solid ${
            theme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.1)"
          }`,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: `1px solid ${
              theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"
            }`,
            background: theme === "dark" ? "#06090d" : "#f8fafc",
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: colors.text }}>
              Audio Editor
            </div>
            <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
              {cropCue?.name} — {prettyTime(cropCue?.duration)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div
              className="btn-small"
              onClick={() => {
                applyCropFromWave();
                applyEnvelopeToSave();
              }}
              style={{
                background: hexToRgba(audioColor, 0.15),
                borderColor: hexToRgba(audioColor, 0.3),
                color: audioColor,
                fontWeight: 700,
              }}
            >
              ✓ Apply All
            </div>
            <div className="btn-small" onClick={closeCrop}>
              ✕ Close
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            padding: "0 20px",
            background: theme === "dark" ? "#06090d" : "#f8fafc",
            borderBottom: `1px solid ${
              theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)"
            }`,
          }}
        >
          <button
            style={tabStyle(cropTab === "crop")}
            onClick={() => setCropTab("crop")}
          >
            ✂️ Crop / Trim
          </button>
          <button
            style={tabStyle(cropTab === "envelope")}
            onClick={() => setCropTab("envelope")}
          >
            📈 Volume Envelope
            {cues[cropIndex]?.volumeEnvelope?.length > 2 && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 10,
                  background: hexToRgba(audioColor, 0.2),
                  color: audioColor,
                }}
              >
                active
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {/* ── Crop tab ── */}
          <div style={{ display: cropTab === "crop" ? "block" : "none" }}>
            <div
              style={{ fontSize: 12, color: colors.muted, marginBottom: 12 }}
            >
              Drag the red handles to set crop in/out points. The body of the
              region can also be dragged to shift the selection.
            </div>
            <div
              style={{
                position: "relative",
                borderRadius: 10,
                overflow: "hidden",
                background: theme === "dark" ? "#040c12" : "#f0f4f8",
                border: `1px solid ${
                  theme === "dark"
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.08)"
                }`,
                minHeight: 128,
              }}
            >
              <div ref={waveformContainerRef} style={{ minHeight: 128 }} />
              {!wfLoading && wfDuration > 0 && (
                <CropOverlay
                  region={cropRegion}
                  onChange={setCropRegion}
                  duration={wfDuration}
                  theme={theme}
                  accentColor="#ef4444"
                />
              )}
              {wfLoading && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: colors.muted,
                    fontSize: 13,
                    background: theme === "dark" ? "#040c12" : "#f0f4f8",
                  }}
                >
                  Loading waveform…
                </div>
              )}
            </div>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <div
                  className="btn-small"
                  onClick={() => wavesurferRef.current?.playPause()}
                >
                  ⏯ Play/Pause
                </div>
                <div
                  className="btn-small"
                  onClick={() => wavesurferRef.current?.stop()}
                >
                  ⏹ Stop
                </div>
              </div>
              <div style={{ flex: 1 }} />
              <div
                className="btn-small"
                onClick={() => {
                  if (wfDuration > 0) setCropRegion({ start: 0, end: 1 });
                }}
              >
                Reset Crop
              </div>
              <div
                className="btn-small"
                onClick={applyCropFromWave}
                style={{
                  background: hexToRgba(audioColor, 0.15),
                  borderColor: hexToRgba(audioColor, 0.3),
                  color: audioColor,
                  fontWeight: 700,
                }}
              >
                Apply Crop
              </div>
            </div>
            <div
              style={{
                marginTop: 14,
                padding: 12,
                background:
                  theme === "dark"
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(0,0,0,0.03)",
                borderRadius: 8,
                fontSize: 12,
                color: colors.muted,
                display: "flex",
                gap: 24,
              }}
            >
              <span>
                In:{" "}
                <strong style={{ color: colors.text }}>
                  {prettyTime(cropRegion.start * wfDuration)}
                </strong>
              </span>
              <span>
                Out:{" "}
                <strong style={{ color: colors.text }}>
                  {prettyTime(cropRegion.end * wfDuration)}
                </strong>
              </span>
              <span>
                Duration:{" "}
                <strong style={{ color: colors.text }}>
                  {prettyTime((cropRegion.end - cropRegion.start) * wfDuration)}
                </strong>
              </span>
            </div>
          </div>

          {/* ── Envelope tab ── */}
          <div style={{ display: cropTab === "envelope" ? "block" : "none" }}>
            <div
              style={{
                marginBottom: 14,
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: colors.text,
                    marginBottom: 4,
                  }}
                >
                  Volume Envelope
                </div>
                <div style={{ fontSize: 12, color: colors.muted }}>
                  Shape the volume over time. The envelope scales with the cue's
                  base volume.
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 11, color: colors.muted }}>
                  Presets:
                </span>
                {[
                  ["flat", "Flat"],
                  ["fadeIn", "Fade In"],
                  ["fadeOut", "Fade Out"],
                  ["fadeBoth", "Fade In+Out"],
                  ["swell", "Swell"],
                  ["duck", "Duck"],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    className="env-preset-btn"
                    onClick={() => setEnvelopePoints(ENVELOPE_PRESETS[k])}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <EnvelopeEditor
              points={envelopePoints}
              onChange={setEnvelopePoints}
              duration={cropDuration || cropCue?.duration || 1}
              theme={theme}
              accentColor={audioColor}
            />
            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: colors.muted,
                  alignSelf: "center",
                }}
              >
                {envelopePoints.length} control points
              </div>
              <div className="btn-small" onClick={clearEnvelope}>
                Clear Envelope
              </div>
              <div
                className="btn-small"
                onClick={applyEnvelopeToSave}
                style={{
                  background: hexToRgba(audioColor, 0.15),
                  borderColor: hexToRgba(audioColor, 0.3),
                  color: audioColor,
                  fontWeight: 700,
                }}
              >
                Save Envelope
              </div>
            </div>
            <div
              style={{
                marginTop: 16,
                padding: 12,
                background:
                  theme === "dark"
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(0,0,0,0.03)",
                borderRadius: 8,
                fontSize: 11,
                color: colors.muted,
              }}
            >
              <strong style={{ color: colors.text }}>Envelope points:</strong>{" "}
              {[...envelopePoints]
                .sort((a, b) => a.t - b.t)
                .map((p, i) => (
                  <span
                    key={i}
                    style={{
                      marginRight: 12,
                      fontFamily: "ui-monospace,monospace",
                    }}
                  >
                    {prettyTime(p.t * (cropDuration || cropCue?.duration || 1))}{" "}
                    → {Math.round(p.v * 100)}%
                  </span>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
