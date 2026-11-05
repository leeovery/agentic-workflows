import { describe, expect, test, tier } from 'claude-code/testing'

import type { View } from '../hooks/model.ts'
import { BRIEF, DISCOVERY, SPIKE } from '../hooks/views/discovery.ts'
import { block, drawn, pressOf } from './board-text.ts'

tier('user')

const mapTopic = (title: string, summary: string) => ({ topic: title.toLowerCase().replaceAll(' ', '-'), title, summary })

/** Fumi's first discovery session, as §20.11 draws it, shaping a map of ten. */
const FUMI_DISCOVERY: View = {
  kind: 'discovery',
  unit: 'fumi',
  title: 'Fumi',
  type: 'epic',
  session: 1,
  started: '2026-07-17',
  waits: false,
  map: [
    mapTopic('Note model', 'What a fumi is: a Markdown body with a stable UID, an optional first-line-derived title'),
    mapTopic('Storage and sync', 'File-based Markdown store in a user-chosen folder (local or iCloud)'),
    mapTopic('Note window', 'The floating fumi as an on-screen object: near-frameless glass'),
    mapTopic('Engine architecture', 'One always-on app over a local socket; note windows, menu bar'),
    mapTopic('Space homing', 'Notes remember their macOS Space and return to it across relaunches'),
    mapTopic('Positioning and audience', 'Positioning as a polished do-one-thing-well tool, user personas'),
    mapTopic('Agent surface', 'The fumi CLI and MCP server over the engine socket: operations'),
    mapTopic('Management window', 'The main app window as an organiser (browse/search/filter)'),
    mapTopic('Onboarding and permissions', 'First-run permission wizard for the Accessibility permission'),
    mapTopic('Commercialization', 'One-time ~$19 plus paid major upgrades, no subscription and no trial'),
  ],
  roadmap: [
    { title: 'Fumi Sync, a hosted sync service', horizon: 'later' },
    { title: 'Storage over a network: SFTP and a hosted API', horizon: 'later' },
    { title: "A fumi's colour drawn from its tags", horizon: 'later' },
    { title: 'A lifetime tier', horizon: 'later' },
  ],
  not_taken: [
    { direction: 'The Mac App Store', why: 'the private Spaces APIs are an automatic rejection' },
    { direction: 'Importing Stickies', why: 'a blank slate, no legacy baggage' },
    { direction: 'A billing backend', why: 'the Merchant of Record covers checkout, tax and licences' },
  ],
  views: ['Clean, well-structured, beautiful, and it just works', 'Modern Swift, correctness over speed, no shortcuts'],
  spikes: [{ spike: '001-note-window', title: 'Note window', status: 'reference', tool: 'Paper', showed: 'Luminous Liquid Glass and stronger type' }],
}

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
    expect(drawn(DISCOVERY, { ...FUMI_DISCOVERY, waits: true } as View).holds.turns).toBe(false)
  })

  test('D27: while approve the map waits, the facts line says so whole, and WAITING ON YOU asks for the approval', () => {
    const twelve = { ...FUMI_DISCOVERY, waits: true, map: [...(FUMI_DISCOVERY.map as object[]), mapTopic('Licensing', 'Licences'), mapTopic('Build and release', 'Signing')] } as View

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

/** Note model's brief, as §20.11 draws it, a leaning or two of each. */
const NOTE_MODEL_BRIEF: View = {
  kind: 'brief',
  unit: 'fumi',
  topic: 'note-model',
  title: 'Note model',
  order: 1,
  of: 10,
  summary: 'What a fumi is: a Markdown body with a stable UID, an optional first-line-derived title, tags, and colour.',
  sections: [
    { heading: null, text: 'What discovery heard.' },
    { heading: 'Leans', text: '- Content is Markdown — a single source of truth.\n- Identity = a stable per-note UID,\n  fixed for the note\'s life.' },
    { heading: 'Paths not taken', text: '- RTF / rich text — predates Markdown.' },
    { heading: 'Open questions', text: '- Tags: how they are created.' },
  ],
  messages: [],
}

describe('a topic\'s brief (20.11.2)', () => {
  test('20.S16: says the topic is decided in its discussion, not here, then its summary and each section of the brief by its heading', () => {
    expect(drawn(BRIEF, NOTE_MODEL_BRIEF).text).toEqual(
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
    const { text } = drawn(BRIEF, { ...NOTE_MODEL_BRIEF, sections: [{ heading: 'Leans', text: '- Plain text.' }, { heading: 'Paths not taken', text: '' }] } as View)

    expect(text.join('\n')).not.toMatch(/[✓◇]/)
    expect(text.filter(row => row.includes('───'))).toEqual(['LEANS ────────────────────────────────────────────────────── 1'])
  })

  test('D29: a topic not started or postponed, off the map, opens on its brief, the messages waiting for it beneath, each opening in full', () => {
    const postponed = { ...NOTE_MODEL_BRIEF, order: null, sections: [], messages: [{ file: '001-tour.md', title: 'The tour opens first', from: 'Onboarding and permissions', when: '20 Oct' }] } as View
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
