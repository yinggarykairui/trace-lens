# PROJECT.md — trace-lens

Per MANUAL §4 (PROJECT.md rule): the converged spec, architecture, done-map,
and open threads. Revisits read this first and update it last; a revisit's
planner diffs repo state against this spec and specs only the next increment.

## Spec (converged)

**Increment 1 (day 002 — hub issue #26, job-lane build for #25).** Replay a
committed JSON trace of an LLM coding-agent run as if live: delta-by-delta
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

Increment 3 (day 008) — complete, built in the spec's A → B → C order,
each item on its own seam:

- [x] **A. Live `hashchange`.** `hash.ts` gains `useHashListener`, wired
      at the App boundary to the load path's semantics: open here,
      paused. `parseHashTime` is still the only parser, so the live junk
      rules are the load junk rules. `#t=%`, `#t=5%`, `#t=%E0%A4%A`,
      `#t=junk`, `#t=`, `#nonsense` and bare `#` are ignored outright —
      position and play state survive, `#root` keeps its children, zero
      console errors. `#t=-3` → 0:00, `#t=9999` → 0:47, neither
      rewritten. Fence item *"live hashchange handling after load"*
      closed; it is the only fence move this increment makes.
- [x] A received hash is never rewritten by its own arrival:
      `useHashPublisher` gains `cancel()` (drops a pending debounced
      write without writing) and the pause a hashchange causes suppresses
      exactly one publish. Verified byte-equal: `#t=31.5` arriving in a
      tab playing at 4× lands on `0:31` with the hash still `#t=31.5`.
- [x] The frame-in-flight bug the spec named. React tears the play
      effect down on the next commit, not synchronously, so one queued
      rAF frame could still advance vt ~67 ms past the linked moment at
      4× — and publish that. The loop now returns early when
      `playingRef` is false, which is set the instant the clock stops.
      `usePlayback` gained `pause()` so the adapter need not fake one
      through `toggle()` (which would replay from 0 for any link into
      the silent tail).
- [x] No self-trigger, no history growth: 20 drag-seeks + 5 play/pause
      cycles fire `hashchange` **0** times; Back ×3 / Forward ×3 across
      three `#t=` entries leaves `history.length` identical and the
      readout right at every stop.
- [x] **B. Focusable timeline + keyboard seek.** `tabIndex`,
      `role="slider"`, `aria-valuemin/max/now/text`, an `aria-label`
      naming the keys, and a 2 px accent `:focus-visible` ring offset
      clear of the lane border. Six keys and no more: ←/→ ∓± 1 s,
      Shift for 5 s, Home → 0, End → end. Canvas is the 2nd Tab stop;
      arrows `preventDefault` (`scrollY` stays 0 with the document
      forced scrollable at 375×600); Space still toggles play with the
      lane focused; seeking by key does not change play state.
- [x] **C. Tool-colour legend.** One row per distinct `tool_call` name,
      walked from `trace.events` in first-call order, coloured through
      the same `TOOL_COLORS` / `toolColor()` that `draw()` uses — no
      hexes in `styles.css`, one table. Three rows (`read_file`,
      `run_tests`, `edit_file`) whose swatches equal the sampled bar
      pixels (`#6d94c9` / `#a488c9` / `#c9995f`); a scratch build with
      `run_tests`' calls stripped drops that row. 18.6 px tall, no
      horizontal scroll at 375 px, non-interactive.
- [x] Regression: one clock, one projection — a keyboard seek to 31.0 s
      and a reload at `#t=31.0` produce byte-identical transcript
      `textContent`; an arrow press while playing at 2× does not pause
      and the clock still advances 2.0 s/s. `npm run build` clean,
      committed `docs/` byte-identical to a fresh build of `HEAD`.
- [x] README: each item's §6 sentences landed in that item's own commit
      sequence, never ahead of the build.

**One deviation from the spec, deliberate and disclosed.** §7 says the
key handler should compute its target from the `vt` **prop**. That
cannot satisfy §4 item 4's own acceptance test — 30 synthetic
`repeat: true` arrows inside 300 ms — because React does not re-render
between dispatches in one task, so all 30 handlers read `vt = 0` and the
run lands at 0:01 instead of 0:30 (measured on the built bundle before
the fix). `seek()` now also accepts a function of the current vt, and
the arrows pass `at => at ± step`; `vtRef` is current the instant a seek
lands, so the delta resolves against the clock rather than a stale prop.
The invariant the prop rule was protecting is intact: Timeline still
holds no vt state, and there is still exactly one seek path, one clamp
(now in one place only — `seek()` returns where it landed, so `onSeek`
no longer re-clamps for the publisher) and one debounced publish.

New and deliberate, per the spec's §8: a junk `hashchange` leaves the
address bar disagreeing with the app. We ignore it rather than reset the
viewer's position or clobber what they typed.

**Improvement cycle 1 (day 008 evening), against the merged defect list
of the playtester and the three critics.** Feature freeze held: seven
defects closed, one declined, nothing added. Every measurement below was
taken against the built `docs/`, driven headlessly.

- [x] **D1, the unanimous blocker.** `screenshot.png` had been stale
      since day 005 and showed 0 px of legend under a caption that
      claims one. Re-captured from this build at 2200 × 1400, the same
      framing as before, and checked by eye against all four claims:
      2× active with the run playing (`Pause`, `0:34 / 0:47`), the
      `edit_file` card expanded on its INPUT and OUTPUT, turn 3's line
      streaming behind the caret, the playhead 72.5% along the lane, and
      the legend's one row of three entries under it. Captured last, so
      the image is of the shipped build rather than of the one the cycle
      started with.
- [x] **D2.** `#t=1e999` and `#t=-1e999` parsed to ±Infinity, failed the
      `Number.isFinite` gate and were treated as junk, so the app played
      from 0:00 where the README promises a clamp. Only `NaN` is junk
      now; the seek's own clamp already resolved ±Infinity. `#t=1e999`
      and `#t=Infinity` → `0:47` paused, `#t=-1e999` → `0:00`, neither
      rewritten; the eight junk hashes still leave position, play state
      and `#root` untouched.
- [x] **D3.** The played region of the lane measured 1.14:1 against the
      unplayed track — progress was legible only from the playhead. It
      is a surface now, not a 7% tint, at **3.163:1** sampled from the
      canvas (`rgb(115,123,141)` against `rgb(42,47,57)`), painted under
      the dividers, ticks, bars and playhead so every mark keeps its
      exact colour: the legend swatches still equal their bar pixels.
- [x] **D4.** The six controls and the `source` link fell back to
      Chromium's white ring while the canvas and the cards wore the
      amber one. One `:focus-visible` rule now. Re-measured on the built
      `docs/` after the evening shift's cycle-2 rework, at `#t=34.0` and
      at 1440 × 900, 375 × 667 and 320 × 568: **12 focus stops at each
      width** — the `source` link, four tool-card heads, the canvas,
      Play, four speed chips, Restart — each a 2 px `rgb(227, 179, 76)`
      ring, in **two geometries and no more**: outside the border box at
      `outline-offset: 2px` (the eight that clip nothing) and inside it
      at `-2px` (the four card heads, whose card clips its overflow).
      The two overflow-driven panes, `.transcript` and `.tool-body pre`,
      take the inset one when a narrow window makes them tab stops. No
      ring is clipped on any of its four sides at any of the three
      widths, and the lowest ratio a ring measures against a surface it
      touches is 7.32:1 (`--border`, on the inset heads); everything
      else is 8.98:1 (`--panel`) or 9.66:1 (the page).
- [x] **D5.** `aria-pressed` on each speed button, mirroring
      `.is-active` and following a speed change. Play/Pause deliberately
      left alone — its accessible name already changes.
- [x] **D6.** `source` 41.5 × 20.4 → **49.5 × 45.4 px** (padded, then
      pulled back by equal negative margins, so the header grew by
      nothing on its own account); speed buttons
      40.7 → **54 × 44 px**, and only at 480 px and below — the floor was
      written inside the phone-width query, so every wider viewport kept
      33.7 px whether or not a thumb was doing the pointing. It follows
      the input device now: **44 px under `(pointer: coarse)` at any
      width** (`.btn` 74 × 44, `.btn-speed` 54 × 44, `.tool-head`
      766 × 44 at 812 × 375; 74 / 54 / 722 × 44 at 768 × 1024), and
      unchanged for a fine pointer (33.7 / 33.7 / 34.6 px at 1100 × 700,
      which is the metric the committed screenshot shows).
      `scrollWidth === clientWidth` at 320 and 375 px. The header numbers
      this line carried — 44.3 px at 375 px, 48.3 px at 1100 px — were
      measured before cycle 2's own D3, which bought the source link's
      ring six pixels of `padding-top` (`PROJECT.md` D3, twenty lines
      below) and was landed the same night. `326e80d` rewrote this line
      afterwards and left them standing. Measured on the built `docs/`:
      **50.25 px at 320 and 375 px, 54.25 px at 1100 px** (also 54.25 at
      1440), `padding-top` 16 px and 20 px.
- [x] **D8.** `.tool-summary` was `display:none` below 481 px, so the
      two `read_file` cards read identically on a phone. Restored on one
      ellipsised line, half a point smaller: at 375 px the first shows
      its path in full and the second truncates inside `paginate.test`.
      No layout cost — head heights (44 px) and the transcript's
      `scrollHeight` (1280 / 1177 / 1053 px at 320 / 375 / 480 px) are
      unchanged to the pixel.
- [ ] **D7 declined.** The defect made it conditional on staying
      type-clean and it does not; it is an open thread below.
- [x] Nothing regressed: a live `#t=31.5` still lands paused and
      unwritten, the six keys still clamp (`0:05 / 0:10 / 0:09 / 0:00 /
      0:47 / 0:00`), `window.scrollY` stays 0 through every arrow press,
      drag-seek still lands on the pixel it was released over, zero
      console and page errors on every run, `npm run build` clean
      including `tsc --noEmit`, and the committed `docs/` is
      byte-identical to a fresh build of `git archive HEAD`.

**Improvement cycle 2 (day 008 evening), against the merged list of two
independent clean-context verifiers.** Both returned BLOCK on the same
thing: a regression cycle 1 itself introduced. Four defects on the list,
four closed, nothing added, nothing declined.

- [x] **D1, the unanimous blocker, and a regression of cycle 1's own
      `69721a7`.** That commit bought the played region 3.16:1 against the
      unplayed track by making it a full-height lighter surface, and paid
      for it out of every mark drawn on that surface: inside the played
      region `read_file` 4.30 → 1.36, `run_tests` 4.44 → 1.40, `edit_file`
      5.25 → 1.66, playhead 6.92 → 2.19, assistant tick 6.24 → 2.43, user
      tick 2.50 → 1.21, turn divider 1.39 → 1.07 (visually gone). After a
      full playthrough the played region is the whole lane, so at that
      point the legend named colours nothing on screen still showed. The
      commit message stated only the half that improved.
      Progress and the marks only compete where they share pixels, so
      progress moved to a band of its own: a 4 px rail along the lane's
      bottom edge in the playhead's accent, below the dividers' feet
      (`HEIGHT - 4`), clear of the text ticks (`HEIGHT - 10`), stopping
      0.75 px short of the playhead's left edge. Nothing is drawn on top of
      it and it is drawn on top of nothing. Both sides re-measured from the
      built canvas at dpr 1 on an 818 px lane: **the cue reads 6.92:1**
      against the unplayed lane beside it (was 3.16, and 1.14 before that),
      and **every mark is back on `LANE_FILL`** — 4.30 / 4.44 / 5.25 /
      6.52 / 6.19 / 2.47 / 1.21 sampled, against 3.84 / 3.98 / 4.68 / 5.71
      / 5.42 / 2.33 / 1.21 for the same probe on a fresh build of
      `69721a7^`. No mark is below where it stood before either cycle-1
      state; five are above. (The three alpha strokes sample under their
      composited-hex values because a 1 px stroke at a fractional x is
      antialiased across two columns — the same probe reads the same way on
      both builds.)
- [x] **D2.** The caption's "the playhead two-thirds through the run" was
      false of the committed image, which both verifiers measured at
      71.8–72.5%. The caption moved, not the capture: the trace only lets
      the caption's three claims co-occur in 34.5–35.6 s (assistant text
      streams in six windows, `edit_file` is not born until 31.283 s), i.e.
      72–75%, so at two-thirds nothing is streaming. Now "three-quarters",
      and the re-captured image measures 72.4% off the PNG.
