import { useEffect, useMemo, useRef, useState } from 'react';
import type { Trace } from './types';
import type { SeekTarget } from './usePlayback';

const PAD = 8; // px inside the canvas on each side
const HEIGHT = 64; // css px

// Keyboard seek steps. One second is the smallest move worth making on a 47 s
// run; five is a turn's worth. Both are coarser than the hash's own 0.01 s, so
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

// The lane's own surface. It is only 1.40:1 above the page background, so it is
// not what shows where the track starts and stops before anything is drawn into
// it — the lane's 1px CSS border does that, at 3.21:1 against the page. Do not
// lighten this to make the extent read on its own: every mark in the lane is
// measured against this fill, and all of them would lose exactly what it gained
// (a past cycle tried a lighter surface for the played region and pushed the
// turn dividers to 1.07:1). The bars and the playhead carry their own contrast.
const LANE_FILL = '#2a2f39';

// The app's accent, and the playhead's own colour. The progress rail is drawn
// in it too, so the rail reads as the playhead's trail rather than as a fourth
// colour to learn.
const ACCENT = '#e3b34c';

// How far the clock has got. Progress does need a cue that clears 3:1 against
// the unplayed track — the 7% amber wash this replaces measured 1.14:1, so
// progress read only from the playhead and the readout — but buying that with
// a *surface behind the marks* spends their contrast instead: the full-height
// lighter fill that reached 3.16:1 pushed every bar, tick and divider drawn
// over it below the same floor (the dividers to 1.07:1, visually gone), and
// after a full playthrough the played region is the whole lane, so the legend
// would be naming colours nothing on screen still shows. Progress and the marks
// only compete where they share pixels, so the rail takes a band of its own:
// 4 px along the lane's bottom edge, under the dividers' feet (HEIGHT - 4) and
// well clear of the text ticks (HEIGHT - 10), stopping short of the playhead's
// left edge. Nothing is drawn on top of the rail, and every mark is back on
// LANE_FILL at exactly the contrast it had.
const RAIL_H = 4;

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

  // progress rail: its own band along the bottom edge, ending 0.75 px before
  // the playhead's left edge so the two never share a pixel
  const phx = x(vt);
  const railEnd = phx - 1.5;
  if (railEnd > PAD) {
    ctx.fillStyle = ACCENT;
    ctx.fillRect(PAD, HEIGHT - RAIL_H, railEnd - PAD, RAIL_H);
  }

  // playhead
  ctx.strokeStyle = ACCENT;
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
        // Rounded the same way valuenow is, or the two can never meet: the raw
        // max is 47.713 while valuenow tops out at 47.7, so End — the run's own
        // end — was announced as 99.98% of the way through.
        aria-valuemax={Number((duration / 1000).toFixed(1))}
        aria-valuenow={Number((vt / 1000).toFixed(1))}
        aria-valuetext={`${(vt / 1000).toFixed(1)} seconds of ${(duration / 1000).toFixed(1)}`}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          // The primary button only. Without this a right-click seeks the
          // replay and publishes the new moment while Chrome opens its context
          // menu over a playhead the visitor never asked to move, and a middle
          // click does the same silently. Touch and pen are unaffected: a
          // finger or a pen tip reports button 0 and isPrimary, the same as the
          // left mouse button; a second finger is not primary and is ignored,
          // which is what the single-capture drag already assumed.
          if (e.button !== 0 || !e.isPrimary) return;
          // Guarded for the same reason as roundRect and ResizeObserver above:
          // there is no error boundary over this tree. setPointerCapture throws
          // NotFoundError for a pointerId the browser has no active pointer for
          // — not reachable with a real mouse or finger, but it was the last
          // unguarded DOM call in the build and it took the seek down with it.
          // Capture is only what keeps a drag on the lane once the cursor
          // leaves it, so losing it costs the drag, not the click.
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // no capture: the click below still seeks, the drag just will not
            // follow the pointer off the canvas
          }
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
