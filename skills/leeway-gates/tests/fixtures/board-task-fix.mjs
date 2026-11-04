// A fix task's page as engine board answers it, for the locked board's task 9.1 of Mint's review, the finding it fixes, what running the product proved and the question parking it, held to its shape by tests/scripts/test-engine-board-review.cjs.
export default {
  kind: 'task',
  unit: 'token-aware-diff-sizing',
  phase: 9,
  phase_name: 'the review\'s fixes, round 1',
  line: { task: '9.1', title: 'The notes stage\'s live line after a failed check', state: 'waits', since: null, on: ['Q1'] },
  started: new Date(2026, 9, 21, 14, 2).toISOString(),
  finished: null,
  does: 'In pretty mode, a failed exclusion check leaves the notes stage\'s live line running, so the stage still says what it is doing.',
  criteria: 2,
  account: null,
  reviews: [],
  calls: [],
  ran: [
    { scenario: '16.S1', criterion: 'A failed check leaves the live line running', standing: 'proven' },
    { scenario: '16.S2', criterion: 'The stage\'s last line names the failed check', standing: 'not proven' },
  ],
  questions: ['Q1'],
  fixes: [
    { round: 1, finding: 12, area: '16-progress-narration', call: 'serious', text: 'In pretty mode, a failed check kills the notes stage\'s live line for the rest of the stage.' },
  ],
}
