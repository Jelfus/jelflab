import React from "react";
import { DEFAULT_CUE_COLORS } from "../utils/theme";

export default function ColorModal({
  colorMenuOpen,
  setColorMenuOpen,
  cueColors,
  setCueColors,
  theme,
  colors,
}) {
  if (!colorMenuOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={() => setColorMenuOpen(false)}
    >
      <div
        style={{
          width: "90%",
          maxWidth: 500,
          background: theme === "dark" ? "#0f1417" : "#ffffff",
          borderRadius: 10,
          padding: 20,
          border: `1px solid ${colors.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, color: colors.text }}>
            Customize Cue Colors
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div
              className="btn-small"
              onClick={() => setCueColors(DEFAULT_CUE_COLORS)}
            >
              Reset
            </div>
            <div className="btn-small" onClick={() => setColorMenuOpen(false)}>
              Close
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[
            ["audio", "🎵", "Audio"],
            ["control", "⚙️", "Control"],
            ["note", "📝", "Note"],
            ["playlist", "📂", "Playlist"],
          ].map(([key, icon, label]) => (
            <div
              key={key}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span
                  style={{ fontWeight: 600, fontSize: 14, color: colors.text }}
                >
                  {label} Cue Color
                </span>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {["light", "dark"].map((t) => (
                  <div
                    key={t}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                      flex: 1,
                    }}
                  >
                    <label style={{ fontSize: 12, color: colors.muted }}>
                      {t === "light" ? "Light" : "Dark"} Theme
                    </label>
                    <input
                      type="color"
                      value={cueColors[key][t]}
                      onChange={(e) =>
                        setCueColors((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], [t]: e.target.value },
                        }))
                      }
                      style={{
                        width: "100%",
                        height: 40,
                        border: `1px solid ${colors.inputBorder}`,
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
