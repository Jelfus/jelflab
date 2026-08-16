export const uid = (prefix = "") =>
  `${prefix}${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;

export function prettyTime(s) {
  if (s == null || Number.isNaN(s)) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function lightenColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16),
    g = parseInt(hex.slice(3, 5), 16),
    b = parseInt(hex.slice(5, 7), 16);
  const l = (c) => Math.min(255, Math.floor(c + (255 - c) * 0.5));
  return `#${l(r).toString(16).padStart(2, "0")}${l(g)
    .toString(16)
    .padStart(2, "0")}${l(b).toString(16).padStart(2, "0")}`;
}