- [x] **D3.** Cycle 1's `bb02f93` gave the `source` link a 49.5 × 45.4 px
      target by padding a 20 px word, which put its box at `top: -1px` at
      320 and 375 px (3 px at 1100 px) — so its focus ring, drawn 2 px
      outside the box, landed at −3 px and the viewport cut its top edge
      off at every width. Lowering the box inside an unchanged header only
      trades the defect: the box is taller than the header's content, so
      its foot lands in the transcript, whose scrolled content paints over
      it and takes the clicks (`elementFromPoint` returned `.tool-head` at
      1100 px, a text span at 375 px — a 39.3 px effective target). The
      header pays the 6 px instead: `padding-top` 14 → 20 px, 10 → 16 px at
      phone width. Ring rows counted off screenshots: 1–2 and 52–53 at both
      phone widths, 5–6 and 56–57 at 1100 px, all four sides, target still
      45.4 px and owning its own bottom-left corner.
- [ ] **D4 — ticked here in error: closed in one place of four.** The
      opener said "token-by-token"; the trace's deltas are 1–4-word
      chunks. The opener became "delta-by-delta", which is what
      *What it does* has said since day 005, and STYLE.md makes the opener
      the repo description, so that much mattered. But `1863456` changed
      only that line: the same sentence ships verbatim in `index.html`'s
      `description` and `og:description` (and so in `docs/index.html`),
      and this file's own increment-1 spec line carried it too — the
      commit message argued the phrase was untrue and then never grepped
      for it. Cycle 3 closed the remaining three (see below), so D4 is
      whole now; it was not whole when this box was ticked.
