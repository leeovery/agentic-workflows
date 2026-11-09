import { describe, expect, test, tier } from 'claude-code/testing'

import type { View } from '../hooks/model.ts'
import { HUNT, INVESTIGATION } from '../hooks/views/investigation.ts'
import { UNIT } from '../hooks/views/unit.ts'
import { NOW, block, drawn, pressOf, sectionOf } from './drawing.ts'
import H6 from './fixtures/board-hunt.mjs'
import KILL_ALL from './fixtures/board-investigation.mjs'
import MINT, { phase } from './fixtures/board-unit.mjs'

tier('user')

const ASKED = 'A session you kill yourself: should it ever come back? Killing every one today empties the saved state and deletes its scrollback.'

/** The fixture's fields, as a test reads them to vary it. */
const fixture = KILL_ALL as View & Record<string, any>

/**
 * §20.12's first drawing: the root-cause validation read for 6:12 and the
 * question it raised waiting, before the person's ruling made H1 intended.
 */
const VALIDATING = {
  ...fixture,
  standing: 'validating-root-cause',
  waiting: [{ kind: 'raise', id: 'q9Zp1c', text: ASKED, page: null, raised_by: 'root-cause', options: null, lean_first: null }],
  decided: [],
  hypotheses: fixture.hypotheses.map((each: { name: string }) => (each.name === 'H1' ? { ...each, state: 'confirmed' } : each)),
  root_cause: { ...fixture.root_cause, validated: false },
  validations: [
    { validation: 'root-cause', effort: 'xhigh', state: 'running', since: new Date(NOW - 372_000).toISOString(), found: 0 },
    { validation: 'fix', effort: 'medium', state: 'after', since: null, found: 0 },
  ],
  since: [],
  fix_direction: { state: 'after', stepped_back: [], options: [], pick: null, fix: null },
} as View

