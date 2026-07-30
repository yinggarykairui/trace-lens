import { useCallback, useEffect, useRef } from 'react';

/**
 * The URL hash carries one thing: `#t=<seconds>`, a moment in the run.
 * It is read exactly once, at load — never watched afterwards — and written
 * back only through replaceState, so sharing a moment costs zero history
 * entries. Virtual time in and out of the address bar; no second clock.
 */

const WRITE_DEBOUNCE_MS = 250;

/**
 * Parse `#t=<seconds>` out of a raw location hash. Returns ms from run start,
 * or null when the hash carries no usable `t` — which is the common case
 * (no hash at all) and the garbage case (`#t=junk`) alike. Callers treat null
 * as "no deep-link": load normally.
 *
 * Out-of-range values are NOT rejected here; clamping is the seek's job, so
 * `#t=9999` on a 47 s trace lands at the end rather than being ignored.
 *
 * This runs at module scope, before React mounts, so it must not throw for any
 * input at all: a single stray `%` in a pasted link (`#t=5%`, `#t=%E0%A4%A`)
 * makes decodeURIComponent raise URIError, and an escaped throw here would
 * leave the page permanently blank instead of just ignoring the junk.
 */
export function parseHashTime(rawHash: string): number | null {
  const params = rawHash.replace(/^#/, '').split('&');
  for (const part of params) {
    if (!part.startsWith('t=')) continue;
    let raw: string;
    try {
      raw = decodeURIComponent(part.slice(2)).trim();
    } catch {
      return null; // malformed percent-escape: junk, same as `#t=nonsense`
    }
    if (raw === '') return null; // `#t=` alone is junk, and Number('') is 0
    const seconds = Number(raw);
    if (!Number.isFinite(seconds)) return null; // 'junk', 'Infinity', '12.4abc'
    return seconds * 1000;
  }
  return null;
}

/**
 * Format ms as the hash's own units: seconds, one decimal — floored, never
 * rounded. Rounding up would disagree with the on-screen readout (which floors
 * to whole seconds) and could push the value past the end of the run, so the
 * link would land a hair short of a moment the sharer saw as the end.
 */
export function formatHashTime(ms: number): string {
  return `#t=${(Math.floor(ms / 100) / 10).toFixed(1)}`;
}

/**
 * Returns a debounced publisher: call it with the moment to put in the hash.
 * A drag that fires fifty seeks writes once, at the value of the last one.
 */
export function useHashPublisher(): (ms: number) => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback((ms: number) => {
    pending.current = ms;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      // replaceState, not location.hash: the Back button must not collect a
      // stop for every scrub. Relative URL keeps path and query untouched.
      history.replaceState(null, '', formatHashTime(pending.current));
    }, WRITE_DEBOUNCE_MS);
  }, []);
}
