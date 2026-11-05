import { describe, expect, test, tier } from 'claude-code/testing'

import { bannerParts } from '../hooks/banner.ts'
import { COLOUR, RUNNING_FRAMES } from '../hooks/draw.ts'
import type { View } from '../hooks/model.ts'
import { BRIEF, DISCOVERY, SPIKE } from '../hooks/views/discovery.ts'
import { DISCUSSION, ENTRY, MESSAGE, REVIEW_REPORT } from '../hooks/views/discussion.ts'
import { EXPERIMENT, EXPERIMENT_REPORT } from '../hooks/views/experiment.ts'
import { PASS, SECTION, SPEC, SPEC_FINDING } from '../hooks/views/spec.ts'
import { PHASE } from '../hooks/views/unit.ts'
import { NOW, block, drawn, markOf, pressOf } from './drawing.ts'
import NOTE_MODEL_BRIEF from './fixtures/board-brief.mjs'
import FUMI_DISCOVERY, { approval, mapTopic } from './fixtures/board-discovery.mjs'
import ONBOARDING, { decision } from './fixtures/board-discussion.mjs'
import E1 from './fixtures/board-experiment.mjs'
import PASS_4 from './fixtures/board-pass.mjs'
import MINT_SPEC, { READY, specSection, readPass, cutPhase } from './fixtures/board-spec.mjs'

tier('user')

describe('discovery on the board (20.11)', () => {
  test('20.S16: This session in discovery is §20.11\'s drawing at 64 columns: the map in its order, each with its summary', () => {
    expect(drawn(DISCOVERY, FUMI_DISCOVERY).text.slice(0, 25)).toEqual(
      block(`
Fumi · discovery
Fumi · epic · session 1 · started 17 Jul
10 topics on the map · 4 to the roadmap · ◐ shaping

THE MAP ─────────────────────────────── 10 · foundations first
 1 Note model
     What a fumi is: a Markdown body with a stable UID, an op…
 2 Storage and sync
     File-based Markdown store in a user-chosen folder (local…
 3 Note window
     The floating fumi as an on-screen object: near-frameless…
 4 Engine architecture
     One always-on app over a local socket; note windows, men…
 5 Space homing
     Notes remember their macOS Space and return to it across…
 6 Positioning and audience
     Positioning as a polished do-one-thing-well tool, user p…
 7 Agent surface
     The fumi CLI and MCP server over the engine socket: oper…
 8 Management window
     The main app window as an organiser (browse/search/filte…
 9 Onboarding and permissions
     First-run permission wizard for the Accessibility permis…
10 Commercialization
     One-time ~$19 plus paid major upgrades, no subscription …
`),
    )
  })

  test('20.S16: after the map, what goes to the roadmap, what was not taken, the spikes and the person\'s views', () => {
    expect(drawn(DISCOVERY, FUMI_DISCOVERY).text.slice(25)).toEqual(
      block(`

TO THE ROADMAP ────────────────────── 4 · later · with the map
◇ Fumi Sync, a hosted sync service
◇ Storage over a network: SFTP and a hosted API
◇ A fumi's colour drawn from its tags
◇ A lifetime tier

NOT TAKEN ──────────────────────────────── 3 · kept in the log
– The Mac App Store · the private Spaces APIs are an automatic
  rejection
– Importing Stickies · a blank slate, no legacy baggage
– A billing backend · the Merchant of Record covers checkout,
  tax and licences

SPIKES ───────────────────────────────────────── 1 · reference
◇ Note window · Paper · Luminous Liquid Glass and stronger ty…

YOUR VIEWS OF THE PRODUCT ──────── 2 · carried into the topics
» Clean, well-structured, beautiful, and it just works
» Modern Swift, correctness over speed, no shortcuts
`),
    )
  })

  test('20.S16: a topic on the map opens its brief; a spike its page', () => {
    const { lines } = drawn(DISCOVERY, FUMI_DISCOVERY)

    expect(pressOf(lines, 'd:topic:note-model')).toBe('page:topic:note-model')
    expect(pressOf(lines, 'd:spike:001-note-window')).toBe('page:spike:001-note-window')
  })

  test('shaping turns its ◐; nothing turns while the map waits on the person', () => {
    expect(drawn(DISCOVERY, FUMI_DISCOVERY).holds.turns).toBe(true)
    expect(drawn(DISCOVERY, { ...FUMI_DISCOVERY, waiting: [approval('10 topics in this order, and 4 to the roadmap')] } as View).holds.turns).toBe(false)
  })

  test('D27: while approve the map waits, the facts line says so whole, and WAITING ON YOU asks for the approval', () => {
    const twelve = { ...FUMI_DISCOVERY, waiting: [approval('12 topics in this order, and 4 to the roadmap')], map: [...(FUMI_DISCOVERY.map as object[]), mapTopic('Licensing', 'Licences'), mapTopic('Build and release', 'Signing')] } as View

    expect(drawn(DISCOVERY, twelve).text.slice(2, 8)).toEqual([
      '12 topics on the map · 4 to the roadmap · ⚑ the map waits on',
      'you',
      '',
      'WAITING ON YOU ───────────────── 1 · asked in the conversation',
      '⚑ Approve the map: 12 topics in this order, and 4 to the',
      '  roadmap',
    ])
  })

  test('a section with nothing in it is left out', () => {
    const bare = { ...FUMI_DISCOVERY, map: [], roadmap: [], not_taken: [], views: [], spikes: [] } as View

    expect(drawn(DISCOVERY, bare).text).toEqual(['Fumi · discovery', 'Fumi · epic · session 1 · started 17 Jul', '0 topics on the map · 0 to the roadmap · ◐ shaping'])
  })
})

