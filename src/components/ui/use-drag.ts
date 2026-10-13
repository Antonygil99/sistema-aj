'use client';
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
export type DragState = { dx: number; dy: number; vx: number; vy: number };
type Options = {
  axis: 'x' | 'y';
  onMove?: (state: DragState) => void;
  onEnd?: (state: DragState) => void;
  // Ignore drags that start on interactive controls (buttons, inputs, links).
  ignoreInteractive?: boolean;
};
// Pointer-based drag with axis locking: a gesture only counts once movement clearly follows `axis`,
// so vertical page scrolling and horizontal swipes never fight each other.
export function useDrag({ axis, onMove, onEnd, ignoreInteractive = true }: Options) {
  const state = useRef<{ id: number; x: number; y: number; t: number; locked: boolean | null; last: DragState } | null>(null);
  function reset() { state.current = null; }
  return {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      if (ignoreInteractive && (event.target as HTMLElement).closest('button, a, input, select, textarea, label, [data-no-drag]')) return;
      state.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t: performance.now(), locked: null, last: { dx: 0, dy: 0, vx: 0, vy: 0 } };
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      const current = state.current;
      if (!current || current.id !== event.pointerId) return;
      const dx = event.clientX - current.x, dy = event.clientY - current.y;
      if (current.locked === null) {
        if (Math.hypot(dx, dy) < 8) return;
        current.locked = axis === 'x' ? Math.abs(dx) > Math.abs(dy) * 1.2 : Math.abs(dy) > Math.abs(dx) * 1.2;
        if (!current.locked) { reset(); return; }
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* pointer already released */ }
      }
      const elapsed = Math.max(1, performance.now() - current.t);
      current.last = { dx, dy, vx: dx / elapsed, vy: dy / elapsed };
      onMove?.(current.last);
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      const current = state.current;
      if (!current || current.id !== event.pointerId) return;
      if (current.locked) onEnd?.(current.last);
      reset();
    },
    onPointerCancel() { if (state.current?.locked) onEnd?.({ dx: 0, dy: 0, vx: 0, vy: 0 }); reset(); },
  };
}