- [x] `screenshot.png` re-captured last, from the built `docs/` at HEAD,
      at the same 2200 × 1400 framing and the same moment as the image it
      replaces (2× active, `Pause`, `0:34 / 0:47`, `edit_file` expanded on
      INPUT and OUTPUT, turn 3 streaming behind a visible caret, the
      legend of three entries in one row, playhead at 72.4%). The lane in
      it is now the lane the build draws.
- [x] Re-verified on the built artifact after all four: the live `#t=31.5`
      path at 4× (paused, `0:31`, hash byte-identical, playhead 1.48 px
      off), seven junk hashes ignored with `#root` intact, `-3` / `9999` /
      `1e999` / `0x10` clamping and never rewritten, 20 drag-seeks + 5
      play/pause firing `hashchange` 0 times with `history.length`
      unchanged, the six keys clamping (`0:05 / 0:10 / 0:09 / 0:00 / 0:47 /
      0:00`) and 30 repeat arrows landing `0:30` / `#t=30.0`, three legend
      swatches equal to their sampled bar pixels, no horizontal scroll and
      `scrollY` 0 at 320 and 375 px with the document forced 3000 px tall,
      all 12 focus stops mid-run wearing an unclipped ring, zero console
      and page errors, `npm run build` clean including `tsc --noEmit`, and
      the committed `docs/` byte-identical to a fresh build of
      `git archive HEAD`. 34/34.

**Improvement cycle 3 (day 008 evening), the last cycle under
`loop_cap: 3`.** Two clean-context passes, one APPROVE-with-nits and one
BLOCK, agreed on the same two truth defects — both word-level, both
against the must-pass "README is truthful" line — plus this file's own
done-map. Three defects, three closed, nothing added, nothing declined.
Feature freeze held: no `src/` file was opened this cycle.

- [x] **D1. The README overstated the streaming granularity in the two
      places `1863456` left standing.** The caption said the fix "streams
      into the text pane word by word" and *What it does* said a seek
      lands "even mid-word". Neither is reachable: `project.ts` appends
      only whole deltas (`if (ev.t + d.dt <= vt) text += d.s`), and of the
      trace's 87 deltas — 1–4 whole words each, 65 of them multi-word
      (`"Pagination is "`, `"broken on the "`) — all 80 internal
      boundaries fall on whitespace, so the pane cannot render a partial
      word and a seek cannot land inside one. The words moved, not the
      code: the chunked rhythm is the fixture's own and is correct. The
      caption now reads *"the agent's fix streams into the text pane in
      whole-word chunks"* and the timeline sentence *"seeks the replay to
      that moment, even mid-sentence"* — true of the artifact, the
      caption's shape and STYLE.md's 2–5 sentence slot (5) unchanged.
      `screenshot.png` deliberately **not** re-captured: the image does
      not depict granularity, and cycle 3 verified it against this build
      (2× active, expanded `edit_file` card, one legend row of three
      entries, the 4 px amber rail, playhead at 72.8%).
- [x] **D2. `index.html` still shipped the phrase the same commit ruled
      untrue.** `description` and `og:description` both carried
      "token-by-token text", and both ship inside `docs/index.html` — it
      is what a pasted `#t=` link unfurls to a stranger who has not opened
      it yet. Both now read "delta-by-delta text", byte-identical to the
      README opener that STYLE.md makes the repo description. This time
      the whole repo was grepped, `docs/` included, for `token-by-token`,
      `word by word` and `mid-word`: the increment-1 spec line at the top
      of this file was carrying it too and was corrected in the same
      commit. What the grep still finds is history and stays: the
      cycle-2 D4 entry and this entry quoting the phrase, the increment-2
      note about the `<h1>` wrapping mid-word (a different defect, about
      line breaks), and the §6 README draft quoted verbatim below. That
      draft is the planner artifact as posted and is not edited after the
      fact — it is where both phrases came from, and the shipped README
      now departs from it in three places: the two named above, plus the
      caption's "two-thirds" → "three-quarters" (cycle 2's D2, `ea9e501`).
- [x] **D3. This done-map checked off a defect that was only half
      closed.** Cycle 2's D4 box is unticked and now says what actually
      happened — one of four places closed, three left standing, and the
      grep the commit message implied but never ran.
