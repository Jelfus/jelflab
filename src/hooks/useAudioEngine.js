import { useRef, useEffect } from "react";
import WaveSurfer from "wavesurfer.js";

// All audio-context and playback logic lives here.
// Returns a stable object of functions. The caller (JPLite) owns cues state
// and passes it in via cuesRef + the various setters.

let waveSurferLoadPromise = null;

export function useAudioEngine({
  cuesRef,
  mountedRef,
  setCues,
  setSelectedIndex,
  setDelayCountdowns,
  masterVolume,
}) {
  const audioCtxRef = useRef(null);
  const masterGainRef = useRef(null);
  const audioRefs = useRef(new Map());
  const delayIntervalsRef = useRef({});
  const WaveSurferRef = useRef(null);

  // ── Init AudioContext ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && !audioCtxRef.current) {
        const ctx = new AC();
        const mg = ctx.createGain();
        mg.gain.value = masterVolume;
        mg.connect(ctx.destination);
        audioCtxRef.current = ctx;
        masterGainRef.current = mg;
      }
    } catch (e) {
      console.error("AudioContext init failed", e);
    }

    return () => {
      audioRefs.current.forEach((h) => {
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
      });
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
      }
      Object.values(delayIntervalsRef.current).forEach(clearInterval);
      delayIntervalsRef.current = {};
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume suspended context on first click
  useEffect(() => {
    const resume = () => {
      if (audioCtxRef.current?.state === "suspended")
        audioCtxRef.current.resume().catch(console.warn);
    };
    window.addEventListener("click", resume, { once: true });
    return () => window.removeEventListener("click", resume);
  }, []);

  // Sync master gain
  useEffect(() => {
    try {
      if (masterGainRef.current)
        masterGainRef.current.gain.value = masterVolume;
    } catch {}
  }, [masterVolume]);

  // ── Provide WaveSurfer from installed dependency ─────────────────────────
  useEffect(() => {
    try {
      WaveSurferRef.current = WaveSurfer;
      waveSurferLoadPromise = Promise.resolve();
    } catch (e) {
      console.error("WaveSurfer init failed:", e);
      waveSurferLoadPromise = Promise.reject(e);
    }
  }, []);

  // ── Envelope helpers ────────────────────────────────────────────────────
  function getEnvelopeValueAt(cue, progress) {
    const pts = cue.volumeEnvelope;
    if (!pts?.length) return 1;
    const sorted = [...pts].sort((a, b) => a.t - b.t);
    if (progress <= sorted[0].t) return sorted[0].v;
    if (progress >= sorted[sorted.length - 1].t)
      return sorted[sorted.length - 1].v;
    for (let k = 0; k < sorted.length - 1; k++) {
      if (progress >= sorted[k].t && progress <= sorted[k + 1].t) {
        const span = sorted[k + 1].t - sorted[k].t;
        return (
          sorted[k].v +
          (span === 0 ? 0 : (progress - sorted[k].t) / span) *
            (sorted[k + 1].v - sorted[k].v)
        );
      }
    }
    return 1;
  }

  function applyEnvelope(holder, cue, startTime, totalDuration) {
    if (
      !holder?.gainNode ||
      !cue.volumeEnvelope?.length ||
      !audioCtxRef.current
    )
      return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    const pts = [...cue.volumeEnvelope].sort((a, b) => a.t - b.t);
    const base = cue.volume ?? 1;
    holder.gainNode.gain.cancelScheduledValues(now);
    holder.gainNode.gain.setValueAtTime(pts[0].v * base, now);
    for (let i = 0; i < pts.length; i++)
      holder.gainNode.gain.linearRampToValueAtTime(
        Math.max(0, Math.min(1, pts[i].v * base)),
        now + startTime + pts[i].t * totalDuration
      );
  }

  // ── Audio holder ────────────────────────────────────────────────────────
  function ensureAudioHolder(cue) {
    if (!cue || cue.type !== "audio") return null;
    let holder = audioRefs.current.get(cue.id);
    const ctx = audioCtxRef.current;

    if (holder && ctx && (!holder.sourceNode || !holder.gainNode)) {
      try {
        if (holder.el && typeof ctx.createMediaElementSource === "function") {
          const source = ctx.createMediaElementSource(holder.el);
          const gainNode = ctx.createGain();
          gainNode.gain.value = cue.volume ?? 1;
          source.connect(gainNode);
          gainNode.connect(masterGainRef.current ?? ctx.destination);
          holder.sourceNode = source;
          holder.gainNode = gainNode;
        }
      } catch {}
      audioRefs.current.set(cue.id, holder);
      return holder;
    }

    if (!holder) {
      const el = new Audio(cue.base64Data);
      el.preload = "auto";
      el.loop = false;
      el.muted = false;
      holder = {
        el,
        sourceNode: null,
        gainNode: null,
        fadeTimer: null,
        progressTimer: null,
        loopIteration: 0,
      };
      if (ctx && typeof ctx.createMediaElementSource === "function") {
        try {
          const source = ctx.createMediaElementSource(el);
          const gainNode = ctx.createGain();
          gainNode.gain.value = cue.volume ?? 1;
          source.connect(gainNode);
          gainNode.connect(masterGainRef.current ?? ctx.destination);
          holder.sourceNode = source;
          holder.gainNode = gainNode;
        } catch {}
      }
      audioRefs.current.set(cue.id, holder);
    }

    if (!holder.gainNode) {
      try {
        holder.el.volume =
          (cue.volume ?? 1) *
          getEnvelopeValueAt(cue, cue.progress || 0) *
          (masterVolume ?? 1);
      } catch {}
    } else {
      try {
        holder.gainNode.gain.value =
          (cue.volume ?? 1) * getEnvelopeValueAt(cue, cue.progress || 0);
      } catch {}
    }
    return holder;
  }

  // ── Fade helpers ────────────────────────────────────────────────────────
  function startFadeOnHolder(holder, from, to, duration) {
    if (!holder) return;
    try {
      if (holder.gainNode?.gain && audioCtxRef.current) {
        const now = audioCtxRef.current.currentTime;
        holder.gainNode.gain.cancelScheduledValues(now);
        holder.gainNode.gain.setValueAtTime(from, now);
        holder.gainNode.gain.linearRampToValueAtTime(
          to,
          now + Math.max(0.001, duration)
        );
        return;
      }
    } catch {}
    if (holder.fadeTimer) {
      clearInterval(holder.fadeTimer);
      holder.fadeTimer = null;
    }
    if (duration <= 0) {
      try {
        holder.el.volume = to;
      } catch {}
      return;
    }
    const steps = Math.max(6, Math.floor(duration * 20));
    const stepTime = (duration * 1000) / steps;
    const delta = (to - from) / steps;
    let step = 0;
    try {
      holder.el.volume = from;
    } catch {}
    holder.fadeTimer = setInterval(() => {
      step++;
      try {
        holder.el.volume = Math.max(0, Math.min(1, holder.el.volume + delta));
      } catch {}
      if (step >= steps) {
        clearInterval(holder.fadeTimer);
        holder.fadeTimer = null;
      }
    }, stepTime);
  }

  function fadeOutSingle(index, duration = 1.0) {
    const cue = cuesRef.current[index];
    if (!cue || cue.type !== "audio") return;
    const h = audioRefs.current.get(cue.id);
    if (!h) return;
    const cur = h.gainNode ? h.gainNode.gain.value : h.el?.volume || 0;
    startFadeOnHolder(h, cur, 0, duration);
    setTimeout(() => {
      try {
        h.el.pause();
        h.el.currentTime = cue.cropStart ?? 0;
      } catch {}
      if (h.progressTimer) {
        clearInterval(h.progressTimer);
        h.progressTimer = null;
      }
      if (!mountedRef.current) return;
      setCues((prev) => {
        const copy = [...prev];
        if (copy[index]) {
          copy[index].progress = 0;
          copy[index].currentTime = 0;
        }
        return copy;
      });
    }, duration * 1000 + 50);
  }

  function fadeAllPrevious(beforeIndex, duration = 1.0) {
    for (let i = 0; i < beforeIndex; i++) {
      if (cuesRef.current[i]?.type === "audio") fadeOutSingle(i, duration);
    }
  }

  function fadeAllOut(duration = 1.0) {
    audioRefs.current.forEach((h) => {
      try {
        const cur = h.gainNode ? h.gainNode.gain.value : h.el?.volume || 0;
        startFadeOnHolder(h, cur, 0, duration);
      } catch {}
    });
    setTimeout(() => {
      audioRefs.current.forEach((h) => {
        try {
          h.el.pause();
          h.el.currentTime = 0;
        } catch {}
        if (h.progressTimer) {
          clearInterval(h.progressTimer);
          h.progressTimer = null;
        }
      });
      if (!mountedRef.current) return;
      setSelectedIndex(null);
      setCues((prev) =>
        prev.map((c) => ({ ...c, progress: 0, currentTime: 0 }))
      );
    }, Math.max(200, duration * 1000 + 100));
  }

  // ── Stop helpers ────────────────────────────────────────────────────────
  function stopDelay(cueId, indexForCountdown) {
    if (delayIntervalsRef.current[cueId]) {
      clearInterval(delayIntervalsRef.current[cueId]);
      delete delayIntervalsRef.current[cueId];
    }
    if (mountedRef.current) {
      setDelayCountdowns((prev) => {
        const n = { ...prev };
        delete n[indexForCountdown];
        return n;
      });
    }
  }

  function stopAll() {
    audioRefs.current.forEach((h) => {
      try {
        if (h.fadeTimer) {
          clearInterval(h.fadeTimer);
          h.fadeTimer = null;
        }
        if (h.progressTimer) {
          clearInterval(h.progressTimer);
          h.progressTimer = null;
        }
        h.el.pause();
        h.el.currentTime = 0;
      } catch {}
    });
    Object.values(delayIntervalsRef.current).forEach(clearInterval);
    delayIntervalsRef.current = {};
    setDelayCountdowns({});
    setCues((prev) => prev.map((c) => ({ ...c, progress: 0, currentTime: 0 })));
  }

  function stopSingle(i) {
    const cue = cuesRef.current[i];
    if (!cue) return;
    stopDelay(cue.id, i);
    if (cue.type === "audio" || cue.type === "playlist") {
      if (cue.type === "playlist" && cue.playlistItems)
        cue.playlistItems.forEach((item) => {
          const h = audioRefs.current.get(item.id);
          if (h) {
            try {
              h.el.pause();
              h.el.currentTime = 0;
            } catch {}
            if (h.progressTimer) {
              clearInterval(h.progressTimer);
              h.progressTimer = null;
            }
          }
        });
      const h = audioRefs.current.get(cue.id);
      if (h) {
        if ((cue.fadeOut || 0) > 0) {
          const cur = h.gainNode ? h.gainNode.gain.value : h.el?.volume || 0;
          startFadeOnHolder(h, cur, 0, cue.fadeOut);
          setTimeout(() => {
            try {
              h.el.pause();
              h.el.currentTime = cue.cropStart ?? 0;
            } catch {}
            if (h.progressTimer) {
              clearInterval(h.progressTimer);
              h.progressTimer = null;
            }
          }, (cue.fadeOut + 0.05) * 1000);
        } else {
          try {
            h.el.pause();
            h.el.currentTime = cue.cropStart ?? 0;
          } catch {}
          if (h.progressTimer) {
            clearInterval(h.progressTimer);
            h.progressTimer = null;
          }
        }
      }
    }
    setCues((prev) => {
      const copy = [...prev];
      if (copy[i]) {
        copy[i].progress = 0;
        copy[i].currentTime = 0;
        if (copy[i].type === "playlist") copy[i].playlistCurrentIndex = 0;
      }
      return copy;
    });
    setSelectedIndex((prev) => (prev === i ? null : prev));
  }

  // ── Playback ────────────────────────────────────────────────────────────
  function onCueComplete(index) {
    if (!mountedRef.current) return;
    setCues((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index].progress = 0;
        copy[index].currentTime = 0;
      }
      return copy;
    });
    const cue = cuesRef.current[index];
    if (!cue) return;
    if (cue.advanceMode === "autoAdvance") {
      const next = index + 1;
      if (next < cuesRef.current.length) setSelectedIndex(next);
    }
    const nextIdx = index + 1;
    if (
      nextIdx < cuesRef.current.length &&
      cuesRef.current[nextIdx].advanceMode === "follow"
    )
      playCueAt(nextIdx);
  }

  function onPlaylistItemComplete(playlistIndex) {
    if (!mountedRef.current) return;
    const playlist = cuesRef.current[playlistIndex];
    if (!playlist || playlist.type !== "playlist") return;
    const nextIdx = (playlist.playlistCurrentIndex || 0) + 1;
    if (nextIdx < playlist.playlistItems.length) {
      setCues((prev) => {
        const copy = [...prev];
        copy[playlistIndex] = {
          ...copy[playlistIndex],
          playlistCurrentIndex: nextIdx,
        };
        return copy;
      });
      setTimeout(() => playPlaylistItem(playlistIndex, nextIdx), 50);
    } else {
      setCues((prev) => {
        const copy = [...prev];
        copy[playlistIndex] = {
          ...copy[playlistIndex],
          playlistCurrentIndex: 0,
          progress: 0,
          currentTime: 0,
        };
        return copy;
      });
      onCueComplete(playlistIndex);
    }
  }

  function findEndOfParallelGroupStartingAt(startIndex) {
    let i = startIndex;
    while (
      i + 1 < cuesRef.current.length &&
      cuesRef.current[i + 1].advanceMode === "parallel"
    )
      i++;
    return i;
  }

  function startParallelGroupAfter(index) {
    let i = index + 1;
    while (
      i < cuesRef.current.length &&
      cuesRef.current[i].advanceMode === "parallel"
    ) {
      playCueAt(i);
      i++;
    }
  }

  function playPlaylistItem(playlistIndex, itemIndex) {
    const playlist = cuesRef.current[playlistIndex];
    if (!playlist || playlist.type !== "playlist") return;
    const item = playlist.playlistItems[itemIndex];
    if (!item) return;
    const tempCue = {
      id: item.id,
      type: "audio",
      base64Data: item.base64Data,
      duration: item.duration,
      volume: playlist.volume,
      fadeIn: playlist.fadeIn,
      fadeOut: playlist.fadeOut,
      loop: false,
      cropStart: null,
      cropEnd: null,
    };
    const holder = ensureAudioHolder(tempCue);
    if (!holder) return;
    const audio = holder.el;
    const end = item.duration || Infinity;
    audio.onended = null;
    try {
      audio.currentTime = 0;
    } catch {}
    if (holder.gainNode) {
      try {
        holder.gainNode.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
      } catch {}
    } else {
      try {
        audio.volume = 0;
      } catch {}
    }
    audio.play().catch((err) => console.warn("Audio play failed:", err));
    const targetVol = playlist.volume ?? 1;
    if ((playlist.fadeIn || 0) > 0)
      startFadeOnHolder(
        holder,
        0,
        Math.max(0, Math.min(1, targetVol)),
        playlist.fadeIn
      );
    else if (holder.gainNode) {
      try {
        holder.gainNode.gain.setValueAtTime(
          targetVol,
          audioCtxRef.current.currentTime
        );
      } catch {}
    } else {
      try {
        audio.volume = targetVol * masterVolume;
      } catch {}
    }
    if (holder.progressTimer) {
      clearInterval(holder.progressTimer);
      holder.progressTimer = null;
    }
    let completionFired = false;
    const fireComplete = () => {
      if (completionFired) return;
      completionFired = true;
      if (holder.progressTimer) {
        clearInterval(holder.progressTimer);
        holder.progressTimer = null;
      }
      if ((playlist.fadeOut || 0) > 0) {
        const cur = holder.gainNode ? holder.gainNode.gain.value : audio.volume;
        startFadeOnHolder(holder, cur, 0, playlist.fadeOut);
        setTimeout(() => {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch {}
          onPlaylistItemComplete(playlistIndex);
        }, (playlist.fadeOut + 0.05) * 1000);
      } else {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {}
        onPlaylistItemComplete(playlistIndex);
      }
    };
    holder.progressTimer = setInterval(() => {
      try {
        const t = audio.currentTime;
        const prog = end > 0 ? Math.min(1, t / Math.max(0.0001, end)) : 0;
        if (mountedRef.current) {
          setCues((prev) => {
            const copy = [...prev];
            if (copy[playlistIndex]) {
              copy[playlistIndex].progress = prog;
              copy[playlistIndex].currentTime = t;
            }
            return copy;
          });
        }
        if (t >= end) fireComplete();
      } catch {}
    }, 50);
    audio.onended = () => fireComplete();
  }

  function startPlaybackForCue(cue, idx) {
    if (!cue) return;
    if (cue.type === "playlist") {
      if (!cue.playlistItems?.length) {
        alert("Playlist is empty");
        return;
      }
      const startIndex =
        cue.playlistMode === "shuffle"
          ? Math.floor(Math.random() * cue.playlistItems.length)
          : 0;
      setCues((prev) => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], playlistCurrentIndex: startIndex };
        return copy;
      });
      playPlaylistItem(idx, startIndex);
      startParallelGroupAfter(idx);
      setSelectedIndex(idx);
      return;
    }
    if (cue.type !== "audio") return;
    const holder = ensureAudioHolder(cue);
    if (!holder) return;
    const audio = holder.el;
    const start = cue.cropStart ?? 0;
    const end = cue.cropEnd ?? cue.duration ?? Infinity;
    audio.onended = null;
    try {
      audio.currentTime = Math.max(0, start);
    } catch {}
    if (holder.gainNode) {
      try {
        holder.gainNode.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
      } catch {}
    } else {
      try {
        audio.volume = 0;
      } catch {}
    }
    audio.play().catch((err) => console.warn("Audio play failed:", err));
    const targetVol = cue.volume ?? 1;
    if (cue.volumeEnvelope?.length > 1)
      applyEnvelope(holder, cue, 0, end - start);
    else if ((cue.fadeIn || 0) > 0)
      startFadeOnHolder(
        holder,
        0,
        Math.max(0, Math.min(1, targetVol)),
        cue.fadeIn
      );
    else if (holder.gainNode) {
      try {
        holder.gainNode.gain.setValueAtTime(
          targetVol,
          audioCtxRef.current.currentTime
        );
      } catch {}
    } else {
      try {
        audio.volume = targetVol * masterVolume;
      } catch {}
    }
    if (holder.progressTimer) {
      clearInterval(holder.progressTimer);
      holder.progressTimer = null;
    }
    let completionFired = false;
    const fireComplete = () => {
      if (completionFired) return;
      completionFired = true;
      if (holder.progressTimer) {
        clearInterval(holder.progressTimer);
        holder.progressTimer = null;
      }
      if ((cue.fadeOut || 0) > 0) {
        const cur = holder.gainNode ? holder.gainNode.gain.value : audio.volume;
        startFadeOnHolder(holder, cur, 0, cue.fadeOut);
        setTimeout(() => {
          try {
            audio.pause();
            audio.currentTime = start;
          } catch {}
          onCueComplete(idx);
        }, (cue.fadeOut + 0.05) * 1000);
      } else {
        try {
          audio.pause();
          audio.currentTime = start;
        } catch {}
        onCueComplete(idx);
      }
    };
    holder.progressTimer = setInterval(() => {
      try {
        const t = audio.currentTime;
        const prog =
          end > start
            ? Math.min(1, (t - start) / Math.max(0.0001, end - start))
            : 0;
        if (mountedRef.current) {
          setCues((prev) => {
            const copy = [...prev];
            if (copy[idx]) {
              copy[idx].progress = prog;
              copy[idx].currentTime = t;
            }
            return copy;
          });
        }
        if (t >= end && !cue.loop) fireComplete();
      } catch {}
    }, 50);
    holder.loopIteration = 0;
    audio.onended = () => {
      if (cue.loop && cue.loopCount) {
        holder.loopIteration = (holder.loopIteration || 0) + 1;
        if (holder.loopIteration < cue.loopCount) {
          try {
            audio.currentTime = start;
            audio.play();
          } catch {}
        } else {
          holder.loopIteration = 0;
          fireComplete();
        }
      } else if (!cue.loop) {
        fireComplete();
      }
    };
    startParallelGroupAfter(idx);
    setSelectedIndex(idx);
  }

  function executeControlCue(cue, index) {
    const cc = cuesRef.current;
    switch (cue.controlAction) {
      case "start": {
        if (cue.targetCueId) {
          const ti = cc.findIndex((c) => c.id === cue.targetCueId);
          if (ti !== -1) startPlaybackForCue(cc[ti], ti);
        }
        break;
      }
      case "stop": {
        if (cue.targetCueId) {
          const ti = cc.findIndex((c) => c.id === cue.targetCueId);
          if (ti !== -1) stopSingle(ti);
        }
        break;
      }
      case "setVolume": {
        if (cue.targetCueId) {
          const ti = cc.findIndex((c) => c.id === cue.targetCueId);
          if (ti !== -1) {
            const newVol = cue.volume ?? 1;
            setCues((prev) => {
              const copy = [...prev];
              if (copy[ti]) copy[ti].volume = newVol;
              return copy;
            });
            const h = audioRefs.current.get(cue.targetCueId);
            if (h) {
              const cur = h.gainNode
                ? h.gainNode.gain.value
                : h.el?.volume || 0;
              startFadeOnHolder(
                h,
                cur,
                Math.max(0, Math.min(1, newVol)),
                cue.fadeDuration || 0
              );
            }
          }
        }
        break;
      }
      case "fadeIndividual": {
        if (cue.targetCueId) {
          const ti = cc.findIndex((c) => c.id === cue.targetCueId);
          if (ti !== -1) fadeOutSingle(ti, cue.fadeDuration || 1);
        }
        break;
      }
      case "fadeAllPrevious": {
        fadeAllPrevious(index, cue.fadeDuration || 1);
        break;
      }
      case "jumpTo": {
        if (cue.targetCueId) {
          const ti = cc.findIndex((c) => c.id === cue.targetCueId);
          if (ti !== -1) setSelectedIndex(ti);
        }
        return;
      }
      default:
        break;
    }
    if (cue.advanceMode === "autoAdvance") {
      const next = index + 1;
      if (next < cc.length) setSelectedIndex(next);
    }
  }

  function playCueAtImmediate(index) {
    const cue = cuesRef.current[index];
    if (!cue) return;
    if (cue.type === "note") {
      setSelectedIndex(index);
      if (cue.advanceMode === "autoAdvance") {
        const next = index + 1;
        if (next < cuesRef.current.length)
          setTimeout(() => setSelectedIndex(next), 100);
      } else if (cue.advanceMode === "startAdvance") {
        const next = index + 1;
        if (next < cuesRef.current.length) setSelectedIndex(next);
      }
      return;
    }
    if (cue.type === "control") {
      executeControlCue(cue, index);
      return;
    }
    if (cue.advanceMode === "startAdvance") {
      startPlaybackForCue(cue, index);
      const next = index + 1;
      if (next < cuesRef.current.length) setSelectedIndex(next);
      return;
    }
    if (cue.advanceMode === "parallel") {
      startPlaybackForCue(cue, index);
      setSelectedIndex(
        Math.min(
          findEndOfParallelGroupStartingAt(index) + 1,
          cuesRef.current.length - 1
        )
      );
      return;
    }
    startPlaybackForCue(cue, index);
  }

  async function playCueAt(index) {
    if (audioCtxRef.current?.state === "suspended")
      await audioCtxRef.current.resume().catch(console.warn);
    if (index == null || index < 0 || index >= cuesRef.current.length) return;
    const cue = cuesRef.current[index];
    if (!cue) return;
    const delayMs = (cue.delay || 0) * 1000;
    if (delayMs > 0) {
      let remaining = cue.delay;
      if (mountedRef.current)
        setDelayCountdowns((prev) => ({ ...prev, [index]: remaining }));
      if (delayIntervalsRef.current[cue.id])
        clearInterval(delayIntervalsRef.current[cue.id]);
      delayIntervalsRef.current[cue.id] = setInterval(() => {
        remaining = Math.max(0, remaining - 0.1);
        if (mountedRef.current)
          setDelayCountdowns((prev) => ({ ...prev, [index]: remaining }));
        if (remaining <= 0) {
          clearInterval(delayIntervalsRef.current[cue.id]);
          delete delayIntervalsRef.current[cue.id];
          if (mountedRef.current)
            setDelayCountdowns((prev) => {
              const n = { ...prev };
              delete n[index];
              return n;
            });
        }
      }, 100);
      setTimeout(() => {
        if (mountedRef.current) playCueAtImmediate(index);
      }, delayMs);
    } else {
      playCueAtImmediate(index);
    }
  }

  return {
    audioRefs,
    masterGainRef,
    WaveSurferRef,
    waveSurferLoadPromise: () => waveSurferLoadPromise,
    getEnvelopeValueAt,
    startFadeOnHolder,
    fadeOutSingle,
    fadeAllPrevious,
    fadeAllOut,
    stopDelay,
    stopAll,
    stopSingle,
    playCueAt,
    startPlaybackForCue,
  };
}
