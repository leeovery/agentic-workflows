/**
 * The specification on the board (20.9): This session while the session is
 * in a specification, and a section's page, a pass's and a finding's
 * (20.9.2).
 *
 * Its facts line ends in where the review stands, and wraps rather than lose
 * those words at the edge, as each gap's and call's facts do under their
 * indent. WAITING ON YOU lists what waits on the person in the unit, the
 * engine's one list: each gap asked in the conversation, never queued, with
 * its facts, ready to build while it waits on the person's yes, and any
 * other wait by its words, each opening its page where it has one. A
 * pass's findings each stand with the person: ⚑ while the question it was
 * asked as waits on them, ✓ once they answered it, ◇ Claude's call (D23).
 */
import { COLOUR, INDENT, MARK, blank, counted, heading, prose, spread, type Kit, type Line, type Part } from '../draw.ts'
import type { View } from '../model.ts'
import { pageKey } from '../pane.ts'
import type { ViewDrawing } from './index.ts'
import { READ, factLines, header, section, sectionsOf, titled } from './words.ts'

type Section = { number: string; title: string; changed_by: number[]; reading: boolean }
type Pass = { pass: number; found: number; calls: number; yours: number; state: 'running' | 'landed' | 'lost' | 'read'; since: string | null; reads: string[] | null }
type Gap = { kind: string; id: string; text: string; page: string | null; pass: number | null; finding: string | null; sections: string[] }
type Call = { id: string; text: string; question: string | null; pass: number | null; finding: string | null; sections: string[] }
type Standing = 'waits' | 'yours' | 'claude'
type Cut = { phase: number; name: string; scenarios: number; sections: string[] }

type Spec = {
  unit: string
  title: string
  type: string
  project: string
  sections: Section[]
  passes: Pass[]
  waiting: Gap[]
  since: Call[]
  cut: Cut[]
}

/** The pass out, where one is. */
const outOf = ({ passes: [latest] }: Spec) => (latest === undefined || latest.state === 'read' ? null : latest)

/** The passes reported. */
const reportedOf = ({ passes }: Spec) => passes.filter(({ state }) => state === 'read')

/** The gaps waiting on the person. */
const gapsOf = ({ waiting }: Spec) => waiting.filter(({ kind }) => kind === 'gap')

/** Whether ready to build waits on the person's yes, as the engine lists it. */
const isReady = ({ waiting }: Spec) => waiting.some(({ kind }) => kind === 'ready')

/** Where the review stands, at the end of the facts line. */
function standingOf(view: Spec, kit: Kit): Part[] {
  const out = outOf(view)
  const next = reportedOf(view).length + 1

  if (out?.state === 'running') {
    return [kit.spinner(), { text: ` pass ${out.pass} reading`, color: COLOUR.running }]
  }

  if (out !== null) {
    return [{ text: out.state === 'landed' ? `${MARK.round} pass ${out.pass}'s report in` : `${MARK.difference} pass ${out.pass} lost`, color: COLOUR.secondary }]
  }

  if (gapsOf(view).length > 0) {
    return [{ text: `${MARK.needs} pass ${next} waits on your answer`, color: COLOUR.needs }]
  }

  if (isReady(view)) {
    return [{ text: `${MARK.needs} ready to build, waiting on your yes`, color: COLOUR.needs }]
  }

  return view.sections.length === 0 ? [kit.spinner(), { text: ' being written', color: COLOUR.running }] : [{ text: `${MARK.waiting} pass ${next} next`, color: COLOUR.notStarted }]
}

function factsLine(view: Spec, kit: Kit): Line {
  const reported = reportedOf(view)
  const found = reported.reduce((sum, pass) => sum + pass.found, 0)
  const said = `${counted(view.sections.length, 'section')} · ${counted(view.cut.length, 'phase')} cut · ${counted(reported.length, 'pass', 'passes')}, ${found} found · `

  return { key: 'spec:facts', wraps: true, parts: [{ text: said, color: COLOUR.secondary }, ...standingOf(view, kit)] }
}

/** What a call's ▸ read opens: the finding that asked its question, else its entry. */
const readOf = ({ id, pass, finding }: { id: string; pass: number | null; finding: string | null }) => (pass === null || finding === null ? `entry:${id}` : `pass:${pass}:${finding}`)