describe('a bug\'s investigation on the board (20.12)', () => {
  test('20.S19: the fix direction waiting on the person is §20.12\'s second drawing at 64 columns: the ruling theirs, H1 intended by it, the step back and the options, Claude\'s lean marked', () => {
    expect(drawn(INVESTIGATION, KILL_ALL).text).toEqual(
      block(`
Killing All Sessions Wipes Restore State · investigation
Portal · bugfix · started 16 Aug
6 hypotheses · 3 confirmed · 10 experiments · ⚑ the fix
direction waits on you

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ Which fix: 3 options, Claude's lean first

DECIDED ──────────────────────────────────────────── 1 · yours
✓ A session you kill never comes back; a session you detach
  from does, and so do sessions ended by kill-server or a
  reboot

SYMPTOMS ─────────────────────────────────────────────────── 3
· sessions.json overwritten with an empty (or shrunken) index.
· Every saved scrollback .bin file removed by the housekeeping
  pass.
· No confirmation, no warning — the next restore simply has
  nothing to restore.

HYPOTHESES ─────────────────────────────────────── 3 confirmed
– H1 Killing every session empties the s… intended · your rule
– H2 kill-server saves an empty state                ruled out
✓ H3 The daemon's last save catches a dying server   confirmed
– H4 A real reboot finds the server already gone     ruled out
✓ H5 At reboot, sessions die before tmux does        confirmed
✓ H6 A dying tmux reads as zero sessions             confirmed

EXPERIMENTS ─────────────────────────────────────────────── 10
✓ E1 Kill every session, hook on   each kill shrank it · 3 → 0
✓ E2 Kill every session, no hook             next tick saved 0
✓ E3 kill-server, the runtime live                 5 of 5 kept
✓ E4 One SIGTERM to everything                     5 of 5 kept
✓ E5 Panes, then daemon, then server           3 sessions lost
✓ E6 Panes and daemon, server after       10 ms gap: all wiped
✓ E7 list-sessions racing a SIGTERM            2 empty answers
✓ E8 E6, every tmux call logged       every wipe a failed read
✓ E9 list-panes racing a SIGTERM               2 empty answers
✓ E10 Kill every session, hooks set        hooks reaped in 7 s

ROOT CAUSE ───────────────────────────────────────── validated
Every Portal save treats the session list tmux gives it at
that instant as the complete, authoritative truth, and acts on
it irreversibly in the same step: whatever sessions the
capture does not see are dropped from sessions.json, and the
housekeeping pass that runs inside every commit
(gcOrphanScrollback, internal/state/commit.go:39) deletes
every scrollback file the new index no longer names.

VALIDATION ─────────────────────────────────── both always run
✓ Root cause · extra-high                    2 found, acted on
○ Fix                                  after the fix direction

CLAUDE'S CALLS ───────────────────── 2 · since you last looked
◇ Restore keeps reading "no tmux" as "no sessions"; only
  saving stops trusting it
◇ Measuring a real reboot waits for your next one: the fix
  logs every session a save drops

FIX DIRECTION ────────────────────────────────────── 3 options
Stepped back first: other tools that save tmux state take a
snapshot every 15 minutes and never promise a kill is final.
1 Harden the reads, outlast the shutdown, log every drop ·
  Claude's lean
2 Read hardening alone
3 Read hardening plus hold every removal until tmux outlives
  it
`),
    )
  })

  test('20.S18: a question the root-cause validation raised is §20.12\'s first drawing: WAITING ON YOU asked in the conversation with what raised it and nothing more, the validation read with its clock, the fix direction after it', () => {
    const { text, holds } = drawn(INVESTIGATION, VALIDATING)

    expect([text.slice(2, 10), sectionOf(text, 'ROOT CAUSE ')[0], sectionOf(text, 'VALIDATION '), sectionOf(text, 'FIX DIRECTION ')]).toEqual([
      block(`
6 hypotheses · 4 confirmed · 10 experiments · ◐ validating the
root cause

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ A session you kill yourself: should it ever come back?
  Killing every one today empties the saved state and deletes
  its scrollback.
     raised by the root-cause validation
`),
      'ROOT CAUSE ─────────────────────────────────── being validated',
      block(`
VALIDATION ─────────────────────────────────── both always run
◐ Root cause · extra-high                         reading 6:12
○ Fix                                  after the fix direction
`),
      block(`
FIX DIRECTION ─────────────────────────── after the root cause
○ once the root cause is validated
`),
    ])
    expect(text.some(row => row.startsWith('DECIDED') || row.startsWith("CLAUDE'S CALLS"))).toBe(false)
    expect(holds).toEqual({ turns: true, clocks: true })
  })

  test('a question no validation raised draws no second line', () => {
    const view = { ...VALIDATING, waiting: [{ ...(VALIDATING.waiting as object[])[0], raised_by: null }] } as View

    expect(sectionOf(drawn(INVESTIGATION, view).text, 'WAITING ON YOU').slice(1)).toEqual([
      '⚑ A session you kill yourself: should it ever come back?',
      '  Killing every one today empties the saved state and deletes',
      '  its scrollback.',
    ])
  })

  test('the fix direction\'s wait says Claude\'s lean is first only where it is the first row, else marked; one the fix validation raised replacing the fix says so', () => {
    const wait = fixture.waiting[0]
    const lines = (waiting: object) => sectionOf(drawn(INVESTIGATION, { ...fixture, waiting: [{ ...wait, ...waiting }] } as View).text, 'WAITING ON YOU').slice(1)

    expect([lines({ lean_first: false }), lines({ raised_by: 'fix', options: 3 })]).toEqual([
      ["⚑ Which fix: 3 options, Claude's lean marked"],
      ["⚑ Which fix: 3 options, Claude's lean first", '     raised by the fix validation'],
    ])
  })

  test('20.15: the unit\'s tab draws a raise as the investigation does, with what raised it', () => {
    const tab = { ...MINT, type: 'bugfix', here: false, waiting: VALIDATING.waiting, phases: [phase('discovery', 'complete', 'from your inbox note'), phase('investigation', 'waits', '6 hypotheses')] } as View

    expect(sectionOf(drawn(UNIT, tab).text, 'WAITING ON YOU')).toEqual(sectionOf(drawn(INVESTIGATION, VALIDATING).text, 'WAITING ON YOU'))
  })

  test('being set out, the fix direction says so once', () => {
    const next = { ...VALIDATING, fix_direction: { state: 'next', stepped_back: [], options: [], pick: null, fix: null } } as View

    expect(sectionOf(drawn(INVESTIGATION, next).text, 'FIX DIRECTION ')).toEqual([
      'FIX DIRECTION ───────────────────────────────────────────────',
      '○ being set out',
    ])
  })

  test('picked: the person\'s pick marked and the rest set aside, the heading theirs; in their own words, the fix as they said it', () => {
    const picked = { ...fixture, standing: 'validating-fix', waiting: [], fix_direction: { ...fixture.fix_direction, state: 'picked', pick: '1', fix: 'Harden the reads.' } } as View
    const own = { ...picked, fix_direction: { ...fixture.fix_direction, state: 'picked', options: [], pick: null, fix: 'Harden the reads, and say what a save dropped.' } } as View

    expect(sectionOf(drawn(INVESTIGATION, picked).text, 'FIX DIRECTION ').slice(0, 1).concat(sectionOf(drawn(INVESTIGATION, picked).text, 'FIX DIRECTION ').slice(3))).toEqual([
      'FIX DIRECTION ────────────────────────────────────────── yours',
      '✓ Harden the reads, outlast the shutdown, log every drop ·',
      '  your pick',
      '– Read hardening alone',
      '– Read hardening plus hold every removal until tmux outlives',
      '  it',
    ])
    expect(sectionOf(drawn(INVESTIGATION, own).text, 'FIX DIRECTION ').slice(-1)).toEqual(['✓ Harden the reads, and say what a save dropped. · yours'])
    expect(drawn(INVESTIGATION, picked).text[2]).toBe('6 hypotheses · 3 confirmed · 10 experiments · ◐ validating the')
  })

  test('20.12.4: concluded, the facts line says the specification is next, and nothing turns', () => {
    const done = { ...fixture, standing: 'concluded', waiting: [], fix_direction: { ...fixture.fix_direction, state: 'picked', pick: '1', fix: 'Harden the reads.' } } as View
    const { text, holds } = drawn(INVESTIGATION, done)

    expect(text.slice(2, 4)).toEqual(['6 hypotheses · 3 confirmed · 10 experiments · ✓ concluded ·', 'the specification next'])
    expect(holds.turns).toBe(false)
  })

  test('each validation by where it stands: not started, lost, done with nothing found', () => {
    const view = {
      ...fixture,
      validations: [
        { validation: 'root-cause', effort: 'xhigh', state: 'done', since: null, found: 0 },
        { validation: 'fix', effort: 'medium', state: 'not-started', since: null, found: 0 },
      ],
    } as View
    const lost = { ...view, validations: [{ validation: 'root-cause', effort: 'xhigh', state: 'lost', since: null, found: 0 }] } as View

    expect(sectionOf(drawn(INVESTIGATION, view).text, 'VALIDATION ').slice(1)).toEqual([
      '✓ Root cause · extra-high                        nothing found',
      '○ Fix                                              not started',
    ])
    expect(sectionOf(drawn(INVESTIGATION, lost).text, 'VALIDATION ').slice(1)).toEqual(['✗ Root cause · extra-high                                 lost'])
  })

  test('20.12.2: each hypothesis, experiment, the root cause, what stepping back found, an option and a call opens its own page; a decision opens its entry', () => {
    const { lines } = drawn(INVESTIGATION, KILL_ALL)

    expect(['hunt:h:H6', 'hunt:e:E5', 'hunt:root-cause', 'hunt:fix:back', 'hunt:option:2', 'hunt:call:c1Vb6z', 'hunt:decided:r4Tn8w'].map(key => pressOf(lines, key))).toEqual([
      'page:hunt:H6',
      'page:hunt:E5',
      'page:hunt:root-cause',
      'page:hunt:stepped-back',
      'page:option:2',
      'page:entry:c1Vb6z',
      'page:entry:r4Tn8w',
    ])
  })
})

