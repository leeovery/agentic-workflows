// A scenario's page as engine board answers it, for the locked board's 6.S1 of Mint's task 6.1, held to its shape by tests/scripts/test-engine-board.cjs.
// Its time is local, as the board draws it: run 21 Oct 09:38.
export default {
  kind: 'scenario',
  unit: 'token-aware-diff-sizing',
  task: '6.1',
  title: '`r` on chunked notes re-runs only the merge',
  scenario: '6.S1',
  criterion: 'r at the review gate re-runs only the merge',
  standing: 'proven',
  at: new Date(2026, 9, 21, 9, 38).toISOString(),
  drive: 'mint release on the fixture repository, whose diff is over the cap; at the review gate, r',
  check: 'one AI call, for the merge; no chunk call; the review gate shown again with the merged notes',
  evidence: [{ name: 'captured screen', lines: 41 }],
}
