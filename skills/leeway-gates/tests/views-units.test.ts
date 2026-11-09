import { describe, expect, test, tier } from 'claude-code/testing'

import { COLOUR, MARK, RUNNING_FRAMES, type Line } from '../hooks/draw.ts'
import type { View } from '../hooks/model.ts'
import { ALL } from '../hooks/views/all.ts'
import { EPIC, PHASE, UNIT } from '../hooks/views/unit.ts'
import { NOW, block, drawn, markOf, ownMarkOf, pressOf } from './drawing.ts'
import MINT_WORK from './fixtures/board-all.mjs'
import FUMI, { epicTopic, decidedTopics, restaged } from './fixtures/board-epic.mjs'
import MINT, { phase } from './fixtures/board-unit.mjs'

tier('user')

/** The epic's page with its stages and dates as given. */
const fumiAt = (more: object) => ({ ...FUMI, at_menu: false, set_aside: [], lately: [], ...more }) as View

describe('the epic\'s page (20.8)', () => {
  test('at its menu, This session is §20.8\'s drawing at 64 columns: its topics under DISCOVERY, where sessions are and what messages wait', () => {
    expect(drawn(EPIC, FUMI, { now: NOW }).text.slice(0, 28)).toEqual(
      block(`
Fumi · epic · at its menu
Fumi — a smarter macOS Stickies alternative: notes assigned to
specific macOS Spaces
started 17 Jul · in discussion
▰▰▰▰▰▱▱▱  9 of 15 topics decided · 5 in discussion

DISCOVERY ──────────────────────────────────── 9 of 15 decided
✓ Note model                                           decided
✓ Storage and sync                                     decided
✓ Note window                                          decided
✓ Engine architecture                                  decided
✓ Space homing                                         decided
✓ Platform support                                     decided
✓ Search and retrieval                                 decided
✓ Status and alerts                                    decided
✓ Agent surface                                        decided
◐ Management window                           36 of 36 decided
     1 message waiting
◐ Onboarding and permissions                  11 of 12 decided
     this session · 1 message waiting
◐ Commercialization                           25 of 25 decided
     1 message waiting
◐ Licensing and trial integrity               10 of 15 decided
     another session · 2 messages waiting
◐ Support and diagnostics                       0 of 6 decided
     another session
○ Build and release                                not started
     17 messages waiting
`),
    )
  })

  test('S1: what waits on the person stands under the head as WAITING ON YOU, the map restaged by what it holds, before DISCOVERY', () => {
    expect(drawn(EPIC, { ...FUMI, waiting: [restaged] } as View, { now: NOW }).text.slice(4, 9)).toEqual(
      block(`
▰▰▰▰▰▱▱▱  9 of 15 topics decided · 5 in discussion

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ Approve the map: 16 topics in this order

`).slice(0, 5),
    )
  })

  test('N4: a title too long for the head gives way with "…", the type and "at its menu" kept whole', () => {
    const long = 'Token-aware diff sizing plus graceful handling of oversized diffs'

    expect(drawn(EPIC, { ...FUMI, title: long } as View, { now: NOW }).text[0]).toBe('Token-aware diff sizing plus graceful ha… · epic · at its menu')
    expect(drawn(UNIT, { ...MINT, title: long } as View).text[0]).toBe('Token-aware diff sizing plus graceful handling of o… · feature')
  })

  test('then the specification and the build after it, what is set aside, and LATELY: an intake one row with its count, a message by its sender', () => {
    expect(drawn(EPIC, FUMI, { now: NOW }).text.slice(28)).toEqual(
      block(`

DEFINITION ──────────────────────────────────────────────────
○ Specification · waits until every topic is decided · 6 to go

DELIVERY ────────────────────────────────────────────────────
○ Build and review · after the specification

SET ASIDE ────────────────────────────────────────────────── 2
– Positioning and audience                           cancelled
↷ Website                             postponed · roadmap next

LATELY ──────────────────────────────────────────────────────
» Licensing and trial integrity took in 8 messages     20m ago
» Onboarding and permissions took in a message from Ma… 1h ago
» Onboarding and permissions sent a message to Managem… 1h ago
◐ Support and diagnostics started                      16h ago
↷ Website postponed to the roadmap · next              17h ago
✓ Started as an epic                                    17 Jul
`),
    )
  })

  test('D30: a topic under way that no session is in is sky blue and still; one a session is in, this or another, turns in seafoam', () => {
    const { lines } = drawn(EPIC, FUMI)

    expect(markOf(lines, 'epic:topic:management-window')).toEqual({ text: RUNNING_FRAMES[0], color: COLOUR.sky })
    expect(markOf(lines, 'epic:topic:licensing-and-trial-integrity')).toEqual({ text: RUNNING_FRAMES[0], color: COLOUR.running })
  })

  test('20.8.3: a topic opens on its own page; the topic the session is in is This session', () => {
    const { lines } = drawn(EPIC, FUMI)

    expect(pressOf(lines, 'epic:topic:onboarding-and-permissions')).toBe('tab:this')
    expect(pressOf(lines, 'epic:topic:build-and-release')).toBe('page:topic:build-and-release')
    expect(pressOf(lines, 'epic:aside:website')).toBe('page:topic:website')
  })

  test('20.S21: an experiment running, the topic\'s row says so, with the session in it; concluded, its report waits', () => {
    const running = fumiAt({ topics: [epicTopic('Scale and performance', 'discussing', { decided: 3, total: 5, session: 'this', experiment: { id: 'E1', running: true } })] })
    const concluded = fumiAt({ topics: [epicTopic('Scale and performance', 'discussing', { decided: 3, total: 5, experiment: { id: 'E1', running: false } })] })

    expect(drawn(EPIC, running).text).toContain('     E1 running · this session')
    expect(drawn(EPIC, concluded).text).toContain('     E1 concluded · the report waits')
  })

  test('D28, 20.11.4: the map just approved, every topic not started and the first next, discovery complete the day it was, its moment just now; the count to go wraps under its mark', () => {
    const titles = ['Note model', 'Storage and sync', 'Note window', 'Engine architecture', 'Space homing', 'Positioning and audience', 'Agent surface', 'Management window', 'Onboarding and permissions', 'Commercialization', 'Licensing and trial integrity', 'Build and release']
    const approved = fumiAt({
      at_menu: true,
      now: { phase: 'discussion', since: '2026-10-21T13:29:30' },
      progress: { decided: 0, total: 12, discussing: 0 },
      topics: titles.map((title, at) => epicTopic(title, at === 0 ? 'next' : 'not-started')),
      set_aside: [],
      lately: [{ kind: 'map-approved', at: '2026-10-21T13:29:30', topic: null, detail: '12 topics, 4 to the roadmap' }],
    })
    const { text } = drawn(EPIC, approved, { now: NOW })

    expect(text.slice(3, 9)).toEqual([
      'started 17 Jul · discovery complete 21 Oct',
      '▱▱▱▱▱▱▱▱  0 of 12 topics decided',
      '',
      'DISCOVERY ──────────────────────────────────── 0 of 12 decided',
      '○ Note model                                              next',
      '○ Storage and sync                                 not started',
    ])
    expect(text.slice(20, 23)).toEqual(['DEFINITION ──────────────────────────────────────────────────', '○ Specification · waits until every topic is decided · 12 to', '  go'])
    expect(text.at(-1)).toBe('✓ Map approved · 12 topics, 4 to the roadmap          just now')
  })

  test('N1: discovery complete on the day the map was approved only while no topic has started or been decided; once one has, in discussion', () => {
    const dated = (progress: object) => drawn(EPIC, fumiAt({ progress })).text[3]

    expect(dated({ decided: 0, total: 15, discussing: 0 })).toBe('started 17 Jul · discovery complete 17 Jul')
    expect(dated({ decided: 0, total: 15, discussing: 1 })).toBe('started 17 Jul · in discussion')
    expect(dated({ decided: 9, total: 15, discussing: 0 })).toBe('started 17 Jul · in discussion')
  })

  test('N1: at ready to build the specification waits on the person', () => {
    const ready = fumiAt({ now: { phase: 'specification', since: '2026-10-17' }, progress: { decided: 15, total: 15, discussing: 0 }, spec: { state: 'ready', session: 'other' } })
    const { text, lines } = drawn(EPIC, ready)

    expect(text[3]).toBe('started 17 Jul · specifying since 17 Oct')
    expect(text).toContain('⚑ Specification · ready to build · waits on you')
    expect(ownMarkOf(lines, 'epic:spec')).toEqual({ text: '⚑ ', color: COLOUR.needs })
  })

  test('S2: in its build, then its review, the build and review stand under way until the unit completes', () => {
    const past = (now: object, build: object) => drawn(EPIC, fumiAt({ now, progress: { decided: 15, total: 15, discussing: 0 }, spec: { state: 'complete', session: null }, build })).text
    const building = past({ phase: 'build', since: '2026-10-19' }, { state: 'building', session: 'other' })
    const reviewing = past({ phase: 'review', since: '2026-10-21' }, { state: 'reviewing', session: null })
    const complete = past({ phase: 'complete', since: '2026-10-24' }, { state: 'complete', session: null })

    expect([building[3], building.at(-4), building.at(-1)]).toEqual(['started 17 Jul · building since 19 Oct', '✓ Specification · complete', '◐ Build and review · building'])
    expect([reviewing[3], reviewing.at(-1)]).toEqual(['started 17 Jul · in review since 21 Oct', '◐ Build and review · in review'])
    expect([complete[3], complete.at(-1)]).toEqual(['started 17 Jul · complete 24 Oct', '✓ Build and review · complete'])
  })

  test('S1: the specification held by the sweep\'s map or the person\'s answer, and the build stopped or finish waiting, each flagged on its stage, saying for what', () => {
    const stages = (spec: object, build: object) => drawn(EPIC, fumiAt({ progress: { decided: 15, total: 15, discussing: 0 }, spec, build }))
    const map = stages({ state: 'map', session: 'this' }, { state: 'waits', session: null })
    const asking = stages({ state: 'asking', session: 'this' }, { state: 'waits', session: null })
    const stopped = stages({ state: 'complete', session: null }, { state: 'stopped', session: 'this' })
    const finish = stages({ state: 'complete', session: null }, { state: 'finish', session: null })

    expect([map.text.find(row => row.includes('Specification')), asking.text.find(row => row.includes('Specification')), stopped.text.at(-1), finish.text.at(-1)]).toEqual([
      '⚑ Specification · the map waits on you',
      '⚑ Specification · waits on your answer',
      '⚑ Build and review · stopped',
      '⚑ Build and review · finish waits on you',
    ])
    expect([ownMarkOf(asking.lines, 'epic:spec'), ownMarkOf(stopped.lines, 'epic:build')]).toEqual([{ text: '⚑ ', color: COLOUR.needs }, { text: '⚑ ', color: COLOUR.needs }])
  })

  test('one topic is counted as one: 1 of 1 topic decided', () => {
    expect(drawn(EPIC, fumiAt({ progress: { decided: 1, total: 1, discussing: 0 }, topics: decidedTopics('Note model') })).text[4]).toBe('▰▰▰▰▰▰▰▰  1 of 1 topic decided')
  })

  test('D30: a stage under way turns only where a session is in it', () => {
    const writing = (session: string | null) => ownMarkOf(drawn(EPIC, fumiAt({ now: { phase: 'specification', since: null }, spec: { state: 'running', words: 'being written', session } })).lines, 'epic:spec')

    expect(writing(null)).toEqual({ text: `${RUNNING_FRAMES[0]} `, color: COLOUR.sky })
    expect(writing('this')).toEqual({ text: `${RUNNING_FRAMES[0]} `, color: COLOUR.running })
  })

  test('N4: the specification being written says what it is doing as the banner and All work say it: a pass out reading', () => {
    const reading = drawn(EPIC, fumiAt({ now: { phase: 'specification', since: null }, progress: { decided: 15, total: 15, discussing: 0 }, spec: { state: 'running', words: 'pass 2 reading', session: 'this' } }))

    expect(reading.text.find(row => row.includes('Specification'))).toBe(`${RUNNING_FRAMES[0]} Specification · pass 2 reading`)
  })
})

