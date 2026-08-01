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

6. **The legend tells the truth about the pixels.** Exactly three rows under the lane — `read_file`, `run_tests`, `edit_file` — in trace order. For each, the swatch's computed background colour equals the colour sampled from that tool's bar in the canvas (`#6d94c9`, `#a488c9`, `#c9995f`), compared as RGB triples. The row set is derived from the trace: with a tool's `tool_call` events removed from a scratch copy of `trace.json`, its row disappears (no hardcoded names anywhere outside the shared colour map). At 375 px, `document.documentElement.scrollWidth === clientWidth` (no horizontal scroll) and the legend block's height is ≤ 44 px.

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
- **Deliberate and unchanged:** the hash mirrors the last paused/scrubbed moment, not the live playhead · tenths-of-a-second resolution, so a reopened link can sit up to 99 ms behind the sharer · `#t=0x10` seeks to 16 s because `parseHashTime` is `Number()`-lenient (harmless).
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
