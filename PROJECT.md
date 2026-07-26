# PROJECT.md — trace-lens

Per MANUAL §4 (PROJECT.md rule): the converged spec, architecture, done-map,
and open threads. Revisits read this first and update it last; a revisit's
planner diffs repo state against this spec and specs only the next increment.

## Spec (converged, day 002 — hub issue #26, job-lane build for #25)

Replay a committed JSON trace of an LLM coding-agent run as if live:
token-by-token streaming text, expandable tool-call cards, Canvas 2D
timeline with click/drag scrub, play/pause/speed (0.5–4×)/restart, one
virtual clock. Keyless and offline: the trace is compiled into the bundle.
Full spec with done-checklist: hub issue #26, spec comment.

**Fence (excluded — a revisit needs a new spec comment to move it):** live
model connection · BYO-key · multi-trace upload/paste · WebGL · trace
editing · export · routing/state-lib/CSS-framework/localStorage · runtime
deps beyond react + react-dom.

## Architecture sketch

- `src/usePlayback.ts` — the one virtual clock: rAF loop only while playing;
  `vt += (now − last) × speed` into a ref; seek writes the ref directly.
- `src/project.ts` — `projectState(trace, vt)`, pure: walks events `t ≤ vt`,
  slices text by cumulative delta `dt`, joins tool results by `call_id`.
  Playback AND seek both render through it — pane and playhead cannot
  disagree. This invariant is the design; protect it in any revisit.
- `src/Timeline.tsx` — single canvas, DPR ≤ 2, pointer-capture click+drag,
  `touch-action: none`.
- `src/Transcript.tsx` — streaming pane, pinned-to-bottom autoscroll,
  ToolCard expand state is local (unmounts on back-scrub — known nit D2).
- `src/trace.json` — fixture, 23 events / 47.7 s; schema in the #26 spec.
- Build: Vite, `base:'./'`, outDir `docs/` (committed); Pages serves /docs.

## Done-map

- [x] v0: clock + projection + streaming pane + plain cards + play/pause
- [x] Canvas timeline with scrub (click + drag + touch)
- [x] Speed 0.5/1/2/4× · restart · elapsed/total readout
- [x] Card expand/collapse with full I/O JSON
- [x] 375 px pass (no h-scroll, touch scrub works)
- [x] README + LICENSE + screenshot · Pages live · shipped day 002,
      rubric must-pass 7/7 (critic report in #26)

v0 done-map is complete. Anything below is a NEW increment needing a spec.

## Open threads

- D2 (critic nit, kept): card expand state lost when scrubbing back past
  the card's birth — pure-projection unmount by design; revisit would need
  keyed state outside the projection.
- D3 (critic nit, kept): transcript empty at hard vt=0 with no hint (first
  event t=400 ms); only visible when paused at zero.
- Fence candidates a future owner issue could open: second bundled trace
  (contrast run), URL-hash deep-link to a timestamp, reduced-motion mode.
