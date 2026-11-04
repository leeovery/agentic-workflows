import { describe, expect, test, tier } from 'claude-code/testing'

import type { Answer, Board, View } from '../hooks/model.ts'
import { checkLines, findingLines, reviewLines } from '../hooks/views/review.ts'
import { drawnRows, kitAt, paneDrawn } from './drawing.ts'
import BUILD from './fixtures/board-build.mjs'
import REVIEW from './fixtures/board-review.mjs'

tier('user')

const UNIT = 'token-aware-diff-sizing'

const NOW = Date.parse('2026-10-21T15:00:00.000Z')

/** The review with `change` made to it. */
const review = (change: Record<string, unknown>): View => ({ ...REVIEW, ...change })

const answered = (view: View): Answer => ({ kind: 'board', board: { ...BUILD, place: { ...BUILD.place, phase: 'review' }, questions: [], view } as Board })

type Area = { area: string; title: string; state: string; ran: number; found: number; since: string | null }

const AREAS = REVIEW.areas as Area[]

/** Round 1 recorded failing: §4 and §16 found, three fix tasks the next phase. */
const failing = review({
  round: 1,
  finish: false,
  verdict: 'failed',
  areas: AREAS.map(area => ({ ...area, state: 'read', found: area.area === '4' || area.area === '16' ? 1 : 0 })),
  found: [
    { round: 1, finding: 3, area: '4-the-per-call-size-cap', text: 'The comment above the regeneration stage says every exit closes it.' },
    { round: 1, finding: 9, area: 'tests', text: 'assertNoTag still counts the pre-3-8 argv git tag -a.' },
  ],
  fixes: {
    phase: 9,
    round: 1,
    tasks: [
      { task: '9.1', title: 'The notes stage\'s live line after a failed check', state: 'not-started', since: null, on: [] },
      { task: '9.2', title: 'Add or repair the 4 tests the criteria name', state: 'not-started', since: null, on: [] },
      { task: '9.3', title: 'Correct the 11 comments that no longer match the code', state: 'not-started', since: null, on: [] },
    ],
  },
})

/** The rows of a section, from its heading to the next blank. */
function sectionOf(rows: readonly string[], heading: string): string[] {
  const from = rows.findIndex(row => row.startsWith(heading))

  return rows.slice(from, rows.indexOf('', from))
}

describe('the review phase\'s This session (20.10)', () => {
  test('the locked board\'s review once round 2 passed: finish waits on the person under WAITING ON YOU (D18), the areas the fixes did not change unchanged, not read again (20.S11)', () => {
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

  test('D12, D19, 20.10.2: a failing round says so whole, wrapping, its fix tasks the build\'s next phase, and its verdict hung under its mark', () => {
    const rows = paneDrawn(answered(failing), { now: NOW })

    expect([rows.slice(5, 7), sectionOf(rows, 'FIX TASKS'), rows.slice(-3)]).toEqual([
      ['round 1 · 19 of 19 areas read · ✗ round 1 fails · 3 fix tasks', 'to build'],
      [
        'FIX TASKS · PHASE 9 ────────────────────────────── 0 of 3 done',
        '○ 9.1 The notes stage\'s live line after a failed check waiting',
        '○ 9.2 Add or repair the 4 tests the criteria name      waiting',
        '○ 9.3 Correct the 11 comments that no longer match th… waiting',
      ],
      ['VERDICT ─────────────────────────────────────────────────────', '✗ round 1 fails: the fix tasks build, then every area they', '  change is read again'],
    ])
  })

  test('20.10.3, D17: each fix task opens its task\'s page, each finding its own, each check not proven its own, and what went to the inbox its finding', () => {
    const lines = reviewLines(review({ ...(failing as object), not_proven: [{ scenario: '13.S2', standing: 'not proven', text: null }], inbox: [{ finding: 17, text: 'The file header still says processOneVersion returns a per-version result.' }] }), kitAt(NOW))
    const opens = (prefix: string) => lines.filter(line => line.key.startsWith(prefix)).map(line => line.press)

    expect([opens('task:'), opens('review:found:'), opens('review:unproven:'), opens('review:inbox:')]).toEqual([
      ['page:task:9.1', 'page:task:9.2', 'page:task:9.3'],
      ['page:finding:1:3', 'page:finding:1:9'],
      ['page:check:1:13.S2'],
      ['page:finding:1:17'],
    ])
    expect(drawnRows(lines.filter(line => line.key.startsWith('review:found') || line.key.startsWith('review:unproven:')))).toEqual([
      'FOUND ───────────────────────────────────────────── 2 in scope',
      '△ §4 The comment above the regeneration stage says every exit…',
      '△ tests assertNoTag still counts the pre-3-8 argv git tag -a.',
      '△ 13.S2 not proven',
    ])
  })

  test('a round under way: how many areas are read and how many being read, each read with its clock, and its verdict once every area is read', () => {
    const since = '2026-10-21T14:57:42.000Z'
    const reading = review({
      round: 1,
      finish: false,
      recorded: false,
      verdict: null,
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
  }

  test('a finding in scope: its opening words, whole words on three rows at most, where it went and its area, then its words in full', () => {
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

  test('D13: a finding filed to the inbox wraps where it went so its area and round show whole; one dropped says so', () => {
    const went = (change: Record<string, unknown>) => {
      const rows = drawnRows(findingLines({ ...finding, area: '12-the-remediation-floor', scope: 'out', fix: null, ...change }, kitAt(NOW)))

      return rows.slice(rows.findIndex(row => /^[»–]/.test(row)), rows.findIndex(row => row.startsWith(' ─')))
    }

    expect([went({ inbox: '.leeway/.inbox/bugs/2026-10-21--process-one-version.md' }), went({ inbox: null })]).toEqual([
      ['» out of scope · filed to the inbox, Claude\'s call · §12 ·', 'round 1'],
      ['– out of scope · dropped, Claude\'s call · §12 · round 1'],
    ])
  })

  test('a check not proven: where it stands, its scenario and round, and its scenario\'s words', () => {
    const check = { kind: 'check', unit: UNIT, round: 1, scenario: '13.S2', standing: 'not proven', text: 'Given a notes file, when the release runs, then notes.md is still untracked.' }

    expect(drawnRows(checkLines(check, kitAt(NOW)))).toEqual([
      '△ Not proven · 13.S2 · round 1',
      ' ────────────────────────────────────────────────────────────',
      'Given a notes file, when the release runs, then notes.md is',
      'still untracked.',
    ])
  })
})
