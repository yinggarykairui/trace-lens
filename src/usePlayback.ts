import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How close to the end of the run counts as "at the end". Below one tenth of a
 * second nothing more can be seen, and that is also the hash's resolution.
 */
export const END_SLACK_MS = 100;

/**
 * Where to seek to: a moment in ms, or a function of the moment the clock is
 * on right now. The relative form exists because React props are a frame
 * behind: a key repeat can fire thirty arrows before a single re-render, and
 * thirty handlers all reading the same stale `vt` would seek one second thirty
 * times over. `vtRef` is current the instant a seek lands, so resolving the
 * delta here is the only way "one second later" means it every time. Still one
 * seek, one clamp, one publish — the caller does not gain a second path.
 */
export type SeekTarget = number | ((vt: number) => number);

export interface Playback {
  vt: number; // virtual time, ms from run start
  playing: boolean;
  speed: number;
  /** Returns true when the press restarted the run from 0 (play at the end). */
  toggle: () => boolean;
  /** Stop the clock where it is. Idempotent, and unlike toggle() never plays. */
  pause: () => void;
  /** Moves the clock and returns the clamped moment it actually landed on. */
  seek: (target: SeekTarget) => number;
  setSpeed: (s: number) => void;
  restart: () => void;
}

/**
 * One virtual clock. While playing, a requestAnimationFrame loop accumulates
 * real elapsed time x speed into vt. Seeking just moves vt; the same loop
 * continues from the new position. Auto-pauses at the end of the run.
 */
export function usePlayback(
  durationMs: number,
  autoplay = false,
  initialVt = 0,
  endSlackMs = END_SLACK_MS,
): Playback {
  // autoplay/initialVt are read once, at mount: a deep-linked load starts the
  // clock somewhere other than 0, and paused. Later changes are ignored.
  const start = Math.max(0, Math.min(durationMs, initialVt));
  const [vt, setVt] = useState(start);
  const [playing, setPlaying] = useState(autoplay);
  const [speed, setSpeedState] = useState(1);

  const vtRef = useRef(start);
  const speedRef = useRef(1);
  const playingRef = useRef(autoplay);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      // A frame already queued when the clock stopped is still going to fire:
      // React tears this effect down on the next commit, not synchronously, so
      // between a pause() and that commit there is room for exactly one frame.
      // Left to run it would advance vt past the moment the pause was for — up
      // to ~67 ms at 4x — and that value, not the chosen one, is what a link
      // arriving in this tab would end up showing. playingRef is set the
      // instant the clock stops, so this is the synchronous half of the stop.
      if (!playingRef.current) return;
      // Clamp both ends. `last` is captured when this effect runs, but a frame
      // callback's `now` is the frame-start timestamp and can predate it, so a
      // fast play/pause toggle can hand the first frame a negative delta —
      // which used to drive vt below zero and write `#t=-0.1`.
      const next = Math.max(
        0,
        Math.min(durationMs, vtRef.current + (now - last) * speedRef.current),
      );
      last = now;
      vtRef.current = next;
      setVt(next);
      if (next >= durationMs) {
        playingRef.current = false;
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, durationMs]);

  const toggle = useCallback(() => {
    let restarted = false;
    if (!playingRef.current && vtRef.current >= durationMs - endSlackMs) {
      // play pressed at the end: start over. The slack matters — a deep-link or
      // a scrub can park the playhead inside the run's silent tail, and playing
      // from there would run the clock out with nothing new appearing, so Play
      // would look dead. The caller sizes the tail; see App.tsx.
      vtRef.current = 0;
      setVt(0);
      restarted = true; // the caller republishes the hash: see App.tsx
    }
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
    return restarted;
  }, [durationMs, endSlackMs]);

  // Stopping the clock without the "play at the end restarts" branch toggle()
  // carries: a link landing in this tab means "show me this moment, paused",
  // and going through toggle() to get there would replay the run from 0 for
  // any link into the silent tail.
  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
  }, []);

  // The one clamp. Every seek — pointer, key, hash — comes through here, and
  // the landed value goes back to the caller so nothing downstream (the hash
  // publisher, above all) has to clamp a second time and get it slightly wrong.
  const seek = useCallback(
    (target: SeekTarget) => {
      const raw = typeof target === 'function' ? target(vtRef.current) : target;
      const clamped = Math.max(0, Math.min(durationMs, raw));
      vtRef.current = clamped;
      setVt(clamped);
      return clamped;
    },
    [durationMs],
  );

  const setSpeed = useCallback((s: number) => {
    speedRef.current = s;
    setSpeedState(s);
  }, []);

  const restart = useCallback(() => {
    vtRef.current = 0;
    setVt(0);
    playingRef.current = true;
    setPlaying(true);
  }, []);

  return { vt, playing, speed, toggle, pause, seek, setSpeed, restart };
}
