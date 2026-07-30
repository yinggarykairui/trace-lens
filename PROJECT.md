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

Evening polish pass (day 005, the 20:00 PT shift — MANUAL §11 evening
mandate). Three critic→fix cycles on the already-shipped increment under
feature freeze: no new scope, no fence item moved, 14 commits. What
fresh-eyes critics found and what closed:

- [x] **Blocker.** `parseHashTime`'s `decodeURIComponent` was unguarded, so
      `#t=%` (also `5%`, `%zz`, `%FF`, `%E0%A4%A`) threw `URIError` during
      module evaluation — before React mounted — leaving a **permanently
      blank page**, no UI at all. A stray `%` in a shared link is exactly
      the garbage that parser exists to absorb. Now try/catch → the
      existing junk path (normal autoplay).
- [x] Virtual time could go negative: the rAF accumulator clamped only
      upward, and `last` (a `performance.now()` captured in the play
      effect) can postdate the frame's own timestamp, so a play toggle
      could apply a negative delta — rendering `-1:-1 / 0:47` and
      publishing `#t=-0.1`. The share link this increment exists to
      produce came out corrupt. Clamped at both ends in all three vt
      writers, plus a `fmt` floor.
- [x] Stale hashes, three paths: Play-at-the-end and Restart both replayed
      from 0 while leaving the old `#t=` in the address bar, and the run
      reaching its own end could not clear a hash an earlier pause had
      published. Each one handed a spent transcript to whoever reopened the
      link. All three now republish or clear (`clear()` cancels the pending
      debounced write first, so nothing lands after it).
- [x] Timeline draw and seek used different widths (`contentRect` 818 vs
      `getBoundingClientRect` 820), so clicking the very pixel the playhead
      was drawn on seeked ~59 ms off at desktop width and ~170 ms at
      320 px — past the hash's own 100 ms resolution. One width now, border
      inset corrected: measured error ≤7 ms.
- [x] `ctx.roundRect` and `new ResizeObserver` were unguarded inside draw
      effects. With no error boundary above them React 19 unmounts on
      throw — the same blank page as the blocker, for older browsers.
      Feature-detected, with `fillRect` and window-resize fallbacks.
- [x] README truth (directive 4): "**recorded** LLM agent run" and "**real
      timings**" implied a captured session, but `trace.json` is a
      hand-authored fixture → "sample trace". The provenance footer was
      frozen at Day 002 → `Day 002 (revisited day 005)`. Two 40-word
      sentences split, then the section merged back inside STYLE.md's 2–5
      sentence slot.
- [x] UX pass on what already existed: tool cards had no hover state at all
      (a stranger could watch the whole run and never learn they open —
      never seeing this increment's headline feature), opening one left
      181 px of it clipped below the pane at 375 px, the `<h1>` wrapped
      mid-word as "trace-"/"lens" on a phone, the empty-pane hint sat
      orphaned ~980 px above the button it names, phone `<pre>` payloads
      hid the trace's punchline behind an inner scroll, tap targets were
      34 px, and the timeline lane was drawn at 1.08:1 against the page —
      effectively undrawn. All closed. No legend, no new UI.
- [x] Page metadata: description, inline `data:` SVG favicon (no more
      `/favicon.ico` 404), `og:type/title/description`, so a pasted `#t=`
      link unfurls as something. Plus one `source` anchor in the header:
      the fence's "the address bar is the share UI" theory makes the README
      the only documentation of `#t=`, and a deep link dropped a stranger
      into the demo with no route to it. Provenance, not share UI.
- [x] §13: `react`, `react-dom` and all five devDependencies pinned exact.
      No resolved version moved — the rebuilt bundle is byte-identical.
- [x] **A regression the polish itself introduced, caught by cycle 3 and
      fixed in cycle 3.** The new card scroll-into-view fired on close as
      well as open; its own programmatic scroll emitted a `scroll` event,
      `onScroll` latched `pinnedRef` false, and the streaming autoscroll
      then never re-snapped — so one tap on a card permanently killed
      pinned-to-bottom and the last ~12 s of the run streamed off-screen.
      Self-scrolls are now flagged and ignored by `onScroll`, and the
      toggle scrolls on open only. Verified 12/12 across 0.5–4× replay and
      4/6/10× CPU throttle, with the same probe failing 4/4 on the pre-fix
      build. A deliberate scroll-up still unpins; returning re-pins.
- [x] `screenshot.png` re-captured from the polished build (§9.6), framing
      matched to the existing caption; lane pixels sampled to confirm
      `#2a2f39`.

Kept deliberately after three cycles: `#t=0x10` seeks to 16 s because
`parseHashTime` is `Number()`-lenient (harmless, nothing crashes) · the
~0.5 s blank pane at the very start of autoplay (showing the hint there
would make its own "Press play" copy false) · the desktop vertical dead
space at 1440×900 (a layout restructure is not a polish-cycle change) ·
`.tool-body pre` still scrolling horizontally at ≥481 px, where there is
room for it.

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
- Increment 2's four kept nits are **closed** by the day-005 evening polish
  pass (above): the `<h1>` wrap, the orphaned hint, the caret ranges, and
  the latent no-events `lastContentMs` seed. Only `#t=0x10`'s parsing
  leniency is still deliberately kept.
- Open, priced, not worth a cycle tonight: the desktop layout leaves
  ~700 px of dead space at 1440×900 at load and a 139 px gap above the
  timeline mid-run, because content is top-aligned — the honest fix is
  bottom-anchoring the transcript so it fills upward like a console, which
  is a layout change and wants its own increment · the canvas is
  unfocusable (`tabIndex`/`role` unset) so keyboard users cannot seek at
  all, while the empty-pane hint invites them to "scrub the timeline" —
  adding arrow-key seeking is a feature, so it needs a spec, but the copy
  and the capability should agree · the timeline's three tool colours have
  no legend, so the bars read as unlabelled debris to a first-time viewer.
- Verification debt, not a code defect: no scheduled shift has ever loaded
  `https://yinggarykairui.github.io/trace-lens/`. The sandboxes those
  shifts run in cannot reach `github.io` at all, so §11.2's live-demo line
  and the repo description/topics check keep falling to desk sessions. What
  *is* verified, three times independently: the committed `docs/` is
  byte-identical to a fresh `npm run build` from `git archive HEAD`, so the
  deploy serves what the source says.
