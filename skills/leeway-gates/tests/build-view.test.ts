import { describe, expect, test, tier } from 'claude-code/testing'

import type { Answer, Board, View } from '../hooks/model.ts'
import { HOME, pressed } from '../hooks/pane.ts'
import { VIEWS } from '../hooks/views/index.ts'
import { buildLines, type BuildPhase, type BuildView, type TaskLine } from '../hooks/views/build.ts'
import { drawnRows, kitAt, paneDrawn, rowsDrawn } from './drawing.ts'
import BUILD from './fixtures/board-build.mjs'

tier('user')

/** The locked board's moment: three questions waiting, the oldest four hours. */
const NOW = Date.parse('2026-10-21T15:00:00.000Z')

const view = BUILD.view as BuildView

const answered = (board: Board): Answer => ({ kind: 'board', board })

/** The build with its view as `change` makes it. */
const built = (change: (build: BuildView) => Partial<BuildView>): Answer => answered({ ...BUILD, view: { ...view, ...change(view) } as View })

/** The running phase's tasks, each as `change` makes it. */
const sixth = (change: (line: TaskLine) => TaskLine): BuildPhase[] =>
  view.phases.map(phase => (phase.phase === 6 ? { ...phase, tasks: phase.tasks.map(change) } : phase))

describe('the build\'s This session (20.5)', () => {
  test('20.5\'s drawing: the locked board\'s build at 64 columns, a failed task drawn ✗ (D7), its running tasks\' clocks frozen as its scene froze them', () => {
    expect(paneDrawn(answered(BUILD), { now: NOW, clocked: '0:00' })).toEqual([
      '⌂ This session   ≡ Token-aware diff sizing   ≡ All work',
      '━━━━━━━━━━━━━━────────────────────────────────────────────────',
      '',
      'Token-aware diff sizing · feature · build phase',
      '▰▰▰▰▰▰▰▱  58 of 68 tasks done · phase 6 of 8 · 2 running',
      '',
      'WAITING ON YOU ───────────────────────────── 3 · ▸ discuss all',
      '⚑ Q1 If the terminal closes while the review gate waits,',
      '  should the release unwind as a decline does, or keep its',
      '  commit for the operator to finish by hand?',
      '     parks 6.7 · waiting 4h                          ▸ discuss',
      '⚑ Q2 When a re-merge fails at the review gate, should the',
      '  notes the operator already saw stay on offer to accept, or',
      '  should the run abort with the chunk notes saved?',
      '     parks 6.8, and 2 after it · waiting 1h          ▸ discuss',
      '⚑ Q3 While a regeneration runs as chunks, should plain mode',
      '  (CI and agents) print a line as each part finishes, or one',
      '  line when the whole wave is done?',
      '     parks 6.5 · waiting 10m                         ▸ discuss',
      '',
      'PHASE 1 · Lean default AI command and quote-…─ complete ▸ show',
      '',
      'PHASE 2 · Per-call size cap and chunked rele…─ complete ▸ show',
      '',
      'PHASE 3 · `--notes-file` and one non-AI body ─ complete ▸ show',
      '',
      'PHASE 4 · Failure classification, halving an…─ complete ▸ show',
      '',
      'PHASE 5 · The remediation floor ────────────── complete ▸ show',
      '',
      'PHASE 6 · Chunked notes at the review gate and …─ 2 of 12 done',
      '✓ 6.1 `r` on chunked notes re-runs only the merge         done',
      '✓ 6.2 Regenerate\'s `r` on chunked notes re-runs only the… done',
      '◐ 6.3 `r` on single-pass notes re-runs from th… in review 0:00',
      '◐ 6.4 A failed single-pass `r` call is classifi… building 0:00',
      '⚑ 6.5 An `r` that becomes a chunked run narrates … waits on Q3',
      '✗ 6.6 Chunked notes come back from the notes cache wit… failed',
      '⚑ 6.7 Every abort at the review gate unwinds       waits on Q1',
      '⚑ 6.8 A failed re-merge aborts with every chunk\'s… waits on Q2',
      '○ 6.9 A failed `r` the ladder made chunked aborts w… after 6.4',
      '○ 6.10 A failed regenerate `r` saves the version\'s … after 6.8',
      '○ 6.11 One `r` regenerator for both verbs, with the… after 6.8',
      '○ 6.12 One review-gate `r` assembly for both verbs  after 6.11',
      '',
      'PHASE 7 · Per-verb exclusion lists and the e…─ not yet written',
      'PHASE 8 · Recording exclusion answers ──────── not yet written',
    ])
  })

  test('20.S1: with three questions waiting, WAITING ON YOU follows the progress, "▸ discuss all" on its heading and "▸ discuss" on each, and the running tasks show their clocks, turning', () => {
    const shown = paneDrawn(answered(BUILD), { now: NOW })
    const at = shown.indexOf('WAITING ON YOU ───────────────────────────── 3 · ▸ discuss all')

    expect([at, shown.filter(row => row.endsWith('▸ discuss')).length]).toEqual([shown.indexOf('▰▰▰▰▰▰▰▱  58 of 68 tasks done · phase 6 of 8 · 2 running') + 2, 3])
    expect(shown.filter(row => /^◐ 6\.[34] /.test(row))).toEqual([
      '◐ 6.3 `r` on single-pass notes re-runs from th… in review 1:40',
      '◐ 6.4 A failed single-pass `r` call is classif… building 12:14',
    ])
  })

  test('D6, D11: a build stopped ends its progress "⚑ stopped until you answer", the words whole, wrapped under its facts', () => {
    const stopped = built(({ progress }) => ({ progress: { ...progress, done: 62, running: 0, stopped: true } }))
    const kit = kitAt(NOW)
    const [, progress] = buildLines((stopped as { board: Board }).board.view, kit)

    expect(rowsDrawn(progress!)).toEqual(['▰▰▰▰▰▰▰▱  62 of 68 tasks done · phase 6 of 8 · ⚑ stopped until', '          you answer'])
  })

  test('20.5.2: every state a task stands in reads at its line\'s right, its mark beside its number: at its gate and behind another in step, closed, and a fix phase whose merge waits', () => {
    const states: TaskLine[] = [
      { task: '6.1', title: 'At its gate', state: 'at-gate', since: null, on: [] },
      { task: '6.2', title: 'Behind the task in flight', state: 'behind', since: null, on: ['6.1'] },
      { task: '6.3', title: 'Closed without being done', state: 'closed', since: null, on: [] },
      { task: '6.4', title: 'Building before its brief was seen', state: 'building', since: null, on: [] },
      { task: '6.5', title: 'Not started', state: 'not-started', since: null, on: [] },
    ]
    const phases: BuildPhase[] = [{ phase: 9, name: 'the review\'s fixes, round 1', state: 'merging', done: 2, total: 2, tasks: [] }]
    const lines = buildLines({ ...view, phases: [{ ...view.phases[5]!, tasks: states }, ...phases] } as View, kitAt(NOW))

    expect(drawnRows(lines.filter(line => line.key.startsWith('task:') || line.key === 'phase:9'))).toEqual([
      '⚑ 6.1 At its gate                                  at its gate',
      '○ 6.2 Behind the task in flight                      after 6.1',
      '– 6.3 Closed without being done                         closed',
      '◐ 6.4 Building before its brief was seen              building',
      '○ 6.5 Not started                                      waiting',
      'PHASE 9 · the review\'s fixes, round 1 ─ its merge waits on you',
    ])
  })

  test('20.4.7: a complete phase folds to its heading, and a press opens it on its tasks with "▾ hide"', () => {
    const opened = pressed(HOME, 'fold:phase:1', BUILD, VIEWS)
    const shown = paneDrawn(answered(BUILD), { nav: opened ?? HOME, now: NOW })
    const at = shown.indexOf('PHASE 1 · Lean default AI command and quote-…─ complete ▾ hide')

    expect(shown.slice(at, at + 3)).toEqual([
      'PHASE 1 · Lean default AI command and quote-…─ complete ▾ hide',
      '✓ 1.1 Quote-aware `ai_command` splitting                  done',
      '✓ 1.2 Lean shipped default AI command                     done',
    ])
  })

  test('20.5.4: a press on a task opens its page, read by its number in the unit it is of', () => {
    const line = buildLines(view, kitAt(NOW)).find(each => each.key === 'task:6.4')

    expect(pressed(HOME, line?.press ?? '', BUILD, VIEWS)?.pages).toEqual([{ ref: 'task:6.4', unit: 'token-aware-diff-sizing', over: null }])
  })
})
