import { describe, expect, test, tier } from 'claude-code/testing'

import type { Answer, Board, Question, View } from '../hooks/model.ts'
import { checkLines, findingLines, reviewLines } from '../hooks/views/review.ts'
import { taskLines } from '../hooks/views/task.ts'
import { drawnRows, kitAt, paneDrawn, sectionOf } from './drawing.ts'
import BUILD from './fixtures/board-build.mjs'
import FAILED from './fixtures/board-review-failed.mjs'
import REVIEW from './fixtures/board-review.mjs'
import FIXING from './fixtures/board-task-fix.mjs'

tier('user')

const UNIT = 'token-aware-diff-sizing'

const NOW = Date.parse('2026-10-21T15:00:00.000Z')

/** The review with `change` made to it. */
const review = (change: Record<string, unknown>, from: View = REVIEW): View => ({ ...from, ...change })

/** The board at the review phase, its view `view`, `questions` waiting on the person. */
const answered = (view: View, questions: Question[] = []): Answer => ({ kind: 'board', board: { ...BUILD, place: { ...BUILD.place, phase: 'review' }, questions, view } as Board })

type Area = { area: string; title: string; state: string; ran: number; found: number; since: string | null }

const AREAS = REVIEW.areas as Area[]

/** The areas round 2 reads again, as the locked board's replay has them: §4, §5, §6, §12, §16, §18 and the tests. */
const READ_AGAIN = new Set(['4', '5', '6', '12', '16', '18', 'tests'])

/** Round 2 under way, each area it reads again being read, as the replay's step 5 draws it. */
const secondReading = review({
  finish: false,
  recorded: false,
  verdict: null,
  found: [],
  not_proven: (REVIEW.not_proven as { scenario: string }[]).map(check => ({ ...check, round: 1 })),
  areas: AREAS.map(area => (READ_AGAIN.has(area.area) ? { ...area, state: 'reading', ran: 0, since: '2026-10-21T14:57:42.000Z' } : area)),
})

