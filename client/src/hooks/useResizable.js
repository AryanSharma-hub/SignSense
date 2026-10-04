import { useCallback, useEffect, useRef, useState } from 'react';

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback; // key not set — NOT the same as a stored 0 (Number(null) is 0, not NaN)
    const v = Number(JSON.parse(raw));
    return Number.isFinite(v) ? v : fallback;
  } catch { return fallback; }
};

/**
 * One draggable dimension (a pane's width or height), clamped to [min,max] and persisted
 * to localStorage per `storageKey` — the building block for the LeetCode-style resizable
 * split layout in App.jsx. `axis` picks which pointer coordinate drives the drag; `invert`
 * flips the direction for a divider whose pane grows the opposite way from the pointer
 * (e.g. the right-hand column, which grows as the divider moves left).
 */
export function useResizable({ initial, min = 160, max = Infinity, axis = 'x', storageKey, invert = false }) {
  const [size, setSize] = useState(() => (storageKey ? read(storageKey, initial) : initial));
  const drag = useRef(null);

  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(size)); } catch { /* ignore */ }
  }, [size, storageKey]);

  const onMove = useCallback((e) => {
    const d = drag.current;
    if (!d) return;
    const pos = axis === 'x' ? e.clientX : e.clientY;
    const delta = (pos - d.start) * (invert ? -1 : 1);
    setSize(Math.max(min, Math.min(max, d.startSize + delta)));
  }, [axis, invert, min, max]);

  const endDrag = useCallback(() => {
    drag.current = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', endDrag);
  }, [onMove]);

  const onDragStart = useCallback((e) => {
    e.preventDefault();
    drag.current = { start: axis === 'x' ? e.clientX : e.clientY, startSize: size };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endDrag);
  }, [axis, size, onMove, endDrag]);

  const nudge = useCallback((dir) => setSize((s) => Math.max(min, Math.min(max, s + dir * 24))), [min, max]);

  return { size, onDragStart, nudge };
}
