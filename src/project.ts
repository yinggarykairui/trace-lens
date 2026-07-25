import type { Trace } from './types';

export interface TextItem {
  kind: 'text';
  id: string;
  role: 'user' | 'assistant';
  text: string;
  streaming: boolean; // started but not all deltas landed at vt
}

export interface ToolItem {
  kind: 'tool';
  id: string;
  callId: string;
  name: string;
  input: Record<string, unknown>;
  durationMs: number;
  done: boolean;
  ok: boolean | null; // null while running
  output: string | null; // null until the tool_result lands
}

export interface TurnItem {
  kind: 'turn';
  id: string;
  turn: number;
}

export interface StatsItem {
  kind: 'stats';
  id: string;
  turn: number;
  tokensIn: number;
  tokensOut: number;
}

export type Item = TextItem | ToolItem | TurnItem | StatsItem;

/**
 * Pure projection: the full UI state at virtual time vt.
 * Playback and seeking both render through this, so they can never disagree.
 */
export function projectState(trace: Trace, vt: number): Item[] {
  const items: Item[] = [];

  const results = new Map<string, { t: number; ok: boolean; output: string }>();
  for (const ev of trace.events) {
    if (ev.type === 'tool_result') {
      results.set(ev.call_id, { t: ev.t, ok: ev.ok, output: ev.output });
    }
  }

  for (const ev of trace.events) {
    if (ev.t > vt) break; // events are sorted ascending by t

    switch (ev.type) {
      case 'turn_start':
        items.push({ kind: 'turn', id: ev.id, turn: ev.turn });
        break;

      case 'text': {
        let text = '';
        let streaming = false;
        for (const d of ev.deltas) {
          if (ev.t + d.dt <= vt) {
            text += d.s;
          } else {
            streaming = true;
            break;
          }
        }
        items.push({ kind: 'text', id: ev.id, role: ev.role, text, streaming });
        break;
      }

      case 'tool_call': {
        const res = results.get(ev.call_id);
        const done = res !== undefined && res.t <= vt;
        items.push({
          kind: 'tool',
          id: ev.id,
          callId: ev.call_id,
          name: ev.name,
          input: ev.input,
          durationMs: ev.duration_ms,
          done,
          ok: done && res ? res.ok : null,
          output: done && res ? res.output : null,
        });
        break;
      }

      case 'tool_result':
        break; // attached to its tool_call above

      case 'turn_end':
        items.push({
          kind: 'stats',
          id: ev.id,
          turn: ev.turn,
          tokensIn: ev.tokens_in,
          tokensOut: ev.tokens_out,
        });
        break;
    }
  }

  return items;
}