describe('the review phase\'s This session (20.10)', () => {
  test('the locked board\'s replay, step 7: round 2 passed, finish waiting on the person under WAITING ON YOU (D18), round 1\'s fix tasks still shown (N2), the areas the fixes did not change unchanged, not read again (20.S11)', () => {
    expect(paneDrawn(answered(REVIEW), { now: NOW })).toEqual([
      '⌂ This session   ≡ Token-aware diff sizing   ≡ All work',
      '━━━━━━━━━━━━━━────────────────────────────────────────────────',
      '',
      'Token-aware diff sizing · review',
      'Mint · feature · 99 tasks built',
      'round 2 · 19 of 19 areas read · ⚑ finish waits on you',
      '',
      'WAITING ON YOU ───────────────── 1 · asked in the conversation',
      '⚑ Finish: the report of every round, and your verdict on each',
      '  call you changed',
      '',
      'FIX TASKS · PHASE 9 ────────────────────────────── 3 of 3 done',
      '✓ 9.1 The notes stage\'s live line after a failed check    done',
      '✓ 9.2 Add or repair the 4 tests the criteria name         done',
      '✓ 9.3 Correct the 11 comments that no longer match the c… done',
      '',
      'ROUND 2 ────────────────────────── the areas the fixes changed',
      '✓ §1 Purpose and Scope               unchanged, not read again',
      '✓ §2 The Lean Default AI Command     unchanged, not read again',
      '✓ §3 Quote-Aware ai_command Parsing  unchanged, not read again',
      '✓ §4 The Per-Call Size Cap                       nothing found',
      '✓ §5 Per-Verb Exclusion Lists            ran 1 · nothing found',
      '✓ §6 The Exclusion Check                 ran 4 · nothing found',
      '✓ §7 Routing a Release\'s Notes       unchanged, not read again',
      '✓ §8 Chunked Generation              unchanged, not read again',
      '✓ §9 Failure Classification          unchanged, not read again',
      '✓ §10 Halving After an Under-Cap Ov… unchanged, not read again',
      '✓ §11 Failures in a Chunked Run      unchanged, not read again',
      '✓ §12 The Remediation Floor              ran 2 · nothing found',
      '✓ §13 --notes-file                   unchanged, not read again',
      '✓ §14 One Non-AI Body: Dropping [re… unchanged, not read again',
      '✓ §15 Chunked Notes at the Review G… unchanged, not read again',
      '✓ §16 Progress Narration                         nothing found',
      '✓ §17 mint commit\'s AI-Failure Outp… unchanged, not read again',
      '✓ §18 Documentation and the Setup Guide  ran 6 · nothing found',
      '✓ Tests held against the specification           nothing found',
      '',
      'NOT PROVEN ──────────────────────────────── 9 could not be run',
      '△ Afterwards notes.md is still untracked with its contents un…',
      '△ afterwards the file carries the same edits, staged if they …',
      '△ The notes file stays in the work tree through the run with …',
      '△ the file that path names is the one left out of the clean-t…',
      '△ In each case HEAD is back at the starting commit, and the r…',
      '△ Given that file, --autostash with other uncommitted changes…',
      '△ diff.noprefix = true, custom diff.srcPrefix/diff.dstPrefix …',
      '△ Given either warning, carrying out the steps it names, in t…',
      '△ A tracked .mint.toml, one a .gitignore rule matches include…',
      '',
      'TO THE INBOX ─────────────────────────────── 1 · Claude\'s call',
      '» The file header still says processOneVersion returns "a per…',
      '',
      'VERDICT ─────────────────────────────────────────────────────',
      '✓ round 2 passes: nothing found',
    ])
  })

  test('the locked board\'s replay, step 2: round 1 failed — its fix tasks the build\'s next phase, each finding in scope marked by its call — ✗ the calls that fail a round, serious and bug, △ a nit — its checks not proven, what it filed, and its verdict hung under its mark; the facts line wrapping so it says so whole (D12, D19, 20.10.2)', () => {
    expect(paneDrawn(answered(FAILED), { now: NOW })).toEqual([
      '⌂ This session   ≡ Token-aware diff sizing   ≡ All work',
      '━━━━━━━━━━━━━━────────────────────────────────────────────────',
      '',
      'Token-aware diff sizing · review',
      'Mint · feature · 99 tasks built',
      'round 1 · 19 of 19 areas read · ✗ round 1 fails · 3 fix tasks',
      'to build',
      '',
      'FIX TASKS · PHASE 9 ────────────────────────────── 0 of 3 done',
      '○ 9.1 The notes stage\'s live line after a failed check waiting',
      '○ 9.2 Add or repair the 4 tests the criteria name      waiting',
      '○ 9.3 Correct the 11 comments that no longer match th… waiting',
      '',
      'FOUND ──────────────────────────────────────────── 16 in scope',
      '✗ tests no test drives mint release regenerate <version> agai…',
      '△ §18 the generousTimeout comment still says tests exist "so …',
      '△ §4 The comment above the regeneration stage says every exit…',
      '✗ tests The criterion names three verbs, but only mint releas…',
      '✗ tests assertNoTag still counts the pre-3-8 argv git tag -a …',
      '✗ tests Regenerate\'s production chunk-notes store is built in…',
      '△ §12 The Edit method doc says "A non-nil error means no edit…',
      '△ §12 The file header (lines 19-22) says batch skip-and-conti…',
      '△ §18 GenerateWithContext\'s doc still says "It is the AI supp…',
      '△ §5 This task changed the assertion two lines above to expec…',
      '✗ §16 In pretty mode, a failed check kills the notes stage\'s …',
      '△ §6 The CheckNarration doc says it is told "when the exclusi…',
      '△ §18 the file header still describes "the up-to-two-commit g…',
      '△ §12 The touchesConfig doc says the git calls naming .mint.t…',
      '△ §6 The AUTO-UNWIND header says the unwind "re-commits the e…',
      '△ §12 The phase 11 comment-corrections commit (49f7b86) delet…',
      '',
      'ROUND 1 ───────────────────────────── every area, read and run',
      '✓ §1 Purpose and Scope                           nothing found',
      '✓ §2 The Lean Default AI Command                 nothing found',
      '✓ §3 Quote-Aware ai_command Parsing              nothing found',
      '✗ §4 The Per-Call Size Cap                             1 found',
      '✗ §5 Per-Verb Exclusion Lists                  ran 1 · 1 found',
      '✗ §6 The Exclusion Check                       ran 4 · 2 found',
      '✓ §7 Routing a Release\'s Notes                   nothing found',
      '✓ §8 Chunked Generation                          nothing found',
      '✓ §9 Failure Classification                      nothing found',
      '✓ §10 Halving After an Under-Cap Overfl… ran 1 · nothing found',
      '✓ §11 Failures in a Chunked Run                  nothing found',
      '✗ §12 The Remediation Floor                    ran 2 · 5 found',
      '✓ §13 --notes-file                       ran 9 · nothing found',
      '✓ §14 One Non-AI Body: Dropping [release].fallb… nothing found',
      '✓ §15 Chunked Notes at the Review Gate … ran 1 · nothing found',
      '✗ §16 Progress Narration                               1 found',
      '✓ §17 mint commit\'s AI-Failure Output            nothing found',
      '✗ §18 Documentation and the Setup Guide        ran 6 · 3 found',
      '✗ Tests held against the specification                 4 found',
      '',
      'NOT PROVEN ──────────────────────────────── 9 could not be run',
      '△ Afterwards notes.md is still untracked with its contents un…',
      '△ afterwards the file carries the same edits, staged if they …',
      '△ The notes file stays in the work tree through the run with …',
      '△ the file that path names is the one left out of the clean-t…',
      '△ In each case HEAD is back at the starting commit, and the r…',
      '△ Given that file, --autostash with other uncommitted changes…',
      '△ diff.noprefix = true, custom diff.srcPrefix/diff.dstPrefix …',
      '△ Given either warning, carrying out the steps it names, in t…',
      '△ A tracked .mint.toml, one a .gitignore rule matches include…',
      '',
      'TO THE INBOX ─────────────────────────────── 1 · Claude\'s call',
      '» The file header still says processOneVersion returns "a per…',
      '',
      'VERDICT ─────────────────────────────────────────────────────',
      '✗ round 1 fails: the fix tasks build, then every area they',
      '  change is read again',
    ])
  })

  test('the locked board\'s replay, step 5: round 2 under way — round 1\'s fix tasks, its checks not proven and what it filed until round 2 is recorded, and nothing found yet of round 2\'s own (N2)', () => {
    expect(paneDrawn(answered(secondReading), { now: NOW, clocked: '0:00' })).toEqual([
      '⌂ This session   ≡ Token-aware diff sizing   ≡ All work',
      '━━━━━━━━━━━━━━────────────────────────────────────────────────',
      '',
      'Token-aware diff sizing · review',
      'Mint · feature · 99 tasks built',
      'round 2 · 12 of 19 areas read · ◐ 7 being read',
      '',
      'FIX TASKS · PHASE 9 ────────────────────────────── 3 of 3 done',
      '✓ 9.1 The notes stage\'s live line after a failed check    done',
      '✓ 9.2 Add or repair the 4 tests the criteria name         done',
      '✓ 9.3 Correct the 11 comments that no longer match the c… done',
      '',
      'ROUND 2 ────────────────────────── the areas the fixes changed',
      '✓ §1 Purpose and Scope               unchanged, not read again',
      '✓ §2 The Lean Default AI Command     unchanged, not read again',
      '✓ §3 Quote-Aware ai_command Parsing  unchanged, not read again',
      '◐ §4 The Per-Call Size Cap                        reading 0:00',
      '◐ §5 Per-Verb Exclusion Lists                     reading 0:00',
      '◐ §6 The Exclusion Check                          reading 0:00',
      '✓ §7 Routing a Release\'s Notes       unchanged, not read again',
      '✓ §8 Chunked Generation              unchanged, not read again',
      '✓ §9 Failure Classification          unchanged, not read again',
      '✓ §10 Halving After an Under-Cap Ov… unchanged, not read again',
      '✓ §11 Failures in a Chunked Run      unchanged, not read again',
      '◐ §12 The Remediation Floor                       reading 0:00',
      '✓ §13 --notes-file                   unchanged, not read again',
      '✓ §14 One Non-AI Body: Dropping [re… unchanged, not read again',
      '✓ §15 Chunked Notes at the Review G… unchanged, not read again',
      '◐ §16 Progress Narration                          reading 0:00',
      '✓ §17 mint commit\'s AI-Failure Outp… unchanged, not read again',
      '◐ §18 Documentation and the Setup Guide           reading 0:00',
      '◐ Tests held against the specification            reading 0:00',
      '',
      'NOT PROVEN ──────────────────────────────── 9 could not be run',
      '△ Afterwards notes.md is still untracked with its contents un…',
      '△ afterwards the file carries the same edits, staged if they …',
      '△ The notes file stays in the work tree through the run with …',
      '△ the file that path names is the one left out of the clean-t…',
      '△ In each case HEAD is back at the starting commit, and the r…',
      '△ Given that file, --autostash with other uncommitted changes…',
      '△ diff.noprefix = true, custom diff.srcPrefix/diff.dstPrefix …',
      '△ Given either warning, carrying out the steps it names, in t…',
      '△ A tracked .mint.toml, one a .gitignore rule matches include…',
      '',
      'TO THE INBOX ─────────────────────────────── 1 · Claude\'s call',
      '» The file header still says processOneVersion returns "a per…',
      '',
      'VERDICT ─────────────────────────────────────────────────────',
      '○ once every area is read',
    ])
  })

  test('N2, N4: round 1 under way — FOUND each finding its landed reports hold, "found" not "in scope", marked by its call, each opening its page by its report item; its checks not proven at the change\'s tips, each opening its page; nothing to the inbox yet', () => {
    const reading = review({
      round: 1,
      finish: false,
      recorded: false,
      verdict: null,
      fixes: null,
      inbox: [],
      found: [
        { round: 1, finding: null, from: '4-the-per-call-size-cap-a#1', area: '4-the-per-call-size-cap', call: 'nit', text: 'The comment above the regeneration stage says every exit closes it.' },
        { round: 1, finding: null, from: '16-progress-narration-b#1', area: '16-progress-narration', call: 'bug', text: 'In pretty mode, a failed check kills the notes stage\'s live line.' },
      ],
      not_proven: [{ round: 1, scenario: '13.S1', standing: 'not proven', text: 'Afterwards notes.md is still untracked.' }],
      areas: AREAS.map((area, at) => ({ ...area, state: at < 17 ? 'read' : 'reading', since: at < 17 ? null : '2026-10-21T14:57:42.000Z' })),
    })
    const lines = reviewLines(reading, kitAt(NOW))
    const rows = drawnRows(lines)

    expect([sectionOf(rows, 'FOUND'), sectionOf(rows, 'NOT PROVEN'), rows.some(row => row.startsWith('TO THE INBOX'))]).toEqual([
      [
        'FOUND ──────────────────────────────────────────────── 2 found',
        '△ §4 The comment above the regeneration stage says every exit…',
        '✗ §16 In pretty mode, a failed check kills the notes stage\'s …',
      ],
      ['NOT PROVEN ──────────────────────────────── 1 could not be run', '△ Afterwards notes.md is still untracked.'],
      false,
    ])
    expect(lines.filter(line => line.key.startsWith('review:found:') || line.key.startsWith('review:unproven:')).map(line => line.press)).toEqual([
      'page:finding:1:4-the-per-call-size-cap-a#1',
      'page:finding:1:16-progress-narration-b#1',
      'page:check:1:13.S1',
    ])
  })

  test('N2: what each round filed to the inbox is its own line, two rounds\' finding 2 never one key', () => {
    const filed = review({ inbox: [{ round: 1, finding: 2, text: 'A card\'s expiry is checked nowhere.' }, { round: 2, finding: 2, text: 'A refund\'s expiry is checked nowhere.' }] })
    const lines = reviewLines(filed, kitAt(NOW)).filter(line => line.key.startsWith('review:inbox:'))

    expect([lines.map(line => line.key), lines.map(line => line.press)]).toEqual([
      ['review:inbox:1:2', 'review:inbox:2:2'],
      ['page:finding:1:2', 'page:finding:2:2'],
    ])
  })

  test('the facts line once a round passes with fix tasks still to build, before finish waits, and once Claude settled the round that ended the phase (N6)', () => {
    const facts = (change: Record<string, unknown>) => drawnRows(reviewLines(review({ finish: false, ...change }), kitAt(NOW)))[2]

    expect([facts({ round: 1, verdict: 'passed' }), facts({ verdict: 'settled' })]).toEqual([
      'round 1 · 19 of 19 areas read · ✓ round 1 passes',
      'round 2 · 19 of 19 areas read · ✓ round 2 settled',
    ])
  })

  test('20.10.3, D17: each fix task opens its task\'s page, each finding recorded its own, each check recorded its own, and what went to the inbox its finding', () => {
    const lines = reviewLines(FAILED, kitAt(NOW))
    const opens = (prefix: string) => lines.filter(line => line.key.startsWith(prefix)).map(line => line.press)

    expect([opens('task:'), opens('review:found:').slice(0, 2), opens('review:unproven:').slice(0, 1), opens('review:inbox:')]).toEqual([
      ['page:task:9.1', 'page:task:9.2', 'page:task:9.3'],
      ['page:finding:1:1', 'page:finding:1:2'],
      ['page:check:1:13.S1'],
      ['page:finding:1:9'],
    ])
  })

  test('a round under way: how many areas are read and how many being read, each read with its clock, and its verdict once every area is read', () => {
    const since = '2026-10-21T14:57:42.000Z'
    const reading = review({
      round: 1,
      finish: false,
      recorded: false,
      verdict: null,
      fixes: null,
      not_proven: [],
      inbox: [],
      areas: AREAS.map((area, at) => ({ ...area, state: at < 17 ? 'read' : 'reading', since: at < 17 ? null : since })),
    })
    const rows = paneDrawn(answered(reading), { now: NOW })

    expect([rows[5], rows.filter(row => row.startsWith('◐')), rows.slice(-2)]).toEqual([
      'round 1 · 17 of 19 areas read · ◐ 2 being read',
      ['◐ §18 Documentation and the Setup Guide           reading 2:18', '◐ Tests held against the specification            reading 2:18'],
      ['VERDICT ─────────────────────────────────────────────────────', '○ once every area is read'],
    ])
  })

  test('the edge rule: in the header the title gives way with "…", "· review" never does', () => {
    expect(drawnRows(reviewLines(review({ title: 'A title long enough that it would run past the edge of the pane' }), kitAt(NOW)).slice(0, 1))).toEqual([
      'A title long enough that it would run past the edge … · review',
    ])
  })

  test('the edge rule: on the line beneath, the project\'s name gives way with "…", its type and the tasks built never do', () => {
    expect(drawnRows(reviewLines(review({ project: 'A project whose name runs long past forty characters' }), kitAt(NOW)).slice(1, 2))).toEqual([
      'A project whose name runs long pas… · feature · 99 tasks built',
    ])
  })
})

