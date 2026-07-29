import { useCallback, useEffect, useRef, useState } from 'react';

export interface Playback {
  vt: number; // virtual time, ms from run start
  playing: boolean;
  speed: number;
  toggle: () => void;
  seek: (vt: number) => void;
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
      const next = Math.min(durationMs, vtRef.current + (now - last) * speedRef.current);
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
    if (!playingRef.current && vtRef.current >= durationMs) {
      // play pressed at the end: start over
      vtRef.current = 0;
      setVt(0);
    }
    playingRef.current = !playingRef.current;
    setPlaying(playingRef.current);
  }, [durationMs]);

  const seek = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(durationMs, target));
      vtRef.current = clamped;
      setVt(clamped);
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

  return { vt, playing, speed, toggle, seek, setSpeed, restart };
}
