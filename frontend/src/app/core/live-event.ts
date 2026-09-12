/**
 * xwa-sdk `Event` envelope parsing and live-scan state reduction.
 *
 * The profiler WebSocket emits: analysis_started → analysis_progress →
 * item_found* → analysis_completed|analysis_error (plus optional log events).
 * Keeping the parsing/reduction here (pure functions) makes the live protocol
 * testable without a real socket.
 */

export interface LiveEventPayload {
  phase?: number;
  total_phases?: number;
  name?: string;
  status?: string;
  percent?: number;
  message?: string;
  kind?: string;
  route_type?: string | null;
  summary?: {
    technologies?: number;
    routes?: number;
    guards?: number;
    dependencies?: number;
  };
  [key: string]: unknown;
}

/** xwa-sdk `Event` envelope (see xwa-sdk/schemas/event.json). */
export interface LiveEvent {
  seq: number;
  type: string;
  tool: string;
  analysis_id: string;
  ts: string;
  payload: LiveEventPayload | null;
}

/** Aggregated counters/state produced by a live profile scan. */
export interface LiveStats {
  profileId: number | null;
  techs: number;
  routes: number;
  guards: number;
  jsDeps: number;
  phase: number;
  phaseStatus: string;
  phaseName: string;
  percent: number;
  completed: boolean;
  error: string | null;
}

export function createLiveStats(): LiveStats {
  return {
    profileId: null,
    techs: 0,
    routes: 0,
    guards: 0,
    jsDeps: 0,
    phase: 0,
    phaseStatus: '',
    phaseName: '',
    percent: 0,
    completed: false,
    error: null,
  };
}

/**
 * Parse a raw WebSocket frame into an `Event` envelope.
 * Returns `null` for malformed frames instead of throwing.
 */
export function parseLiveEvent(raw: unknown): LiveEvent | null {
  if (typeof raw !== 'string') {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  if (typeof record['type'] !== 'string') {
    return null;
  }

  const rawPayload = record['payload'];
  const payload =
    rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
      ? (rawPayload as LiveEventPayload)
      : null;

  const rawId = record['analysis_id'];

  return {
    seq: typeof record['seq'] === 'number' ? record['seq'] : 0,
    type: record['type'],
    tool: typeof record['tool'] === 'string' ? record['tool'] : '',
    analysis_id:
      typeof rawId === 'string' ? rawId : rawId === undefined || rawId === null ? '' : String(rawId),
    ts: typeof record['ts'] === 'string' ? record['ts'] : '',
    payload,
  };
}

/** Apply one parsed event to the running stats (immutable). */
export function applyLiveEvent(stats: LiveStats, event: LiveEvent): LiveStats {
  const payload = event.payload ?? {};

  switch (event.type) {
    case 'analysis_started': {
      const id = Number.parseInt(event.analysis_id, 10);
      return { ...stats, profileId: Number.isNaN(id) ? stats.profileId : id };
    }

    case 'analysis_progress': {
      const phase = typeof payload.phase === 'number' ? payload.phase : stats.phase;
      return {
        ...stats,
        phase,
        phaseStatus: typeof payload.status === 'string' ? payload.status : stats.phaseStatus,
        phaseName: typeof payload.name === 'string' ? payload.name : stats.phaseName,
        percent: typeof payload.percent === 'number' ? payload.percent : stats.percent,
      };
    }

    case 'item_found': {
      switch (payload.kind) {
        case 'technology':
          return { ...stats, techs: stats.techs + 1 };
        case 'dependency':
          return { ...stats, jsDeps: stats.jsDeps + 1 };
        case 'route':
          return payload.route_type === 'guard'
            ? { ...stats, guards: stats.guards + 1 }
            : { ...stats, routes: stats.routes + 1 };
        default:
          return stats;
      }
    }

    case 'analysis_completed': {
      const summary = payload.summary ?? {};
      return {
        ...stats,
        completed: true,
        techs: summary.technologies ?? stats.techs,
        routes: summary.routes ?? stats.routes,
        guards: summary.guards ?? stats.guards,
        jsDeps: summary.dependencies ?? stats.jsDeps,
      };
    }

    case 'analysis_error':
      return {
        ...stats,
        error: typeof payload.message === 'string' ? payload.message : 'Analysis failed.',
      };

    default:
      return stats;
  }
}

/** Human-readable terminal line for an event (progress/log events). */
export function liveEventLogLine(event: LiveEvent): string | null {
  const payload = event.payload ?? {};
  const message = typeof payload.message === 'string' ? payload.message : '';

  switch (event.type) {
    case 'analysis_started':
      return `[STARTED] ${event.analysis_id || 'analysis'}`;
    case 'analysis_progress': {
      const phase = typeof payload.phase === 'number' ? `PHASE ${payload.phase}` : 'PHASE';
      const name = typeof payload.name === 'string' ? payload.name : '';
      return `[${phase}] ${name}${payload.status === 'complete' ? ' — DONE' : ''}`;
    }
    case 'item_found':
      return message
        ? `[ITEM] ${message}`
        : `[ITEM] ${typeof payload.kind === 'string' ? payload.kind.toUpperCase() : 'FOUND'}`;
    case 'analysis_completed':
      return '[COMPLETED] PROFILE SAVED';
    case 'analysis_error':
      return `[ERROR] ${message || 'ANALYSIS FAILED'}`;
    case 'log':
      return message ? message : null;
    default:
      return message || null;
  }
}