/** A gap's or a call's lines: its words under its mark, then its facts under their indent, ▸ read on the last row — on its own row where it has no facts. */
function readLines(key: string, mark: Part, words: string, said: string, width: number, ref: string): Line[] {
  const row: Line = { key, mark: { ...mark, text: `${mark.text} ` }, wraps: true, parts: [{ text: words, color: COLOUR.body }] }

  return said === '' ? [{ ...row, button: { key: pageKey(ref), label: READ } }] : [row, ...factLines(`${key}:said`, said, width, ref)]
}

/** A gap's facts: the pass that found it and the sections it touches, each where it has one. */
const gapSaid = ({ pass, sections }: Gap) => [...(pass === null ? [] : [`found by pass ${pass}`]), ...(sections.length === 0 ? [] : [`touches ${sectionsOf(sections)}`])].join(' · ')

/** A wait other than a gap: its words under its mark, opening its page where it has one. */
const askLine = (waiting: Gap): Line => ({
  key: `spec:ask:${waiting.id}`,
  mark: { text: `${MARK.needs} `, color: COLOUR.needs },
  wraps: true,
  parts: [{ text: waiting.text, color: COLOUR.body }],
  ...(waiting.page === null ? {} : { press: pageKey(waiting.page) }),
})

/** WAITING ON YOU: what waits on the person in the unit, each gap with its facts and ▸ read, every other wait by its words. */
function waitingLines(view: Spec, width: number): Line[] {
  return section(
    heading('spec:waiting', { text: 'WAITING ON YOU', bold: true, color: COLOUR.needs }, [{ text: `${view.waiting.length} · asked in the conversation`, color: COLOUR.secondary }], width),
    view.waiting.flatMap(waiting =>
      waiting.kind === 'gap' && waiting.page !== null ? readLines(`spec:gap:${waiting.id}`, { text: MARK.needs, color: COLOUR.needs }, waiting.text, gapSaid(waiting), width, waiting.page) : [askLine(waiting)],
    ),
  )
}

/** A call's facts: the pass that asked its question and the sections it touches, else what it decided where its row shows the question; empty where neither. */
const callSaid = ({ text, question, pass, sections }: Call) =>
  [...(pass === null ? [] : [`pass ${pass}`]), ...(sections.length === 0 ? [] : [sectionsOf(sections)])].join(' · ') || (question === null ? '' : text)

function sinceLines(view: Spec, width: number): Line[] {
  return section(
    heading('spec:since', { text: 'SINCE YOU LAST LOOKED', bold: true, color: COLOUR.gold }, [{ text: `${counted(view.since.length, 'call')} by Claude`, color: COLOUR.secondary }], width),
    view.since.flatMap(call => readLines(`spec:since:${call.id}`, { text: MARK.call, color: COLOUR.gold }, call.question ?? call.text, callSaid(call), width, readOf(call))),
  )
}

/** The pass to come, while the review has not settled: waiting on an answer, else next. */
function nextLine(view: Spec): Line[] {
  const next = reportedOf(view).length + 1

  if (outOf(view) !== null || isReady(view) || view.sections.length === 0) {
    return []
  }

  const reads = next === 1 ? 'reads the whole specification' : `reads what pass ${next - 1} changed`

  return [
    {
      key: 'spec:pass:next',
      parts: [
        { text: MARK.waiting, color: COLOUR.notStarted },
        { text: ` Pass ${next}`, color: COLOUR.body },
        { text: ` · ${reads}${gapsOf(view).length > 0 ? ', once you answer' : ', next'}`, color: COLOUR.notStarted },
      ],
    },
  ]
}

function passLine(pass: Pass, kit: Kit): Line {
  const key = `spec:pass:${pass.pass}`
  const name: Part = { text: ` Pass ${pass.pass}`, color: COLOUR.body }

  if (pass.state === 'running') {
    const reads = pass.reads === null ? '' : ` · reading ${counted(pass.reads.length, 'section')} pass ${pass.pass - 1} changed`

    return { key, parts: spread([kit.spinner(), name, { text: reads, color: COLOUR.secondary }], [{ text: kit.clock(pass.since ?? ''), color: COLOUR.running }], kit.width) }
  }

  if (pass.state !== 'read') {
    const said = pass.state === 'landed' ? ' · its report in, not yet taken' : ' · lost with the conversation that sent it'

    return { key, parts: [{ text: MARK.round, color: COLOUR.violet }, name, { text: said, color: COLOUR.secondary }] }
  }

  const found: Part =
    pass.found === 0
      ? { text: ' · found nothing, changed nothing', color: COLOUR.done }
      : { text: ` · ${pass.found} found · ${counted(pass.calls, 'call')}${pass.yours > 0 ? `, ${pass.yours} yours` : ''}`, color: COLOUR.secondary }

  return {
    key,
    parts: spread([{ text: MARK.round, color: COLOUR.violet }, name, found], [], kit.width - READ.length),
    button: { key: pageKey(`pass:${pass.pass}`), label: READ },
  }
}

