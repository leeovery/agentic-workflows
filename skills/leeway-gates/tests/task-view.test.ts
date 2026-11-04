import { describe, expect, test, tier } from 'claude-code/testing'

import { QUIET, waitingLines } from '../hooks/discuss.ts'
import type { Answer, Board, Question, View } from '../hooks/model.ts'
import { HOME, pressed, type Page } from '../hooks/pane.ts'
import { VIEWS } from '../hooks/views/index.ts'
import { roundLines, scenarioLines, taskLines, writtenLines } from '../hooks/views/task.ts'
import { WIDTH, drawnRows, kitAt, paneDrawn, sectionOf } from './drawing.ts'
import BUILD from './fixtures/board-build.mjs'
import FIXING from './fixtures/board-task-fix.mjs'
import TASK from './fixtures/board-task.mjs'

tier('user')

const UNIT = 'token-aware-diff-sizing'

const NOW = Date.parse('2026-10-21T15:00:00.000Z')

/** A page opened over This session's build, in the build's unit. */
const OVER_BUILD: Page = { ref: 'task:1.4', unit: UNIT, over: null }

/** The pane on a page, This session's build beneath it. */
const onPage = (view: View, pages: readonly Page[] = [OVER_BUILD]) => {
  const answer: Answer = { kind: 'board', board: { ...BUILD, view, beneath: BUILD.view } as Board }

  return paneDrawn(answer, { nav: { tab: 'this', unit: null, pages, opened: new Set() }, now: NOW, clocked: '0:12' })
}

/** The task's page with `change` made to it. */
const task = (change: Record<string, unknown>): View => ({ ...TASK, ...change })

/** A task's line on its page. */
const lineOf = (state: string, on: string[] = []) => ({ task: '6.4', title: 'A failed single-pass `r` call is classified and halved', state, since: '2026-10-21T14:59:48.000Z', on })

