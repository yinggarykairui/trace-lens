import { useEffect, useMemo, useRef, useState } from 'react';
import type { Trace } from './types';
import type { SeekTarget } from './usePlayback';

const PAD = 8; // px inside the canvas on each side
const HEIGHT = 64; // css px

// Keyboard seek steps. One second is the smallest move worth making on a 47 s
// run; five is a turn's worth. Both are coarser than the hash's own 0.1 s, so
// every keyed moment is a moment the address bar can carry exactly.
const KEY_STEP_MS = 1000;
const KEY_STEP_SHIFT_MS = 5000;

/**
 * The one colour table. draw() paints the bars from it and the legend under the
 * lane paints its swatches from it, through toolColor() — so the legend cannot
 * describe a colour the canvas is not using. These hexes deliberately do not
 * appear in styles.css: a second copy there is a second table, and the two
 * would drift the first time one of them was edited.
 */
const TOOL_COLORS: Record<string, string> = {
  read_file: '#6d94c9',
  run_tests: '#a488c9',
  edit_file: '#c9995f',
};
const TOOL_FALLBACK = '#7f8ea3';

export function toolColor(name: string): string {
  return TOOL_COLORS[name] ?? TOOL_FALLBACK;
}

/**
 * The distinct tool names this trace actually calls, in the order it first
 * calls them. Walked from the events rather than listed, so the legend cannot
 * name a tool the run never uses, or miss one it does.
 */
function toolsInTrace(trace: Trace): string[] {
  const seen: string[] = [];
  for (const ev of trace.events) {
    if (ev.type === 'tool_call' && !seen.includes(ev.name)) seen.push(ev.name);
  }
  return seen;
}

// The lane's own surface. Kept a clear step above the page background so the
// track's extent is visible even before anything is drawn into it; the bars and
// the playhead carry their own contrast.
const LANE_FILL = '#2a2f39';

// How far the clock has got, as a surface rather than a tint. The old 7% amber
// wash measured 1.14:1 against LANE_FILL — progress was legible only from the
// 1.5 px playhead and the readout. This is 3.16:1 (WCAG's 3:1 floor for
// meaningful non-text), which needs a real lift in lightness: nothing darker
// than the lane can reach 3:1 against it, since black itself only reaches 1.56.
// It stays the lane's own hue so the played region reads as the same track lit,
// and it is painted *under* the dividers, ticks, bars and playhead, so every
// mark keeps its exact colour and sits clearly on top of it.
const PLAYED_FILL = '#737b8d';

function draw(canvas: HTMLCanvasElement, trace: Trace, vt: number, width: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.round(HEIGHT * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, HEIGHT);

  const duration = trace.meta.duration_ms;
  const span = Math.max(1, width - PAD * 2);
  const x = (t: number) => PAD + (t / duration) * span;

  // lane background
  ctx.fillStyle = LANE_FILL;
  ctx.fillRect(0, 0, width, HEIGHT);

  // played region: the surface everything else is drawn on top of
  ctx.fillStyle = PLAYED_FILL;
  ctx.fillRect(PAD, 0, Math.max(0, x(vt) - PAD), HEIGHT);

  // turn dividers
  for (const ev of trace.events) {
    if (ev.type !== 'turn_start') continue;
    const px = x(ev.t);
    ctx.strokeStyle = 'rgba(139, 147, 161, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, 4);
    ctx.lineTo(px, HEIGHT - 4);
    ctx.stroke();
  }

  // text events: ticks along the lower band (dim for user, light for assistant)
  for (const ev of trace.events) {
    if (ev.type !== 'text') continue;
    const px = x(ev.t);
    ctx.strokeStyle =
      ev.role === 'assistant' ? 'rgba(217, 220, 227, 0.75)' : 'rgba(139, 147, 161, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, HEIGHT - 22);
    ctx.lineTo(px, HEIGHT - 10);
    ctx.stroke();
  }

  // tool calls: duration bars in the upper band, colored by tool
  for (const ev of trace.events) {
    if (ev.type !== 'tool_call') continue;
    const px = x(ev.t);
    const pw = Math.max(3, x(ev.t + ev.duration_ms) - px);
    ctx.fillStyle = toolColor(ev.name);
    // roundRect is Chrome 99+ / Safari 16.4+ / Firefox 112+. There is no error
    // boundary above this effect, so an older browser throwing here would
    // unmount the whole tree; square bars read fine.
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(px, 16, pw, 10, 2);
      ctx.fill();
    } else {
      ctx.fillRect(px, 16, pw, 10);
    }
  }

  // playhead
  const phx = x(vt);
  ctx.strokeStyle = '#e3b34c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(phx, 0);
  ctx.lineTo(phx, HEIGHT);
  ctx.stroke();
  ctx.fillStyle = '#e3b34c';
  ctx.beginPath();
  ctx.moveTo(phx - 4, 0);
  ctx.lineTo(phx + 4, 0);
  ctx.lineTo(phx, 6);
  ctx.closePath();
  ctx.fill();
}

