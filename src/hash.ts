import { useCallback, useEffect, useRef } from 'react';

/**
 * The URL hash carries one thing: `#t=<seconds>`, a moment in the run.
 * It is read at load and again on every `hashchange` after it — one parser for
 * both paths, never two sets of junk rules — and written back only through
 * replaceState, which does not fire `hashchange`, so our own writes can never
 * feed the listener. Virtual time in and out of the address bar; no second
 * clock, and no history entry either way.
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
 * leave the page permanently blank instead of just ignoring the junk. It now
 * also runs on every hash the visitor types for the rest of the session, so
 * the same rule holds for every keystroke in the address bar.
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
    // NaN is junk — `#t=junk`, `#t=12.4abc`, `#t=NaN` name no moment at all.
    // ±Infinity is not junk: `#t=1e999` and `#t=Infinity` name a moment outside
    // the run, which the README promises is clamped to its start or end, and
    // the seek's own clamp (Math.max(0, Math.min(duration, …))) already returns
    // duration for +Infinity and 0 for -Infinity. Rejecting them here made the
    // README's clamp sentence false for exactly the values furthest outside the
    // run. Still one parser and one set of junk rules; only the line between
    // "junk" and "out of range" moved to where the README already drew it.
    if (Number.isNaN(seconds)) return null;
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
 * Returns the ways the address bar can be written, and the one way a write can
 * be called off:
 * - `publish(ms)`: debounced — a drag that fires fifty seeks writes once, at
 *   the value of the last one.
 * - `clear()`: drop the `#t=` again, for the moment nobody chose (the clock
 *   running out at the end of the run).
 * - `cancel()`: drop a pending debounced write *without* writing anything, for
 *   the moment somebody else chose (a link arriving in this tab).
 * The two writes go through replaceState, so neither costs a history entry.
 */
export function useHashPublisher(): {
  publish: (ms: number) => void;
  clear: () => void;
  cancel: () => void;
} {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(0);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const publish = useCallback((ms: number) => {
    pending.current = ms;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      // replaceState, not location.hash: the Back button must not collect a
      // stop for every scrub. Relative URL keeps path and query untouched.
      history.replaceState(null, '', formatHashTime(pending.current));
    }, WRITE_DEBOUNCE_MS);
  }, []);

  // A scrub's write is in flight for 250 ms after the scrub. Anything that
  // makes that value wrong before it lands has to call this, or it lands
  // anyway: the address bar would jump back to a moment nobody is looking at
  // a quarter-second later.
  const cancel = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Not publishing is not enough on its own: a `#t=` an earlier pause or scrub
  // already wrote outlives the run it points into, so a reload hands back a
  // near-spent transcript. Cancel any debounced write first — otherwise the
  // scrub that led here lands its stale value a moment after the clear.
  const clear = useCallback(() => {
    cancel();
    // Same replaceState (no history entry); path and query survive, only the
    // fragment goes. Assigning location.hash = '' would leave a bare '#'.
    history.replaceState(null, '', location.pathname + location.search);
  }, [cancel]);

  return { publish, clear, cancel };
}

/**
 * Subscribe to hash navigations that happen after load: another `#t=` link
 * clicked in a tab that already has trace-lens running, Back and Forward
 * across ones already visited, or a visitor editing the address bar by hand.
 *
 * The hash is parsed by `parseHashTime` — the same and only parser the load
 * path uses — and the result is handed over raw: `null` for a hash carrying no
 * usable `t`, so the caller can tell "somebody chose a moment" from "somebody
 * typed something", and there is no second set of junk rules to disagree with
 * the first. `replaceState` does not fire `hashchange`, so our own writes never
 * arrive here; nothing in this listener can loop back into itself.
 *
 * The callback is held in a ref so a caller need not memoize it to avoid
 * re-subscribing, and the whole body is guarded: an unhandled throw in a
 * listener would take the tree down with no error boundary to catch it, and a
 * blank page is a worse answer to a mistyped hash than ignoring it.
 */
export function useHashListener(onNavigate: (ms: number | null) => void): void {
  const latest = useRef(onNavigate);
  latest.current = onNavigate;

  useEffect(() => {
    const onHashChange = () => {
      try {
        latest.current(parseHashTime(location.hash));
      } catch {
        // Ignore: a hash navigation must never be able to blank the page.
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
}