describe('a topic\'s brief (20.11.2)', () => {
  test('20.S16: says the topic is decided in its discussion, not here, then its summary and each section of the brief by its heading', () => {
    expect(drawn(BRIEF, { ...NOTE_MODEL_BRIEF, messages: [] } as View).text).toEqual(
      block(`
Note model · topic 1 of 10
What discovery heard: decided in its discussion, not here

What a fumi is: a Markdown body with a stable UID, an optional
first-line-derived title, tags, and colour.

LEANS ────────────────────────────────────────────────────── 2
· Content is Markdown — a single source of truth.
· Identity = a stable per-note UID, fixed for the note's life.

PATHS NOT TAKEN ──────────────────────────────────────────── 1
· RTF / rich text — predates Markdown.

OPEN QUESTIONS ───────────────────────────────────────────── 1
· Tags: how they are created.
`),
    )
  })

  test('nothing on it is a decision: no mark of one, nor a section empty', () => {
    const { text } = drawn(BRIEF, { ...NOTE_MODEL_BRIEF, messages: [], sections: [{ heading: 'Leans', text: '- Plain text.' }, { heading: 'Paths not taken', text: '' }] } as View)

    expect(text.join('\n')).not.toMatch(/[✓◇]/)
    expect(text.filter(row => row.includes('───'))).toEqual(['LEANS ────────────────────────────────────────────────────── 1'])
  })

  test('D29: a topic not started or postponed, off the map, opens on its brief, the messages waiting for it beneath, each opening in full', () => {
    const postponed = { ...NOTE_MODEL_BRIEF, order: null, sections: [] } as View
    const { text, lines } = drawn(BRIEF, postponed)

    expect(text).toEqual([
      'Note model',
      'What discovery heard: decided in its discussion, not here',
      '',
      'What a fumi is: a Markdown body with a stable UID, an optional',
      'first-line-derived title, tags, and colour.',
      '',
      'MESSAGES WAITING ─────────────────────────────────────────── 1',
      '» The tour opens first',
      '     from Onboarding and permissions · 20 Oct           ▸ read',
    ])
    expect(lines.at(-1)?.button?.key).toBe('page:message:note-model:001-tour.md')
  })
})

describe('a spike\'s page (20.11.3)', () => {
  test('its tool, reference or canonical, where it is kept with its live link, what it showed, and the link', () => {
    const page = {
      kind: 'spike',
      unit: 'fumi',
      spike: '001-note-window',
      title: 'Note window',
      status: 'reference',
      tool: 'Paper',
      showed: 'Luminous Liquid Glass and stronger type.',
      path: 'fumi/spikes/001-note-window',
      link: 'https://paper.design/f/1',
    }

    expect(drawn(SPIKE, page).text).toEqual([
      'Note window · a spike',
      'Paper · reference · kept in fumi/spikes/001-note-window with',
      'its live link',
      '',
      'WHAT IT SHOWED ──────────────────────────────────────────────',
      'Luminous Liquid Glass and stronger type.',
      '',
      'https://paper.design/f/1',
    ])
  })
})

describe('a discussion\'s banner facts', () => {
  test('D40: messages waiting in a topic are peach, with no ⚑; what waits on the person is flagged; every other fact grey', () => {
    const parts = bannerParts({
      state: 'running',
      name: 'Fumi',
      facts: [
        { text: 'discussion', needs: false },
        { text: '1 message waiting', needs: false, waits: true },
        { text: '1 waiting on you', needs: true },
      ],
    })

    expect(parts.filter((_, at) => at % 2 === 1 && at > 1).map(({ text, color }) => [text, color])).toEqual([
      ['discussion', COLOUR.secondary],
      ['1 message waiting', COLOUR.needs],
      ['⚑ 1 waiting on you', COLOUR.needs],
    ])
  })
})

