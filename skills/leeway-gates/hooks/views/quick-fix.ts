/**
 * A quick-fix on the board (20.14): This session in its one session — its
 * header, its facts line, WAITING ON YOU, THE CHANGE, THE FIXES, CLAUDE'S
 * CALLS, REPLACES and, once the fixes are done, THE RECORD.
 *
 * Each fix is drawn as the build draws a task, its line the build's own
 * (`views/build.ts`), a press away from its page, its pair's rounds beneath
 * it. WAITING ON YOU is the build's: a question a fix's builder parked its
 * task on, a press queueing it; a question Claude raised in the
 * conversation, and the close, asked there. The facts line, which ends in
 * where it stands, wraps rather than lose those words at the edge.
 */
import { COLOUR, INDENT, MARK, blank, counted, dayOf, heading, prose, type Kit, type Line, type Part } from '../draw.ts'
import type { View } from '../model.ts'
import { pageKey } from '../pane.ts'
import { taskLineOf, taskState, waitingLines, type TaskLine, type Waiting } from './build.ts'
import type { ViewDrawing } from './index.ts'
import { header, section } from './words.ts'

type Rounds = { sent_back: number; reading: number | null; passed: number | null; settled: boolean }
type Fix = TaskLine & { rounds: Rounds }
type Replaced = { id: string; text: string; by: 'person' | 'claude'; unit_title: string }
type FixRecord = { title: string; changed: string; why: string; leaves: string }

type QuickFix = {
  title: string
  type: string
  project: string
  started: string | null
  from: 'inbox' | 'roadmap' | null
  change: string
  standing: 'working' | 'close'
  progress: { done: number; total: number; written: boolean }
  waiting: Waiting[]
  fixes: Fix[]
  calls: { id: string; text: string }[]
  replaces: Replaced[]
  record: FixRecord[] | null
}

/** Where the note it began from came from, as its header and THE CHANGE say it. */
const FROM: Readonly<Record<'inbox' | 'roadmap', [string, string]>> = {
  inbox: ['from your inbox note', 'your note pins it'],
  roadmap: ['from the roadmap', 'the roadmap pins it'],
}

/** The header's facts: the project, where it came from, its one session and when it started. */
const whereOf = (view: QuickFix) =>
  [view.project, ...(view.from === null ? [] : [FROM[view.from][0]]), 'one session', ...(view.started === null ? [] : [`started ${dayOf(view.started)}`])].join(' · ')

/** Each fix running or parked, by its number and its state as its line ends with it; the running turning. */
function underWay(view: QuickFix, kit: Kit): Part[] {
  const now = view.fixes.filter(({ state }) => state === 'building' || state === 'in-review' || state === 'waits')

  return now.flatMap((fix, at) => {
    const { text, color } = taskState({ ...fix, since: null }, kit)
    const mark: Part = fix.state === 'waits' ? { text: MARK.needs, color: COLOUR.needs } : kit.spinner()

    return [...(at === 0 ? [] : [{ text: ' · ', color: COLOUR.secondary }]), mark, { text: ` ${fix.task} ${text}`, color }]
  })
}

/** Where it stands, at the end of its facts line. */
const standingParts = (view: QuickFix, kit: Kit): Part[] =>
  view.standing === 'close' ? [{ text: `${MARK.needs} close waits on you`, color: COLOUR.needs }] : underWay(view, kit)

/** Its fixes done of all; that none is written, before the first. */
const doneOf = ({ done, total, written }: QuickFix['progress'], unit = ' done') => (written ? `${done} of ${total}${unit}` : 'no fix written yet')

function factsLine(view: QuickFix, kit: Kit): Line {
  const standing = standingParts(view, kit)
  const count = doneOf(view.progress)

  return { key: 'qf:facts', wraps: true, parts: [{ text: standing.length === 0 ? count : `${count} · `, color: COLOUR.secondary }, ...standing] }
}

const changeLines = (view: QuickFix, width: number): Line[] => [
  heading('qf:change', { text: 'THE CHANGE', bold: true, color: COLOUR.sky }, view.from === null ? [] : [{ text: FROM[view.from][1], color: COLOUR.secondary }], width),
  ...prose('qf:change:text', view.change),
  { key: 'qf:confirmed', parts: [{ text: `${MARK.done} `, color: COLOUR.done }, { text: 'confirmed in one line; nothing shaped again', color: COLOUR.secondary }], press: pageKey('phase:discovery') },
  blank('qf:change'),
]

/** Rounds 1 to `last`, as their words say them. */
const roundsUpTo = (last: number) => (last === 1 ? 'round 1' : `rounds 1 to ${last}`)

/** The round a done fix's review ended in, as the build says it: settled by the orchestrator, or passed after the rounds of fixes before it; nothing where none did. */
function endedWords({ passed, settled, sent_back }: Rounds): string {
  if (passed === null) return ''
  if (settled) return `settled by the orchestrator in round ${passed}`

  return `passed its review in round ${passed}${sent_back === 0 ? '' : `, after ${counted(sent_back, 'round')} of fixes`}`
}

/** A fix's pair's rounds, as the line beneath it says them: how its review ended once done, else those sent back and the one being read. */
function roundsWords({ state, rounds }: Fix): string {
  if (state === 'done') return endedWords(rounds)

  return [...(rounds.sent_back === 0 ? [] : [`${roundsUpTo(rounds.sent_back)} sent back`]), ...(rounds.reading === null ? [] : [`round ${rounds.reading} being read`])].join(' · ')
}

