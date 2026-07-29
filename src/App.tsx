import { useCallback, useEffect, useMemo, useRef } from 'react';
import rawTrace from './trace.json';
import type { Trace } from './types';
import { projectState } from './project';
import { usePlayback } from './usePlayback';
import { parseHashTime, useHashPublisher } from './hash';
import { Transcript } from './Transcript';
import { Timeline } from './Timeline';

const trace = rawTrace as unknown as Trace;

const SPEEDS = [0.5, 1, 2, 4];

// Read once, before the first render: a usable #t= means "open here, paused",
// which overrides autoplay. No hash, or an unusable one, loads normally.
const deepLink = parseHashTime(window.location.hash);

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function App() {
  const playback = usePlayback(
    trace.meta.duration_ms,
    deepLink === null, // deep-linked loads start paused on the shared moment
    deepLink ?? 0,
  );
  const { toggle, seek, playing, vt } = playback;
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

  // Pausing fixes a moment worth sharing; playing does not (a per-frame hash
  // would be a live mirror, not a link). Skips the initial render: the hash
  // that was loaded is left exactly as the visitor received it.
  const vtRef = useRef(vt);
  vtRef.current = vt; // read by the pause effect, which must not run per frame
  const wasPlaying = useRef(playing);
  useEffect(() => {
    const stopped = wasPlaying.current && !playing;
    wasPlaying.current = playing;
    if (stopped) publishHash(vtRef.current);
  }, [playing, publishHash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault(); // no page scroll, no focused-button re-activation
      if (!e.repeat) toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <div className="app">
      <header className="header">
        <h1>trace-lens</h1>
        <span className="trace-title">{trace.meta.title}</span>
      </header>
      <Transcript items={items} playing={playback.playing} />
      <Timeline trace={trace} vt={playback.vt} onSeek={onSeek} />
      <div className="controls">
        <button type="button" className="btn btn-play" onClick={toggle}>
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
        <button type="button" className="btn" onClick={playback.restart}>
          Restart
        </button>
        <span className="time-readout">
          {fmt(playback.vt)} / {fmt(trace.meta.duration_ms)}
        </span>
      </div>
    </div>
  );
}