describe('a discussion on the board (20.7)', () => {
  test('This session in a discussion is §20.7\'s drawing at 64 columns: what is open, the messages waiting, Claude\'s calls since, the review rounds by their findings', () => {
    expect(drawn(DISCUSSION, ONBOARDING, { now: NOW }).text.slice(0, 21)).toEqual(
      block(`
Onboarding and permissions · discussion
Fumi · epic
▰▰▰▰▰▰▰▱  11 of 12 of yours decided · 6 calls by Claude

STILL OPEN ───────────────────────────────────────────────── 1
○ An unlicensed Fumi opens on a licence window, and setup runs
  once a licence is in
     yours · from Commercialization's message           ▸ read

MESSAGES WAITING ──────────────── 1 · raised at the next pause
» The licence window carries a "Lost your key?" link
     from Commercialization · 16 Oct                    ▸ read

SINCE YOU LAST LOOKED ─────────────────────── 1 call by Claude
◇ Pricing mention                                       ▸ read
     No price line in the walkthrough or anywhere else in fir…

REVIEWS ───────────────────────────────────────────── 3 rounds
◐ Round 3 · reading the record                    running 4:12
◆ Round 2 · 9 findings, all taken in                    ▸ read
◆ Round 1 · 7 findings, all taken in                    ▸ read
`),
    )
  })

  test('then what is decided, whose each is, and what the topic sent, each where it stands', () => {
    expect(drawn(DISCUSSION, ONBOARDING).text.slice(21)).toEqual(
      block(`

DECIDED ───────────────────────── 11 yours · 6 calls by Claude
✓ Enabling sync later                                    yours
✓ First run shape                                        yours
✓ Launch at login offer                                  yours
✓ No iCloud account state                                yours
✓ First run landing                                      yours
◇ First launch definition                        Claude's call
✓ Sample notes and sync                                  yours
◇ Login item banner                              Claude's call
✓ Sync toggle default                                    yours
◇ Who performs the restart after the Accessibil… Claude's call
◇ The engine needs Files-and-Folders access — a… Claude's call
✓ Sync offer copy                                        yours
✓ Notification permission ask                            yours
◇ Screen title                                   Claude's call
◇ Pricing mention                                Claude's call
✓ Wizard step content                                    yours
✓ Personalisation step                                   yours

SENT ─────────────────────────────────────────────────────── 2
→ Fumi is also in ⌘Tab and the Dock while the first-run wizard
  or the licence window is open
     to Management window · 21 Oct · in its mailbox
→ First run shows the product before the licence: the licence
  is a wizard step after the tour
     to Commercialization · 20 Oct · taken in
`),
    )
  })

  test('the review running turns and is clocked; nothing else in the discussion moves', () => {
    expect(drawn(DISCUSSION, ONBOARDING).holds).toEqual({ turns: true, clocks: true })
    expect(drawn(DISCUSSION, { ...ONBOARDING, reviews: (ONBOARDING.reviews as object[]).slice(1) } as View).holds).toEqual({ turns: false, clocks: false })
  })

  test('D26: once nothing of the person\'s is open the progress line says so, wrapping rather than losing it at the edge', () => {
    const settled = { ...ONBOARDING, progress: { decided: 13, yours: 13, calls: 7 }, open: [] } as View
    const { text, lines } = drawn(DISCUSSION, settled)

    expect(text.slice(2, 4)).toEqual(['▰▰▰▰▰▰▰▰  13 of 13 of yours decided · 7 calls by Claude ·', 'nothing of yours open'])
    expect(lines.find(line => line.key === 'talk:progress')?.parts.at(-1)).toEqual({ text: 'nothing of yours open', color: COLOUR.done })
  })

  test('D26: through the closing pass, the progress line ends in it turning, and nothing else running, it alone turns', () => {
    const closing = { ...ONBOARDING, progress: { decided: 13, yours: 13, calls: 7 }, open: [], closing: true, reviews: (ONBOARDING.reviews as object[]).slice(1) } as View
    const { text, lines, holds } = drawn(DISCUSSION, closing)

    expect(text.slice(2, 4)).toEqual(['▰▰▰▰▰▰▰▰  13 of 13 of yours decided · 7 calls by Claude · ◐', 'closing pass'])
    expect(lines.find(line => line.key === 'talk:progress')?.parts.slice(-2)).toEqual([
      { text: RUNNING_FRAMES[0], color: COLOUR.running },
      { text: ' closing pass', color: COLOUR.running },
    ])
    expect(holds).toEqual({ turns: true, clocks: false })
  })

  test('20.7.4: a point an experiment measures waits on it, its facts wrapping under their indent with ▸ read on the last row; a round still to raise says so', () => {
    const measuring = {
      ...ONBOARDING,
      open: [{ id: 'q2', text: 'Eager restore', from: 'Licensing and trial integrity', experiment: { id: 'E1', running: true } }],
      reviews: [{ id: 'r4', round: 4, state: 'read', since: '2026-10-21T13:00:00', findings: 2, taken: 0, waiting: 2 }],
    } as View
    const { text, lines } = drawn(DISCUSSION, measuring)

    expect(text.slice(5, 8)).toEqual(['○ Eager restore', "     yours · from Licensing and trial integrity's", '     message · E1 running                               ▸ read'])
    expect(lines.find(line => line.key === 'talk:open:q2:said')?.button?.key).toBe('page:entry:q2')
    expect(text).toContain('◆ Round 4 · 2 findings, 2 to raise                      ▸ read')
  })

  test('what the topic sent stands in its mailbox, taken in, or moved to the inbox, which is no taking in', () => {
    const sent = (stands: string) => drawn(DISCUSSION, { ...ONBOARDING, sent: [{ ...(ONBOARDING.sent as object[])[0], stands }] } as View).text.at(-1)

    expect(sent('waiting')).toBe('     to Management window · 21 Oct · in its mailbox')
    expect(sent('taken')).toBe('     to Management window · 21 Oct · taken in')
    expect(sent('inbox')).toBe('     to Management window · 21 Oct · moved to the inbox')
  })

  test('DECIDED counts what was carried over beside the person\'s and Claude\'s, and marks each carried row so', () => {
    const carried = { ...ONBOARDING, decided: [...decision('yours', 'First run shape'), ...decision('claude', 'Screen title'), ...decision('carried', 'Licence storage', 'Trial length')], sent: [] } as View
    const { text } = drawn(DISCUSSION, carried)

    expect(text.slice(-5)).toEqual([
      'DECIDED ────────── 1 yours · 1 call by Claude · 2 carried over',
      '✓ First run shape                                        yours',
      "◇ Screen title                                   Claude's call",
      '✓ Licence storage                                 carried over',
      '✓ Trial length                                    carried over',
    ])
  })

  test('a section with nothing in it is left out', () => {
    const empty = { ...ONBOARDING, open: [], messages: [], since: [], reviews: [], decided: [], sent: [] } as View

    expect(drawn(DISCUSSION, empty).text).toEqual(['Onboarding and permissions · discussion', 'Fumi · epic', '▰▰▰▰▰▰▰▱  11 of 12 of yours decided · 6 calls by Claude ·', 'nothing of yours open'])
  })
})

