// Fumi's E1 as engine board answers it, 26 of its 40 runs in, held to its shape by tests/scripts/test-engine-board-views.cjs.
export default {
  kind: 'experiment',
  unit: 'fumi',
  title: 'Fumi',
  type: 'epic',
  id: 'E1',
  question: 'What does a real fumi cost at launch?',
  topic: 'scale-and-performance',
  topic_title: 'Scale and performance',
  status: 'running',
  approved: '2026-09-02',
  verdict: null,
  reason: null,
  problem: 'Measured so far: sixteen bare NSWindows created, placed one per Space and shown non-activating in 242 ms total.',
  design: [
    { heading: 'Question', text: '- Measures the time from launch to the last fumi shown on its Space' },
    { heading: 'Setup', text: '- 20 cold launches of 16 bare windows: the floor, again\n- 20 cold launches of 25 real fumis, the top of your open set (~20–25)' },
    {
      heading: 'Decision rule',
      text: '- The rule: if the 25th real fumi is on screen in under 1 second, eager restore stands as decided; at 1 second or more, placing fumis beyond the active Space lazily is open again.',
    },
  ],
  runs: [
    { condition: '16 bare windows', of: 20, done: 20, median: 0.24, unit: 's' },
    { condition: '25 real fumis', of: 20, done: 6, median: 0.67, unit: 's' },
  ],
  report: false,
}
