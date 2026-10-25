/**
 * Draggable handles between panes, and pane sizes remembered per browser.
 * Sizes are a convenience, so storage failing (private window) only means
 * they reset on reload.
 */
import { useCallback, useState } from "react";

export function usePaneSize(key: string, initial: number, min: number, max: number) {
  const [size, setSize] = useState(() => {
    try {
      const v = Number(localStorage.getItem(`gameide.pane.${key}`));
      return v >= min && v <= max ? v : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: number) => {
      const c = Math.round(Math.min(max, Math.max(min, v)));
      setSize(c);
      try {
        localStorage.setItem(`gameide.pane.${key}`, String(c));
      } catch {
        /* sizes just won't be remembered */
      }
    },
    [key, min, max],
  );
  return [size, set] as const;
}

/**
 * A handle. `onDrag` gets how far the pointer has moved since the drag
 * began (in px, along the handle's axis); `invert` for a pane on the far
 * side, which grows as the handle moves toward the start.
 */
export function Splitter({
  axis,
  size,
  onResize,
  invert,
  label,
}: {
  axis: "x" | "y";
  size: number;
  onResize: (size: number) => void;
  invert?: boolean;
  label: string;
}) {
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    const start = axis === "x" ? e.clientX : e.clientY;
    const startSize = size;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    document.body.classList.add(axis === "x" ? "resizing-x" : "resizing-y");
    const move = (ev: PointerEvent) => {
      const d = (axis === "x" ? ev.clientX : ev.clientY) - start;
      onResize(startSize + (invert ? -d : d));
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      document.body.classList.remove("resizing-x", "resizing-y");
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  const key = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10;
    const grow = axis === "x" ? (invert ? "ArrowLeft" : "ArrowRight") : invert ? "ArrowUp" : "ArrowDown";
    const shrink = axis === "x" ? (invert ? "ArrowRight" : "ArrowLeft") : invert ? "ArrowDown" : "ArrowUp";
    if (e.key === grow) onResize(size + step);
    else if (e.key === shrink) onResize(size - step);
  };
  return (
    <div
      className={`splitter splitter-${axis}`}
      role="separator"
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-label={label}
      tabIndex={0}
      onPointerDown={down}
      onKeyDown={key}
    />
  );
}
