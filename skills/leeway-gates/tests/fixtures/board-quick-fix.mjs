// Portal's m-marks quick-fix as engine board answers it, its one fix done and its close waiting on the person — §20.14's second drawing — held to its shape by tests/scripts/test-engine-board-quick-fix.cjs.
export default {
  kind: 'quick-fix',
  unit: 'm-marks-highlighted-on-entry',
  title: 'M Marks Highlighted On Entry',
  type: 'quick-fix',
  project: 'Portal',
  started: '2026-07-15T09:00:00.000Z',
  from: 'inbox',
  change: 'Pressing m on a highlighted session marks it as the first multi-select selection on entry, instead of entering multi-select mode with an empty set',
  standing: 'close',
  stopped: false,
  progress: { done: 1, total: 1 },
  waiting: [{ kind: 'finish', id: 'close', text: "Close: what was proven; you changed none of Claude's calls, so there is no verdict to give", page: null }],
  fixes: [{ task: '1.1', title: 'Mark the highlighted session on entry', state: 'done', since: null, on: [], rounds: { sent_back: 1, reading: null, passed: 2 } }],
  calls: [
    { id: 'Rd8kQe', text: 'The README says entering marks the highlighted row' },
    { id: 'Hn3wPz', text: 'The capture harness keeps entering with a named set, as it did' },
  ],
  replaces: [{ id: 'Mq7tVb', text: 'm enters a real mode you can sit in with zero selected', by: 'person', unit: 'restore-host-terminal-windows', unit_title: 'Restore Host Terminal Windows' }],
  record: [
    {
      title: 'Mark the highlighted session on entry',
      changed: 'entering multi-select marks the highlighted session; on a group header it still marks none',
      why: 'Entering multi-select mode by pressing m on a highlighted session should immediately select that session as the first marked item — rather than entering the mode with nothing selected.',
      leaves: 'No change to behaviour after entry; no footer or banner copy change; WithInitialMultiSelect is unaffected; no new visual state, Paper frame, or visual gate',
    },
  ],
}