describe('a question its fix tasks wait on (S1, 20.5.3)', () => {
  const question: Question = {
    question: 'Q1',
    asks: 'Should a failed check stop the live line, or keep it running?',
    parks: [{ task: '9.1', title: 'The notes stage\'s live line after a failed check' }],
    after: [],
    since: '2026-10-21T14:00:00.000Z',
  }
  const parked = review({
    fixes: { phase: 9, round: 1, tasks: [{ task: '9.1', title: 'The notes stage\'s live line after a failed check', state: 'waits', since: null, on: ['Q1'] }] },
  }, FAILED)

  test('WAITING ON YOU stands in the review\'s This session with the question and its "▸ discuss", the fix task waiting on it', () => {
    const rows = paneDrawn(answered(parked, [question]), { now: NOW })

    expect([sectionOf(rows, 'WAITING ON YOU'), sectionOf(rows, 'FIX TASKS')]).toEqual([
      [
        'WAITING ON YOU ───────────────────────────────────────────── 1',
        '⚑ Q1 Should a failed check stop the live line, or keep it',
        '  running?',
        '     parks 9.1 · waiting 1h                          ▸ discuss',
      ],
      ['FIX TASKS · PHASE 9 ────────────────────────────── 0 of 1 done', '⚑ 9.1 The notes stage\'s live line after a failed … waits on Q1'],
    ])
  })

  test('the parked fix task\'s page lists the question with its "▸ discuss", and what it fixes', () => {
    const rows = paneDrawn({ kind: 'board', board: { ...BUILD, questions: [question], view: FIXING } as Board }, { now: NOW })

    expect([sectionOf(rows, 'WAITING ON YOU'), sectionOf(rows, 'WHAT IT FIXES')]).toEqual([
      [
        'WAITING ON YOU ──────────────────────────────────────────────',
        '⚑ Q1 Should a failed check stop the live line, or keep it',
        '  running?',
        '     parks 9.1 · waiting 1h                          ▸ discuss',
      ],
      ['WHAT IT FIXES ────────────────────────────────────────────── 1', '· In pretty mode, a failed check kills the notes stage\'s live', '  line for the rest of the stage.'],
    ])
    expect(taskLines(FIXING, kitAt(NOW)).some(line => line.key.startsWith('q:'))).toBe(false)
  })
})

