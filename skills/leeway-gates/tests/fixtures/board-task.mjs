// A task's page as engine board answers it, for the locked board's task 1.4 of Mint's build, held to its shape by tests/scripts/test-engine-board.cjs.
// Its times are local, as the board draws them: done 20 Oct 00:03, twelve minutes after it started.
export default {
  kind: 'task',
  unit: 'token-aware-diff-sizing',
  phase: 1,
  phase_name: 'Lean default AI command and quote-aware parsing',
  line: { task: '1.4', title: '180-second shipped release timeout', state: 'done', since: null, on: [] },
  started: new Date(2026, 9, 19, 23, 51).toISOString(),
  finished: new Date(2026, 9, 20, 0, 3).toISOString(),
  does: 'With no timeout configured, a hung release-notes call fails after 180 seconds and a hung commit call after 60. An explicit timeout at either level still wins. Every surface that states the shipped timeout names both values.',
  criteria: 6,
  account: {
    done: 'With no timeout set at any level, a release-notes call now gets 180 seconds per attempt before it fails as `AI timed out`, and a `mint commit` call keeps 60. `mint release regenerate <version>` from a fresh source gets the 180 seconds too. A `timeout` under `[release]` or `[commit]`, or a shared one, still wins. The README, `mint setup`\'s config reference and its AI-transport paragraph now name both defaults, and the `[commit]` `timeout` row reads `shared, else 60` as well, which the task did not ask for.',
    where: [
      '- internal/config/config.go: DefaultReleaseTimeout (180s) and DefaultCommitTimeout (60s) replace DefaultTimeout',
      '- internal/config/config.go: TimeoutFor falls to the verb\'s own floor; defaults() no longer seeds a shared 60s',
      '- internal/config/metadata.go: shared timeout row names both defaults; verb rows read `shared, else N`',
      '- README.md, internal/setupguide/setupguide.go: every stated timeout default names 180 and 60',
    ].join('\n'),
    tests: '- 8 new tests check the deadline each call site gets (180s release and regenerate, 60s commit, 90s overrides) and every doc surface; 7 config and metadata tests rewritten for per-verb floors, 1 dropped',
    differences: [
      'With no .mint.toml, mint no longer writes a shared 60s timeout into the config, so the 180s and 60s defaults apply there too. The task\'s Context pointed at this; its Do did not name the edit.',
      'The [commit] timeout rows in the README and the config reference now read "shared, else 60". The task asked only for the release and shared rows.',
      'No test waits out a real 180-second hang: the tests read how much time the call\'s deadline leaves, through a new DeadlineRemaining on the test runner.',
    ],
    figures: { files: 18, added: 331, removed: 185, criteria: 6 },
  },
  reviews: [
    { round: 'Round 1', summary: '1 finding, fixed' },
    { round: 'Round 2', summary: 'passed' },
  ],
  calls: [
    { id: 'e3a1', text: 'Each names the exclusion check\'s answers as the exception, both their commit, re-committed on the starting commit, and their uncommitted write to an untracked .mint.toml git ignores, which the unwind leaves in place.' },
    { id: 'e3a2', text: 'The list also covers failure classification (§9) and halving with the lower-the-cap hint (§10).' },
  ],
  ran: null,
  question: null,
  fixes: [],
}
