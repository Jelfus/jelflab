import React from "react";
import { prettyTime, lightenColor } from "../utils/helpers";
import {
  ACTIONS_NEEDING_TARGET,
  ACTIONS_NEEDING_FADE,
  ACTIONS_NEEDING_VOLUME,
} from "../constants";

export default function CueRow({
  cue,
  i,
  isSelected,
  isPlaying,
  countdown,
  columnsTemplate,
  cues,
  setCues,
  audioRefs,
  getEnvelopeValueAt,
  masterVolume,
  playCueAt,
  stopSingle,
  fadeOutSingle,
  openCropModal,
  duplicateCue,
  deleteCue,
  openPlaylistEditor,
  addFilesToPlaylist,
  pushHistory,
  setSelectedIndex,
  theme,
  colors,
  audioColor,
  controlColor,
  noteColor,
  playlistColor,
}) {
  const isControl = cue.type === "control";
  const isNote = cue.type === "note";
  const isPlaylist = cue.type === "playlist";
  const isCounting = countdown != null && countdown > 0;

  const cropStart = cue.cropStart ?? 0;
  const cropEnd = cue.cropEnd ?? cue.duration ?? 0;
  const croppedDuration = cropEnd - cropStart;
  const croppedCurrentTime = Math.max(0, (cue.currentTime || 0) - cropStart);
  const hasEnvelope = cue.volumeEnvelope && cue.volumeEnvelope.length > 2;

  const rowClass = [
    "cue-grid-row",
    isPlaying ? "playing" : "",
    isSelected ? "selected" : "",
    isControl ? "control-cue" : "",
    isNote ? "note-cue" : "",
    isPlaylist ? "playlist-cue" : "",
    isCounting ? "counting-down" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const selectStyle = {
    padding: "5px 7px",
    borderRadius: 6,
    background: theme === "dark" ? "#071018" : "#e9ecef",
    border: `1px solid ${colors.inputBorder}`,
    color: colors.text,
    fontSize: 12,
    flex: 1,
  };

  const advanceSelectStyle = {
    padding: 7,
    borderRadius: 6,
    background: theme === "dark" ? "#071018" : "#e9ecef",
    border: `1px solid ${colors.inputBorder}`,
    color: colors.text,
    minWidth: 140,
    fontSize: 12,
  };

  function updateCue(patch) {
    setCues((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], ...patch };
      return copy;
    });
  }

  return (
    <div
      className={rowClass}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", i.toString());
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const fi = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (Number.isNaN(fi)) return;
        pushHistory();
        setCues((prev) => {
          const arr = [...prev];
          const [m] = arr.splice(fi, 1);
          arr.splice(i, 0, m);
          return arr.map((c, idx) => ({ ...c, number: idx + 1 }));
        });
      }}
      onClick={() => setSelectedIndex(i)}
      style={{ gridTemplateColumns: columnsTemplate }}
    >
      {/* Play button */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <div
          className="btn-small"
          onClick={(e) => {
            e.stopPropagation();
            playCueAt(i);
          }}
        >
          ▶
        </div>
      </div>

      {/* Number / countdown */}
      <div
        style={{
          textAlign: "center",
          fontFamily: "ui-monospace, Menlo, monospace",
          color: isControl
            ? lightenColor(controlColor)
            : isNote
            ? lightenColor(noteColor)
            : isPlaylist
            ? lightenColor(playlistColor)
            : lightenColor(audioColor),
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        {isCounting ? (
          <span
            className="countdown-badge"
            title={`Delayed — fires in ${countdown.toFixed(1)}s`}
          >
            {countdown.toFixed(1)}
          </span>
        ) : (
          cue.number
        )}
      </div>

      {/* Name (+ notes inline for note cues) */}
      <div>
        <input
          value={cue.name}
          onChange={(e) => updateCue({ name: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          style={{ width: "100%" }}
        />
        {cue.notes && !isNote && (
          <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
            {cue.notes}
          </div>
        )}
        {isNote && (
          <textarea
            value={cue.notes}
            onChange={(e) => updateCue({ notes: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              marginTop: 6,
              minHeight: 60,
              resize: "vertical",
              fontFamily: "inherit",
              color: colors.text,
              background: colors.input,
              border: `1px solid ${colors.inputBorder}`,
              padding: 7,
              borderRadius: 6,
              fontSize: 12,
            }}
          />
        )}
      </div>

      {/* Filename / type label */}
      <div
        style={{
          color: colors.muted,
          fontSize: 12,
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
        }}
      >
        {cue.fileName ||
          (isControl
            ? "Control"
            : isNote
            ? "Note"
            : isPlaylist
            ? `${cue.playlistItems?.length || 0} items`
            : "—")}
      </div>

      {/* Volume + progress (audio / playlist) or control label */}
      {!isControl && !isNote ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={cue.volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                updateCue({ volume: v });
                if (!isPlaylist) {
                  const h = audioRefs.current.get(cue.id);
                  if (h) {
                    if (h.gainNode) {
                      try {
                        h.gainNode.gain.value =
                          v * getEnvelopeValueAt(cue, cue.progress || 0);
                      } catch {}
                    } else {
                      try {
                        h.el.volume =
                          v *
                          getEnvelopeValueAt(cue, cue.progress || 0) *
                          masterVolume;
                      } catch {}
                    }
                  }
                }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ flex: 1 }}
            />
            <div
              style={{
                width: 42,
                textAlign: "right",
                fontWeight: 600,
                fontSize: 12,
              }}
            >
              {Math.round((cue.volume || 0) * 100)}%
            </div>
          </div>
          <div
            className="progress-wrap"
            title="Click to seek"
            style={{ cursor: isPlaylist ? "default" : "pointer" }}
            onClick={(e) => {
              if (isPlaylist) return;
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const fraction = Math.max(
                0,
                Math.min(1, (e.clientX - rect.left) / rect.width)
              );
              const h = audioRefs.current.get(cue.id);
              if (!h) return;
              const s = cue.cropStart ?? 0;
              const end = cue.cropEnd ?? cue.duration ?? 0;
              const seekTo = s + fraction * (end - s);
              try {
                h.el.currentTime = seekTo;
              } catch {}
              setCues((prev) => {
                const copy = [...prev];
                if (copy[i]) {
                  copy[i].progress = fraction;
                  copy[i].currentTime = seekTo;
                }
                return copy;
              });
            }}
          >
            <div
              className="progress-bar"
              style={{ width: `${(cue.progress || 0) * 100}%` }}
            />
          </div>
          <div
            style={{
              fontSize: 11,
              color: colors.muted,
              fontFamily: "ui-monospace, monospace",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            {isPlaylist ? (
              <>
                <span>
                  {cue.playlistCurrentIndex != null
                    ? `${cue.playlistCurrentIndex + 1}/${
                        cue.playlistItems?.length || 0
                      }`
                    : "—"}
                </span>
                <span>{cue.playlistMode === "shuffle" ? "🔀" : "▶"}</span>
              </>
            ) : (
              <>
                <span>{prettyTime(croppedCurrentTime)}</span>
                <span>{prettyTime(croppedDuration)}</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: colors.muted, paddingTop: 2 }}>
          {isControl
            ? (() => {
                const lbl = {
                  start: "▶ Start",
                  stop: "■ Stop",
                  setVolume: `🔊 ${Math.round((cue.volume || 0) * 100)}%`,
                  fadeIndividual: "↓ Fade",
                  fadeAllPrevious: "↓↓ Fade All Prev",
                  jumpTo: "→ Jump To",
                };
                return lbl[cue.controlAction] || cue.controlAction;
              })()
            : "—"}
        </div>
      )}

      {/* Loop */}
      {!isControl && !isNote && !isPlaylist ? (
        <div
          style={{
            display: "flex",
            gap: 4,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="checkbox"
            checked={cue.loop || false}
            onChange={(e) => updateCue({ loop: e.target.checked })}
            onClick={(e) => e.stopPropagation()}
            style={{ margin: 0 }}
          />
          <input
            type="number"
            min={1}
            max={999}
            value={cue.loopCount || 1}
            disabled={!cue.loop}
            onChange={(e) =>
              updateCue({ loopCount: parseInt(e.target.value) || 1 })
            }
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "50px",
              opacity: cue.loop ? 1 : 0.4,
              padding: "4px 6px",
              fontSize: 12,
            }}
          />
        </div>
      ) : (
        <div style={{ fontSize: 12, color: colors.muted }}>—</div>
      )}

      {/* Delay */}
      <div>
        <input
          type="number"
          min={0}
          step={0.1}
          value={cue.delay || 0}
          onChange={(e) =>
            updateCue({ delay: parseFloat(e.target.value) || 0 })
          }
          onClick={(e) => e.stopPropagation()}
          style={{ width: "100%" }}
        />
      </div>

      {/* Actions column */}
      <div className="actions-wrap">
        {isPlaylist ? (
          <div className="ctrl-block">
            <div className="ctrl-row">
              <span className="ctrl-lbl">Mode:</span>
              <select
                value={cue.playlistMode || "sequential"}
                onChange={(e) => updateCue({ playlistMode: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                style={selectStyle}
              >
                <option value="sequential">Sequential</option>
                <option value="shuffle">Shuffle</option>
              </select>
            </div>
            <div className="ctrl-row">
              <div
                className="btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  openPlaylistEditor(i);
                }}
                style={{ flex: 1 }}
              >
                Edit Items
              </div>
              <label className="btn-small" onClick={(e) => e.stopPropagation()}>
                Add
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={(e) => {
                    addFilesToPlaylist(e.target.files, i);
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </label>
            </div>
            <div className="ctrl-row">
              <select
                value={cue.advanceMode || "autoAdvance"}
                onChange={(e) => updateCue({ advanceMode: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                style={selectStyle}
              >
                <option value="autoAdvance">Auto-Advance</option>
                <option value="startAdvance">Start & Advance</option>
                <option value="follow">Follow Previous</option>
              </select>
              <div
                className="btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCue(i);
                }}
              >
                ✕
              </div>
            </div>
          </div>
        ) : isControl ? (
          <div className="ctrl-block">
            <div className="ctrl-row">
              <span className="ctrl-lbl">Action:</span>
              <select
                value={cue.controlAction || "start"}
                onChange={(e) => updateCue({ controlAction: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                style={selectStyle}
              >
                <option value="start">▶ Start cue</option>
                <option value="stop">■ Stop cue</option>
                <option value="setVolume">🔊 Set Volume</option>
                <option value="fadeIndividual">↓ Fade individual</option>
                <option value="fadeAllPrevious">↓↓ Fade all previous</option>
                <option value="jumpTo">→ Jump To (no start)</option>
              </select>
            </div>
            {ACTIONS_NEEDING_TARGET.includes(cue.controlAction) && (
              <div className="ctrl-row">
                <span className="ctrl-lbl">Target:</span>
                <select
                  value={cue.targetCueId || ""}
                  onChange={(e) => updateCue({ targetCueId: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  style={{ ...selectStyle, minWidth: 0 }}
                >
                  <option value="">— select —</option>
                  {cues
                    .filter(
                      (c) =>
                        (c.type === "audio" || c.type === "playlist") &&
                        c.id !== cue.id
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.number} {t.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            {ACTIONS_NEEDING_VOLUME.includes(cue.controlAction) && (
              <div className="ctrl-row">
                <span className="ctrl-lbl">Vol:</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={cue.volume || 1}
                  onChange={(e) =>
                    updateCue({ volume: parseFloat(e.target.value) })
                  }
                  onClick={(e) => e.stopPropagation()}
                  style={{ flex: 1 }}
                />
                <span
                  style={{ fontSize: 12, color: colors.muted, minWidth: 34 }}
                >
                  {Math.round((cue.volume || 1) * 100)}%
                </span>
              </div>
            )}
            {ACTIONS_NEEDING_FADE.includes(cue.controlAction) && (
              <div className="ctrl-row">
                <span className="ctrl-lbl">Fade s:</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={cue.fadeDuration != null ? cue.fadeDuration : 1}
                  onChange={(e) =>
                    updateCue({ fadeDuration: parseFloat(e.target.value) || 0 })
                  }
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 60, padding: "4px 6px", fontSize: 12 }}
                />
              </div>
            )}
            <div className="ctrl-row">
              <select
                value={cue.advanceMode || "autoAdvance"}
                onChange={(e) => updateCue({ advanceMode: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                style={selectStyle}
              >
                <option value="autoAdvance">Auto-Advance</option>
                <option value="startAdvance">Start & Advance</option>
                <option value="follow">Follow Previous</option>
              </select>
              <div
                className="btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCue(i);
                }}
              >
                ✕
              </div>
            </div>
          </div>
        ) : isNote ? (
          <>
            <select
              value={cue.advanceMode || "autoAdvance"}
              onChange={(e) => updateCue({ advanceMode: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              style={advanceSelectStyle}
            >
              <option value="autoAdvance">Auto-Advance</option>
              <option value="startAdvance">Start & Advance</option>
              <option value="follow">Follow Previous</option>
            </select>
            <div
              className="btn-small"
              onClick={(e) => {
                e.stopPropagation();
                deleteCue(i);
              }}
            >
              ✕
            </div>
          </>
        ) : (
          <>
            <select
              value={cue.advanceMode || "autoAdvance"}
              onChange={(e) => updateCue({ advanceMode: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              style={advanceSelectStyle}
            >
              <option value="autoAdvance">Auto-Advance</option>
              <option value="startAdvance">Start & Advance</option>
              <option value="follow">Follow Previous</option>
              <option value="parallel">Parallel</option>
            </select>
            <div style={{ display: "flex", gap: 6 }}>
              <div
                className="btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  playCueAt(i);
                }}
              >
                Play
              </div>
              <div
                className="btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  stopSingle(i);
                }}
              >
                Stop
              </div>
              <div
                className="btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  fadeOutSingle(i, 1.0);
                }}
              >
                Fade
              </div>
              <div
                className="btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  openCropModal(i);
                }}
                style={{ position: "relative" }}
              >
                Crop
                {hasEnvelope && (
                  <span
                    className="has-envelope-dot"
                    title="Has volume envelope"
                  />
                )}
              </div>
              <div
                className="btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateCue(i);
                }}
                title="Duplicate (Ctrl+D)"
              >
                ⧉
              </div>
              <div
                className="btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCue(i);
                }}
              >
                ✕
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