describe('a finding\'s and a check\'s pages (20.10.3)', () => {
  const finding = {
    kind: 'finding',
    unit: UNIT,
    round: 1,
    finding: 3,
    area: '4-the-per-call-size-cap',
    scope: 'in',
    call: 'bug',
    text: 'The comment above the regeneration stage says every exit closes it via "success via the timed completion closure, a transport failure via the spinner-stopping AI-failure Warn …, any other failure via surface\'s StageFailed". This task added the over-cap branch at run.go:681-684.',
    fix: '9.1',
    inbox: null,
    reviewer: null,
  }

  test('a finding in scope: its opening words, whole words on three rows at most, where it went under its mark and its area, then its words in full', () => {
    expect(drawnRows(findingLines(finding, kitAt(NOW)))).toEqual([
      'The comment above the regeneration stage says every exit',
      'closes it via "success via the timed completion closure, a',
      'transport failure via the spinner-stopping AI-failure Warn …,…',
      '✗ in scope · fix task 9.1 · §4 · round 1',
      ' ────────────────────────────────────────────────────────────',
      'The comment above the regeneration stage says every exit',
      'closes it via "success via the timed completion closure, a',
      'transport failure via the spinner-stopping AI-failure Warn …,',
      'any other failure via surface\'s StageFailed". This task added',
      'the over-cap branch at run.go:681-684.',
    ])
  })

  test('D13, D19: a finding filed to the inbox wraps where it went, hung under its mark, so its area and round show whole; one dropped says so', () => {
    const went = (change: Record<string, unknown>) => {
      const rows = drawnRows(findingLines({ ...finding, area: '12-the-remediation-floor', scope: 'out', fix: null, ...change }, kitAt(NOW)))

      return rows.slice(rows.findIndex(row => /^[»–]/.test(row)), rows.findIndex(row => row.startsWith(' ─')))
    }

    expect([went({ inbox: '.leeway/.inbox/bugs/2026-10-21--process-one-version.md' }), went({ inbox: null })]).toEqual([
      ['» out of scope · filed to the inbox, Claude\'s call · §12 ·', '  round 1'],
      ['– out of scope · dropped, Claude\'s call · §12 · round 1'],
    ])
  })

  test('N4: a finding while its round is read: its opening words, that it is being read under its mark by its call, its call, area and reviewer, then its words in full', () => {
    const read = { ...finding, finding: null, scope: null, fix: null, reviewer: 'b', text: 'The comment above the regeneration stage says every exit closes it.' }

    expect(drawnRows(findingLines(read, kitAt(NOW)))).toEqual([
      'The comment above the regeneration stage says every exit',
      'closes it.',
      '✗ round 1 · being read · bug · §4 · reviewer b',
      ' ────────────────────────────────────────────────────────────',
      'The comment above the regeneration stage says every exit',
      'closes it.',
    ])
  })

  test('a check not proven: where it stands under its mark, its scenario, area and round, then its scenario\'s words', () => {
    const check = { kind: 'check', unit: UNIT, round: 1, scenario: '13.S2', standing: 'not proven', text: 'Given a notes file, when the release runs, then notes.md is still untracked.' }

    expect(drawnRows(checkLines(check, kitAt(NOW)))).toEqual([
      '△ Not proven · 13.S2 · §13 · round 1',
      ' ────────────────────────────────────────────────────────────',
      'Given a notes file, when the release runs, then notes.md is',
      'still untracked.',
    ])
  })
})