const reviewLines = (view: Spec, kit: Kit): Line[] => [
  heading('spec:review', { text: 'REVIEW', bold: true, color: COLOUR.violet }, [{ text: 'stops when a pass changes nothing', color: COLOUR.secondary }], kit.width),
  ...nextLine(view),
  ...view.passes.map(pass => passLine(pass, kit)),
  blank('spec:review'),
]

function sectionLines(view: Spec, kit: Kit): Line[] {
  return section(
    heading('spec:sections', { text: 'SECTIONS', bold: true, color: COLOUR.sky }, [{ text: `${view.sections.length}`, color: COLOUR.secondary }], kit.width),
    view.sections.map(held => ({
      key: `spec:section:${held.number}`,
      parts: spread(
        [held.reading ? kit.spinner() : { text: MARK.done, color: COLOUR.done }, { text: ` ${held.number.padStart(2)} ${held.title}`, color: COLOUR.body }],
        [
          held.reading
            ? { text: 'being read', color: COLOUR.running }
            : { text: held.changed_by.length === 0 ? 'unchanged' : `pass ${held.changed_by.join(', ')}`, color: COLOUR.secondary },
        ],
        kit.width,
      ),
      press: pageKey(`section:${held.number}`),
    })),
  )
}

function cutLines(view: Spec, width: number): Line[] {
  const scenarios = view.cut.reduce((sum, phase) => sum + phase.scenarios, 0)

  return section(
    heading('spec:cut', { text: 'PHASE CUT', bold: true, color: COLOUR.sky }, [{ text: `${counted(view.cut.length, 'phase')} · ${counted(scenarios, 'scenario')}`, color: COLOUR.secondary }], width),
    view.cut.flatMap(phase => [
      { key: `spec:cut:${phase.phase}`, parts: spread([{ text: `${phase.phase} `, color: COLOUR.secondary }, { text: phase.name, color: COLOUR.body }], [{ text: `${phase.scenarios}`, color: COLOUR.secondary }], width) },
      { key: `spec:cut:${phase.phase}:draws`, parts: [{ text: `${INDENT}draws on ${sectionsOf(phase.sections)}`, color: COLOUR.notStarted }] },
    ]),
  )
}

function readyLines(view: Spec, width: number): Line[] {
  const ready = isReady(view)

  return [
    heading('spec:ready', { text: 'READY TO BUILD', bold: true, color: ready ? COLOUR.needs : COLOUR.sky }, [], width),
    ready
      ? { key: 'spec:ready:row', parts: [{ text: `${MARK.needs} `, color: COLOUR.needs }, { text: 'the outline and the phase cut, put to you', color: COLOUR.body }] }
      : { key: 'spec:ready:row', parts: [{ text: `${MARK.waiting} `, color: COLOUR.notStarted }, { text: 'once a pass changes nothing', color: COLOUR.notStarted }] },
  ]
}

const specLines = (view: Spec, kit: Kit): Line[] => [
  ...header('spec', view.title, [{ text: ' · specification', color: COLOUR.secondary }], `${view.project} · ${view.type}`),
  factsLine(view, kit),
  blank('spec:head'),
  ...waitingLines(view, kit.width),
  ...sinceLines(view, kit.width),
  ...reviewLines(view, kit),
  ...sectionLines(view, kit),
  ...cutLines(view, kit.width),
  ...readyLines(view, kit.width),
]

type SectionPage = { number: string; title: string; changed_by: number[]; text: string }