export function Timeline({
  trace,
  vt,
  onSeek,
}: {
  trace: Trace;
  vt: number;
  onSeek: (target: SeekTarget) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const tools = useMemo(() => toolsInTrace(trace), [trace]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // ResizeObserver is Chrome 64+ / Safari 13.1+ / Firefox 69+ — old, but the
    // same rule as roundRect in draw() applies: there is no error boundary above
    // this effect, so a browser without it would throw here and unmount the
    // whole tree. Fall back to the window's resize event; clientWidth is the
    // same content box contentRect reports (no padding, border-box sizing), so
    // both paths hand draw() the pixels seekFromPointer maps back.
    if (typeof ResizeObserver !== 'function') {
      const measure = () => setWidth(canvas.clientWidth);
      measure();
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && width > 0) draw(canvas, trace, vt, width);
  }, [trace, vt, width]);

  // Both directions must span the same pixels or the playhead lands where a
  // click does not: `width` is the content box (what draw() maps the run onto),
  // while getBoundingClientRect includes the 1 px border on each side. Reuse
  // `width` and take the border out of the origin.
  const seekFromPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (width <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const inset = (rect.width - width) / 2; // border: in the rect, not in contentRect
    const frac = (e.clientX - rect.left - inset - PAD) / Math.max(1, width - PAD * 2);
    onSeek(Math.max(0, Math.min(1, frac)) * trace.meta.duration_ms);
  };

  // The keyboard is a third way to reach the same seek, not a third seek: every
  // key below ends at the same `onSeek` the pointer handlers call, so it gets
  // the same clamp and the same debounced publish. Timeline still holds no
  // clock — the arrows ask for "a second either side of wherever the clock is",
  // which the clock resolves, because a held arrow can fire thirty times before
  // React re-renders and thirty reads of the same stale `vt` prop would land
  // one second from the start instead of thirty. Key repeat is otherwise left
  // alone: the 250 ms publish debounce coalesces the run into one write.
  const duration = trace.meta.duration_ms;
  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    let target: SeekTarget;
    switch (e.key) {
      case 'ArrowLeft': {
        const step = e.shiftKey ? KEY_STEP_SHIFT_MS : KEY_STEP_MS;
        target = (at) => at - step;
        break;
      }
      case 'ArrowRight': {
        const step = e.shiftKey ? KEY_STEP_SHIFT_MS : KEY_STEP_MS;
        target = (at) => at + step;
        break;
      }
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = duration;
        break;
      default:
        return; // Space belongs to the window handler, and so does everything else
    }
    // Arrows scroll the page by default, which would slide the lane out from
    // under the very playhead the visitor is aiming.
    e.preventDefault();
    onSeek(target);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="timeline"
        style={{ height: HEIGHT }}
        tabIndex={0}
        role="slider"
        aria-label="run timeline — click, drag, or seek with arrow keys; hold Shift for five seconds, Home and End for the ends of the run"
        aria-valuemin={0}
        aria-valuemax={duration / 1000}
        aria-valuenow={Number((vt / 1000).toFixed(1))}
        aria-valuetext={`${(vt / 1000).toFixed(1)} seconds of ${(duration / 1000).toFixed(1)}`}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromPointer(e);
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
      />
      {/* What the colours in the lane mean. Static and non-interactive on
          purpose: the bars are already clickable, and a second, smaller set of
          click targets that filtered or highlighted them would be a feature,
          not a caption. */}
      <ul className="legend" aria-label="tool colours in the timeline">
        {tools.map((name) => (
          <li key={name}>
            <span className="legend-swatch" style={{ background: toolColor(name) }} />
            {name}
          </li>
        ))}
      </ul>
    </>
  );
}