describe('a task\'s page (20.5.4–20.5.7)', () => {
  test('20.5.6\'s drawing of a done task: its phase and ✓ on one line, when it finished and how long it took on the next (D10), and the count of its acceptance criteria alone, the template holding no steps', () => {
    expect(onPage(TASK)).toEqual([
      '⌂ This session   ≡ Token-aware diff sizing   ≡ All work',
      '━━━━━━━━━━━━━━────────────────────────────────────────────────',
      '',
      '← back to the build',
      '',
      '1.4 180-second shipped release timeout',
      'Phase 1 · Lean default AI command and quote-aware parsing · ✓',
      'done 20 Oct 00:03 · took 12m',
      '',
      'WHAT IT DOES ────────────────────────────────────────────────',
      'With no timeout configured, a hung release-notes call fails',
      'after 180 seconds and a hung commit call after 60. An explicit',
      'timeout at either level still wins. Every surface that states',
      'the shipped timeout names both values.',
      '6 acceptance criteria                          ▸ read the task',
      '',
      'WHAT WAS DONE ───────────────────────────────────────────────',
      'With no timeout set at any level, a release-notes call now',
      'gets 180 seconds per attempt before it fails as `AI timed',
      'out`, and a `mint commit` call keeps 60. `mint release',
      'regenerate <version>` from a fresh source gets the 180 seconds',
      'too. A `timeout` under `[release]` or `[commit]`, or a shared',
      'one, still wins. The README, `mint setup`\'s config reference',
      'and its AI-transport paragraph now name both defaults, and the',
      '`[commit]` `timeout` row reads `shared, else 60` as well,',
      'which the task did not ask for.',
      '· internal/config/config.go: DefaultReleaseTimeout (180s) and',
      '  DefaultCommitTimeout (60s) replace DefaultTimeout',
      '· internal/config/config.go: TimeoutFor falls to the verb\'s',
      '  own floor; defaults() no longer seeds a shared 60s',
      '· internal/config/metadata.go: shared timeout row names both',
      '  defaults; verb rows read `shared, else N`',
      '· README.md, internal/setupguide/setupguide.go: every stated',
      '  timeout default names 180 and 60',
      '· 8 new tests check the deadline each call site gets (180s',
      '  release and regenerate, 60s commit, 90s overrides) and every',
      '  doc surface; 7 config and metadata tests rewritten for',
      '  per-verb floors, 1 dropped',
      '✓ Proves 6 criteria · 18 files changed · +331 −185',
      '',
      'DIFFERS FROM THE TASK ────────────────────────────────────── 3',
      '△ With no .mint.toml, mint no longer writes a shared 60s',
      '  timeout into the config, so the 180s and 60s defaults apply',
      '  there too. The task\'s Context pointed at this; its Do did',
      '  not name the edit.',
      '△ The [commit] timeout rows in the README and the config',
      '  reference now read "shared, else 60". The task asked only',
      '  for the release and shared rows.',
      '△ No test waits out a real 180-second hang: the tests read how',
      '  much time the call\'s deadline leaves, through a new',
      '  DeadlineRemaining on the test runner.',
      '',
      'REVIEWS ───────────────────────────────────────────── 2 rounds',
      '◆ Round 1 · 1 finding, fixed                            ▸ read',
      '◆ Round 2 · passed                                      ▸ read',
      '',
      'CALLS MADE ───────────────────────────────────────────────── 2',
      '◇ Each names the exclusion check\'s answers as the exce… ▸ read',
      '◇ The list also covers failure classification (§9) and… ▸ read',
    ])
  })

  test('D10: a task not done keeps its mark and state whole on its phase\'s line, the phase\'s name giving way to them', () => {
    const phase = { phase: 6, phase_name: 'Chunked notes at the review gate and in the dry-run cache', finished: null, account: null, reviews: [], calls: [] }
    const standing = (line: ReturnType<typeof lineOf>) => onPage(task({ ...phase, line, questions: [] }))[6]

    expect([standing(lineOf('building')), standing(lineOf('in-review')), standing(lineOf('waits', ['Q1'])), standing(lineOf('failed')), standing(lineOf('after', ['6.3']))]).toEqual([
      'Phase 6 · Chunked notes at the review gate … · ◐ building 0:12',
      'Phase 6 · Chunked notes at the review gate… · ◐ in review 0:12',
      'Phase 6 · Chunked notes at the review gate an… · ⚑ waits on Q1',
      'Phase 6 · Chunked notes at the review gate and in … · ✗ failed',
      'Phase 6 · Chunked notes at the review gate and … · ○ after 6.3',
    ])
  })

  test('20.5.6: a parked task\'s page shows every question it waits on in full, each with its "▸ discuss", and none it does not', () => {
    const questions = BUILD.questions as Question[]
    const parks = questions.map(question => ({ ...question, parks: [{ task: '6.4', title: '' }], after: [] }))
    const waiting = () => waitingLines([...parks, { ...questions[0]!, question: 'Q4' }], QUIET, WIDTH, NOW)
    const page = task({ line: lineOf('waits', ['Q1', 'Q3']), finished: null, account: null, reviews: [], calls: [], questions: ['Q1', 'Q3'] })

    expect(sectionOf(drawnRows(taskLines(page, kitAt(NOW, waiting))), 'WAITING ON YOU')).toEqual([
      'WAITING ON YOU ──────────────────────────────────────────────',
      '⚑ Q1 If the terminal closes while the review gate waits,',
      '  should the release unwind as a decline does, or keep its',
      '  commit for the operator to finish by hand?',
      '     parks 6.4 · waiting 4h                          ▸ discuss',
      '⚑ Q3 While a regeneration runs as chunks, should plain mode',
      '  (CI and agents) print a line as each part finishes, or one',
      '  line when the whole wave is done?',
      '     parks 6.4 · waiting 10m                         ▸ discuss',
    ])
  })

  test('the way back from a page over a task names the task by its number, as 15.2.14 draws it', () => {
    const over = pressed({ ...HOME, pages: [OVER_BUILD] }, 'page:task:1.4:written', { ...BUILD, view: TASK } as Board, VIEWS)

    expect(over?.pages.at(-1)?.over).toBe('1.4')
  })

  test('D8: a done task with no account says so in WHAT WAS DONE, its reviews standing beside it', () => {
    const rows = onPage(task({ account: null, reviews: [{ round: 'Round 1', summary: 'passed' }] }))

    expect([sectionOf(rows, 'WHAT WAS DONE'), sectionOf(rows, 'REVIEWS')]).toEqual([
      ['WHAT WAS DONE ───────────────────────────────────────────────', 'No account was written for this task as it landed.'],
      ['REVIEWS ────────────────────────────────────────────── 1 round', '◆ Round 1 · passed                                      ▸ read'],
    ])
  })

  test('D14, D41: DIFFERS FROM THE TASK always shows, saying nothing differs where nothing does; one criterion, one file and one round each read in the one', () => {
    const account = { ...(TASK.account as object), differences: [], figures: { files: 1, added: 4, removed: 0, criteria: 1 } }
    const rows = onPage(task({ criteria: 1, account }))

    expect([rows.find(row => row.startsWith('1 acceptance')), rows.find(row => row.startsWith('✓ Proves')), sectionOf(rows, 'DIFFERS FROM THE TASK')]).toEqual([
      '1 acceptance criterion                         ▸ read the task',
      '✓ Proves 1 criterion · 1 file changed · +4 −0',
      ['DIFFERS FROM THE TASK ─────────────────────────────────── none', 'Nothing differs from the task as written.'],
    ])
  })

  test('D17: a fix task\'s page lists what it fixes, each finding hung under its mark', () => {
    expect(sectionOf(onPage(FIXING), 'WHAT IT FIXES')).toEqual([
      'WHAT IT FIXES ────────────────────────────────────────────── 1',
      '· In pretty mode, a failed check kills the notes stage\'s live',
      '  line for the rest of the stage.',
    ])
  })

  test('12.S49, D15: each round\'s "▸ read" opens that round, its two reports read in full, A then B', () => {
    const review = taskLines(TASK, kitAt(NOW)).find(line => line.key === 'reviews:1')
    const round: View = {
      kind: 'task-round',
      unit: UNIT,
      task: '1.4',
      title: '180-second shipped release timeout',
      round: 2,
      reports: [
        { letter: 'a', text: '## Findings\n\nNone.\n\nVerdict: pass' },
        { letter: 'b', text: '## Findings\n\n- nit: A name.\n\nVerdict: pass' },
      ],
    }

    expect(review?.button?.key).toBe('page:task:1.4:round:2')
    expect(drawnRows(roundLines(round, kitAt(NOW)))).toEqual([
      'Review round 2 · 1.4 180-second shipped release timeout',
      ' ────────────────────────────────────────────────────────────',
      'REPORT A ────────────────────────────────────────────────────',
      'Findings',
      'None.',
      'Verdict: pass',
      '',
      'REPORT B ────────────────────────────────────────────────────',
      'Findings',
      '· nit: A name.',
      'Verdict: pass',
    ])
  })

  test('D19: the task as written, each section under its heading, a list\'s items hung under their marks', () => {
    const written: View = {
      kind: 'task-written',
      unit: UNIT,
      task: '1.4',
      title: '180-second shipped release timeout',
      sections: [{ heading: 'Acceptance scenarios', text: '- Given no timeout at any level, whether there is no .mint.toml or one that sets no timeout, a release-notes call that hangs fails' }],
    }

    expect(drawnRows(writtenLines(written, kitAt(NOW)))).toEqual([
      'The task · 1.4 180-second shipped release timeout',
      '',
      'ACCEPTANCE SCENARIOS ────────────────────────────────────────',
      '· Given no timeout at any level, whether there is no',
      '  .mint.toml or one that sets no timeout, a release-notes call',
      '  that hangs fails',
    ])
  })
})

