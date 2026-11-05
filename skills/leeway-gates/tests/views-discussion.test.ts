import { describe, expect, test, tier } from 'claude-code/testing'

import { bannerParts } from '../hooks/banner.ts'
import { COLOUR, RUNNING_FRAMES } from '../hooks/draw.ts'
import type { View } from '../hooks/model.ts'
import { DISCUSSION, ENTRY, MESSAGE, REVIEW_REPORT } from '../hooks/views/discussion.ts'
import { NOW, block, drawn } from './board-text.ts'

tier('user')

const decision = (who: 'yours' | 'claude' | 'carried', ...texts: string[]) => texts.map((text, at) => ({ id: `${who}${at}${text.length}`, text, who }))

/** Fumi's Onboarding and permissions in its discussion, as §20.7 draws it, its third review round running for 4:12. */
const ONBOARDING: View = {
  kind: 'discussion',
  unit: 'fumi',
  title: 'Fumi',
  type: 'epic',
  topic: 'onboarding-and-permissions',
  topic_title: 'Onboarding and permissions',
  summary: 'First-run permission wizard for the Accessibility permission.',
  live: true,
  progress: { decided: 11, yours: 12, calls: 6 },
  closing: false,
  open: [{ id: 'q1', text: 'An unlicensed Fumi opens on a licence window, and setup runs once a licence is in', from: 'Commercialization', experiment: null }],
  messages: [{ file: '001-lost-key.md', title: 'The licence window carries a "Lost your key?" link', from: 'Commercialization', when: '16 Oct' }],
  since: [{ id: 'c1', text: 'No price line in the walkthrough or anywhere else in first run.', question: 'Pricing mention' }],
  reviews: [
    { id: 'r3', round: 3, state: 'running', since: '2026-10-21T13:25:48', findings: 0, taken: 0, waiting: 0 },
    { id: 'r2', round: 2, state: 'read', since: '2026-10-21T10:00:00', findings: 9, taken: 9, waiting: 0 },
    { id: 'r1', round: 1, state: 'read', since: '2026-10-20T10:00:00', findings: 7, taken: 7, waiting: 0 },
  ],
  decided: [
    ...decision('yours', 'Enabling sync later', 'First run shape', 'Launch at login offer', 'No iCloud account state', 'First run landing'),
    ...decision('claude', 'First launch definition'),
    ...decision('yours', 'Sample notes and sync'),
    ...decision('claude', 'Login item banner'),
    ...decision('yours', 'Sync toggle default'),
    ...decision('claude', 'Who performs the restart after the Accessibility grant', 'The engine needs Files-and-Folders access — and asks for it'),
    ...decision('yours', 'Sync offer copy', 'Notification permission ask'),
    ...decision('claude', 'Screen title', 'Pricing mention'),
    ...decision('yours', 'Wizard step content', 'Personalisation step'),
  ],
  sent: [
    { title: 'Fumi is also in ⌘Tab and the Dock while the first-run wizard or the licence window is open', to: 'Management window', file: '002.md', at: '2026-10-21T12:10:00', stands: 'waiting' },
    { title: 'First run shows the product before the licence: the licence is a wizard step after the tour', to: 'Commercialization', file: '001.md', at: '2026-10-20T21:18:00', stands: 'taken' },
  ],
}

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
