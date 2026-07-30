import { useCallback, useEffect, useRef, useState } from 'react';
import type { Item, ToolItem } from './project';

function summarizeInput(input: Record<string, unknown>): string {
  const parts = Object.entries(input).map(([k, v]) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return `${k}: ${s.length > 40 ? s.slice(0, 37) + '…' : s}`;
  });
  return parts.join('  ');
}

function ToolCard({
  item,
  open,
  onToggle,
}: {
  item: ToolItem;
  open: boolean;
  onToggle: (callId: string, card: HTMLElement | null) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  return (
    <div className="tool-card" ref={cardRef}>
      <button
        type="button"
        className="tool-head"
        onClick={() => onToggle(item.callId, cardRef.current)}
        aria-expanded={open}
      >
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
        <span className={'tool-chevron' + (open ? ' is-open' : '')}>›</span>
      </button>
      {open && (
        <div className="tool-body">
          <div className="tool-section">input</div>
          <pre>{JSON.stringify(item.input, null, 2)}</pre>
          <div className="tool-section">
            {item.done ? `output — ${item.ok ? 'ok' : 'error'}` : 'output — pending'}
          </div>
          {item.output !== null && <pre>{item.output}</pre>}
        </div>
      )}
    </div>
  );
}

export function Transcript({ items, playing }: { items: Item[]; playing: boolean }) {
  const paneRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true); // stick to the bottom until the user scrolls up

  // Which cards are expanded, keyed by call_id and held here rather than inside
  // ToolCard: a card unmounts whenever the playhead moves back before its birth,
  // and losing the expansion on the way back would be a surprise (D2). The
  // projection stays pure — this is view state, not projected state. Transcript
  // never unmounts, so the set also survives restart; a reload resets it.
  const [openCalls, setOpenCalls] = useState<ReadonlySet<string>>(() => new Set());
  const toggledCard = useRef<HTMLElement | null>(null);
  const toggleCall = useCallback((callId: string, card: HTMLElement | null) => {
    toggledCard.current = card;
    setOpenCalls((prev) => {
      const next = new Set(prev);
      if (!next.delete(callId)) next.add(callId);
      return next;
    });
  }, []);

  // An opened body is often taller than what is left below the card, so without
  // this most of what the reader just asked for renders off the bottom of the
  // pane with nothing (overlay scrollbars) to say so. The autoscroll effect
  // below cannot cover it: a toggle does not change `items`. 'nearest' scrolls
  // the minimum, so a card already fully visible does not move.
  useEffect(() => {
    const card = toggledCard.current;
    toggledCard.current = null;
    if (card) card.scrollIntoView({ block: 'nearest' });
  }, [openCalls]);

  const onScroll = () => {
    const el = paneRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  useEffect(() => {
    const el = paneRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [items]);

  // Nothing has happened yet at this playhead, and no clock is running to change
  // that — say which control moves it, rather than sit blank. (When this is the
  // only thing in the pane, the pane centres it: see .transcript.is-empty. The
  // *condition* stays exactly as is — during autoplay "press play" would lie.)
  const showHint = items.length === 0 && !playing;

  return (
    <div
      className={'transcript' + (showHint ? ' is-empty' : '')}
      ref={paneRef}
      onScroll={onScroll}
    >
      {showHint && <p className="pane-hint">Press play (or space), or scrub the timeline.</p>}
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
            return (
              <ToolCard
                item={item}
                key={item.id}
                open={openCalls.has(item.callId)}
                onToggle={toggleCall}
              />
            );
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
