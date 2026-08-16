import React from "react";
import { prettyTime } from "../utils/helpers";

export default function PlaylistEditorModal({
  playlistEditOpen,
  playlistEditIndex,
  cues,
  setCues,
  addFilesToPlaylist,
  closePlaylistEditor,
  theme,
  colors,
}) {
  if (!playlistEditOpen || playlistEditIndex == null) return null;

  const playlist = cues[playlistEditIndex];

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
      onClick={closePlaylistEditor}
    >
      <div
        style={{
          width: "90%",
          maxWidth: 700,
          maxHeight: "80vh",
          background: theme === "dark" ? "#0f1417" : "#ffffff",
          borderRadius: 10,
          padding: 20,
          border: `1px solid ${colors.border}`,
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 16, color: colors.text }}>
            Edit Playlist Items
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <label className="btn-small">
              Add Files
              <input
                type="file"
                accept="audio/*"
                multiple
                onChange={(e) => {
                  addFilesToPlaylist(e.target.files, playlistEditIndex);
                  e.target.value = "";
                }}
                style={{ display: "none" }}
              />
            </label>
            <div className="btn-small" onClick={closePlaylistEditor}>
              Close
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {playlist?.playlistItems?.length === 0 && (
            <div
              style={{ padding: 24, color: colors.muted, textAlign: "center" }}
            >
              No items. Click "Add Files" to add audio.
            </div>
          )}
          {playlist?.playlistItems?.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 10,
                background: colors.panel,
                borderRadius: 6,
                marginBottom: 8,
                border: `1px solid ${colors.border}`,
              }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", idx.toString());
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const fromIdx = parseInt(
                  e.dataTransfer.getData("text/plain"),
                  10
                );
                if (Number.isNaN(fromIdx)) return;
                setCues((prev) => {
                  const copy = [...prev];
                  const items = [...copy[playlistEditIndex].playlistItems];
                  const [moved] = items.splice(fromIdx, 1);
                  items.splice(idx, 0, moved);
                  copy[playlistEditIndex] = {
                    ...copy[playlistEditIndex],
                    playlistItems: items,
                  };
                  return copy;
                });
              }}
            >
              <div
                style={{
                  color: colors.muted,
                  fontSize: 13,
                  fontFamily: "ui-monospace",
                  minWidth: 30,
                }}
              >
                {idx + 1}.
              </div>
              <div style={{ flex: 1, fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: colors.muted }}>
                  {prettyTime(item.duration)}
                </div>
              </div>
              <div
                className="btn-small"
                onClick={() =>
                  setCues((prev) => {
                    const copy = [...prev];
                    const items = copy[playlistEditIndex].playlistItems.filter(
                      (_, i) => i !== idx
                    );
                    copy[playlistEditIndex] = {
                      ...copy[playlistEditIndex],
                      playlistItems: items,
                    };
                    return copy;
                  })
                }
              >
                ✕
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