describe('the hunt\'s pages (20.12.2)', () => {
  test('a hypothesis read in full is §20.12\'s third drawing: its name and title, where it stands, the rule, each paragraph of its record', () => {
    expect(drawn(HUNT, H6).text).toEqual(
      block(`
H6 A dying tmux reads as zero sessions
confirmed
 ────────────────────────────────────────────────────────────
Basis: found in the reboot-timing trials (E5): a 10ms gap
between the daemon's SIGTERM and the server's wiped 5/5
sessions including two whose programs had survived.
Reach: any committer — the daemon's SIGTERM flush (E5, E7) and
a hook-run commit-now (E7, gap 30ms #1: 0/0 with
flush_completed=false).
`),
    )
    expect(HUNT.name(H6)).toBe('H6 A dying tmux reads as zero sessions')
  })

  test('the root cause, an experiment, the step back and an option each say where they stand', () => {
    const page = (item: Record<string, unknown>) => drawn(HUNT, { ...H6, ...item } as View).text.slice(0, 2)

    expect([
      page({ item: 'root-cause', name: null, title: '', state: 'being-validated' }),
      page({ item: 'experiment', name: 'E5', title: 'Panes, then daemon, then server', state: '3 sessions lost' }),
      page({ item: 'stepped-back', name: null, title: '', state: null }),
      page({ item: 'option', name: '1', title: 'Harden the reads', state: 'lean' }),
      page({ item: 'option', name: '2', title: 'Read hardening alone', state: 'picked' }),
      page({ item: 'option', name: '3', title: 'Hold every removal', state: 'option' }),
    ]).toEqual([
      ['Root cause', 'being validated'],
      ['E5 Panes, then daemon, then server', '3 sessions lost'],
      ['What stepping back found', 'before the options'],
      ['1 Harden the reads', "Claude's lean"],
      ['2 Read hardening alone', '✓ your pick'],
      ['3 Hold every removal', 'an option'],
    ])
  })
})