/** WAITING ON YOU as the board's questions draw it, which are always this session's. */
const HELD: Line[] = [
  { key: 'waiting', parts: [{ text: 'WAITING ON YOU · held' }] },
  { key: 'q:Q1', parts: [{ text: '⚑ Q1 held' }] },
  { key: 'q:Q2', parts: [{ text: '⚑ Q2 held' }] },
]

describe('the unit\'s tab (20.15)', () => {
  test('20.15.1: what it is for, when it started and the phase it is in since, WAITING ON YOU as the board holds it, each phase finished on its day, and LATELY', () => {
    expect(drawn(UNIT, MINT, { waiting: HELD, now: NOW }).text).toEqual(
      block(`
Token-aware diff sizing · feature
Token-aware diff sizing plus graceful handling of oversized
diffs
started 26 Jun · building since 19 Oct
▰▰▰▱▱  3 of 5 phases complete · in build

WAITING ON YOU · held
⚑ Q1 held
⚑ Q2 held
PHASES ──────────────────────────────────────────────────────
✓ Discovery · the seed                         complete 26 Jun
✓ Discussion · 52 decisions                    complete 17 Oct
✓ Specification · 18 sections · 8 build phases complete 19 Oct
◐ Build · 58 of 68 tasks done                         building
○ Review                                       after the build

LATELY ──────────────────────────────────────────────────────
⚑ Q3 raised                                            10m ago
✗ 6.6 failed                                           18m ago
`),
    )
  })

  test('20.15.1 LATELY: each pass of the spec\'s review with what it found, each question a pass asked the person flagged, and the specification written with its counts', () => {
    const lately = [
      { kind: 'pass', at: '2026-10-21T13:20:00', topic: null, detail: '2 found 3 · 2 calls, 1 yours' },
      { kind: 'asked', at: '2026-10-21T13:10:00', topic: null, detail: "2 asked you about the halving line's part count" },
      { kind: 'spec-landed', at: '2026-10-21T13:00:00', topic: null, detail: '18 sections, 8 phases cut' },
    ]
    const { text, lines } = drawn(UNIT, { ...MINT, lately } as View, { waiting: HELD, now: NOW })

    expect(text.slice(-3)).toEqual([
      '◆ Pass 2 found 3 · 2 calls, 1 yours                    10m ago',
      "⚑ Pass 2 asked you about the halving line's part count 20m ago",
      '✓ Specification written · 18 sections, 8 phases cut    30m ago',
    ])
    expect(lines.find(line => line.key === 'unit:lately:1')?.parts[0]).toEqual({ text: MARK.needs, color: COLOUR.needs })
  })

  test('20.15.1 LATELY, a bugfix\'s: the investigation concluded, the fix direction picked, the root cause written and each experiment by its name and title, each done', () => {
    const lately = [
      { kind: 'concluded', at: '2026-10-21T13:25:00', topic: null, detail: null },
      { kind: 'fix-picked', at: '2026-10-21T13:20:00', topic: null, detail: null },
      { kind: 'root-cause', at: '2026-10-21T13:10:00', topic: null, detail: null },
      { kind: 'experiment', at: '2026-10-21T13:00:00', topic: null, detail: 'E10 Kill every session, hook on' },
    ]
    const { text, lines } = drawn(UNIT, { ...MINT, lately } as View, { waiting: HELD, now: NOW })

    expect(text.slice(-4)).toEqual([
      '✓ Investigation concluded                               5m ago',
      '✓ Fix direction picked                                 10m ago',
      '✓ Root cause written                                   20m ago',
      '✓ E10 Kill every session, hook on                      30m ago',
    ])
    expect(lines.filter(line => line.key.startsWith('unit:lately:')).map(line => line.parts[0])).toEqual(Array(4).fill({ text: MARK.done, color: COLOUR.done }))
  })

  test('19.5.9 LATELY: a unit moved to another type says what it became, above how it started', () => {
    const lately = [
      { kind: 'moved', at: '2026-10-21T13:20:00', topic: null, detail: 'feature' },
      { kind: 'created', at: '2026-10-21T13:00:00', topic: null, detail: 'quick-fix' },
    ]

    expect(drawn(UNIT, { ...MINT, lately } as View, { waiting: HELD, now: NOW }).text.slice(-2)).toEqual([
      '✓ Became a feature                                     10m ago',
      '✓ Started as a quick-fix                               30m ago',
    ])
  })

  test('20.3.7: a phase the session is in opens This session; a finished phase that reads in full opens its page; any other presses nothing', () => {
    const { lines } = drawn(UNIT, MINT, { waiting: HELD })

    expect(lines.filter(line => line.key.startsWith('unit:phase:')).map(line => line.press)).toEqual(['page:phase:discovery', 'page:phase:discussion', undefined, 'tab:this', undefined])
  })

  test('D30: a phase under way turns only where a session is in it', () => {
    const elsewhere = { ...MINT, here: false, phases: (MINT.phases as object[]).map(held => ({ ...held, session: null })) } as View

    expect(markOf(drawn(UNIT, MINT).lines, 'unit:phase:build')).toEqual({ text: RUNNING_FRAMES[0], color: COLOUR.running })
    expect(markOf(drawn(UNIT, elsewhere).lines, 'unit:phase:build')).toEqual({ text: RUNNING_FRAMES[0], color: COLOUR.sky })
  })

  test('S3: another unit\'s page lists its own questions by their words, never the ones the board holds for this session, though their numbers match', () => {
    const other = { ...MINT, unit: 'rate-limit-aware-publish', title: 'Rate-limit-aware publish', here: false, waiting: [{ kind: 'question', id: 'Q1', text: 'Q1 Should a rate-limited publish wait for the reset?', page: 'task:2.1' }] } as View
    const { text } = drawn(UNIT, other, { waiting: HELD })

    expect(text.slice(6, 8)).toEqual(['WAITING ON YOU ───────────────────────────────────────────── 1', '⚑ Q1 Should a rate-limited publish wait for the reset?'])
    expect(text.join('\n')).not.toContain('held')
  })

  test('on the session\'s own unit, the questions the board holds stand first, and what is asked in the conversation beside them is listed under its own heading, counted alone', () => {
    const both = {
      ...MINT,
      waiting: [
        { kind: 'question', id: 'Q1', text: 'Q1 Should the diff keep its header?', page: 'task:2.1' },
        { kind: 'raised', id: 'Kp2wQx', text: 'Should an oversized diff still be sent?', page: null },
      ],
    } as View

    expect(drawn(UNIT, both, { waiting: HELD }).text.slice(6, 11)).toEqual(
      block(`
WAITING ON YOU · held
⚑ Q1 held
⚑ Q2 held
WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ Should an oversized diff still be sent?
`),
    )
  })

  test('in its specification, a gap is asked in the conversation and the phase waits on the person; the phase after waits on it', () => {
    const specifying = {
      ...MINT,
      now: { phase: 'specification', since: '2026-10-17T12:00:00' },
      progress: { complete: 2, total: 5 },
      waiting: [{ kind: 'gap', id: 'g1', text: "The halving progress line's part count", page: 'pass:4:F2' }],
      phases: [...(MINT.phases as object[]).slice(0, 2), phase('specification', 'waits', '18 sections · 4 passes'), phase('build', 'later'), phase('review', 'later')],
    } as View

    expect(drawn(UNIT, specifying, { waiting: HELD }).text.slice(3, 15)).toEqual(
      block(`
started 26 Jun · specifying since 17 Oct
▰▰▱▱▱  2 of 5 phases complete · in specification

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ The halving progress line's part count

PHASES ──────────────────────────────────────────────────────
✓ Discovery · the seed                         complete 26 Jun
✓ Discussion · 52 decisions                    complete 17 Oct
⚑ Specification · 18 sections · 4 passes          waits on you
○ Build                                after the specification
○ Review                                       after the build
`),
    )
  })

  test('N1: at ready to build, its yes waits on the person, the phase with it', () => {
    const ready = {
      ...MINT,
      now: { phase: 'specification', since: '2026-10-17T12:00:00' },
      waiting: [{ kind: 'ready', id: 'ready-to-build', text: 'Ready to build: the outline and the phase cut, for your yes', page: null }],
      phases: [...(MINT.phases as object[]).slice(0, 2), phase('specification', 'waits', '18 sections · 8 build phases'), phase('build', 'later'), phase('review', 'later')],
    } as View
    const { text } = drawn(UNIT, ready, { waiting: HELD })

    expect(text.slice(6, 8)).toEqual(['WAITING ON YOU ───────────────── 1 · asked in the conversation', '⚑ Ready to build: the outline and the phase cut, for your yes'])
    expect(text).toContain('⚑ Specification · 18 sections · 8 build phases    waits on you')
  })

  test('S1: its build stopped, flagged as stopped; its review waiting on finish, flagged, finish listed under what waits; approve the map listed with what it holds, discovery flagged', () => {
    const at = (phases: object[], waiting: object[] = []) => drawn(UNIT, { ...MINT, here: false, waiting, phases: [...(MINT.phases as object[]).slice(0, 3), ...phases] } as View).text
    const stopped = at([phase('build', 'stopped', '62 of 68 tasks done'), phase('review', 'later')])
    const finish = at([phase('build', 'complete', '99 tasks done', { on: '2026-10-21T12:00:00' }), phase('review', 'waits', 'round 2')], [{ kind: 'finish', id: 'finish', text: 'Finish: the report of every round, and your verdict on each call you changed', page: null }])
    const shaping = drawn(UNIT, {
      ...MINT,
      type: 'epic',
      here: false,
      now: { phase: 'discovery', since: null },
      waiting: [{ kind: 'map', id: 'approve-the-map', text: 'Approve the map: 12 topics in this order, and 4 to the roadmap', page: null }],
      phases: [phase('discovery', 'waits', '12 topics'), phase('discussion', 'later', 'once the map is approved'), phase('specification', 'later', 'once every topic is decided'), phase('build', 'later'), phase('review', 'later')],
    } as View).text

    expect(stopped).toContain('⚑ Build · 62 of 68 tasks done                          stopped')
    expect(finish).toContain('⚑ Review · round 2                                waits on you')
    expect(finish).toContain('⚑ Finish: the report of every round, and your verdict on each')
    expect(shaping.slice(6, 13)).toEqual(
      block(`
WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ Approve the map: 12 topics in this order, and 4 to the
  roadmap

PHASES ──────────────────────────────────────────────────────
⚑ Discovery · 12 topics                           waits on you
○ Discussion                          once the map is approved
`),
    )
  })

  test('in its review, the build complete on its day and the review under way', () => {
    const reviewing = {
      ...MINT,
      now: { phase: 'review', since: '2026-10-21T10:00:00' },
      progress: { complete: 4, total: 5 },
      waiting: [],
      phases: [...(MINT.phases as object[]).slice(0, 3), phase('build', 'complete', '99 tasks done', { on: '2026-10-21T10:00:00' }), phase('review', 'running', 'round 1', { doing: 'reviewing', session: 'this' })],
      lately: [],
    } as View

    expect(drawn(UNIT, reviewing).text.slice(3)).toEqual(
      block(`
started 26 Jun · in review since 21 Oct
▰▰▰▰▱  4 of 5 phases complete · in review

PHASES ──────────────────────────────────────────────────────
✓ Discovery · the seed                         complete 26 Jun
✓ Discussion · 52 decisions                    complete 17 Oct
✓ Specification · 18 sections · 8 build phases complete 19 Oct
✓ Build · 99 tasks done                        complete 21 Oct
◐ Review · round 1                                   reviewing
`),
    )
  })

  test('20.15.2: a bugfix investigating since its discovery closed, its progress line naming no phase', () => {
    const bugfix = {
      ...MINT,
      title: 'killing-all-sessions-wipes-restore-state',
      type: 'bugfix',
      about: '',
      started: '2026-08-16',
      now: { phase: 'investigation', since: '2026-08-16T10:00:00' },
      progress: { complete: 1, total: 5 },
      waiting: [],
      phases: [
        phase('discovery', 'complete', 'from your inbox note', { on: '2026-08-16T10:00:00', page: true }),
        phase('investigation', 'running', '6 hypotheses', { doing: 'investigating', session: 'this' }),
        phase('specification', 'later'),
        phase('build', 'later'),
        phase('review', 'later'),
      ],
      lately: [],
    } as View

    expect(drawn(UNIT, bugfix).text.slice(1, 3)).toEqual(['started 16 Aug · investigating since 16 Aug', '▰▱▱▱▱  1 of 5 phases complete'])
    expect(drawn(UNIT, bugfix).text).toContain('✓ Discovery · from your inbox note             complete 16 Aug')
  })

  test('20.15.2, 20.15.3: a quick-fix\'s discovery and implementation, its one session, counting its fixes and building', () => {
    const quickfix = {
      ...MINT,
      title: 'm-marks-highlighted-on-entry',
      type: 'quick-fix',
      about: '',
      started: '2026-07-15',
      now: { phase: 'implementation', since: '2026-07-15T09:00:00' },
      progress: { complete: 1, total: 2 },
      waiting: [],
      phases: [phase('discovery', 'complete', 'your note, confirmed', { on: '2026-07-15T09:00:00', page: true }), phase('implementation', 'running', '0 of 1 done', { doing: 'building', session: 'this' })],
      lately: [],
    } as View

    expect(drawn(UNIT, quickfix).text).toEqual(
      block(`
m-marks-highlighted-on-entry · quick-fix
started 15 Jul · one session
▰▱  1 of 2 phases complete

PHASES ──────────────────────────────────────────────────────
✓ Discovery · your note, confirmed             complete 15 Jul
◐ Implementation · 0 of 1 done                        building
`),
    )
  })

  test('E6: a migrated unit of a retired type waits on the migration\'s cut, its progress line naming no phase', () => {
    const migrated = {
      ...MINT,
      title: 'error-envelope',
      type: 'cross-cutting',
      about: '',
      started: '2026-05-02',
      now: { phase: 'cut', since: null },
      progress: { complete: 1, total: 1 },
      waiting: [],
      phases: [phase('discovery', 'complete', 'the seed', { on: '2026-05-02T09:00:00', page: true })],
      lately: [],
    } as View

    expect(drawn(UNIT, migrated).text.slice(0, 3)).toEqual(['error-envelope · cross-cutting', 'started 2 May · waiting on the migration\'s cut', '▰  1 of 1 phase complete'])
  })

  test('20.15.2: an epic\'s while its discovery runs, before any topic exists — discovery under way, then what each phase waits on, the build and review one stage', () => {
    const shaping = {
      kind: 'unit',
      unit: 'fumi',
      title: 'Fumi',
      type: 'epic',
      about: '',
      started: '2026-07-17',
      now: { phase: 'discovery', since: null },
      at_menu: false,
      here: true,
      progress: { complete: 0, total: 5 },
      waiting: [],
      phases: [
        phase('discovery', 'running', '3 topics', { doing: 'shaping', session: 'this' }),
        phase('discussion', 'later', 'once the map is approved'),
        phase('specification', 'later', 'once every topic is decided'),
        phase('build', 'later'),
        phase('review', 'later'),
      ],
      lately: [],
    } as View

    expect(drawn(UNIT, shaping).text).toEqual(
      block(`
Fumi · epic
started 17 Jul · in discovery
▱▱▱▱  0 of 4 phases complete

PHASES ──────────────────────────────────────────────────────
◐ Discovery · 3 topics                                 shaping
○ Discussion                          once the map is approved
○ Specification                    once every topic is decided
○ Build and review                     after the specification
`),
    )
  })
})