/** Fumi's Licensing and trial integrity, under way in another session, read from the epic's page, as the spike draws it. */
const LICENSING: View = {
  ...ONBOARDING,
  topic: 'licensing-and-trial-integrity',
  topic_title: 'Licensing and trial integrity',
  summary: 'Cryptographically-signed offline licences and how far to harden the resettable trial (device/account/backend), including Merchant-of-Record licensing options.',
  live: false,
  progress: { decided: 0, yours: 5, calls: 0 },
  open: ['Comparable mac apps', 'Trial hardening', 'Trial backend', 'Device fingerprinting', 'Account gated trial'].map((text, at) => ({ id: `q${at + 1}`, text, from: null, experiment: null })),
  messages: [
    { file: '001.md', title: "Dodo's licence keys are checked online, not verified offline: how often does Fumi check?", from: 'Commercialization', when: '20 Oct' },
    { file: '002.md', title: 'Only a refund locks Fumi, a check that cannot reach Dodo never does, and the notes are never locked', from: 'Commercialization', when: '21 Oct' },
  ],
  since: [],
  decided: [],
}

describe('a topic\'s own page (20.8.3)', () => {
  test('a topic under way is the spike\'s page: what it is for, the person\'s questions decided of theirs, what is open, bare, each opening its entry, then the messages waiting, each with its sender and ▸ read', () => {
    const { text, lines } = drawn(DISCUSSION, LICENSING)

    expect(lines.filter(line => line.key.startsWith('talk:open:')).map(line => line.press)).toEqual(LICENSING.open.map(({ id }: { id: string }) => `page:entry:${id}`))
    expect(text).toEqual(
      block(`
Licensing and trial integrity · discussion
Fumi · epic
Cryptographically-signed offline licences and how far to
harden the resettable trial (device/account/backend),
including Merchant-of-Record licensing options.
▱▱▱▱▱  0 of 5 decided

STILL OPEN ───────────────────────────────────────────────── 5
○ Comparable mac apps
○ Trial hardening
○ Trial backend
○ Device fingerprinting
○ Account gated trial

MESSAGES WAITING ─────────────────────────────────────────── 2
» Dodo's licence keys are checked online, not verified
  offline: how often does Fumi check?
     from Commercialization · 20 Oct                    ▸ read
» Only a refund locks Fumi, a check that cannot reach Dodo
  never does, and the notes are never locked
     from Commercialization · 21 Oct                    ▸ read
`),
    )
  })

  test('a decided topic\'s page counts the person\'s questions decided, lists what is decided, bare, Claude\'s calls marked ◇, each opening its entry, and says nothing of what is open', () => {
    const decided = {
      ...LICENSING,
      topic_title: 'Note model',
      summary: '',
      progress: { decided: 2, yours: 2, calls: 1 },
      open: [],
      messages: [],
      decided: [...decision('yours', 'Content format', 'A heading that runs on and on past the edge of the pane it is drawn in'), ...decision('claude', 'Markdown dialect')],
    } as View
    const { text, lines } = drawn(DISCUSSION, decided)

    expect(text).toEqual([
      'Note model · discussion',
      'Fumi · epic',
      '▰▰  2 of 2 decided',
      '',
      'DECIDED ──────────────────────────────────────────────────── 3',
      '✓ Content format',
      '✓ A heading that runs on and on past the edge of the pane it …',
      '◇ Markdown dialect',
    ])
    expect(lines.filter(line => line.press !== undefined).map(line => line.press)).toEqual(decided.decided.map(({ id }: { id: string }) => `page:entry:${id}`))
  })
})

