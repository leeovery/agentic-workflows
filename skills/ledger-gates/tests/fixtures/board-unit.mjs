// Token-aware diff sizing's tab in its build as engine board answers it, three questions waiting, held to its shape by tests/scripts/test-engine-board-units.cjs.

/** A phase on a unit's tab, the rest as given. */
export const phase = (name, state, words = '', more = {}) => ({ phase: name, state, words, doing: '', on: null, session: null, page: false, ...more })

export default {
  kind: 'unit',
  unit: 'token-aware-diff-sizing',
  title: 'Token-aware diff sizing',
  type: 'feature',
  about: 'Token-aware diff sizing plus graceful handling of oversized diffs',
  started: '2026-06-26',
  now: { phase: 'build', since: '2026-10-19T16:00:00' },
  at_menu: false,
  here: true,
  progress: { complete: 3, total: 5 },
  waiting: [
    { kind: 'question', id: 'Q1', text: 'Q1 If the terminal closes, should the release unwind?', page: 'task:6.7' },
    { kind: 'question', id: 'Q2', text: 'Q2 When a re-merge fails, should the notes stay?', page: 'task:6.8' },
  ],
  phases: [
    phase('discovery', 'complete', 'the seed', { on: '2026-06-26', page: true }),
    phase('discussion', 'complete', '52 decisions', { on: '2026-10-17T12:00:00', page: true }),
    phase('specification', 'complete', '18 sections · 8 build phases', { on: '2026-10-19T16:00:00' }),
    phase('build', 'running', '58 of 68 tasks done', { doing: 'building', session: 'this' }),
    phase('review', 'later'),
  ],
  lately: [
    { kind: 'raised', at: '2026-10-21T13:20:00', topic: null, detail: 'Q3' },
    { kind: 'task-failed', at: '2026-10-21T13:12:00', topic: null, detail: '6.6' },
  ],
}
