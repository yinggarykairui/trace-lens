import { useEffect, useMemo } from 'react';
import rawTrace from './trace.json';
import type { Trace } from './types';
import { projectState } from './project';
import { usePlayback } from './usePlayback';
import { Transcript } from './Transcript';
import { Timeline } from './Timeline';

const trace = rawTrace as unknown as Trace;

export default function App() {
  const playback = usePlayback(trace.meta.duration_ms, true);
  const { toggle } = playback;
  const items = useMemo(() => projectState(trace, playback.vt), [playback.vt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault(); // no page scroll, no focused-button re-activation
      if (!e.repeat) toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <div className="app">
      <header className="header">
        <h1>trace-lens</h1>
        <span className="trace-title">{trace.meta.title}</span>
      </header>
      <Transcript items={items} />
      <Timeline trace={trace} vt={playback.vt} onSeek={playback.seek} />
      <div className="controls">
        <button type="button" className="btn btn-play" onClick={toggle}>
          {playback.playing ? 'Pause' : 'Play'}
        </button>
      </div>
    </div>
  );
}
