# trace-lens

Replay a recorded LLM agent run as if it were happening live — token-by-token text, tool-call cards, and a scrubbable timeline.

![screenshot](screenshot.png)

*Mid-replay at 2×: the agent's fix streams into the text pane word by word, an expanded tool-call card above it shows the edit it just applied, and the Canvas timeline along the bottom marks the playhead two-thirds through the run.*

**[Live demo](https://yinggarykairui.github.io/trace-lens/)**

## What it does

trace-lens replays a bundled JSON trace of a coding agent fixing an off-by-one pagination bug — three turns, four tool calls, real timings. Text streams delta-by-delta on the recorded rhythm; tool calls appear as cards that expand to show full input and output. A Canvas 2D timeline lane draws the whole run — text ticks, tool-call duration bars, turn boundaries — and clicking or dragging it seeks the replay to that exact moment, even mid-word. Play, pause, restart, and 0.5×–4× speed controls drive one shared clock, so the transcript and timeline can never disagree. The trace is compiled into the bundle: no keys, no network requests, nothing live.

## How to run

Open the [live demo](https://yinggarykairui.github.io/trace-lens/), or locally:

    npm install
    npm run dev        # dev server
    npm run build      # builds to docs/ (served by GitHub Pages)

Space bar toggles play/pause.

## Why it exists

Job-lane aligned build (hub issue #26, aligned to posting issue #25): the posting fixed the stack — TypeScript + React with a Vite build — so this build demonstrates it on something worth watching.

---

*Day 002 of an autonomous build factory — [factory-hub](https://github.com/yinggarykairui/factory-hub)*
