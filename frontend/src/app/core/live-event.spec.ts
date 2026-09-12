import {
  applyLiveEvent,
  createLiveStats,
  liveEventLogLine,
  parseLiveEvent,
} from './live-event';

describe('parseLiveEvent', () => {
  it('should parse a full xwa-sdk Event envelope', () => {
    const event = parseLiveEvent(
      JSON.stringify({
        seq: 4,
        type: 'analysis_progress',
        tool: 'kensei',
        analysis_id: '42',
        ts: '2026-01-01T00:00:00Z',
        payload: { phase: 2, total_phases: 4, name: 'SERVER FINGERPRINT', status: 'running' },
      }),
    );

    expect(event).not.toBeNull();
    expect(event?.seq).toBe(4);
    expect(event?.type).toBe('analysis_progress');
    expect(event?.analysis_id).toBe('42');
    expect(event?.payload?.['phase']).toBe(2);
  });

  it('should coerce numeric analysis ids to strings', () => {
    const event = parseLiveEvent(JSON.stringify({ type: 'analysis_started', analysis_id: 9 }));
    expect(event?.analysis_id).toBe('9');
  });

  it('should reject malformed frames', () => {
    expect(parseLiveEvent('not-json')).toBeNull();
    expect(parseLiveEvent('null')).toBeNull();
    expect(parseLiveEvent('[]')).toBeNull();
    expect(parseLiveEvent(JSON.stringify({ payload: {} }))).toBeNull();
    expect(parseLiveEvent(42)).toBeNull();
    expect(parseLiveEvent(undefined)).toBeNull();
  });

  it('should ignore non-object payloads', () => {
    const event = parseLiveEvent(JSON.stringify({ type: 'log', payload: 'text' }));
    expect(event?.payload).toBeNull();
  });
});

describe('applyLiveEvent', () => {
  const stats = () => createLiveStats();

  it('should capture the profile id on analysis_started', () => {
    const next = applyLiveEvent(
      stats(),
      parseLiveEvent(JSON.stringify({ type: 'analysis_started', analysis_id: '17' }))!,
    );
    expect(next.profileId).toBe(17);
  });

  it('should track phases and percent on analysis_progress', () => {
    const next = applyLiveEvent(
      stats(),
      parseLiveEvent(
        JSON.stringify({
          type: 'analysis_progress',
          payload: { phase: 3, name: 'JS BUNDLE ANALYSIS', status: 'running', percent: 55 },
        }),
      )!,
    );
    expect(next.phase).toBe(3);
    expect(next.phaseName).toBe('JS BUNDLE ANALYSIS');
    expect(next.phaseStatus).toBe('running');
    expect(next.percent).toBe(55);
  });

  it('should count item_found events by kind', () => {
    let next = stats();
    next = applyLiveEvent(next, parseLiveEvent(JSON.stringify({ type: 'item_found', payload: { kind: 'technology' } }))!);
    next = applyLiveEvent(next, parseLiveEvent(JSON.stringify({ type: 'item_found', payload: { kind: 'dependency' } }))!);
    next = applyLiveEvent(next, parseLiveEvent(JSON.stringify({ type: 'item_found', payload: { kind: 'route' } }))!);
    next = applyLiveEvent(next, parseLiveEvent(JSON.stringify({ type: 'item_found', payload: { kind: 'route', route_type: 'guard' } }))!);
    next = applyLiveEvent(next, parseLiveEvent(JSON.stringify({ type: 'item_found', payload: { kind: 'unknown' } }))!);

    expect(next.techs).toBe(1);
    expect(next.jsDeps).toBe(1);
    expect(next.routes).toBe(1);
    expect(next.guards).toBe(1);
  });

  it('should sync summary counters on analysis_completed', () => {
    const next = applyLiveEvent(
      stats(),
      parseLiveEvent(
        JSON.stringify({
          type: 'analysis_completed',
          payload: { summary: { technologies: 12, routes: 5, guards: 2, dependencies: 30 } },
        }),
      )!,
    );

    expect(next.completed).toBe(true);
    expect(next.techs).toBe(12);
    expect(next.routes).toBe(5);
    expect(next.guards).toBe(2);
    expect(next.jsDeps).toBe(30);
  });

  it('should capture the error message on analysis_error', () => {
    const next = applyLiveEvent(
      stats(),
      parseLiveEvent(JSON.stringify({ type: 'analysis_error', payload: { message: 'boom' } }))!,
    );
    expect(next.error).toBe('boom');
  });

  it('should keep state unchanged for unknown events', () => {
    const initial = { ...createLiveStats(), techs: 3 };
    const next = applyLiveEvent(initial, { seq: 1, type: 'unknown', tool: '', analysis_id: '', ts: '', payload: null });
    expect(next).toBe(initial);
  });
});

describe('liveEventLogLine', () => {
  it('should render progress lines', () => {
    const event = parseLiveEvent(
      JSON.stringify({
        type: 'analysis_progress',
        payload: { phase: 2, name: 'SERVER FINGERPRINT', status: 'complete' },
      }),
    )!;
    expect(liveEventLogLine(event)).toBe('[PHASE 2] SERVER FINGERPRINT — DONE');
  });

  it('should render error lines', () => {
    const event = parseLiveEvent(
      JSON.stringify({ type: 'analysis_error', payload: { message: 'TIMEOUT' } }),
    )!;
    expect(liveEventLogLine(event)).toBe('[ERROR] TIMEOUT');
  });

  it('should return null for empty log events', () => {
    const event = parseLiveEvent(JSON.stringify({ type: 'log', payload: {} }))!;
    expect(liveEventLogLine(event)).toBeNull();
  });
});