- [x] Re-verified after the changes, against the built `docs/` served on
      a port checked to be free before binding and re-checked after (a
      leftover server answering 200 from a stale build is how a previous
      pass graded the wrong bundle): the served `index.html` is
      byte-identical to the committed one, the served bundle is the
      committed `index-BqEPnbYl.js`, both metadata strings carry the
      corrected sentence, the page renders (`#root` populated, three
      legend entries, transcript streaming), a live `#t=31.5` still lands
      and is not rewritten, and console errors, page errors and failed
      requests are all zero. `npm run build` clean including
      `tsc --noEmit`; the rebuild moved `docs/index.html` only, the asset
      hashes are unchanged; the committed `docs/` is byte-identical to a
      fresh build from `git archive HEAD`.

## Increment 3 spec (day 008 revisit — planner artifact)

*Posted to `PROJECT.md` (repo) and `HANDOFF.md` (hub) rather than as an issue comment: the GitHub API plane is gated in this sandbox. Size s–m. Last ship: day 005 (increment 2) + the day-005 evening polish pass. §4 shape.*

---

## 1. Scope

**The theme: a shared link has to work on a stranger's tab, and the timeline has to answer a keyboard.** Three items, in this order.

**A. Live `hashchange` handling.** This opens the fence item *"live hashchange handling after load"* — the one fence move this increment makes, and the item PROJECT.md's open threads name first.

- `window.addEventListener('hashchange', …)`: on every hash navigation after load, re-read the hash through the **existing** `parseHashTime` and, when it yields a finite value, **seek to it and pause** — the same semantics the load-time deep link already has ("open here, paused").
- A hash with no usable `t` (`#t=junk`, `#t=%`, `#t=`, `#nonsense`, bare `#`) is **ignored**: playback keeps its current position and play state. Mid-session there is already a moment on screen, and discarding a viewer's position over a typo is worse than a stale address bar. This matches the load-time junk rule, so the README's existing "a hash with no usable `t` in it is ignored" stays true without a new clause.
- Out-of-range values clamp exactly as at load (`#t=-3` → 0, `#t=9999` → end).
- **A received hash is never rewritten by its own arrival.** The pause that a hashchange causes publishes nothing, and any *pending* debounced write from an earlier scrub is **cancelled** before it can land on top of the incoming link. The next user-chosen pause or scrub publishes normally.
- Our own writes stay `replaceState` (which does not fire `hashchange`), so there is no feedback loop and no new history entries.

**B. A focusable timeline with keyboard seeking.** Not a fence item — an open thread PROJECT.md prices as "a feature, so it needs a spec". This is that spec.

- The canvas gets `tabIndex={0}`, `role="slider"`, `aria-valuemin=0`, `aria-valuemax` = duration in seconds, `aria-valuenow` = current vt in seconds to one decimal, `aria-valuetext` (e.g. `31.5 seconds of 47.7`), and its `aria-label` updated to name the keys.
- A visible focus ring on `:focus-visible` (accent, ≥2 px, offset so it does not sit on the lane border).
- Keys, **only** when the canvas has focus: `←`/`→` seek ∓/± 1.0 s · `Shift+←`/`Shift+→` ∓/± 5.0 s · `Home` → 0 · `End` → end of run. Each calls the **same `onSeek` prop the pointer path calls** — same clamp, same debounced publish, no second seek path.
- Arrow keys with the canvas focused `preventDefault()` so the page does not scroll. Key repeat is allowed and is naturally coalesced by the existing 250 ms publish debounce.
- Seeking by key does **not** change play state — identical to click/drag. Space keeps toggling play/pause, including while the canvas is focused.
- The empty-pane hint copy does **not** change. It already invites "scrub the timeline"; this item makes that true for keyboard users instead of making the copy smaller.

**C. A legend for the timeline's tool colours.** Also an open thread, not a fence item.

- A row directly under the lane: one swatch + tool name per distinct `tool_call` name, **derived by walking the trace**, not a hardcoded list, and coloured through the **same exported colour map `draw()` uses**. One colour table in the codebase, ever.
- Static, non-interactive, ≤ 44 px tall at 375 px, wraps rather than scrolls.

### Excluded — must NOT be built

Fence items that **stay closed** (this increment opens only "live hashchange handling"): live model connection · BYO-key · multi-trace upload/paste · WebGL · trace editing · export · routing / state-lib / CSS-framework / localStorage · runtime deps beyond `react` + `react-dom` · second bundled trace · reduced-motion mode · **copy-link / share UI**. The last one is the adjacent temptation: making links work live makes a "Copy link" button feel obvious. The address bar is still the share UI.

Also excluded, explicitly:

- **The desktop dead-space layout restructure** (bottom-anchoring the transcript). PROJECT.md prices it as its own increment. Not this one.
- `pushState`, history entries authored by the app, hash keys other than `t` (no `#speed=`, no `#card=`), per-frame hash publishing / live-mirror hash.
- Rewriting a received hash to its clamped or normalised value.
- Any keyboard shortcut beyond the six above — no `J/K/L`, no number keys for speed, no `,`/`.` frame-stepping, no PageUp/PageDown.
- Legend interactivity: no click-to-filter, no hover-highlight, no tooltips or time readouts on the canvas.
- Colour hexes duplicated into CSS, or a second colour table for the legend.
- Screen-reader live-region announcements; `aria-live` anywhere.
- Any edit to `src/trace.json`'s events, any new dependency, any change to the projection's shape.
- Persisting focus, legend, or card state anywhere.

---

## 2. Order is not optional

**A → B → C**, and A is a working v0 on its own.

1. **A (live hashchange)** lands first, alone, and is committed on its own seam. It is the smallest change (a listener in the App boundary + a `cancel()` on the publisher), it closes the failure both increment-2 critics named, and it needs no CSS and no new markup. When A is committed, README-truthful, `npm run build` clean and `docs/` rebuilt, the increment satisfies the rubric by itself — that is the budget-rule checkpoint, and it must be reached before half the run is spent.
2. **B (focus + keys)** second: it touches `Timeline.tsx` and `styles.css` only, and its correctness is checkable against A's own seek path.
3. **C (legend)** last: pure additive UI, the cheapest to cut, and the only item that changes the screenshot's framing.

The README draft in §6 is written so **each item owns its own sentences**. If the run goes sideways, ship what is committed and delete that item's sentences — do not ship a README sentence describing an item that was cut, and do not ship a half-item (a `tabIndex` with no key handler is a trap: focus that does nothing is worse than no focus).