describe('a finished phase read in full (20.15.3)', () => {
  test('a linear unit\'s discovery opens on the note it began from, closed on its day', () => {
    const page = { kind: 'phase', unit: 'token-aware-diff-sizing', title: 'Token-aware diff sizing', phase: 'discovery', on: '2026-06-26', words: 'the seed', sections: [{ heading: 'The seed', text: 'When a release has a big diff, mint release fails hard.\n\nThe guard counts lines, not tokens.' }] }

    expect(drawn(PHASE, page).text).toEqual([
      'Discovery · Token-aware diff sizing',
      '✓ complete 26 Jun · the seed',
      '',
      'THE SEED ─────────────────────────────────────────────────── 2',
      'When a release has a big diff, mint release fails hard.',
      'The guard counts lines, not tokens.',
    ])
  })

  test('its discussion on its decisions, each its question with its answer, DECISIONS in sage', () => {
    const page = { kind: 'phase', unit: 'u', title: 'Token-aware diff sizing', phase: 'discussion', on: '2026-10-17T12:00:00', words: '2 decisions', sections: [{ heading: 'Decisions', text: 'Oversize Knob: No setting.\n\nWhen the Merge Fails: No concatenation rung.' }] }
    const { text, lines } = drawn(PHASE, page)

    expect(text.slice(1)).toEqual(['✓ complete 17 Oct · 2 decisions', '', 'DECISIONS ────────────────────────────────────────────────── 2', 'Oversize Knob: No setting.', 'When the Merge Fails: No concatenation rung.'])
    expect(markOf(lines, 'phase:0')?.color).toBe(COLOUR.done)
  })
})

