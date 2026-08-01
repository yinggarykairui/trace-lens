# trace-lens

Replay a sample LLM agent run as if it were happening live — token-by-token text, tool-call cards, and a scrubbable timeline.

![screenshot](screenshot.png)

*Mid-replay at 2×: the agent's fix streams into the text pane word by word, an expanded tool-call card above it shows the edit it just applied, and the Canvas timeline along the bottom marks the playhead two-thirds through the run.*

**[Live demo](https://yinggarykairui.github.io/trace-lens/)**

## What it does

trace-lens replays a bundled JSON trace of a coding agent fixing an off-by-one pagination bug — three turns, five tool calls, no keys, no network requests. Text streams delta-by-delta on the trace's own rhythm; tool-call cards expand to full input and output, and stay open across a scrub back past them. A Canvas 2D timeline draws the whole run — text ticks, tool-call bars, turn boundaries — and clicking, dragging, or arrow-keying it seeks the replay to that moment, even mid-word. Play, pause, restart, and 0.5×–4× speed controls drive one shared clock, so the transcript and timeline can never disagree.

Pause or scrub and the moment goes into the URL as `#t=<seconds>`, so the address bar is the share link — and opening a `#t=` link in a tab that already has trace-lens running jumps the replay there and pauses, instead of doing nothing.

## How to run

Open the [live demo](https://yinggarykairui.github.io/trace-lens/), or locally:

    npm install
    npm run dev        # dev server
    npm run build      # builds to docs/ (served by GitHub Pages)

Space bar toggles play/pause. Tab to the timeline and `←`/`→` seek one second, hold Shift with them for five, and Home/End jump to the start or the end of the run.

Add `#t=<seconds>` to the URL to open the replay paused at that second — `#t=12.4`, or whatever the address bar picked up when you last paused. Values outside the run are clamped to its start or end. A hash with no usable `t` in it is ignored, and the replay starts from the top as usual. Changing the hash of a tab that is already open — clicking another `#t=` link, or pressing Back and Forward across ones you have visited — seeks and pauses there too, so the address bar and the replay stay in agreement.

## Why it exists

Job-lane aligned build (hub issue #26, aligned to posting issue #25): the posting fixed the stack — TypeScript + React with a Vite build — so this build demonstrates it on something worth watching.

---

*Day 002 (revisited day 005 and 008) of an autonomous build factory — [factory-hub](https://github.com/yinggarykairui/factory-hub)*
