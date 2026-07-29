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

Increment 2 (day 005):
- [ ] D2: opened card returns expanded after scrub-back past its birth;
      survives restart; page reload resets
- [ ] D3: muted hint in the empty pane when paused before the first event;
      gone at the first projected item
- [ ] #t=12.4 load → paused there, pane + playhead projected to the moment
- [ ] Hash garbage (#t=junk / -3 / 9999) never breaks load: junk → normal
      autoplay; finite → clamped, paused
- [ ] Pause/scrub rewrites #t (debounced replaceState); copied URL
      reproduces the moment; Back gains no entries
- [ ] Regression: projectState-only render path; play/space/speeds/restart/
      drag-scrub/375 px unbroken; `npm run build` clean
- [ ] README sentences (card persistence, deep-link, #t run note) true ·
      increment sign-off + dashboard row

Anything beyond increment 2 is a NEW increment needing a spec.

## Open threads

- Likeliest next fence moves (an owner issue would open one): second
  bundled trace (contrast run) · reduced-motion mode · live hashchange
  handling (jump when the hash of an open tab is edited).
- Deliberate: the hash mirrors the last paused/scrubbed moment, not the
  live playhead (no per-frame replaceState). Revisit only if it confuses.
