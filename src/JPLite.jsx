import React, { useEffect, useRef, useState } from "react";

import { DEFAULT_COLUMNS } from "./constants";
import {
  uid,
  prettyTime,
  fileToBase64,
  hexToRgba,
  lightenColor,
} from "./utils/helpers";
import { getThemeColors, DEFAULT_CUE_COLORS } from "./utils/theme";
import { useAudioEngine } from "./hooks/useAudioEngine";

import CueRow from "./components/CueRow";
import CropModal from "./components/CropModal";
import PlaylistEditorModal from "./components/PlaylistEditorModal";
import ColorModal from "./components/ColorModal";

export default function JPLite() {
  // ── Persisted state ────────────────────────────────────────────────────
  const [cues, setCues] = useState(() => {
    try {
      const raw = localStorage.getItem("jp_v5_cues");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("jp_theme") || "dark";
    } catch {
      return "dark";
    }
  });
  const [cueColors, setCueColors] = useState(() => {
    try {
      const saved = localStorage.getItem("jp_cue_colors");
      const parsed = saved ? JSON.parse(saved) : null;
      return {
        audio: parsed?.audio || DEFAULT_CUE_COLORS.audio,
        control: parsed?.control || DEFAULT_CUE_COLORS.control,
        note: parsed?.note || DEFAULT_CUE_COLORS.note,
        playlist: parsed?.playlist || DEFAULT_CUE_COLORS.playlist,
      };
    } catch {
      return DEFAULT_CUE_COLORS;
    }
  });

  // ── UI state ───────────────────────────────────────────────────────────
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [masterVolume, setMasterVolume] = useState(1);
  const [sidebarWidth, setSidebarWidth] = useState(290);
  const [transportSize, setTransportSize] = useState(130);
  const [columnsTemplate, setColumnsTemplate] = useState(DEFAULT_COLUMNS);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [clipboard, setClipboard] = useState(null);
  const [delayCountdowns, setDelayCountdowns] = useState({});

  // ── Crop / editor modal state ──────────────────────────────────────────
  const [cropOpen, setCropOpen] = useState(false);
  const [cropIndex, setCropIndex] = useState(null);
  const [cropTab, setCropTab] = useState("crop");
  const [cropRegion, setCropRegion] = useState({ start: 0, end: 1 });
  const [wfLoading, setWfLoading] = useState(false);
  const [wfDuration, setWfDuration] = useState(0);
  const [envelopePoints, setEnvelopePoints] = useState([]);

  // ── Playlist editor modal state ────────────────────────────────────────
  const [playlistEditOpen, setPlaylistEditOpen] = useState(false);
  const [playlistEditIndex, setPlaylistEditIndex] = useState(null);

  // ── Refs ───────────────────────────────────────────────────────────────
  const mountedRef = useRef(true);
  const cuesRef = useRef(cues);
  const waveformContainerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    cuesRef.current = cues;
  }, [cues]);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Audio engine ───────────────────────────────────────────────────────
  const {
    audioRefs,
    masterGainRef,
    WaveSurferRef,
    waveSurferLoadPromise,
    getEnvelopeValueAt,
    startFadeOnHolder,
    fadeOutSingle,
    fadeAllOut,
    stopAll,
    stopSingle,
    stopDelay,
    playCueAt,
  } = useAudioEngine({
    cuesRef,
    mountedRef,
    setCues,
    setSelectedIndex,
    setDelayCountdowns,
    masterVolume,
  });

  // ── localStorage sync ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem("jp_theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    try {
      localStorage.setItem("jp_cue_colors", JSON.stringify(cueColors));
    } catch {}
  }, [cueColors]);
  useEffect(() => {
    try {
      localStorage.setItem("jp_v5_cues", JSON.stringify(cues));
    } catch {}
  }, [cues]);

  // ── Derived theme values ───────────────────────────────────────────────
  const colors = getThemeColors(theme);
  const audioColor = cueColors.audio[theme];
  const controlColor = cueColors.control[theme];
  const noteColor = cueColors.note[theme];
  const playlistColor = cueColors.playlist?.[theme] || "#f59e0b";

  // ── Undo / Redo ────────────────────────────────────────────────────────
  function pushHistory(snapshot) {
    const snap = snapshot ?? JSON.parse(JSON.stringify(cuesRef.current));
    setHistory((h) => [...h, snap]);
    setFuture([]);
  }
  // Overload used by CueRow — called with no args to snapshot current state
  function pushHistoryCurrent() {
    pushHistory(JSON.parse(JSON.stringify(cuesRef.current)));
  }

  function undo() {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [JSON.parse(JSON.stringify(cuesRef.current)), ...f]);
      setCues(prev.map((c, i) => ({ ...c, number: i + 1 })));
      setSelectedIndex(null);
      return h.slice(0, -1);
    });
  }
  function redo() {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setHistory((h) => [...h, JSON.parse(JSON.stringify(cuesRef.current))]);
      setCues(next.map((c, i) => ({ ...c, number: i + 1 })));
      setSelectedIndex(null);
      return f.slice(1);
    });
  }

  // ── Cue management ─────────────────────────────────────────────────────
  function renumber() {
    setCues((prev) => prev.map((c, i) => ({ ...c, number: i + 1 })));
  }
  function getInsertIndex() {
    return selectedIndex != null ? selectedIndex + 1 : cues.length;
  }

  function makeBaseCue(extra) {
    return {
      id: uid(),
      number: 1,
      duration: 0,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      loop: false,
      loopCount: 1,
      notes: "",
      cropStart: null,
      cropEnd: null,
      progress: 0,
      currentTime: 0,
      delay: 0,
      advanceMode: "autoAdvance",
      volumeEnvelope: null,
      ...extra,
    };
  }

  function insertCue(newCue) {
    const insertAt = getInsertIndex();
    pushHistory();
    setCues((prev) => {
      const arr = [...prev];
      arr.splice(insertAt, 0, newCue);
      return arr.map((c, i) => ({ ...c, number: i + 1 }));
    });
    setSelectedIndex(insertAt);
  }

  function addControlCue() {
    insertCue(
      makeBaseCue({
        type: "control",
        name: "Control Cue",
        fileName: null,
        base64Data: null,
        controlAction: "start",
        targetCueId: null,
        fadeDuration: 1,
      })
    );
  }
  function addNoteCue() {
    insertCue(
      makeBaseCue({
        type: "note",
        name: "Note",
        fileName: null,
        base64Data: null,
        notes: "Add your note text here...",
      })
    );
  }
  function addPlaylistCue() {
    insertCue(
      makeBaseCue({
        type: "playlist",
        name: "Playlist",
        fileName: null,
        base64Data: null,
        playlistItems: [],
        playlistMode: "sequential",
        playlistCurrentIndex: 0,
      })
    );
  }

  async function addFiles(files) {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    pushHistory();
    let insertAt = getInsertIndex();
    for (const file of arr) {
      const base64 = await fileToBase64(file);
      const base = makeBaseCue({
        type: "audio",
        name: file.name.replace(/\.[^/.]+$/, ""),
        fileName: file.name,
        base64Data: base64,
        duration: null,
      });
      const a = new Audio(base64);
      a.preload = "metadata";
      await new Promise((resolve) => {
        a.addEventListener("loadedmetadata", () => {
          base.duration = a.duration;
          resolve();
        });
        a.addEventListener("error", resolve);
      });
      const at = insertAt;
      setCues((prev) => {
        const a2 = [...prev];
        a2.splice(at, 0, base);
        return a2.map((c, i) => ({ ...c, number: i + 1 }));
      });
      insertAt++;
    }
    setSelectedIndex(insertAt - 1);
  }

  async function addFilesToPlaylist(files, playlistIndex) {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    const items = [];
    for (const file of arr) {
      const base64 = await fileToBase64(file);
      const item = {
        id: uid("plitem-"),
        name: file.name.replace(/\.[^/.]+$/, ""),
        fileName: file.name,
        base64Data: base64,
        duration: null,
      };
      const a = new Audio(base64);
      a.preload = "metadata";
      await new Promise((resolve) => {
        a.addEventListener("loadedmetadata", () => {
          item.duration = a.duration;
          resolve();
        });
        a.addEventListener("error", resolve);
      });
      items.push(item);
    }
    pushHistory();
    setCues((prev) => {
      const copy = [...prev];
      if (copy[playlistIndex]?.type === "playlist")
        copy[playlistIndex] = {
          ...copy[playlistIndex],
          playlistItems: [...copy[playlistIndex].playlistItems, ...items],
        };
      return copy;
    });
  }

  function deleteCue(index) {
    const cue = cues[index];
    if (!cue) return;
    const stopHolder = (id) => {
      const h = audioRefs.current.get(id);
      if (h) {
        try {
          h.el.pause();
        } catch {}
        if (h.fadeTimer) {
          clearInterval(h.fadeTimer);
          h.fadeTimer = null;
        }
        if (h.progressTimer) {
          clearInterval(h.progressTimer);
          h.progressTimer = null;
        }
        try {
          if (h.sourceNode) h.sourceNode.disconnect();
        } catch {}
        try {
          if (h.gainNode) h.gainNode.disconnect();
        } catch {}
        audioRefs.current.delete(id);
      }
    };
    stopHolder(cue.id);
    if (cue.type === "playlist" && cue.playlistItems)
      cue.playlistItems.forEach((item) => stopHolder(item.id));
    stopDelay(cue.id, index);
    pushHistory();
    setCues((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((c, i) => ({ ...c, number: i + 1 }))
    );
    if (selectedIndex === index) setSelectedIndex(null);
  }

  function copyCue(index) {
    const cue = cuesRef.current[index];
    if (cue) setClipboard(JSON.parse(JSON.stringify(cue)));
  }
  function cutCue(index) {
    const cue = cuesRef.current[index];
    if (!cue) return;
    setClipboard(JSON.parse(JSON.stringify(cue)));
    deleteCue(index);
  }
  function pasteCue() {
    if (!clipboard) return;
    insertCue({
      ...JSON.parse(JSON.stringify(clipboard)),
      id: uid(),
      progress: 0,
      currentTime: 0,
    });
  }
  function duplicateCue(index) {
    const cue = cuesRef.current[index];
    if (!cue) return;
    pushHistory();
    const insertAt = index + 1;
    const newCue = {
      ...JSON.parse(JSON.stringify(cue)),
      id: uid(),
      progress: 0,
      currentTime: 0,
    };
    setCues((prev) => {
      const arr = [...prev];
      arr.splice(insertAt, 0, newCue);
      return arr.map((c, i) => ({ ...c, number: i + 1 }));
    });
    setSelectedIndex(insertAt);
  }

  // ── WaveSurfer / crop modal ────────────────────────────────────────────
  async function openCropModal(index) {
    if (index == null) return;
    const cue = cues[index];
    if (!cue || !cue.base64Data) return alert("No audio to crop for that cue.");

    setCropOpen(true);
    setCropIndex(index);
    setCropTab("crop");
    setWfDuration(0);
    setEnvelopePoints(
      cue.volumeEnvelope?.length > 0
        ? cue.volumeEnvelope
        : [
            { t: 0, v: 1 },
            { t: 1, v: 1 },
          ]
    );
    setWfLoading(true);

    const promise = waveSurferLoadPromise();
    if (promise) {
      try {
        await promise;
      } catch {}
    }

    let attempts = 0;
    while (!window.WaveSurfer && attempts < 50) {
      await new Promise((r) => setTimeout(r, 100));
      attempts++;
    }
    if (!WaveSurferRef.current && window.WaveSurfer)
      WaveSurferRef.current = window.WaveSurfer;
    if (!WaveSurferRef.current) {
      setWfLoading(false);
      alert("WaveSurfer failed to load. Check your internet connection.");
      setCropOpen(false);
      return;
    }

    await new Promise((r) => setTimeout(r, 150));
    if (wavesurferRef.current) {
      try {
        wavesurferRef.current.destroy();
      } catch {}
      wavesurferRef.current = null;
    }
    if (waveformContainerRef.current)
      waveformContainerRef.current.innerHTML = "";

    try {
      const ws = WaveSurferRef.current.create({
        container: waveformContainerRef.current,
        waveColor: theme === "dark" ? "#1e3a5f" : "#94a3b8",
        progressColor: "#ef4444",
        cursorColor: theme === "dark" ? "#f9fafb" : "#1f2937",
        cursorWidth: 2,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 128,
        normalize: true,
        interact: true,
      });
      wavesurferRef.current = ws;
      ws.on("ready", () => {
        const totalDuration = ws.getDuration();
        setWfDuration(totalDuration);
        const cropStart = cue.cropStart ?? 0;
        const cropEnd = cue.cropEnd ?? totalDuration;
        setCropRegion({
          start:
            totalDuration > 0
              ? Math.max(0, Math.min(cropStart / totalDuration, 1))
              : 0,
          end:
            totalDuration > 0
              ? Math.max(0, Math.min(cropEnd / totalDuration, 1))
              : 1,
        });
        setWfLoading(false);
      });
      ws.on("error", (err) => {
        setWfLoading(false);
        console.error("WaveSurfer error:", err);
        alert("Error loading audio: " + (err?.message || err));
      });
      ws.load(cue.base64Data);
    } catch (err) {
      setWfLoading(false);
      console.error("WaveSurfer init error:", err);
      alert("Failed to initialize waveform: " + err.message);
    }
  }

  function applyCropFromWave() {
    if (cropIndex == null) return;
    if (wfDuration <= 0) {
      alert("Waveform not ready.");
      return;
    }
    const start = cropRegion.start * wfDuration;
    const end = cropRegion.end * wfDuration;
    setCues((prev) => {
      const copy = [...prev];
      if (copy[cropIndex])
        copy[cropIndex] = {
          ...copy[cropIndex],
          cropStart: Number(start.toFixed(4)),
          cropEnd: Number(end.toFixed(4)),
        };
      return copy;
    });
    alert(`Crop applied: ${prettyTime(start)} to ${prettyTime(end)}`);
  }

  function applyEnvelopeToSave() {
    if (cropIndex == null) return;
    setCues((prev) => {
      const copy = [...prev];
      if (copy[cropIndex])
        copy[cropIndex] = {
          ...copy[cropIndex],
          volumeEnvelope: envelopePoints,
        };
      return copy;
    });
  }

  function clearEnvelope() {
    const flat = [
      { t: 0, v: 1 },
      { t: 1, v: 1 },
    ];
    setEnvelopePoints(flat);
    if (cropIndex != null)
      setCues((prev) => {
        const copy = [...prev];
        if (copy[cropIndex])
          copy[cropIndex] = { ...copy[cropIndex], volumeEnvelope: null };
        return copy;
      });
  }

  function closeCrop() {
    try {
      if (wavesurferRef.current) wavesurferRef.current.destroy();
    } catch {}
    wavesurferRef.current = null;
    setCropOpen(false);
    setCropIndex(null);
    setWfLoading(false);
    setWfDuration(0);
    if (waveformContainerRef.current)
      waveformContainerRef.current.innerHTML = "";
  }

  // ── Playlist editor ────────────────────────────────────────────────────
  function openPlaylistEditor(index) {
    setPlaylistEditIndex(index);
    setPlaylistEditOpen(true);
  }
  function closePlaylistEditor() {
    setPlaylistEditOpen(false);
    setPlaylistEditIndex(null);
  }

  // ── Transport ──────────────────────────────────────────────────────────
  function transportGo() {
    const anyPlaying = [...audioRefs.current.values()].some((h) => {
      try {
        return !h.el.paused;
      } catch {
        return false;
      }
    });
    if (!anyPlaying) {
      playCueAt(selectedIndex != null ? selectedIndex : 0);
    } else {
      const next = selectedIndex == null ? 0 : selectedIndex + 1;
      if (next < cuesRef.current.length) playCueAt(next);
      else stopAll();
    }
  }
  function transportStop() {
    if (selectedIndex != null) {
      const c = cuesRef.current[selectedIndex];
      if (c?.type === "audio") {
        const h = audioRefs.current.get(c.id);
        if (h && (c.fadeOut || 0) > 0) {
          const cur = h.gainNode ? h.gainNode.gain.value : h.el?.volume || 0;
          startFadeOnHolder(h, cur, 0, c.fadeOut);
          setTimeout(() => {
            try {
              h.el.pause();
              h.el.currentTime = c.cropStart ?? 0;
            } catch {}
            stopAll();
          }, (c.fadeOut + 0.05) * 1000);
          return;
        }
      }
    }
    stopAll();
  }

  // ── Import / Export ────────────────────────────────────────────────────
  function exportJSON() {
    const blob = new Blob([JSON.stringify(cues, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jp-cues.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          pushHistory();
          setCues(imported.map((c, i) => ({ ...c, number: i + 1 })));
          alert("Imported");
        } else alert("Invalid JSON");
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    function handler(e) {
      const tag = document.activeElement?.tagName;
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (
        mod &&
        (e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "c" && !isTyping) {
        e.preventDefault();
        if (selectedIndex != null) copyCue(selectedIndex);
        return;
      }
      if (mod && e.key.toLowerCase() === "v" && !isTyping) {
        e.preventDefault();
        pasteCue();
        return;
      }
      if (mod && e.key.toLowerCase() === "x" && !isTyping) {
        e.preventDefault();
        if (selectedIndex != null) cutCue(selectedIndex);
        return;
      }
      if (mod && e.key.toLowerCase() === "d" && !isTyping) {
        e.preventDefault();
        if (selectedIndex != null) duplicateCue(selectedIndex);
        return;
      }
      if (isTyping) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        transportGo();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        transportStop();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        fadeAllOut(1.0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((p) => (p == null ? 0 : Math.max(0, p - 1)));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((p) =>
          p == null ? 0 : Math.min(cuesRef.current.length - 1, p + 1)
        );
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        renumber();
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        if (
          selectedIndex != null &&
          cuesRef.current[selectedIndex]?.type === "audio"
        )
          openCropModal(selectedIndex);
      } else if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        setTheme((p) => (p === "dark" ? "light" : "dark"));
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        if (selectedIndex != null) deleteCue(selectedIndex);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIndex, clipboard, cues.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global styles (injected once, theme-reactive) ─────────────────────
  const css = `
    * { box-sizing: border-box }
    html, body, #root { height: 100%; margin: 0; padding: 0; overflow: hidden; }
    .sidebar { position: fixed; left: 12px; top: 12px; bottom: 12px; width: var(--sidebar-width); background: ${
      colors.sidebar
    }; border-radius: 10px; padding: 16px; box-shadow: 0 8px 30px ${
    theme === "dark" ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.1)"
  }; z-index: 40; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
    .panel { background: ${
      colors.panel
    }; border-radius: 10px; padding: 12px; border: 1px solid ${colors.border} }
    .transport-btn { border: none; cursor: pointer; border-radius: 8px; font-weight: 700; transition: transform 0.1s; }
    .transport-btn:hover { transform: scale(1.02); } .transport-btn:active { transform: scale(0.98); }
    .go      { background: linear-gradient(180deg,#10b981,#047857); color: white; }
    .stop    { background: linear-gradient(180deg,#991b1b,#7f1d1d); color: white; }
    .fadeall { background: linear-gradient(180deg,#374151,#111827); color: white; }
    .cue-grid-header { display: grid; grid-template-columns: ${columnsTemplate}; gap: 12px; padding: 10px; color: ${
    colors.muted
  }; font-size: 13px; position: sticky; top: 0; background: ${
    colors.gridHeader
  }; z-index: 20; border-bottom: 1px solid ${colors.border}; font-weight: 600; }
    .cue-grid-row { display: grid; grid-template-columns: ${columnsTemplate}; gap: 12px; align-items: start; padding: 10px; border-bottom: 1px solid ${
    colors.border
  }; cursor: pointer; transition: background 0.15s; }
    .cue-grid-row:hover { background: ${colors.hover}; }
    .cue-grid-row.playing  { background: linear-gradient(90deg,${hexToRgba(
      audioColor,
      0.08
    )},${hexToRgba(audioColor, 0.02)}); border-left: 4px solid ${hexToRgba(
    audioColor,
    0.9
  )}; }
    .cue-grid-row.selected { background: ${hexToRgba(
      audioColor,
      0.15
    )} !important; border-left: 4px solid ${audioColor}; }
    .cue-grid-row.control-cue         { background: linear-gradient(90deg,${hexToRgba(
      controlColor,
      0.06
    )},${hexToRgba(controlColor, 0.01)}); }
    .cue-grid-row.control-cue.selected { background: ${hexToRgba(
      controlColor,
      0.15
    )} !important; border-left: 4px solid ${controlColor}; }
    .cue-grid-row.note-cue            { background: linear-gradient(90deg,${hexToRgba(
      noteColor,
      0.06
    )},${hexToRgba(noteColor, 0.01)}); }
    .cue-grid-row.note-cue.selected   { background: ${hexToRgba(
      noteColor,
      0.15
    )} !important; border-left: 4px solid ${noteColor}; }
    .cue-grid-row.playlist-cue        { background: linear-gradient(90deg,${hexToRgba(
      playlistColor,
      0.06
    )},${hexToRgba(playlistColor, 0.01)}); }
    .cue-grid-row.playlist-cue.selected { background: ${hexToRgba(
      playlistColor,
      0.15
    )} !important; border-left: 4px solid ${playlistColor}; }
    .cue-grid-row.counting-down { animation: cdpulse 0.8s ease-in-out infinite; }
    @keyframes cdpulse { 0%,100% { opacity:1; } 50% { opacity:0.65; } }
    .progress-wrap { background: ${
      theme === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.08)"
    }; height: 8px; border-radius: 8px; overflow: hidden; }
    .progress-bar  { height: 100%; background: linear-gradient(90deg,${audioColor},${lightenColor(
    audioColor
  )}); width: 0%; transition: width .12s linear; }
    .btn-small { padding: 7px 10px; border-radius: 8px; background: ${
      theme === "dark" ? "#071018" : "#e9ecef"
    }; border: 1px solid ${colors.inputBorder}; color: ${
    theme === "dark" ? "#cfe9ff" : "#1a1a1a"
  }; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.15s; white-space: nowrap; }
    .btn-small:hover { background: ${
      theme === "dark" ? "#0a1420" : "#dee2e6"
    }; } .btn-small:active { transform: scale(0.96); }
    .sticky-wrap { overflow: auto; flex: 1; }
    input, select { color: ${colors.text}; background: ${
    colors.input
  }; border: 1px solid ${
    colors.inputBorder
  }; padding: 7px 9px; border-radius: 6px; box-sizing: border-box; font-size: 13px; }
    input:focus, select:focus { outline: none; border-color: rgba(59,130,246,0.4); background: ${
      theme === "dark" ? "rgba(255,255,255,0.03)" : "#ffffff"
    }; }
    input[type=range]    { accent-color: ${audioColor}; padding: 0; }
    input[type=checkbox] { width: 16px; height: 16px; accent-color: ${audioColor}; cursor: pointer; padding: 0; }
    .actions-wrap { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .actions-wrap .btn-small { align-self: center; }
    .ctrl-block { display: flex; flex-direction: column; gap: 5px; width: 100%; }
    .ctrl-row   { display: flex; gap: 6px; align-items: center; }
    .ctrl-lbl   { font-size: 11px; color: ${
      colors.muted
    }; white-space: nowrap; min-width: 36px; }
    .sidebar-section-title { font-weight: 800; font-size: 14px; margin-bottom: 8px; color: ${
      colors.text
    }; }
    .button-row        { display: flex; gap: 8px; align-items: center; }
    .transport-controls { display: flex; gap: 8px; flex-direction: column; }
    .theme-toggle { display: flex; align-items: center; gap: 8px; padding: 8px; background: ${
      colors.panel
    }; border-radius: 8px; cursor: pointer; border: 1px solid ${
    colors.border
  }; transition: all 0.15s; }
    .theme-toggle:hover { background: ${colors.hover}; }
    .main-content { position: fixed; left: calc(var(--sidebar-width) + 36px); right: 12px; top: 12px; bottom: 12px; display: flex; flex-direction: column; }
    .cue-list-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .env-preset-btn { padding: 5px 10px; border-radius: 6px; background: ${
      theme === "dark" ? "#0d1820" : "#e2e8f0"
    }; border: 1px solid ${colors.inputBorder}; color: ${
    colors.text
  }; cursor: pointer; font-size: 11px; font-weight: 500; transition: all 0.15s; white-space: nowrap; }
    .env-preset-btn:hover { background: ${
      theme === "dark" ? "#132030" : "#cbd5e0"
    }; }
    .has-envelope-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${audioColor}; margin-left: 4px; vertical-align: middle; }
    .countdown-badge { display: inline-flex; align-items: center; justify-content: center; background: #f59e0b; color: #000; border-radius: 10px; font-size: 10px; font-weight: 800; padding: 2px 5px; min-width: 34px; font-family: ui-monospace, monospace; line-height: 1.2; }
  `;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        height: "100vh",
        background: colors.bg,
        color: colors.text,
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        overflow: "hidden",
      }}
    >
      <style>{css}</style>

      {/* ── Sidebar ── */}
      <aside
        className="sidebar"
        style={{ "--sidebar-width": `${sidebarWidth}px` }}
      >
        <div className="sidebar-section-title">Transport Controls</div>
        <div className="transport-controls">
          <div className="button-row">
            <button
              className="transport-btn go"
              onClick={transportGo}
              style={{
                flex: 1,
                height: transportSize,
                fontSize: Math.max(14, transportSize / 4.5),
              }}
            >
              GO
            </button>
            <button
              className="transport-btn stop"
              onClick={transportStop}
              style={{
                width: transportSize,
                height: transportSize,
                fontSize: Math.max(12, transportSize / 5),
              }}
            >
              STOP
            </button>
          </div>
          <button
            className="transport-btn fadeall"
            onClick={() => fadeAllOut(1.0)}
            style={{
              width: "100%",
              height: transportSize * 0.6,
              fontSize: Math.max(12, transportSize / 5),
            }}
          >
            Fade All Out
          </button>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 12, color: colors.muted, minWidth: 70 }}>
              Button Size
            </span>
            <input
              type="range"
              min={60}
              max={120}
              value={transportSize}
              onChange={(e) => setTransportSize(Number(e.target.value))}
              style={{ flex: 1 }}
            />
          </div>
        </div>

        <div className="panel">
          <div className="sidebar-section-title">Master Volume</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={masterVolume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setMasterVolume(v);
                if (masterGainRef.current)
                  try {
                    masterGainRef.current.gain.value = v;
                  } catch {}
              }}
              style={{ flex: 1 }}
            />
            <div
              style={{
                minWidth: 44,
                textAlign: "right",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {Math.round(masterVolume * 100)}%
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="sidebar-section-title">Project</div>
          <div className="button-row" style={{ marginBottom: 8 }}>
            <div
              className="btn-small"
              onClick={undo}
              title="Undo (Ctrl+Z)"
              style={{
                flex: 1,
                opacity: history.length === 0 ? 0.4 : 1,
                textAlign: "center",
              }}
            >
              ↩ Undo
            </div>
            <div
              className="btn-small"
              onClick={redo}
              title="Redo (Ctrl+Y)"
              style={{
                flex: 1,
                opacity: future.length === 0 ? 0.4 : 1,
                textAlign: "center",
              }}
            >
              ↪ Redo
            </div>
            <div
              className="btn-small"
              onClick={renumber}
              style={{ flex: 1, textAlign: "center" }}
            >
              Renumber
            </div>
          </div>
          <div className="button-row" style={{ marginBottom: 12 }}>
            <div
              className="btn-small"
              onClick={exportJSON}
              style={{ flex: 1, textAlign: "center" }}
            >
              Export
            </div>
            <label
              className="btn-small"
              style={{ cursor: "pointer", flex: 1, textAlign: "center" }}
            >
              Import
              <input
                type="file"
                accept="application/json"
                onChange={(e) => importJSON(e.target.files[0])}
                style={{ display: "none" }}
              />
            </label>
          </div>
          <div
            style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}
          >
            <div style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>
              Add Cues
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                className="btn-small"
                style={{
                  cursor: "pointer",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 16 }}>🎵</span>
                <span>Audio Cue</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={(e) => addFiles(e.target.files)}
                  style={{ display: "none" }}
                />
              </label>
              <div
                className="btn-small"
                onClick={addControlCue}
                style={{
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 16 }}>⚙️</span>
                <span>Control Cue</span>
              </div>
              <div
                className="btn-small"
                onClick={addNoteCue}
                style={{
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 16 }}>📝</span>
                <span>Note Cue</span>
              </div>
              <div
                className="btn-small"
                onClick={addPlaylistCue}
                style={{
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 16 }}>📂</span>
                <span>Playlist Cue</span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="theme-toggle"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <span style={{ fontSize: 12, flex: 1 }}>Theme</span>
          <span style={{ fontSize: 18 }}>{theme === "dark" ? "🌙" : "☀️"}</span>
        </div>
        <div className="theme-toggle" onClick={() => setColorMenuOpen(true)}>
          <span style={{ fontSize: 12, flex: 1 }}>Cue Colors</span>
          <span style={{ fontSize: 18 }}>🎨</span>
        </div>

        {/* Sidebar resize handle */}
        <div
          style={{
            height: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "ew-resize",
          }}
          onMouseDown={(e) => {
            const sx = e.clientX,
              sw = sidebarWidth;
            const move = (ev) =>
              setSidebarWidth(
                Math.max(240, Math.min(450, sw + ev.clientX - sx))
              );
            const up = () => {
              window.removeEventListener("mousemove", move);
              window.removeEventListener("mouseup", up);
            };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
          }}
        >
          <div
            style={{
              width: "40px",
              height: "4px",
              background:
                theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.2)",
              borderRadius: "2px",
            }}
          />
        </div>

        <div style={{ fontSize: 10, color: colors.muted, lineHeight: 1.6 }}>
          <strong>Shortcuts:</strong> Space/Enter=Go • S=Stop • F=Fade All •
          ↑/↓=Navigate • R=Renumber • T=Theme
          <br />
          C=Crop selected • ⌫/Del=Delete • Ctrl+Z=Undo • Ctrl+Y=Redo
          <br />
          Ctrl+C=Copy • Ctrl+V=Paste • Ctrl+X=Cut • Ctrl+D=Duplicate
          {clipboard && (
            <span style={{ color: audioColor }}> • 📋 clipboard ready</span>
          )}
          <br />
          <span style={{ opacity: 0.6 }}>Auto-saves on every change</span>
          <br />
          <span style={{ opacity: 0.6 }}>©2026 Jelfus</span>
        </div>
      </aside>

      {/* ── Main cue list ── */}
      <main
        className="main-content"
        style={{ "--sidebar-width": `${sidebarWidth}px` }}
      >
        <div className="panel cue-list-panel">
          <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 16 }}>
            Cue List
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 12,
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 13, color: colors.muted, minWidth: 60 }}>
              Columns:
            </div>
            <input
              value={columnsTemplate}
              onChange={(e) => setColumnsTemplate(e.target.value)}
              style={{ flex: 1 }}
            />
            <div
              className="btn-small"
              onClick={() => setColumnsTemplate(DEFAULT_COLUMNS)}
            >
              Reset
            </div>
          </div>
          <div
            style={{
              borderRadius: 8,
              overflow: "hidden",
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              className="cue-grid-header"
              style={{ gridTemplateColumns: columnsTemplate }}
            >
              <div>Play</div>
              <div>#</div>
              <div>Cue Name</div>
              <div>File</div>
              <div>Volume / Progress</div>
              <div>Loop</div>
              <div>Delay</div>
              <div>Actions</div>
            </div>
            <div className="sticky-wrap">
              {cues.length === 0 && (
                <div
                  style={{
                    padding: 24,
                    color: colors.muted,
                    textAlign: "center",
                  }}
                >
                  No cues — upload audio files or add control/note/playlist cues
                </div>
              )}
              {cues.map((cue, i) => {
                const isPlaying =
                  selectedIndex === i &&
                  [...audioRefs.current.values()].some((h) => {
                    try {
                      return !h.el.paused;
                    } catch {
                      return false;
                    }
                  });
                const countdown = delayCountdowns[i];

                return (
                  <CueRow
                    key={cue.id}
                    cue={cue}
                    i={i}
                    isSelected={selectedIndex === i}
                    isPlaying={isPlaying}
                    countdown={countdown}
                    columnsTemplate={columnsTemplate}
                    cues={cues}
                    setCues={setCues}
                    audioRefs={audioRefs}
                    getEnvelopeValueAt={getEnvelopeValueAt}
                    masterVolume={masterVolume}
                    playCueAt={playCueAt}
                    stopSingle={stopSingle}
                    fadeOutSingle={fadeOutSingle}
                    openCropModal={openCropModal}
                    duplicateCue={duplicateCue}
                    deleteCue={deleteCue}
                    openPlaylistEditor={openPlaylistEditor}
                    addFilesToPlaylist={addFilesToPlaylist}
                    pushHistory={pushHistoryCurrent}
                    setSelectedIndex={setSelectedIndex}
                    theme={theme}
                    colors={colors}
                    audioColor={audioColor}
                    controlColor={controlColor}
                    noteColor={noteColor}
                    playlistColor={playlistColor}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* ── Modals ── */}
      <CropModal
        cropOpen={cropOpen}
        cropIndex={cropIndex}
        cropCue={cropIndex != null ? cues[cropIndex] : null}
        cues={cues}
        waveformContainerRef={waveformContainerRef}
        wavesurferRef={wavesurferRef}
        wfLoading={wfLoading}
        wfDuration={wfDuration}
        cropRegion={cropRegion}
        setCropRegion={setCropRegion}
        cropTab={cropTab}
        setCropTab={setCropTab}
        envelopePoints={envelopePoints}
        setEnvelopePoints={setEnvelopePoints}
        applyCropFromWave={applyCropFromWave}
        applyEnvelopeToSave={applyEnvelopeToSave}
        clearEnvelope={clearEnvelope}
        closeCrop={closeCrop}
        theme={theme}
        colors={colors}
        audioColor={audioColor}
      />

      <PlaylistEditorModal
        playlistEditOpen={playlistEditOpen}
        playlistEditIndex={playlistEditIndex}
        cues={cues}
        setCues={setCues}
        addFilesToPlaylist={addFilesToPlaylist}
        closePlaylistEditor={closePlaylistEditor}
        theme={theme}
        colors={colors}
      />

      <ColorModal
        colorMenuOpen={colorMenuOpen}
        setColorMenuOpen={setColorMenuOpen}
        cueColors={cueColors}
        setCueColors={setCueColors}
        theme={theme}
        colors={colors}
      />
    </div>
  );
}
