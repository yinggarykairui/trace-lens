export interface Trace {
  version: 1;
  meta: {
    title: string;
    agent: string;
    model: string;
    recorded_at: string;
    duration_ms: number;
  };
  events: TraceEvent[]; // sorted ascending by t (ms from run start)
}

export type TraceEvent = { id: string; t: number; turn: number } & (
  | { type: 'turn_start' }
  | {
      type: 'text';
      role: 'user' | 'assistant';
      deltas: { dt: number; s: string }[]; // dt = ms after event t, cumulative
    }
  | {
      type: 'tool_call';
      call_id: string;
      name: string;
      input: Record<string, unknown>;
      duration_ms: number;
    }
  | { type: 'tool_result'; call_id: string; ok: boolean; output: string }
  | { type: 'turn_end'; tokens_in: number; tokens_out: number }
);