/** A section read in full: its number and title, the passes that changed it, how long it is, and its words. */
function sectionPageLines(page: SectionPage, kit: Kit): Line[] {
  const changed = page.changed_by.length === 0 ? 'unchanged by the review' : `changed by pass ${page.changed_by.join(', ')}`
  const words = counted(page.text.split(/\s+/).filter(Boolean).length, 'word')

  return [...titled('section', [{ text: `§${page.number} ${page.title}`, bold: true }], [{ text: `${changed} · ${words}`, color: COLOUR.secondary }], kit.width), ...prose('section:text', page.text)]
}

/** A finding's mark and whose it is, by where it stands with the person. */
const STANDING: Readonly<Record<Standing, [Part, Part]>> = {
  waits: [{ text: MARK.needs, color: COLOUR.needs }, { text: 'waits on you', color: COLOUR.needs }],
  yours: [{ text: MARK.done, color: COLOUR.done }, { text: 'yours', color: COLOUR.secondary }],
  claude: [{ text: MARK.call, color: COLOUR.gold }, { text: "Claude's call", color: COLOUR.secondary }],
}

type Found = { finding: string; label: string; standing: Standing }
type PassPage = { title: string; pass: number; reads: string[] | null; changed: string[]; found: Found[] }

/** A pass read in full: what it read and changed, and each finding as it stands with the person, each opening its page. */
const passPageLines = (page: PassPage, kit: Kit): Line[] => [
  { key: 'pass:title', parts: [{ text: `Review pass ${page.pass}`, bold: true, color: COLOUR.violet }, { text: ` · ${page.title}`, color: COLOUR.secondary }] },
  {
    key: 'pass:reads',
    wraps: true,
    parts: [{ text: page.reads === null ? 'Read the whole specification.' : `Read what pass ${page.pass - 1} changed: ${sectionsOf(page.reads)}.`, color: COLOUR.secondary }],
  },
  { key: 'pass:changed', wraps: true, parts: [{ text: `Changed ${sectionsOf(page.changed)}.`, color: COLOUR.secondary }] },
  ...section(
    heading('pass:found', { text: 'FOUND', bold: true, color: COLOUR.violet }, [{ text: `${page.found.length}`, color: COLOUR.secondary }], kit.width),
    page.found.map(found => {
      const [mark, whose] = STANDING[found.standing]

      return { key: `pass:found:${found.finding}`, parts: spread([mark, { text: ` ${found.label}`, color: COLOUR.body }], [whose], kit.width), press: pageKey(`pass:${page.pass}:${found.finding}`) }
    }),
  ),
]

/** Where a finding stands, as its page says it. */
const STANDS: Readonly<Record<Standing, Part>> = {
  waits: { text: `${MARK.needs} yours · being asked in the conversation`, color: COLOUR.needs },
  yours: { text: `${MARK.done} yours · decided`, color: COLOUR.done },
  claude: { text: `${MARK.call} Claude's call`, color: COLOUR.gold },
}

type FindingPage = { pass: number; finding: string; label: string; lane: string; standing: Standing; sections: string[]; text: string }

/** A finding read in full: where it stands, its pass, lane and the sections it touches, and its words in the report. */
const findingPageLines = (page: FindingPage, kit: Kit): Line[] => [
  { key: 'finding:title', wraps: true, parts: [{ text: page.label === '' ? page.finding : page.label, bold: true }] },
  { key: 'finding:standing', parts: [STANDS[page.standing]] },
  {
    key: 'finding:where',
    wraps: true,
    parts: [{ text: [`pass ${page.pass}`, page.lane, ...(page.sections.length === 0 ? [] : [`touches ${sectionsOf(page.sections)}`])].join(' · '), color: COLOUR.secondary }],
  },
  heading('finding:rule', { text: '' }, [], kit.width),
  ...prose('finding:text', page.text),
]

export const SPEC: ViewDrawing = {
  lines: (view, kit) => specLines(view as View & Spec, kit),
  name: () => 'the specification',
}

export const SECTION: ViewDrawing = {
  lines: (view, kit) => sectionPageLines(view as View & SectionPage, kit),
  name: view => `§${(view as View & SectionPage).number}`,
}

export const PASS: ViewDrawing = {
  lines: (view, kit) => passPageLines(view as View & PassPage, kit),
  name: view => `pass ${(view as View & PassPage).pass}`,
}

export const SPEC_FINDING: ViewDrawing = {
  lines: (view, kit) => findingPageLines(view as View & FindingPage, kit),
  name: view => {
    const page = view as View & FindingPage

    return page.label === '' ? page.finding : page.label
  },
}