describe('a discussion\'s pages (20.7.3)', () => {
  test('an entry opens in full, saying whose it is; a message waiting says it waits to be raised', () => {
    expect(
      drawn(ENTRY, { kind: 'entry', unit: 'fumi', id: 'c1', entry: 'decision', by: 'claude', text: 'No price line in first run.', why: 'The licence step is the only commercial moment.', question: 'Pricing mention' }).text,
    ).toEqual(['Pricing mention', "◇ Claude's call", ` ${'─'.repeat(60)}`, 'No price line in first run.', 'The licence step is the only commercial moment.'])
    expect(
      drawn(MESSAGE, { kind: 'message', unit: 'fumi', topic: 'onboarding-and-permissions', file: '001.md', title: 'The licence window carries a link', from: 'Commercialization', when: '16 Oct', text: 'The ask.' }).text.slice(0, 2),
    ).toEqual(['The licence window carries a link', '» from Commercialization · 16 Oct · waiting to be raised'])
  })

  test('a review round\'s report carries the topic it read', () => {
    const report = { kind: 'review-report', unit: 'fumi', topic: 'onboarding-and-permissions', topic_title: 'Onboarding and permissions', id: 'r2', round: 2, text: 'Nine findings.' }

    expect(drawn(REVIEW_REPORT, report).text).toEqual(['Review round 2 · Onboarding and permissions', ` ${'─'.repeat(60)}`, 'Nine findings.'])
  })
})