describe('All work (20.16)', () => {
  test('is §20.16\'s drawing at 64 columns, a unit\'s second line wrapping under its indent, a topic postponed out of an epic named with the epic, each inbox item one line', () => {
    expect(drawn(ALL, MINT_WORK).text).toEqual(
      block(`
All work · Mint
3 in progress · ⚑ 5 waiting on you · 2 complete

IN PROGRESS ──────────────────────────────────────────────── 3
◐ Token-aware diff sizing                          ⚑ 3 waiting
     feature · build · 58 of 68 tasks done · this session
◐ Rate-limit-aware publish                         ⚑ 2 waiting
     feature · specification · pass 2 waits on you · another
     session
○ Publish failure swallows gh stderr
     bugfix · investigation

ROADMAP ──────────────────────────────────────────── 3 waiting
Next
◇ Headline first release notes
◇ Changelog site · postponed from Release notes overhaul
Later
◇ Agent guide for running releases

INBOX ──────────────────────────────────────── 1 idea · 2 bugs
◇ Mint CLI UI/UX overhaul
✗ Single-version regenerate prepends changelog entry at top i…
✗ Publish heal hint: wrong diagnosis, wrong command form

COMPLETE ──────────────────────────────────────────── 2 ▸ show
`),
    )
  })

  test('a unit opens its page; this session\'s opens its tab; COMPLETE opens to its units', () => {
    const { lines } = drawn(ALL, MINT_WORK)
    const opened = drawn(ALL, MINT_WORK, { opened: ['all:complete'] }).text

    expect(lines.filter(line => line.press !== undefined).map(line => line.press)).toEqual(['tab:unit', 'page:unit:rate-limit-aware-publish', 'page:unit:publish-failure'])
    expect(opened.slice(-5)).toEqual(['COMPLETE ──────────────────────────────────────────── 2 ▾ hide', '✓ Release notes overhaul', '     epic', '✓ Tag signing', '     feature'])
  })

  test('N4: a postponed topic\'s title too long for its row gives way with "…", the epic it came from kept whole', () => {
    const long = { ...MINT_WORK, roadmap: [{ horizon: 'Next', items: [{ title: 'A website for the app, with its pricing and its download', from: 'Fumi' }] }] } as View

    expect(drawn(ALL, long).text).toContain('◇ A website for the app, with its prici… · postponed from Fumi')
  })

  test('D34: quick-fixes are counted as their own kind, each marked ◇', () => {
    const { text } = drawn(ALL, { ...MINT_WORK, inbox: [{ kind: 'idea', title: 'Fumi stacks' }, { kind: 'quick-fix', title: 'Tidy the footer' }] } as View)

    expect(text).toContain('INBOX ────────────────────────── 1 idea · 0 bugs · 1 quick-fix')
    expect(text).toContain('◇ Tidy the footer')
  })

  test('D35: the epic at its menu after the map is approved, this session in it', () => {
    const fumi = { ...MINT_WORK, project: 'Fumi', waiting: 0, units: [{ unit: 'fumi', title: 'Fumi', type: 'epic', phase: 'discussion', standing: '0 of 12 topics decided', waiting: 0, session: 'this' }], complete: [] } as View

    expect(drawn(ALL, fumi).text.slice(0, 6)).toEqual(['All work · Fumi', '1 in progress · 0 complete', '', 'IN PROGRESS ──────────────────────────────────────────────── 1', '◐ Fumi', '     epic · discussion · 0 of 12 topics decided · this session'])
  })

  test('at the start menu it says so; a project\'s name too long for the head gives way with "…", never where the session stands', () => {
    expect(drawn(ALL, { ...MINT_WORK, at_start: true } as View).text[0]).toBe('All work · Mint · at the start menu')
    expect(drawn(ALL, { ...MINT_WORK, project: 'Agentic Engineering Workflows for Claude Code', at_start: true } as View).text[0]).toBe('All work · Agentic Engineering Workflows … · at the start menu')
  })
})
