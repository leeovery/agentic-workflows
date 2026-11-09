import { describe, expect, test, tier } from 'claude-code/testing'

import type { Line } from '../hooks/draw.ts'
import type { View } from '../hooks/model.ts'
import { QUICK_FIX } from '../hooks/views/quick-fix.ts'
import { NOW, block, drawn, pressOf, sectionOf } from './drawing.ts'
import M_MARKS from './fixtures/board-quick-fix.mjs'

tier('user')

/** The fixture's fields, as a test reads them to vary it. */
const fixture = M_MARKS as View & Record<string, any>

/** §20.14's first drawing: its one fix in review for 0:41, its first round sent back and its second being read. */
const IN_REVIEW = {
  ...fixture,
  standing: 'working',
  progress: { done: 0, total: 1 },
  waiting: [],
  fixes: [{ ...fixture.fixes[0], state: 'in-review', since: new Date(NOW - 41_000).toISOString(), rounds: { sent_back: 1, reading: 2, passed: null } }],
  record: null,
} as View

/** A fix as the view holds it. */
const fixOf = (task: string, title: string, state: string, on: string[] = []) => ({ task, title, state, since: null, on, rounds: { sent_back: 0, reading: null, passed: null } })

/** What the kit draws for the build's questions, standing in for the pane's. */
const PARKED: Line[] = [{ key: 'waiting', parts: [{ text: 'WAITING ON YOU · the build\'s questions' }] }, { key: 'blank:waiting', parts: [{ text: ' ' }] }]

