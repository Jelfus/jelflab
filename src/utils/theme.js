// Returns the full colours object and the four cue accent colours
// for the active theme. Re-exported from JPLite to avoid prop drilling.
export function getThemeColors(theme) {
  return theme === "dark"
    ? {
        bg: "#06080a",
        text: "#e6eef6",
        sidebar: "#0b0f12",
        panel: "#0f1316",
        border: "rgba(255,255,255,0.02)",
        input: "rgba(255,255,255,0.02)",
        inputBorder: "rgba(255,255,255,0.04)",
        hover: "rgba(255,255,255,0.02)",
        muted: "#9aa6b2",
        gridHeader: "linear-gradient(180deg,#0d1114,#0f1316)",
      }
    : {
        bg: "#f8f9fa",
        text: "#1a1a1a",
        sidebar: "#ffffff",
        panel: "#f1f3f5",
        border: "rgba(0,0,0,0.08)",
        input: "#ffffff",
        inputBorder: "rgba(0,0,0,0.12)",
        hover: "rgba(0,0,0,0.03)",
        muted: "#6c757d",
        gridHeader: "linear-gradient(180deg,#e9ecef,#f1f3f5)",
      };
}

export const DEFAULT_CUE_COLORS = {
  audio: { light: "#ef4444", dark: "#ef4444" },
  control: { light: "#3b82f6", dark: "#3b82f6" },
  note: { light: "#a855f7", dark: "#a855f7" },
  playlist: { light: "#f59e0b", dark: "#f59e0b" },
};