describe('an experiment on the board (20.13)', () => {
  test('20.S21: This session in an experiment running is §20.13\'s drawing at 64 columns: the question, the design frozen at approval with its rule, each condition\'s runs and median so far, and the topic that waits on it', () => {
    expect(drawn(EXPERIMENT, E1).text).toEqual(
      block(`
E1 What does a real fumi cost at launch?
Fumi · epic · an experiment for Scale and performance
approved 2 Sep · 26 of 40 runs · ◐ running

THE QUESTION ────────────────────── from Scale and performance
Measured so far: sixteen bare NSWindows created, placed one
per Space and shown non-activating in 242 ms total.

THE DESIGN ─────────────────────── frozen when you approved it
· Measures the time from launch to the last fumi shown on its
  Space
· 20 cold launches of 16 bare windows: the floor, again
· 20 cold launches of 25 real fumis, the top of your open set
  (~20–25)
· The rule: if the 25th real fumi is on screen in under 1
  second, eager restore stands as decided; at 1 second or
  more, placing fumis beyond the active Space lazily is open
  again.

RUNS ──────────────────────────────────────────────── 26 of 40
✓ 16 bare windows                     20 of 20 · median 0.24 s
◐ 25 real fumis                        6 of 20 · median 0.67 s

VERDICT ──────────────────────────────────── the rule, applied
○ once every run is in

WAITS ON IT ────────────────────────────────────────── 1 topic
◐ Scale and performance                   its discussion waits
`),
    )
  })

  test('D30: what runs turns, while the topic waiting on it, under way in no session, is sky blue and still', () => {
    const { lines, holds } = drawn(EXPERIMENT, E1)

    expect(markOf(lines, 'x:waits:topic')).toEqual({ text: RUNNING_FRAMES[0], color: COLOUR.sky })
    expect(holds.turns).toBe(true)
  })

  test('concluded: the verdict opens the report, the topic\'s report waits for it, and nothing turns', () => {
    const concluded = { ...E1, status: 'concluded', verdict: '0.68 s, under 1 second: eager restore stands', runs: [{ ...(E1.runs as object[])[0] }, { condition: '25 real fumis', of: 20, done: 20, median: 0.68, unit: 's' }], report: true } as View
    const { text, lines, holds } = drawn(EXPERIMENT, concluded)

    expect(text[2]).toBe('approved 2 Sep · 40 of 40 runs · ✓ concluded')
    expect(text.slice(-5)).toEqual([
      'VERDICT ──────────────────────────────────── the rule, applied',
      '✓ 0.68 s, under 1 second: eager restore stands          ▸ read',
      '',
      'WAITS ON IT ────────────────────────────────────────── 1 topic',
      '◐ Scale and performance                the report waits for it',
    ])
    expect(lines.find(line => line.key === 'x:verdict')?.button?.key).toBe('page:report:scale-and-performance:E1')
    expect(holds.turns).toBe(false)
  })

  test('a verdict too long for its row wraps under its mark, ▸ read on its first row', () => {
    const verdict = '0.68 s for the 25 real fumis, under the 1 second the rule set: eager restore stands as designed'
    const concluded = { ...E1, status: 'concluded', verdict, report: true } as View

    expect(drawn(EXPERIMENT, concluded).text.slice(-6, -3)).toEqual([
      'VERDICT ──────────────────────────────────── the rule, applied',
      '✓ 0.68 s for the 25 real fumis, under the 1 second the  ▸ read',
      '  rule set: eager restore stands as designed',
    ])
  })

  test('20.13.3: abandoned, its facts line says so with its reason', () => {
    expect(drawn(EXPERIMENT, { ...E1, status: 'abandoned', reason: 'the topic was cancelled' } as View).text.slice(2, 4)).toEqual(['approved 2 Sep · 26 of 40 runs · – abandoned: the topic was', 'cancelled'])
  })

  test('its report carries where it stands and the topic it is for', () => {
    const report = { kind: 'experiment-report', unit: 'fumi', topic: 'scale-and-performance', topic_title: 'Scale and performance', id: 'E1', status: 'concluded', text: 'Eager restore stands.' }

    expect(drawn(EXPERIMENT_REPORT, report).text).toEqual(['E1 · the report', 'concluded · for Scale and performance', ` ${'─'.repeat(60)}`, 'Eager restore stands.'])
  })
})

