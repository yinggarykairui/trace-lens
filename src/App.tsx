import { useCallback, useEffect, useMemo, useRef } from 'react';
import rawTrace from './trace.json';
import type { Trace } from './types';
import { projectState } from './project';
import { END_SLACK_MS, usePlayback, type SeekTarget } from './usePlayback';
import { parseHashTime, useHashListener, useHashPublisher } from './hash';
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
  const { toggle, pause, seek, restart, playing, vt } = playback;
  const items = useMemo(() => projectState(trace, playback.vt), [playback.vt]);

  // ---- hash out: the address bar mirrors the last fixed moment ----
  const {
    publish: publishHash,
    clear: clearHash,
    cancel: cancelHash,
  } = useHashPublisher();

  // The one seek the whole app offers: pointer, keyboard and the pointer's own
  // drag all arrive here. seek() clamps and hands back where it landed, so the
  // address bar publishes the moment that is actually on screen.
  const onSeek = useCallback(
    (target: SeekTarget) => {
      publishHash(seek(target));
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
  // that was loaded is left exactly as the visitor received it. The clock's own
  // stop at the end of the run is not a chosen moment, so it publishes nothing
  // — and clears what an earlier pause or scrub published, because a `#t=46.4`
  // left in the address bar outlives the run it points into: reloading after
  // watching the demo through would hand back a near-spent transcript instead
  // of replaying it. That stop is the only way vt reaches duration_ms exactly,
  // which is the test.
  const vtRef = useRef(vt);
  vtRef.current = vt; // read by the pause effect, which must not run per frame
  const wasPlaying = useRef(playing);
  // Set by an arriving hash for the one pause that hash itself caused; see the
  // hash-in adapter below.
  const skipNextPausePublish = useRef(false);
  useEffect(() => {
    const stopped = wasPlaying.current && !playing;
    wasPlaying.current = playing;
    if (!stopped) return;
    if (skipNextPausePublish.current) {
      skipNextPausePublish.current = false;
      return;
    }
    const ranOut = vtRef.current >= trace.meta.duration_ms;
    if (ranOut) clearHash();
    else publishHash(vtRef.current);
  }, [playing, publishHash, clearHash]);

  // ---- hash in: somebody else's moment landing in a tab that has one ----
  // A `#t=` link opened in a tab already running trace-lens gets exactly what
  // the load path gives it — open here, paused — and gives nothing back: an
  // arriving hash is authoritative until the visitor chooses a new moment, so
  // it is never rewritten by its own arrival, not even to its own clamped or
  // reformatted value. Two things could write over it and both are stopped
  // here: a debounced write still in flight from an earlier scrub (cancelled
  // before it can land) and the publish that a pause normally makes (suppressed
  // exactly once, and only when this really is stopping a running clock).
  //
  // A hash with no usable `t` is ignored outright — no seek, no pause, no
  // write. Mid-session there is already a moment on screen, and throwing away
  // a viewer's position over a typo is worse than a stale address bar.
  const playingNow = useRef(playing);
  playingNow.current = playing;
  useHashListener(
    useCallback(
      (ms: number | null) => {
        cancelHash();
        if (ms === null) return;
        // Pause before seeking, not after: the clock must not be left running
        // across the seek, or a frame lands the playhead past the linked moment.
        if (playingNow.current) skipNextPausePublish.current = true;
        pause();
        seek(ms); // the same clamp every other seek gets — no second path
      },
      [cancelHash, pause, seek],
    ),
  );

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
            // aria-pressed, not role="radio"/aria-checked: these stay plain
            // buttons inside the existing role="group", and pressed is what
            // .is-active is drawing. Play/Pause is deliberately left without
            // one — its label already changes between "Play" and "Pause", and
            // aria-pressed on a button whose name flips reads the state twice.
            <button
              type="button"
              key={s}
              className={'btn btn-speed' + (playback.speed === s ? ' is-active' : '')}
              aria-pressed={playback.speed === s}
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
