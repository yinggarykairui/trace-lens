import { useCallback, useEffect, useMemo, useRef } from 'react';
import rawTrace from './trace.json';
import type { Trace } from './types';
import { projectState } from './project';
import { END_SLACK_MS, usePlayback } from './usePlayback';
import { parseHashTime, useHashPublisher } from './hash';
import { Transcript } from './Transcript';
import { Timeline } from './Timeline';

const trace = rawTrace as unknown as Trace;

const SPEEDS = [0.5, 1, 2, 4];

// Read once, before the first render: a usable #t= means "open here, paused",
// which overrides autoplay. No hash, or an unusable one, loads normally.
const deepLink = parseHashTime(window.location.hash);

/**
 * The last moment at which anything new can appear in the pane. The clock runs
 * on to duration_ms after it — this trace's final event lands about a second
 * short of the end — and playing across that tail changes nothing on screen.
 * So the tail is where Play has to mean "replay" instead: without this, a link
 * pointing into it (a scrub to the last few pixels writes one) would answer the
 * first click with a Play button that flickers and no visible motion.
 */
const lastContentMs = trace.events.reduce(
  (latest, ev) => {
    const end =
      ev.type === 'text' && ev.deltas.length > 0
        ? ev.t + ev.deltas[ev.deltas.length - 1].dt
        : ev.t;
    return Math.max(latest, end);
  },
  // Seed: with no events at all there is no content, and seeding at 0 would
  // declare the whole run a silent tail, so Play would only ever replay.
  trace.events.length > 0 ? 0 : trace.meta.duration_ms,
);
const endSlackMs = Math.max(END_SLACK_MS, trace.meta.duration_ms - lastContentMs);

function fmt(ms: number): string {
  // Guard the floor divisions: a negative vt would render as "-1:-1".
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function App() {
  const playback = usePlayback(
    trace.meta.duration_ms,
    deepLink === null, // deep-linked loads start paused on the shared moment
    deepLink ?? 0,
    endSlackMs,
  );
  const { toggle, seek, restart, playing, vt } = playback;
  const items = useMemo(() => projectState(trace, playback.vt), [playback.vt]);

  // ---- hash out: the address bar mirrors the last fixed moment ----
  const publishHash = useHashPublisher();

  const onSeek = useCallback(
    (target: number) => {
      seek(target);
      publishHash(Math.max(0, Math.min(trace.meta.duration_ms, target)));
    },
    [seek, publishHash],
  );

  // Play pressed at the end restarts from 0, which moves the shared moment and
  // so must move the hash too: otherwise a scrub to the far right leaves its
  // spent `#t=47.7` in the address bar while the run replays from the top, and
  // reloading or sharing hands back a finished transcript. (The clock's own stop
  // at the end still writes nothing — see the pause effect below.)
  const onToggle = useCallback(() => {
    if (toggle()) publishHash(0);
  }, [toggle, publishHash]);

  // Restart moves the shared moment to 0 unconditionally, so it republishes the
  // hash through the same publisher as the Play-at-the-end restart above —
  // without it, Restart after a scrub to 28.7 s replays from the top while the
  // address bar still reads `#t=28.7`.
  const onRestart = useCallback(() => {
    restart();
    publishHash(0);
  }, [restart, publishHash]);

  // Pausing fixes a moment worth sharing; playing does not (a per-frame hash
  // would be a live mirror, not a link). Skips the initial render: the hash
  // that was loaded is left exactly as the visitor received it. Also skips the
  // clock's own stop at the end of the run — nobody chose that moment, and a
  // visitor who just watched the whole thing should be able to reload and watch
  // it again rather than find a finished transcript in the address bar. That
  // stop is the only way vt reaches duration_ms exactly, which is the test.
  const vtRef = useRef(vt);
  vtRef.current = vt; // read by the pause effect, which must not run per frame
  const wasPlaying = useRef(playing);
  useEffect(() => {
    const stopped = wasPlaying.current && !playing;
    wasPlaying.current = playing;
    const ranOut = vtRef.current >= trace.meta.duration_ms;
    if (stopped && !ranOut) publishHash(vtRef.current);
  }, [playing, publishHash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault(); // no page scroll, no focused-button re-activation
      if (!e.repeat) onToggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onToggle]);

  return (
    <div className="app">
      <header className="header">
        <h1>trace-lens</h1>
        <span className="trace-title">{trace.meta.title}</span>
        {/* A `#t=` link drops a stranger straight in here with nothing to say
            what this is. Provenance only — one anchor, not share UI. */}
        <a
          className="source-link"
          href="https://github.com/yinggarykairui/trace-lens"
          target="_blank"
          rel="noopener noreferrer"
        >
          source
        </a>
      </header>
      <Transcript items={items} playing={playback.playing} />
      <Timeline trace={trace} vt={playback.vt} onSeek={onSeek} />
      <div className="controls">
        <button type="button" className="btn btn-play" onClick={onToggle}>
          {playback.playing ? 'Pause' : 'Play'}
        </button>
        <div className="speed-group" role="group" aria-label="playback speed">
          {SPEEDS.map((s) => (
            <button
              type="button"
              key={s}
              className={'btn btn-speed' + (playback.speed === s ? ' is-active' : '')}
              onClick={() => playback.setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
        <button type="button" className="btn" onClick={onRestart}>
          Restart
        </button>
        <span className="time-readout">
          {fmt(playback.vt)} / {fmt(trace.meta.duration_ms)}
        </span>
      </div>
    </div>
  );
}