describe('a specification on the board (20.9)', () => {
  test('This session in a specification is §20.9\'s drawing at 64 columns: what waits with the pass that found it, each call since with its pass and sections, the review', () => {
    expect(drawn(SPEC, MINT_SPEC).text.slice(0, 28)).toEqual(
      block(`
Token-aware diff sizing · specification
Mint · feature
18 sections · 8 phases cut · 4 passes, 24 found · ⚑ pass 5
waits on your answer

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ The halving progress line's part count
     found by pass 4 · touches §16                      ▸ read

SINCE YOU LAST LOOKED ────────────────────── 4 calls by Claude
◇ r at single-version regenerate's review gate on chunked
  notes
     pass 4 · §1, 15                                    ▸ read
◇ The progress example merges fewer parts than its own halving
  left
     pass 4 · §8, 16                                    ▸ read
◇ r at regenerate --all's per-version review gate on chunked
  notes
     pass 4 · §1, 12, 15                                ▸ read
◇ The documented timeout default stays 60 seconds while ▸ read
  releases default to 180

REVIEW ───────────────────── stops when a pass changes nothing
○ Pass 5 · reads what pass 4 changed, once you answer
◆ Pass 4 · 6 found · 4 calls, 2 yours                   ▸ read
◆ Pass 3 · 5 found · 4 calls, 1 yours                   ▸ read
◆ Pass 2 · 3 found · 2 calls, 1 yours                   ▸ read
◆ Pass 1 · 10 found · 8 calls, 2 yours                  ▸ read
`),
    )
  })

  test('a gap\'s and a call\'s ▸ read open the finding that raised it, else its entry', () => {
    const { lines } = drawn(SPEC, MINT_SPEC)
    const reads = (key: string) => lines.find(line => line.key === key)?.button?.key

    expect(reads('spec:gap:g1:said')).toBe('page:pass:4:F2')
    expect(reads('spec:since:c1:said')).toBe('page:pass:4:F3')
    expect(reads('spec:since:c4')).toBe('page:entry:c4')
  })

  test('a gap that touches no section says only the pass that found it; one with neither carries ▸ read on its row', () => {
    const gaps = (...waiting: object[]) => drawn(SPEC, { ...MINT_SPEC, waiting } as View).text.slice(5, 8)

    expect(gaps({ kind: 'gap', id: 'g1', text: 'The part count', page: 'pass:4:F2', pass: 4, finding: 'F2', sections: [] })).toEqual([
      'WAITING ON YOU ───────────────── 1 · asked in the conversation',
      '⚑ The part count',
      '     found by pass 4                                    ▸ read',
    ])
    expect(gaps({ kind: 'gap', id: 'g1', text: 'The part count', page: 'entry:g1', pass: null, finding: null, sections: [] }).slice(1)).toEqual([
      '⚑ The part count                                        ▸ read',
      '',
    ])
  })

  test('then each section with the passes that changed it', () => {
    expect(drawn(SPEC, MINT_SPEC).text.slice(28, 48)).toEqual(
      block(`

SECTIONS ────────────────────────────────────────────────── 18
✓  1 Purpose and Scope                               pass 1, 4
✓  2 The Lean Default AI Command                        pass 1
✓  3 Quote-Aware ai_command Parsing                     pass 3
✓  4 The Per-Call Size Cap                           pass 1, 4
✓  5 Per-Verb Exclusion Lists                        unchanged
✓  6 The Exclusion Check                             pass 1, 3
✓  7 Routing a Release's Notes                          pass 2
✓  8 Chunked Generation                              pass 2, 4
✓  9 Failure Classification                          pass 2, 4
✓ 10 Halving After an Under-Cap Overflow                pass 3
✓ 11 Failures in a Chunked Run                       pass 1, 2
✓ 12 The Remediation Floor                     pass 1, 2, 3, 4
✓ 13 --notes-file                                    unchanged
✓ 14 One Non-AI Body: Dropping [release].fallback       pass 3
✓ 15 Chunked Notes at the Review Gate and in the Ca… pass 2, 4
✓ 16 Progress Narration                           pass 1, 3, 4
✓ 17 mint commit's AI-Failure Output                    pass 1
✓ 18 Documentation and the Setup Guide            pass 1, 3, 4
`),
    )
  })

  test('then the phase cut, each phase with its scenarios and the sections it draws on, and what ready to build waits on', () => {
    expect(drawn(SPEC, MINT_SPEC).text.slice(48)).toEqual(
      block(`

PHASE CUT ─────────────────────────── 8 phases · 610 scenarios
1 Lean default AI command and quote-aware parsing           38
     draws on §2, 3, 4, 17, 18
2 Per-call size cap and chunked release notes               77
     draws on §1, 4, 6, 7, 8, 10, 11, 12, 15, 16, 17, 18
3 \`--notes-file\` and one non-AI body                        51
     draws on §6, 7, 11, 12, 13, 14, 18
4 Failure classification, halving and saved chunk notes    101
     draws on §1, 4, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18
5 The remediation floor                                    100
     draws on §1, 2, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,…
6 Chunked notes at the review gate and in the dry-run cache 81
     draws on §1, 2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 18
7 Per-verb exclusion lists and the exclusion check         109
     draws on §2, 4, 5, 6, 7, 9, 10, 12, 13, 14, 15, 16, 17, …
8 Recording exclusion answers                               53
     draws on §5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 18

READY TO BUILD ──────────────────────────────────────────────
○ once a pass changes nothing
`),
    )
  })

  test('D21: the facts line ends in where the review stands, whole, whatever it stands at', () => {
    const facts = (view: View) => drawn(SPEC, view).text.slice(2, 4).join(' ')
    const running = { ...MINT_SPEC, waiting: [], passes: [{ pass: 5, found: 0, calls: 0, yours: 0, state: 'running', since: '2026-10-21T13:29:00', reads: ['12', '16'] }, ...(MINT_SPEC.passes as object[])] } as View

    expect(facts(MINT_SPEC)).toBe('18 sections · 8 phases cut · 4 passes, 24 found · ⚑ pass 5 waits on your answer')
    expect(facts({ ...MINT_SPEC, waiting: [] } as View)).toBe('18 sections · 8 phases cut · 4 passes, 24 found · ○ pass 5 next')
    expect(facts(running)).toBe('18 sections · 8 phases cut · 4 passes, 24 found · ◐ pass 5 reading')
    expect(facts({ ...MINT_SPEC, waiting: [READY] } as View)).toBe('18 sections · 8 phases cut · 4 passes, 24 found · ⚑ ready to build, waiting on your yes')
  })

  test('a pass reading turns and is clocked, its sections being read', () => {
    const reading = {
      ...MINT_SPEC,
      waiting: [],
      sections: (MINT_SPEC.sections as object[]).map((held, at) => ({ ...held, reading: at === 11 })),
      passes: [{ pass: 5, found: 0, calls: 0, yours: 0, state: 'running', since: '2026-10-21T13:29:00', reads: ['12', '16'] }, ...(MINT_SPEC.passes as object[])],
    } as View
    const { text, holds } = drawn(SPEC, reading)

    expect(text).toContain('◐ Pass 5 · reading 2 sections pass 4 changed              1:00')
    expect(text).toContain('◐ 12 The Remediation Floor                          being read')
    expect(holds).toEqual({ turns: true, clocks: true })
  })

  test('D24: at ready to build, WAITING ON YOU lists its yes, which READY TO BUILD puts to the person; no pass is to come', () => {
    const { text } = drawn(SPEC, { ...MINT_SPEC, waiting: [READY], since: [] } as View)

    expect(text.slice(5, 7)).toEqual(['WAITING ON YOU ───────────────── 1 · asked in the conversation', '⚑ Ready to build: the outline and the phase cut, for your yes'])
    expect(text.slice(-2)).toEqual(['READY TO BUILD ──────────────────────────────────────────────', '⚑ the outline and the phase cut, put to you'])
    expect(text.some(row => row.startsWith('○ Pass'))).toBe(false)
  })
})