describe('its evidence (15.2.14, D16)', () => {
  const ran = [
    { scenario: '6.S1', criterion: 'r at the review gate re-runs only the merge', standing: 'proven' },
    { scenario: '6.S2', criterion: 'The merged notes come back to the review gate', standing: 'proven' },
    { scenario: '6.S3', criterion: 'A failed merge on r keeps the chunk notes', standing: 'not proven' },
  ]

  test('2.S9: EVIDENCE stands under the header, each scenario by what running the product proved, "▸ see" where proven and "▸ read" where not', () => {
    const page = task({ line: { ...lineOf('done'), task: '6.1', title: '`r` on chunked notes re-runs only the merge' }, phase: 6, phase_name: 'Chunked notes at the review gate and in the dry-run cache', ran })
    const rows = onPage(page)
    const evidence = taskLines(page, kitAt(NOW)).filter(line => line.key.startsWith('evidence:6'))

    expect(rows.slice(5, 13)).toEqual([
      '6.1 `r` on chunked notes re-runs only the merge',
      'Phase 6 · Chunked notes at the review gate and in the dry… · ✓',
      'done 20 Oct 00:03 · took 12m',
      '',
      'EVIDENCE ───────────────────────────── 2 proven · 1 not proven',
      '✓ r at the review gate re-runs only the merge            ▸ see',
      '✓ The merged notes come back to the review gate          ▸ see',
      '△ A failed merge on r keeps the chunk notes  not proven ▸ read',
    ])
    expect(evidence.map(line => line.button?.key)).toEqual(['page:task:6.1:scenario:6.S1', 'page:task:6.1:scenario:6.S2', 'page:task:6.1:scenario:6.S3'])
  })

  test('15.2.14\'s drawing of a scenario\'s evidence, 2.S9: what it proved and when, what its run drives and checks, and the evidence kept with the run, each a press away', () => {
    const scenario: View = {
      kind: 'scenario',
      unit: UNIT,
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
    const lines = scenarioLines(scenario, kitAt(NOW))

    expect(drawnRows(lines)).toEqual([
      'r at the review gate re-runs only the merge',
      '✓ proven · run by the verify setup · 21 Oct 09:38',
      ' ────────────────────────────────────────────────────────────',
      'DRIVE ───────────────────────────────────────────────────────',
      'mint release on the fixture repository, whose diff is over the',
      'cap; at the review gate, r',
      '',
      'CHECK ───────────────────────────────────────────────────────',
      'one AI call, for the merge; no chunk call; the review gate',
      'shown again with the merged notes',
      '',
      'EVIDENCE ─────────────────────────────────── kept with the run',
      'captured screen · 41 lines                              ▸ open',
    ])
    expect(lines.at(-1)?.button?.key).toBe('page:task:6.1:scenario:6.S1:evidence:1')
  })

  test('a text evidence opens whole, each of its lines as captured, cut at the edge, never wrapped', () => {
    const evidence: View = { kind: 'evidence', unit: UNIT, task: '6.1', scenario: '6.S1', name: 'captured screen', text: `◆ Review the notes\n\n${'x'.repeat(70)}\n` }

    expect(onPage(evidence, [OVER_BUILD, { ref: 'task:6.1:scenario:6.S1', unit: UNIT, over: '6.S1' }]).slice(3)).toEqual([
      '← back to 6.S1',
      '',
      'captured screen · 6.S1',
      ' ────────────────────────────────────────────────────────────',
      '◆ Review the notes',
      '',
      `${'x'.repeat(61)}…`,
    ])
  })
})