describe('a quick-fix on the board (20.14)', () => {
  test('20.S23: its one fix in review is §20.14\'s first drawing at 64 columns: the change confirmed in one line, the fix with its clock and its pair\'s rounds, Claude\'s calls and the earlier decision it replaces', () => {
    const { text, holds } = drawn(QUICK_FIX, IN_REVIEW)

    expect(text).toEqual(
      block(`
M Marks Highlighted On Entry · quick-fix
Portal · from your inbox note · one session · started 15 Jul
0 of 1 done · ◐ 1.1 in review

THE CHANGE ───────────────────────────────── your note pins it
Pressing m on a highlighted session marks it as the first
multi-select selection on entry, instead of entering
multi-select mode with an empty set
✓ confirmed in one line; nothing shaped again

THE FIXES ───────────────────────────────────────────── 0 of 1
◐ 1.1 Mark the highlighted session on entry     in review 0:41
     round 1 sent back · round 2 being read

CLAUDE'S CALLS ───────────────────────────────────────────── 2
◇ The README says entering marks the highlighted row
◇ The capture harness keeps entering with a named set, as it
  did

REPLACES ────────────────────────────────── 1 · yours, earlier
↺ "m enters a real mode you can sit in with zero selected" ·
  Restore Host Terminal Windows
`),
    )
    expect(holds).toEqual({ turns: true, clocks: true })
  })

  test('its close waiting is §20.14\'s second drawing: WAITING ON YOU asked in the conversation, the fix done with the round it passed in, and the record', () => {
    expect(drawn(QUICK_FIX, M_MARKS).text).toEqual(
      block(`
M Marks Highlighted On Entry · quick-fix
Portal · from your inbox note · one session · started 15 Jul
1 of 1 done · ⚑ close waits on you

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ Close: what was proven; you changed none of Claude's calls,
  so there is no verdict to give

THE CHANGE ───────────────────────────────── your note pins it
Pressing m on a highlighted session marks it as the first
multi-select selection on entry, instead of entering
multi-select mode with an empty set
✓ confirmed in one line; nothing shaped again

THE FIXES ───────────────────────────────────────────── 1 of 1
✓ 1.1 Mark the highlighted session on entry               done
     passed its review in round 2, after 1 round of fixes

CLAUDE'S CALLS ───────────────────────────────────────────── 2
◇ The README says entering marks the highlighted row
◇ The capture harness keeps entering with a named set, as it
  did

REPLACES ────────────────────────────────── 1 · yours, earlier
↺ "m enters a real mode you can sit in with zero selected" ·
  Restore Host Terminal Windows

THE RECORD ───────────── what changed, why, what it leaves out
· What changed: entering multi-select marks the highlighted
  session; on a group header it still marks none
· Why: Entering multi-select mode by pressing m on a
  highlighted session should immediately select that session
  as the first marked item — rather than entering the mode
  with nothing selected.
· Leaves out: No change to behaviour after entry; no footer or
  banner copy change; WithInitialMultiSelect is unaffected; no
  new visual state, Paper frame, or visual gate
`),
    )
  })

  test('20.S23: a fix parked while another goes on — the build\'s WAITING ON YOU drawn by the kit, the parked fix waiting on Q1, the facts line naming each fix under way; Claude\'s raise asked in the conversation beneath it (19.5.25)', () => {
    const view = {
      ...IN_REVIEW,
      progress: { done: 0, total: 2 },
      waiting: [
        { kind: 'question', id: 'Q1', text: 'Q1 Should the help name both spellings?', page: 'task:1.2' },
        { kind: 'raised', id: 'Kp2wQx', text: 'Should --color still work?', page: null },
      ],
      fixes: [{ ...fixOf('1.1', 'Spell the flag --colour', 'building'), since: new Date(NOW - 5_000).toISOString() }, fixOf('1.2', 'Spell the help --colour', 'waits', ['Q1'])],
    } as View
    const { text } = drawn(QUICK_FIX, view, { waiting: PARKED })

    expect(text.slice(2, 9)).toEqual(
      block(`
0 of 2 done · ◐ 1.1 building · ⚑ 1.2 waits on Q1

WAITING ON YOU · the build's questions

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ Should --color still work?

`),
    )
    expect(sectionOf(text, 'THE FIXES ').slice(1)).toEqual(
      block(`
◐ 1.1 Spell the flag --colour                    building 0:05
⚑ 1.2 Spell the help --colour                      waits on Q1
`),
    )
  })

  test('a fix opens its task page, the change the note it began from, a call its entry', () => {
    const { lines } = drawn(QUICK_FIX, M_MARKS)

    expect([pressOf(lines, 'task:1.1'), pressOf(lines, 'qf:confirmed'), pressOf(lines, 'qf:call:Rd8kQe')]).toEqual(['page:task:1.1', 'page:phase:discovery', 'page:entry:Rd8kQe'])
  })

  test('several fixes\' records each stand under their title; rounds sent back are counted; a quick-fix from the roadmap says so, one with no note says nothing of where it came from; a decision of Claude\'s replaced is Claude\'s', () => {
    const record = fixture.record[0]
    const several = {
      ...fixture,
      from: 'roadmap',
      fixes: [{ ...fixture.fixes[0], state: 'in-review', rounds: { sent_back: 2, reading: null, passed: null } }],
      record: [record, { ...record, title: 'Mark none on a group header' }],
      replaces: [{ ...fixture.replaces[0], by: 'claude' }],
    } as View
    const { text } = drawn(QUICK_FIX, several)

    expect([text[1], sectionOf(text, 'THE CHANGE ')[0], sectionOf(text, 'THE FIXES ')[2], sectionOf(text, 'REPLACES ')[0]]).toEqual([
      'Portal · from the roadmap · one session · started 15 Jul',
      'THE CHANGE ─────────────────────────────── the roadmap pins it',
      '     rounds 1 to 2 sent back',
      "REPLACES ─────────────────────────────── 1 · Claude's, earlier",
    ])
    expect(text.filter(row => row === 'Mark the highlighted session on entry' || row === 'Mark none on a group header')).toHaveLength(2)
    expect(drawn(QUICK_FIX, { ...fixture, from: null } as View).text.slice(1, 5)).toEqual(['Portal · one session · started 15 Jul', '1 of 1 done · ⚑ close waits on you', '', 'WAITING ON YOU ───────────────── 1 · asked in the conversation'])
    expect(sectionOf(drawn(QUICK_FIX, { ...fixture, from: null } as View).text, 'THE CHANGE ')[0]).toBe('THE CHANGE ──────────────────────────────────────────────────')
  })
})
