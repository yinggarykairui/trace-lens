import { useEffect, useRef } from 'react';
import type { Item, ToolItem } from './project';

function summarizeInput(input: Record<string, unknown>): string {
  const parts = Object.entries(input).map(([k, v]) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return `${k}: ${s.length > 40 ? s.slice(0, 37) + '…' : s}`;
  });
  return parts.join('  ');
}

function ToolCard({ item }: { item: ToolItem }) {
  return (
    <div className="tool-card">
      <div className="tool-head">
        <span
          className={
            'tool-dot ' + (item.done ? (item.ok ? 'is-ok' : 'is-err') : 'is-running')
          }
        />
        <span className="tool-name">{item.name}</span>
        <span className="tool-summary">{summarizeInput(item.input)}</span>
        <span className="tool-dur">
          {item.done ? `${item.durationMs} ms` : 'running…'}
        </span>
      </div>
    </div>
  );
}

export function Transcript({ items }: { items: Item[] }) {
  const paneRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true); // stick to the bottom until the user scrolls up

  const onScroll = () => {
    const el = paneRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  useEffect(() => {
    const el = paneRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  return (
    <div className="transcript" ref={paneRef} onScroll={onScroll}>
      {items.map((item) => {
        switch (item.kind) {
          case 'turn':
            return (
              <div className="turn-divider" key={item.id}>
                <span>turn {item.turn}</span>
              </div>
            );
          case 'text':
            return (
              <div className={`msg msg-${item.role}`} key={item.id}>
                {item.role === 'user' && <span className="role-tag">user</span>}
                <span className="msg-text">{item.text}</span>
                {item.streaming && <span className="cursor" />}
              </div>
            );
          case 'tool':
            return <ToolCard item={item} key={item.id} />;
          case 'stats':
            return (
              <div className="turn-stats" key={item.id}>
                turn {item.turn} · {item.tokensIn.toLocaleString()} tok in ·{' '}
                {item.tokensOut.toLocaleString()} tok out
              </div>
            );
        }
      })}
    </div>
  );
}
