import { useEffect, useRef, useState } from 'react';
import type { Trace } from './types';

const PAD = 8; // px inside the canvas on each side
const HEIGHT = 64; // css px

const TOOL_COLORS: Record<string, string> = {
  read_file: '#6d94c9',
  run_tests: '#a488c9',
  edit_file: '#c9995f',
};
const TOOL_FALLBACK = '#7f8ea3';

// The lane's own surface. Kept a clear step above the page background so the
// track's extent is visible even before anything is drawn into it; the bars and
// the playhead carry their own contrast.
const LANE_FILL = '#2a2f39';

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
    ctx.fillStyle = TOOL_COLORS[ev.name] ?? TOOL_FALLBACK;
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

  // played region tint
  ctx.fillStyle = 'rgba(227, 179, 76, 0.07)';
  ctx.fillRect(PAD, 0, x(vt) - PAD, HEIGHT);

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
  onSeek: (vt: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);

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

  return (
    <canvas
      ref={canvasRef}
      className="timeline"
      style={{ height: HEIGHT }}
      aria-label="run timeline — click or drag to seek"
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
  );
}
