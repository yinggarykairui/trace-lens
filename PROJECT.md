# PROJECT.md — trace-lens

Per MANUAL §4 (PROJECT.md rule): the converged spec, architecture, done-map,
and open threads. Revisits read this first and update it last; a revisit's
planner diffs repo state against this spec and specs only the next increment.

## Spec (converged)

**Increment 1 (day 002 — hub issue #26, job-lane build for #25).** Replay a
committed JSON trace of an LLM coding-agent run as if live: token-by-token
streaming text, expandable tool-call cards, Canvas 2D timeline with
click/drag scrub, play/pause/speed (0.5–4×)/restart, one virtual clock.
Keyless and offline: the trace is compiled into the bundle. Full
done-checklist: hub issue #26, spec comment.

**Increment 2 (day 005 revisit — spec comment on its hub issue).** Close D2
and D3; move ONE fence item in: URL-hash deep-links.
- D2: card expand state becomes a keyed set (call_id) in Transcript — view
  state outside the projection — so an opened card survives back-scrub past
  its birth, and restart. Page reload resets it.
- D3: paused with nothing projected (playhead before the first event), the
  transcript shows one muted hint line; gone once any item projects.
- Deep-link: #t=<seconds> parsed once at load → finite values clamp to
  [0, duration], seek, start paused; junk ignored (normal autoplay).
  Pause/seek writes #t back, debounced, via history.replaceState — zero
  history entries. While playing the hash keeps the last fixed moment.

**Fence (excluded — a revisit needs a new spec comment to move it):** live
model connection · BYO-key · multi-trace upload/paste · WebGL · trace
editing · export · routing/state-lib/CSS-framework/localStorage · runtime
deps beyond react + react-dom · second bundled trace · reduced-motion mode ·
live hashchange handling after load · copy-link/share UI.

## Architecture sketch

- `src/usePlayback.ts` — the one virtual clock: rAF loop only while playing;
  `vt += (now − last) × speed` into a ref; seek writes the ref directly.
- `src/project.ts` — `projectState(trace, vt)`, pure: walks events `t ≤ vt`,
  slices text by cumulative delta `dt`, joins tool results by `call_id`.
  Playback AND seek both render through it — pane and playhead cannot
  disagree. This invariant is the design; protect it in any revisit.
- `src/Timeline.tsx` — single canvas, DPR ≤ 2, pointer-capture click+drag,
  `touch-action: none`.
- `src/Transcript.tsx` — streaming pane, pinned-to-bottom autoscroll;
  increment 2 lifts card expand state here as a keyed set (call_id) —
  outside the projection, alive across card unmount/remount (D2).
- Hash adapter (increment 2; App boundary or a small hook) — vt in/out of
  the URL only: parse once at load → seek + pause; write debounced on
  pause/seek via replaceState. Never a second clock or event walk.
- `src/trace.json` — fixture, 23 events / 47.7 s; schema in the #26 spec.
- Build: Vite, `base:'./'`, outDir `docs/` (committed); Pages serves /docs.

## Done-map

Increment 1 (day 002) — complete, shipped, must-pass 7/7:
- [x] v0: clock + projection + streaming pane + plain cards + play/pause
- [x] Canvas timeline with scrub (click + drag + touch)
- [x] Speed 0.5/1/2/4× · restart · elapsed/total readout
- [x] Card expand/collapse with full I/O JSON
- [x] 375 px pass (no h-scroll, touch scrub works)
- [x] README + LICENSE + screenshot · Pages live (critic report in #26)

Increment 2 (day 005) — complete, shipped:
- [x] D2: opened card returns expanded after scrub-back past its birth;
      survives restart; page reload resets
- [x] D3: muted hint in the empty pane when paused before the first event;
      gone at the first projected item
- [x] #t=12.4 load → paused there, pane + playhead projected to the moment
- [x] Hash garbage (#t=junk / -3 / 9999) never breaks load: junk → normal
      autoplay; finite → clamped, paused
- [x] Pause/scrub rewrites #t (debounced replaceState); copied URL
      reproduces the moment; Back gains no entries
- [x] Regression: projectState-only render path; play/space/speeds/restart/
      drag-scrub/375 px unbroken; `npm run build` clean
- [x] README sentences (card persistence, deep-link, #t run note) true ·
      increment sign-off + dashboard row

Two things the increment 2 critics forced that were not in the spec, both
kept: Play now restarts from anywhere in the run's **silent tail** (the
1.05 s after the last event at 46.664 s, derived from the trace by
`lastContentMs` in App.tsx, not a constant) — without it, a scrub to the
last few pixels wrote a `#t=` link whose first Play click did nothing
visible. And the clock's own stop at the end no longer writes the hash, so
watching the demo through and reloading replays it instead of handing back
a spent transcript.

Anything beyond increment 2 is a NEW increment needing a spec.

## Open threads

- Likeliest next fence moves (an owner issue would open one), best first:
  **live hashchange handling** — a `#t=` link clicked into an already-open
  tab does nothing and the address bar then disagrees with the app; both
  increment-2 critics named it the one path where a share link fails a real
  recipient, so it is the fence item to open next. Then: second bundled
  trace (contrast run) · reduced-motion mode.
- Deliberate: the hash mirrors the last paused/scrubbed moment, not the
  live playhead (no per-frame replaceState). Revisit only if it confuses.
- Deliberate: the hash carries tenths of a second, floored to match the
  on-screen readout, so a reopened link can sit up to 99 ms behind the
  sharer's playhead. Invisible in practice.
- Kept nits from increment 2's critics — judged not worth a cycle, recorded
  so the next revisit can price them: the `<h1>` wraps to two lines at
  ≤375 px (pre-existing since increment 1, one CSS line) · the empty-pane
  hint is one line orphaned at the top of a tall pane — copy and tone are
  right, placement is not · `dependencies` use caret ranges rather than
  pins (§13), mitigated by the committed lockfile and the prebuilt `docs/`
  · `parseHashTime` accepts anything `Number()` accepts, so `#t=0x10`
  seeks to 16 s — harmless, nothing crashes.
- Latent, cannot occur with the committed fixture: `lastContentMs` seeds
  its reduce at 0, so a trace with no events would make the whole run a
  silent tail and Play would always replay. Guard it if the fixture ever
  becomes loadable input.