describe('a specification\'s pages (20.9.2)', () => {
  test('a section opens on its page, with the passes that changed it and its words counted', () => {
    const page = { kind: 'section', unit: 'u', number: '4', title: 'The Per-Call Size Cap', changed_by: [1, 4], text: 'max_prompt_bytes replaces max_diff_lines.' }

    expect(drawn(SECTION, page).text).toEqual(['§4 The Per-Call Size Cap', 'changed by pass 1, 4 · 3 words', ` ${'─'.repeat(60)}`, 'max_prompt_bytes replaces max_diff_lines.'])
    expect(drawn(SECTION, { ...page, changed_by: [] }).text[1]).toBe('unchanged by the review · 3 words')
  })

  test('D23: a pass opens on what it read and changed, and each finding as it stands with the person, each opening its own page', () => {
    const { text, lines } = drawn(PASS, PASS_4)

    expect(text).toEqual([
      'Review pass 4 · Token-aware diff sizing',
      'Read what pass 3 changed: §3, 6, 10, 12, 14, 16, 18.',
      'Changed §1, 4, 8, 9, 12, 15, 16, 18.',
      'FOUND ────────────────────────────────────────────────────── 3',
      '✓ claude sends an oversized prompt and the API rejects … yours',
      "⚑ The halving progress line's part count          waits on you",
      "◇ r at single-version regenerate's review gate … Claude's call",
    ])
    expect(lines.filter(line => line.press !== undefined).map(line => line.press)).toEqual(['page:pass:4:F1', 'page:pass:4:F2', 'page:pass:4:F3'])
    expect(markOf(lines, 'pass:found:F2')).toEqual({ text: '⚑', color: COLOUR.needs })
    expect(drawn(PASS, { ...PASS_4, pass: 1, reads: null }).text[1]).toBe('Read the whole specification.')
  })

  test('20.9.2: a finding opens on its own page: where it stands, its pass, lane and sections, and its words', () => {
    const page = { kind: 'spec-finding', unit: 'u', pass: 4, finding: 'F2', label: "The halving progress line's part count", lane: 'gap', standing: 'waits', sections: ['16'], text: 'The line says 4 parts where 6 ran.' }

    expect(drawn(SPEC_FINDING, page).text).toEqual([
      "The halving progress line's part count",
      '⚑ yours · being asked in the conversation',
      'pass 4 · gap · touches §16',
      ` ${'─'.repeat(60)}`,
      'The line says 4 parts where 6 ran.',
    ])
    expect(drawn(SPEC_FINDING, { ...page, standing: 'yours' }).text[1]).toBe('✓ yours · decided')
    expect(drawn(SPEC_FINDING, { ...page, standing: 'claude' }).text[1]).toBe("◇ Claude's call")
  })
})