---

## 3. Stack

Unchanged. TypeScript + React 19 (`react` / `react-dom` 19.2.8, pinned exact) + Vite 6.4.3, `base: './'`, `outDir: 'docs/'` committed, Pages serves `/docs`. **No new runtime dependencies** — the fence forbids anything beyond `react` + `react-dom`, and nothing here needs one. DevDependencies stay pinned exact (§13). Keyless, offline, the trace compiled into the bundle. `npm run build` runs `tsc --noEmit` first and must stay clean.

---

## 4. Done-checklist

Every item is drivable by a stranger in a headless browser against the built artifact. Duration is 47 713 ms; the lane maps time to `PAD + (t / 47713) × (width − 2·PAD)` with `PAD = 8`.

1. **A live `#t=` link lands exactly, pauses, and is not rewritten.** With the tab playing at 4×, perform a real hash navigation to `#t=31.5`. Within 500 ms: the Play button reads `Play`, the readout reads `0:31`, the playhead is within **3 px** of the mapped x for 31 500 ms, and `location.hash` is still **exactly** `#t=31.5`. Repeat with the tab paused at 0:05: same result. (This is where the frame-in-flight bug lives — a rAF frame that fires after the seek and before the pause lands the playhead up to ~67 ms past the target at 4× and then publishes that wrong value over the visitor's link. The assertion is byte-equality of the hash and the exact readout, so drift fails the check.)

2. **Junk and out-of-range hashchanges break nothing.** Starting paused at a known moment, navigate in turn to `#t=%`, `#t=5%`, `#t=%E0%A4%A`, `#t=junk`, `#t=`, `#nonsense`, `#`. After each: the readout and play state are **unchanged** from before the navigation, `document.getElementById('root')` still has child elements (the day-005 blocker was a permanently blank page), and the console has **zero** uncaught errors across the whole sequence. Then `#t=-3` → paused at `0:00`, `#t=9999` → paused at `0:47`, still zero errors, and neither is rewritten in the address bar.

3. **No stale write, no self-trigger, no history growth.** (a) Drag-scrub the timeline and, within 100 ms of releasing, navigate to `#t=5.0`; one second later `location.hash === '#t=5.0'` and the readout is `0:05` — the pending debounced write never lands. (b) Instrument the `hashchange` listener: 20 drag-seeks and 5 pause/play cycles fire it **0** times (`replaceState` must not feed itself). (c) Navigate to `#t=5.0`, `#t=20.0`, `#t=40.0`, then Back ×3 and Forward ×3 at 60 ms intervals; after settling, the readout matches the entry's value at each stop, `history.length` is **identical** before and after the whole sequence, and the console is clean.

4. **The timeline takes focus and answers keys.** With the pane empty and paused (`#t=0`), the canvas is the **2nd** element reached by Tab from the document start, `document.activeElement` is the canvas, and its `:focus-visible` computed `outline-width` is ≥ 2 px. Then, from 0:00: `→`×5 → `0:05` and `#t=5.0` · `Shift+→` → `0:10` · `←` → `0:09` · `Shift+←`×3 → `0:00` (clamped, never negative, never `-0:-1`) · `End` → `0:47` · `Home` → `0:00`. `aria-valuenow` tracks each move (one decimal). 30 synthetic `repeat: true` `→` keydowns inside 300 ms land at `0:30` with `location.hash === '#t=30.0'` and `history.length` unchanged. At 375 × 600 with the page scrollable, `window.scrollY` stays `0` through all of the above, and Space with the canvas focused toggles play without also seeking.

5. **One clock, one projection — the invariant holds under keys.** Keyboard-seek to 31.0 s while paused and capture the transcript pane's `textContent`; reload the built page at `#t=31.0` and capture again — the two strings are **identical**. Separately, with the run playing at 2×, press `→` once: the run keeps playing (no pause), and 1 000 ms later the readout has advanced by 2.0 s ± 0.2 s from the seeked value — one accumulator, not two. `End` then `Play` still restarts from 0:00 and republishes `#t=0.0` (the 1 049 ms silent tail behaviour from increment 2 is unbroken).

6. **The legend tells the truth about the pixels.** Exactly three entries under the lane — `read_file`, `run_tests`, `edit_file` — in trace order. ("Rows" as this spec first wrote it was wrong about what shipped and what the screenshot shows: the DOM is one flex row of three `<li>`, 18.59 px tall at 320 / 375 / 1100 / 1280 px. It wraps to more rows only if a width forces it, and none of those four does.) For each, the swatch's computed background colour equals the colour sampled from that tool's bar in the canvas (`#6d94c9`, `#a488c9`, `#c9995f`), compared as RGB triples. The entry set is derived from the trace: with a tool's `tool_call` events removed from a scratch copy of `trace.json`, its entry disappears (no hardcoded names anywhere outside the shared colour map). At 375 px, `document.documentElement.scrollWidth === clientWidth` (no horizontal scroll) and the legend block's height is ≤ 44 px.

7. **Nothing from increments 1–2 regressed, and the artifact is the source.** `npm run build` clean (including `tsc --noEmit`); the committed `docs/` is byte-identical to a fresh build from `git archive HEAD`; load-time `#t=` deep link, pause/scrub publishing via `replaceState`, Space toggle, 0.5–4× speeds, Restart, drag-scrub landing within **7 ms** of the playhead pixel, card expand state surviving a back-scrub past the card's birth, pinned-to-bottom autoscroll surviving a card toggle, and 375 px with no horizontal scroll all still hold. README sentences in §6 are all true of the built artifact; `screenshot.png` re-captured from this build.

---

## 5. Rubric lines that matter most (§8)

- **"Survives garbage input without crashing"** — must-pass, and this increment *adds a runtime input surface*. Until today the hash was parsed once, at module scope; from today it is parsed every time the address bar changes, for the rest of the session. The day-005 blocker (`#t=%` → `URIError` during module evaluation → permanently blank page) is exactly the class of bug that re-enters through a listener. Checklist item 2 is the guard, and it must be run against the *built* `docs/` bundle, not the dev server.
- **"Loads/runs without errors on first use"** — must-pass, and "first use" for this increment includes *the second link*: a recipient's first use is often a hash navigation into a tab they already had open. Item 1 is that path.
- **"Web: usable at phone width"** — must-pass. Item C adds vertical UI directly above the controls on the one axis a 375 px phone is short of, and item B adds a focus ring that must not overflow the lane. Item 6 measures both.
- **"README is truthful"** — must-pass, and this increment is where it is easiest to lie: keyboard affordances and "links work live" are claims a reader will test in ten seconds. Anything cut under the budget rule must lose its README sentence in the same commit.
- **Scope discipline (scored)** — this spec opens exactly one fence item and names ten it does not. The obvious drift is a "Copy link" button, a hover time-tooltip on the lane, or clickable legend rows. Each is a fence breach or a new feature; each fails this line.
- **Code clarity (scored)** — the single-colour-table rule and the single-`onSeek` rule are the clarity story here. A contributor must be able to see in five minutes that there is one parser, one clock, one projection, one seek, one colour map.

---

## 6. README-first — the exact sentences the build must make true

The README keeps STYLE.md's section order and its 2–5 sentence "What it does" slot. Changes only where listed; everything else stays as shipped.

**Screenshot caption (replaces the current caption; the screenshot must be re-captured from this build to match it):**

> *Mid-replay at 2×: the agent's fix streams into the text pane word by word, an expanded tool-call card above it shows the edit it just applied, and the Canvas timeline along the bottom marks the playhead two-thirds through the run, with a legend under the lane naming the colour of each tool's bar.*

**"What it does" — exactly five sentences, two of them revised (revisions in the timeline sentence and the share sentence):**

> trace-lens replays a bundled JSON trace of a coding agent fixing an off-by-one pagination bug — three turns, five tool calls, no keys, no network requests. Text streams delta-by-delta on the trace's own rhythm; tool-call cards expand to full input and output, and stay open across a scrub back past them. A Canvas 2D timeline draws the whole run — text ticks, tool-call bars coloured by tool and named in a legend under the lane, turn boundaries — and clicking, dragging, or arrow-keying it seeks the replay to that moment, even mid-word. Play, pause, restart, and 0.5×–4× speed controls drive one shared clock, so the transcript and timeline can never disagree.
>
> Pause or scrub and the moment goes into the URL as `#t=<seconds>`, so the address bar is the share link — and opening a `#t=` link in a tab that already has trace-lens running jumps the replay there and pauses, instead of doing nothing.

**"How to run" — the Space line is replaced by these two sentences:**

> Space bar toggles play/pause. Tab to the timeline and `←`/`→` seek one second, hold Shift with them for five, and Home/End jump to the start or the end of the run.

**"How to run" — one sentence appended to the existing `#t=` paragraph:**

> Changing the hash of a tab that is already open — clicking another `#t=` link, or pressing Back and Forward across ones you have visited — seeks and pauses there too, so the address bar and the replay stay in agreement.

**Provenance footer:**

> *Day 002 (revisited day 005 and 008) of an autonomous build factory — [factory-hub](https://github.com/yinggarykairui/factory-hub)*

Everything else — the one-line opener, the live-demo link, "Why it exists", LICENSE, repo description and topics — is unchanged. If item B or C is cut, its sentences above are deleted, not softened.

---

## 7. Architecture note

Relative to the sketch in PROJECT.md:

- **`src/hash.ts`** — gains a `hashchange` subscription (a small `useHashListener(onTime)` hook alongside the publisher) and a `cancel()` on `useHashPublisher` that drops a pending debounced write **without** writing. `parseHashTime` is untouched and remains the **only** parser for both the load path and the live path — never a second parser, never a second set of junk rules. It already must not throw; that requirement now extends to every keystroke a visitor makes in the address bar.
- **`src/App.tsx`** — the hash adapter stays at the App boundary. A `hashchange` does exactly: `cancel()` any pending write → parse → `null` means return (no seek, no write, no state change) → otherwise pause, then `seek(ms)` through the existing `seek`, and suppress **exactly one** pause-publish, by the same kind of one-shot ref the initial render already uses. Ordering matters: the run must not be left playing across the seek, and no rAF frame may be allowed to advance vt past the linked moment before the pause takes effect — item 1's byte-equality assertion is the test.
- **`src/usePlayback.ts`** — may expose a `pause()` (or a seek-and-pause) so the adapter does not have to fake one through `toggle()`. **No new rAF loop, no second accumulator, no `setInterval`.** The existing both-ends clamp in all three vt writers stays; nothing here may reintroduce a path to negative vt.
- **`src/Timeline.tsx`** — gains `tabIndex`, `role="slider"`, the aria value attributes, an `onKeyDown`, and the legend markup as a DOM sibling under the canvas. The key handler computes a target from the `vt` **prop** and calls the **same `onSeek` prop** the pointer handlers call; clamping stays in `usePlayback.seek` where it already is. Timeline holds no vt state of its own and gains none — it stays a pure function of `(trace, vt)` plus the resize width.
- **Colour map** — `TOOL_COLORS` / a `toolColor(name)` helper is exported from `Timeline.tsx` and consumed by both `draw()` and the legend markup. The hexes never appear in `styles.css`. The legend's rows come from walking `trace.events` for distinct `tool_call` names, so a trace change cannot make the legend lie.
- **`src/styles.css`** — `.timeline:focus-visible` ring and a `.legend` flex row, plus its ≤480 px behaviour. No layout restructure.
- **`src/project.ts`, `src/Transcript.tsx`, `src/trace.json`, `src/types.ts`** — untouched.

**Invariants that must not break, in priority order:**

1. **`projectState(trace, vt)` is pure, and playback, pointer-seek, key-seek and hash-seek all render through it.** Pane and playhead cannot disagree. Item 5's identical-`textContent` comparison is the proof obligation. Never a second event walk.
2. **One clock.** vt lives in `usePlayback`'s ref + state and nowhere else. A hashchange and an arrow key move that clock; they do not start one.
3. **The app never adds a history entry.** All writes go through `replaceState`; `location.hash = …` and `pushState` are forbidden. Item 3(c) measures `history.length`.
4. **A received hash is authoritative until the user chooses a new moment.** Arrival never writes, and never lets an older pending write land on top of it.
5. **The hash carries `t` only, at 0.1 s resolution, floored to match the readout.** Unchanged.
6. **Nothing in a draw effect or a listener may throw unguarded.** There is still no error boundary above the tree; a throw is a blank page. `roundRect` and `ResizeObserver` stay feature-detected.

---

## 8. Open threads left open

- **Desktop dead space** (~700 px at 1440 × 900 at load, 139 px above the timeline mid-run). The honest fix is bottom-anchoring the transcript so it fills upward like a console. Still its own increment; explicitly not this one.
- **Fence items still closed and still the likeliest next moves:** second bundled trace (a contrast run) · reduced-motion mode. Copy-link/share UI stays closed — this increment is the argument that it is unnecessary.
- **Deliberate and unchanged:** the hash mirrors the last paused/scrubbed moment, not the live playhead · `#t=0x10` seeks to 16 s because `parseHashTime` is `Number()`-lenient (harmless). *(The "tenths-of-a-second resolution, so a reopened link can sit up to 99 ms behind the sharer" item that stood here is closed by `62fd5fe`: the hash publishes hundredths and the worst case is 9 ms. See the Open threads note below, which this line used to contradict.)*
- **New, deliberate, to be disclosed in the sign-off:** a junk `hashchange` leaves the address bar disagreeing with the app — we ignore it rather than reset the viewer's position or clobber what they typed. Revisit only if it confuses a real recipient.
- **Not specced, and priced for later:** announcing the seeked moment to a screen reader (needs a live region, and `role="slider"`'s value attributes are the cheaper first move) · a time readout or tooltip on the lane itself · keyboard access to the tool cards beyond the Tab order they already have.
- **Verification debt, unchanged:** no scheduled shift has ever loaded `https://yinggarykairui.github.io/trace-lens/` — `github.io` is unreachable from these sandboxes, so §11.2's live-demo line and the repo description/topics check still fall to a desk session. What is verifiable here, and must be re-verified at ship, is that the committed `docs/` is byte-identical to a fresh build of `HEAD`.

Anything beyond increment 3 is a NEW increment needing a spec.


## Open threads

- Likeliest next fence moves (an owner issue would open one), best first:
  **live hashchange handling** — a `#t=` link clicked into an already-open
  tab does nothing and the address bar then disagrees with the app; both
  increment-2 critics named it the one path where a share link fails a real
  recipient, so it is the fence item to open next. Then: second bundled
  trace (contrast run) · reduced-motion mode.
- Deliberate: the hash mirrors the last paused/scrubbed moment, not the
  live playhead (no per-frame replaceState). Revisit only if it confuses.
- **Closed** (day 008 evening polish). The hash carried tenths of a second,
  floored, so a reopened link sat up to 99 ms behind the sharer's playhead —
  recorded here as "invisible in practice", which measurement disproved. Text
  arrives in whole-word chunks closer together than 99 ms: over 25 random
  scrubs, reloading at each published hash, **2 came back a word-chunk short**
  of what the sharer had on screen (`#t=5.9` lost `"bounds are "`, `#t=27.5`
  lost `"— exactly what "`) — roughly one scrub in twelve, on the increment
  whose premise is that the address bar is the share link. `formatHashTime`
  floors to hundredths now and drops a trailing zero, so a moment that lands
  on a tenth still publishes the string it always did (`#t=12.4`, `#t=0.0`)
  and only a moment that needs the second digit spends it (`#t=5.93`); the
  worst case is 9 ms, which is inside a chunk rather than across one. Graded
  on the built `docs/`, same 25 scrubs both ways: **25/25** byte-equal
  transcripts at the published hash, 23/25 at the same moments floored to
  tenths (`#t=27.5` and `#t=34.4` short). `parseHashTime` is untouched —
  `Number()` reads both, so old links still work. This supersedes the
  increment-3 spec's §7 item 5 and its §8 "tenths-of-a-second resolution"
  line, which describe the format as it was before tonight.
- **Closed** (day 008 evening polish, cycle 2). The provenance footer read
  `Day 002 (revisited day 005 and 008)`, which is the form the increment-3
  planner draft quotes at §6. STYLE.md's rule is that the footer is verbatim
  except `<NNN>`, so that form has never conformed, and two independent
  hygiene passes have now called it. `Day 002` also points a reader at the
  day-002 dashboard one-liner — "Replay an LLM agent run as a live streaming
  trace" — written before deep-links, live `hashchange`, the keyboard and the
  legend existed, which is the day-006 blocker exactly. The footer is now
  `*Day 008 of an autonomous build factory — [factory-hub](…)*`. This
  supersedes the draft's §6 footer line; the draft is the planner artifact as
  posted and is not edited after the fact, so the next revisit takes the
  footer from STYLE.md and not from §6.
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

### Named by cycle 1 (day 008 evening), recorded rather than built

The merged defect list marked these OPEN THREAD: they are not defects the
fixer may close under feature freeze, and none of them was built. In the
defect list's own words:

- **The cold first frame.** On the default autoplay load the transcript pane is
  0 characters for ~500 ms and still 79% empty at 4 s at 1280×800, and the
  `.pane-hint` never renders (sampled 180 consecutive rAF frames over 3 000 ms:
  present in 0 of them) because autoplay advances vt before first paint. So the
  one affordance in the app is shown only to people who arrived at `#t=0`.
  Increment 2 deliberately kept this (showing the hint during autoplay would
  make its own "Press play" copy false). It is now named by three independent
  passes and should be the next increment's headline, not a polish patch.
- **A sighted keyboard user never learns the keys exist.** They live in the
  canvas `aria-label` and the README only. The honest fix is an on-screen
  caption near the legend — new UI, and the spec freezes the hint copy.
- **Desktop dead space** — 499 px (62% of the viewport) below the last
  transcript element at t=1 s, 1280×800. Already priced as its own increment.
- **The legend names bars the eye cannot find.** On an 818 px canvas: `run_tests`
  82 px total, `read_file` 6 px (two 3 px slivers), `edit_file` 5 px — the 10 px
  swatch is wider than the bar it describes. The fix is a minimum bar width in
  `draw()`, which changes what the timeline claims about durations.
- **A junk `hashchange` produces no acknowledgement** — deliberate and already
  disclosed; `aria-live` is excluded by the spec.
- **Restart from paused starts playing** and writes `#t=0.0`, so a reload after
  two ordinary clicks lands on the blank paused pane.
- **Back past the first `#t=` lands on a bare `''` hash**, which has no usable
  `t` and is therefore ignored, so the address bar and the replay disagree.
  Deliberate under the spec's junk rule; worth a sentence in the sign-off. The
  half of this that was a truth defect is closed: `8a3baab` deleted the
  README's "stay in agreement" clause and said what Back actually does, so
  `grep "stay in agreement" README.md` returns 0 hits. The behaviour stays.
- **Expanding all five cards at the end leaves 129 px below the fold**
  (`scrollTop 1337 + 600` vs `scrollHeight 2066`).
- **`index.html`'s favicon data URI repeats `#6d94c9` and `#c9995f`** — a third
  copy of two hexes outside `TOOL_COLORS`, pre-existing since day 005.
- **`#t=0x10` seeks to 0:16** — `Number()`-lenient parsing, kept since day 005.

Two more, from defects the cycle did not close outright:

- **D7, declined and now open: `aria-valuenow` drops the decimal.**
  `Timeline.tsx` renders `aria-valuenow={Number((vt/1000).toFixed(1))}`, so a
  whole second reads `"0"` or `"12"` rather than `"0.0"` / `"12.0"`. The defect
  made the fix conditional on staying type-clean, and it is not: React types
  `aria-valuenow` as `number`, and passing the one-decimal string fails
  `tsc --noEmit` with TS2322 (`Type 'string' is not assignable to type
  'number'`), which `npm run build` runs first. The numeric value is already
  correct to one decimal — only the trailing zero is missing, and a numeric
  attribute carries no trailing zero — and `aria-valuetext` already announces
  the full `31.5 seconds of 47.7` form. Revisit if a future React type ever
  widens the attribute.
- **D8 at 320 px.** The tool-card summary is back at phone width, but at 320 px
  both `read_file` paths truncate before they diverge, so the two cards still
  read alike there; at 375 px they do not. Buying the extra room means
  shrinking the duration or the gaps, which is a layout change rather than a
  polish patch.

### Named by cycle 2 (day 008 evening), recorded rather than built

The cycle-2 defect list marked this OPEN THREAD, and the fixer did not build
it. In the list's own words:

- **`End` while playing wipes the hash instead of publishing `#t=47.71`.** The
  seek lands on `duration_ms`, the rAF loop's own end-stop fires, and the
  "ran out → `clearHash()`" branch swallows a user-chosen moment. Paused, the
  same key writes `#t=47.71` correctly. Pre-existing (drag-to-far-right while
  playing does it too), but newly reachable through a key the README now
  advertises. The end-stop's hash-clearing is deliberate — reloading after
  watching the demo through should replay it, not hand back a spent transcript
  — so the honest fix is to distinguish a user-chosen end from the run's own
  end, which is a behaviour change and wants its own spec. Spec §4.5's
  `End` → `Play` → `#t=0.0` is unaffected and still holds.
  *(The two literals above read `#t=47.7` until the day-008 evening shift;
  `62fd5fe` took the hash to hundredths and the build writes `#t=47.71`. The
  behaviour is unchanged and the thread stays open. The rationale the shift
  accepted for leaving it: the clock reaching its own end clears the hash so
  that watching the demo through and reloading replays it rather than handing
  back a spent transcript, and `End` lands the clock in that same end state —
  telling the two apart is the behaviour change, not the clearing.)*

One more, noticed while measuring D1 and left alone under the freeze:

- **Two marks in the lane have never cleared 3:1 against it, and still do
  not.** Against `LANE_FILL` the user text tick measures 2.47:1 and the turn
  divider 1.21:1 sampled (2.50 and 1.39 as composited hexes) — both are alpha
  strokes chosen in increment 1 to sit quietly behind the bars, and both are
  where they were on day 002. D1 was a regression defect ("the marks must keep
  the contrast they had") and closing it restored exactly that, so raising
  these two was out of its scope and out of the freeze's: it means re-picking
  two colours in the lane's visual hierarchy, which changes what the timeline
  emphasises and belongs with whoever specs the lane next.

### Named by cycle 3 (day 008 evening), recorded rather than built

The cycle-3 defect list marked these OPEN THREAD: they are not defects the
fixer may close under feature freeze, and none of them was built. In the
list's own words, with its measurements:

- **The legend's 10 px swatch is wider than the bars it names.** At 818 px,
  `read_file` renders 4 px, `edit_file` 5 px, `run_tests` 44 px. Those are
  **per-bar** widths, and the trace draws five bars: two `read_file`, two
  `run_tests`, one `edit_file`. Cycle 1's "6 / 5 / 82 px on the same 818 px
  lane" ("the legend names bars the eye cannot find") is the **total** width
  each tool's colour occupies across its bars, so the two records measure
  different things and agree. Sampled again from the canvas bitmap at 818 px
  (dpr 1, solid colour only, antialiased edges excluded): `read_file`
  3 + 3 = 6 px, `edit_file` 5 px, `run_tests` 42 + 40 = 82 px. The fix is a
  minimum bar width in `draw()`, which changes what the timeline claims about
  durations — its own increment; kept, and now named by two cycles.
- **The lane renders 3.1 % vertically squashed.** `height:64` plus
  `box-sizing:border-box` plus a 1 px border gives a 62 px content box for a
  64-unit bitmap, so the new progress rail measures 3.875 css px rather than 4.
  Pre-existing, cosmetic, and it wants the canvas sizing looked at as a whole.
- **`.source-link`'s tap box overhangs `.header` by 0.125 px**, so its
  bottom-left corner hit-tests to `.transcript`. Effective target is 45.25 px,
  still above the 44 px floor.
- **"the address bar and the replay stay in agreement" is false on Back to a
  bare hash** — `#t=30.0` → Back → readout `0:30`, `location.hash === ''`.
  Deliberate under the spec's junk rule and already disclosed (cycle 1 named
  the same path); it belongs in the sign-off, not in a patch. **Closed as a
  truth defect** by the day-008 evening polish: `8a3baab` deleted the clause
  and the README now says what Back does. The behaviour is unchanged.
