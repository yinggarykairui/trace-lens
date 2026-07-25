import { useMemo } from 'react';
import rawTrace from './trace.json';
import type { Trace } from './types';
import { projectState } from './project';
import { usePlayback } from './usePlayback';
import { Transcript } from './Transcript';

const trace = rawTrace as unknown as Trace;

export default function App() {
  const playback = usePlayback(trace.meta.duration_ms, true);
  const items = useMemo(() => projectState(trace, playback.vt), [playback.vt]);

  return (
    <div className="app">
      <header className="header">
        <h1>trace-lens</h1>
        <span className="trace-title">{trace.meta.title}</span>
      </header>
      <Transcript items={items} />
    </div>
  );
}