/** A fix: its line as the build draws a task, its rounds beneath it where it has any. */
function fixLines(fix: Fix, kit: Kit): Line[] {
  const said = roundsWords(fix)

  return [taskLineOf(fix, kit), ...(said === '' ? [] : [{ key: `qf:rounds:${fix.task}`, mark: { text: INDENT }, wraps: true, parts: [{ text: said, color: COLOUR.notStarted }] }])]
}

/** THE FIXES, each under its count; before the first is written, its heading saying so, as the build's phase does. */
function fixesLines(view: QuickFix, kit: Kit): Line[] {
  const head = (said: string) => heading('qf:fixes', { text: 'THE FIXES', bold: true, color: COLOUR.sky }, [{ text: said, color: COLOUR.secondary }], kit.width)

  return view.progress.written ? section(head(doneOf(view.progress, '')), view.fixes.flatMap(fix => fixLines(fix, kit))) : [head('not yet written'), blank('qf:fixes')]
}

const callLines = (view: QuickFix, width: number): Line[] =>
  section(
    heading('qf:calls', { text: "CLAUDE'S CALLS", bold: true, color: COLOUR.gold }, [{ text: `${view.calls.length}`, color: COLOUR.secondary }], width),
    view.calls.map(({ id, text }) => ({ key: `qf:call:${id}`, mark: { text: `${MARK.call} `, color: COLOUR.gold }, wraps: true, parts: [{ text, color: COLOUR.body }], press: pageKey(`entry:${id}`) })),
  )

/** Whose the decisions replaced were, as REPLACES' heading says it: the person's, Claude's, or neither alone. */
function whoseEarlier(replaces: readonly Replaced[]): string {
  const whose = new Set(replaces.map(({ by }) => by))

  return whose.size !== 1 ? `${replaces.length}` : `${replaces.length} · ${whose.has('person') ? 'yours' : "Claude's"}, earlier`
}

/** An earlier decision the change replaces, in its words, with the unit it was made in by its title. */
const replacesLine = ({ id, text, unit_title: unit }: Replaced): Line => ({
  key: `qf:replaces:${id}`,
  mark: { text: `${MARK.replaces} `, color: COLOUR.violet },
  wraps: true,
  parts: [{ text: `"${text}"`, color: COLOUR.body }, { text: ` · ${unit}`, color: COLOUR.secondary }],
})

const replacesLines = (view: QuickFix, width: number): Line[] =>
  section(heading('qf:replaces', { text: 'REPLACES', bold: true, color: COLOUR.violet }, [{ text: whoseEarlier(view.replaces), color: COLOUR.secondary }], width), view.replaces.map(replacesLine))

/** Beneath a record's item, its mark's width. */
const HUNG = '  '

/**
 * A record's item under its mark, its text drawn as the board draws prose:
 * a paragraph opening it follows its name, wrapping under the mark; every
 * line after it — another paragraph, a list's items, a fenced block — hung
 * beneath, keeping its shape.
 */
function itemLines(key: string, name: string, text: string): Line[] {
  const label: Part = { text: `${name}: `, color: COLOUR.secondary }
  const mark: Part = { text: '· ', color: COLOUR.sky }
  const lines = prose(key, text)
  const [first] = lines
  const opens = first !== undefined && first.mark === undefined && first.wraps === true
  const hung = (opens ? lines.slice(1) : lines).map(line => ({ ...line, mark: { ...line.mark, text: `${HUNG}${line.mark?.text ?? ''}` } }))

  return [opens ? { ...first, mark, parts: [label, ...first.parts] } : { key: `${key}:name`, mark, parts: [label] }, ...hung]
}

/** A record's three items. */
const recordItems = (key: string, record: FixRecord): Line[] => [
  ...itemLines(`${key}:changed`, 'What changed', record.changed),
  ...itemLines(`${key}:why`, 'Why', record.why),
  ...itemLines(`${key}:leaves`, 'Leaves out', record.leaves),
]

/** THE RECORD: one fix's three items; where several fixes are done, each fix's under its title. */
function recordLines(view: QuickFix, width: number): Line[] {
  const records = view.record ?? []
  const titled = view.progress.done > 1

  return section(
    heading('qf:record', { text: 'THE RECORD', bold: true, color: COLOUR.sky }, [{ text: 'what changed, why, what it leaves out', color: COLOUR.secondary }], width),
    records.flatMap((record, at) => [
      ...(titled ? [{ key: `qf:record:${at}`, wraps: true, parts: [{ text: record.title, bold: true }] }] : []),
      ...recordItems(`qf:record:${at}`, record),
    ]),
  )
}

const quickFixLines = (view: QuickFix, kit: Kit): Line[] => [
  ...header('qf', view.title, [{ text: ` · ${view.type}`, color: COLOUR.secondary }], whereOf(view), kit.width),
  factsLine(view, kit),
  blank('qf:head'),
  ...waitingLines('qf:waiting', view.waiting, kit),
  ...changeLines(view, kit.width),
  ...fixesLines(view, kit),
  ...callLines(view, kit.width),
  ...replacesLines(view, kit.width),
  ...recordLines(view, kit.width),
]

export const QUICK_FIX: ViewDrawing = {
  lines: (view, kit) => quickFixLines(view as View & QuickFix, kit),
  name: () => 'the quick-fix',
}
