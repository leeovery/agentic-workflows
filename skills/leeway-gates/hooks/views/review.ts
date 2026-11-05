/**
 * The review phase's This session (20.10) and the pages it opens.
 *
 * This session: its header, the project, type and how many tasks were
 * built; the round, its areas read of all and where it stands, the line
 * wrapping so a failing round's fix tasks show whole (D12); WAITING ON YOU,
 * the unit's one list: the questions the review waits on, as the kit draws
 * them, or finish, asked in the conversation (D18) — never both, since
 * finish waits only once no question does; the latest fix tasks as the build's
 * phase past the cut, each opening its task's page (20.10.2, D17); FOUND,
 * each finding with its mark by its call and its area — in scope once the
 * round is recorded, else every one its landed reports hold; the round's
 * areas, each read with what it ran and found, being read with its clock,
 * waiting, or unchanged, not read again (20.S11); NOT PROVEN; TO THE
 * INBOX; and the VERDICT, a failing one hung under its mark (D19). Each
 * fix task, finding and check opens its page (20.10.3).
 *
 * A finding's page names where it went under its mark — or, while its
 * round is read, that it is being read, with its call and its reviewer —
 * the line wrapping so its area shows whole (D13, D19), then its words in
 * full; a check's, where it stands under its mark with its scenario, area
 * and round, then its scenario's words.
 */
import { COLOUR, MARK, blank, counted, cutTo, heading, prose, rowsOf, spread, titledLine, widthOf, type Kit, type Line, type Part } from '../draw.ts'
import type { View } from '../model.ts'
import { pageKey } from '../pane.ts'
import { taskLineOf, type TaskLine } from './build.ts'
import type { Found } from './task.ts'

/** An area of a round, as the engine's model holds it. */
type AreaLine = { area: string; title: string; state: 'read' | 'reading' | 'waiting' | 'unchanged'; ran: number; found: number; since: string | null }

/** The review phase's This session, as the engine's model holds it. */
type ReviewView = View & {
  title: string
  project: string
  type: string
  built: number
  round: number
  waiting: { kind: string; id: string; text: string; page: string | null }[]
  recorded: boolean
  areas: AreaLine[]
  found: Found[]
  not_proven: { round: number; scenario: string; standing: string; text: string | null }[]
  inbox: { round: number; finding: number; text: string }[]
  verdict: 'passed' | 'failed' | 'settled' | null
  fixes: { phase: number; round: number; tasks: TaskLine[] } | null
}

/** A finding read in full, as the engine's model holds it: its reviewer's while its round is read, else the round's. */
type FindingPage = View & {
  round: number
  finding: number | null
  area: string
  scope: string | null
  call: string
  text: string
  fix: string | null
  inbox: string | null
  reviewer: string | null
}

/** A check a round ran, as the engine's model holds it. */
type CheckPage = View & { round: number; scenario: string; standing: string; text: string | null }

/** The reader over the tests, as the engine names its area. */
const TESTS = 'tests'

/** An area as a line names it: its section, or the tests. */
const areaOf = (area: string) => (area === TESTS ? TESTS : `§${area.split('-')[0] ?? area}`)

/** A section's heading, its count or summary where it has one. */
const section = (key: string, name: string, color: string, width: number, summary?: string): Line =>
  heading(key, { text: name, bold: true, color }, summary === undefined ? [] : [{ text: summary, color: COLOUR.secondary }], width)

const SEPARATOR: Part = { text: ' · ', color: COLOUR.secondary }

/** The fix tasks of the round shown still to build. */
const toBuild = ({ fixes }: ReviewView) => fixes?.tasks.filter(({ state }) => state !== 'done' && state !== 'closed').length ?? 0

/** Whether finish waits on the person, as the unit's one list holds it. */
const finishes = ({ waiting }: ReviewView) => waiting.some(({ kind }) => kind === 'finish')

/** Where the round stands, at the end of its facts line. */
function standingOf(view: ReviewView, kit: Kit): Part[] {
  const { round, verdict, areas } = view

  if (finishes(view)) {
    return [SEPARATOR, { text: `${MARK.needs} finish waits on you`, color: COLOUR.needs }]
  }

  if (verdict === 'passed' || verdict === 'settled') {
    return [SEPARATOR, { text: `${MARK.done} round ${round} ${verdict === 'passed' ? 'passes' : 'settled'}`, color: COLOUR.done }]
  }

  if (verdict === 'failed') {
    const left = toBuild(view)

    return [SEPARATOR, { text: `${MARK.failed} round ${round} fails${left === 0 ? '' : ` · ${counted(left, 'fix task')} to build`}`, color: COLOUR.failed }]
  }

  const reading = areas.filter(({ state }) => state === 'reading').length

  return reading === 0 ? [] : [SEPARATOR, kit.spinner(), { text: ` ${reading} being read`, color: COLOUR.running }]
}

/** Where the unit is built: the project, giving way to its type and the tasks built. */
function whereOf({ project, type, built }: ReviewView, kit: Kit): Line {
  const rest: Part = { text: ` · ${type} · ${built} tasks built`, color: COLOUR.secondary }

  return { key: 'review:where', parts: [...cutTo([{ text: project, color: COLOUR.secondary }], kit.width - widthOf([rest])), rest] }
}

/** The header: the unit and phase, where it is built, and the round with where it stands. */
function headOf(view: ReviewView, kit: Kit): Line[] {
  const read = view.areas.filter(({ state }) => state === 'read' || state === 'unchanged').length

  return [
    titledLine('review:head', { text: view.title, bold: true }, [{ text: ' · review', color: COLOUR.secondary }], kit.width),
    whereOf(view, kit),
    {
      key: 'review:facts',
      wraps: true,
      parts: [{ text: `round ${view.round} · ${read} of ${view.areas.length} areas read`, color: COLOUR.secondary }, ...standingOf(view, kit)],
    },
    blank('review:head'),
  ]
}

/** WAITING ON YOU (the header's): finish, asked in the conversation, where it waits, else the questions as the kit draws them. */
function waitingOf(view: ReviewView, kit: Kit): Line[] {
  const finish = view.waiting.find(({ kind }) => kind === 'finish')

  if (finish === undefined) {
    return kit.waiting()
  }

  return [
    section('review:finish', 'WAITING ON YOU', COLOUR.needs, kit.width, '1 · asked in the conversation'),
    { key: 'review:finish:ask', mark: { text: `${MARK.needs} `, color: COLOUR.needs }, wraps: true, parts: [{ text: finish.text, color: COLOUR.body }] },
    blank('review:finish'),
  ]
}

/** FIX TASKS · PHASE N: a failing round's fix tasks as the build's next phase, each with its state. */
function fixesOf({ fixes }: ReviewView, kit: Kit): Line[] {
  if (fixes === null) {
    return []
  }

  const done = fixes.tasks.filter(({ state }) => state === 'done').length

  return [
    section('review:fixes', `FIX TASKS · PHASE ${fixes.phase}`, COLOUR.sky, kit.width, `${done} of ${fixes.tasks.length} done`),
    ...fixes.tasks.map(line => taskLineOf(line, kit)),
    blank('review:fixes'),
  ]
}

/** A finding's mark by its call: ✗ for the calls that fail a round, serious and bug, △ for a nit. */
const callMark = (call: string) => (call === 'nit' ? MARK.difference : MARK.failed)

/** Words drawn on one line, each run of white space one space. */
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

/**
 * FOUND: each finding with its mark by its call and its area, a press away
 * from its page — once the round is recorded, those in scope, by number;
 * while it is read, each its landed reports hold, by its report item, scope
 * being Claude's call then.
 */
const foundOf = ({ found, recorded }: ReviewView, kit: Kit): Line[] =>
  found.length === 0
    ? []
    : [
        section('review:found', 'FOUND', COLOUR.failed, kit.width, recorded ? `${found.length} in scope` : `${found.length} found`),
        ...found.map(({ round, finding, from, area, call, text }): Line => ({
          key: `review:found:${round}:${finding ?? from}`,
          parts: cutTo([{ text: `${callMark(call)} `, color: COLOUR.failed }, { text: `${areaOf(area)} `, color: COLOUR.secondary }, { text: oneLine(text), color: COLOUR.body }], kit.width),
          press: pageKey(`finding:${round}:${finding ?? from}`),
        })),
        blank('review:found'),
      ]

/** An area's mark and what it ran and found, or where its reading stands. */
function areaState({ state, ran, found, since }: AreaLine, kit: Kit): [Part, Part] {
  const runs = ran > 0 ? `ran ${ran} · ` : ''

  switch (state) {
    case 'reading':
      return [kit.spinner(), { text: since === null ? 'reading' : `reading ${kit.clock(since)}`, color: COLOUR.running }]
    case 'waiting':
      return [{ text: MARK.waiting, color: COLOUR.notStarted }, { text: 'waiting', color: COLOUR.notStarted }]
    case 'unchanged':
      return [{ text: MARK.done, color: COLOUR.done }, { text: 'unchanged, not read again', color: COLOUR.notStarted }]
    default:
      return found > 0
        ? [{ text: MARK.failed, color: COLOUR.failed }, { text: `${runs}${found} found`, color: COLOUR.failed }]
        : [{ text: MARK.done, color: COLOUR.done }, { text: `${runs}nothing found`, color: COLOUR.secondary }]
  }
}

/** ROUND N: one row per area and one for the reader over the tests. */
function areasOf({ round, areas }: ReviewView, kit: Kit): Line[] {
  return [
    section('review:areas', `ROUND ${round}`, COLOUR.violet, kit.width, round === 1 ? 'every area, read and run' : 'the areas the fixes changed'),
    ...areas.map((line): Line => {
      const [mark, state] = areaState(line, kit)
      const label = line.area === TESTS ? line.title : `§${line.area} ${line.title}`

      return { key: `review:area:${line.area}`, parts: spread([mark, { text: ` ${label}`, color: COLOUR.body }], [state], kit.width) }
    }),
    blank('review:areas'),
  ]
}

/** NOT PROVEN: each check not proven, a press away from its page. */
const unprovenOf = ({ not_proven: unproven }: ReviewView, kit: Kit): Line[] =>
  unproven.length === 0
    ? []
    : [
        section('review:unproven', 'NOT PROVEN', COLOUR.needs, kit.width, `${unproven.length} could not be run`),
        ...unproven.map(({ round, scenario, standing, text }): Line => ({
          key: `review:unproven:${scenario}`,
          parts: cutTo([{ text: `${MARK.difference} `, color: COLOUR.needs }, { text: text ?? `${scenario} ${standing}`, color: COLOUR.body }], kit.width),
          press: pageKey(`check:${round}:${scenario}`),
        })),
        blank('review:unproven'),
      ]

/** TO THE INBOX: what the round filed there as Claude's call, each a press away from its finding. */
const inboxOf = ({ inbox }: ReviewView, kit: Kit): Line[] =>
  inbox.length === 0
    ? []
    : [
        section('review:inbox', 'TO THE INBOX', COLOUR.gold, kit.width, `${inbox.length} · Claude's ${inbox.length === 1 ? 'call' : 'calls'}`),
        ...inbox.map(({ round, finding, text }) => ({
          key: `review:inbox:${round}:${finding}`,
          parts: cutTo([{ text: `${MARK.message} `, color: COLOUR.gold }, { text: oneLine(text), color: COLOUR.body }], kit.width),
          press: pageKey(`finding:${round}:${finding}`),
        })),
        blank('review:inbox'),
      ]

/** The verdict's line: the round's, hung under its mark, or that it comes once every area is read. */
function verdictOf({ round, verdict, found }: ReviewView): Line {
  const key = 'review:verdict:row'

  switch (verdict) {
    case 'passed':
      return { key, mark: { text: `${MARK.done} `, color: COLOUR.done }, wraps: true, parts: [{ text: `round ${round} passes${found.length === 0 ? ': nothing found' : ''}`, color: COLOUR.body }] }
    case 'settled':
      return { key, mark: { text: `${MARK.done} `, color: COLOUR.done }, wraps: true, parts: [{ text: `round ${round} settled`, color: COLOUR.body }] }
    case 'failed':
      return {
        key,
        mark: { text: `${MARK.failed} `, color: COLOUR.failed },
        wraps: true,
        parts: [{ text: `round ${round} fails: the fix tasks build, then every area they change is read again`, color: COLOUR.body }],
      }
    default:
      return { key, mark: { text: `${MARK.waiting} `, color: COLOUR.notStarted }, parts: [{ text: 'once every area is read', color: COLOUR.notStarted }] }
  }
}

/** The review phase's This session (the header's). */
export function reviewLines(view: View, kit: Kit): Line[] {
  const review = view as ReviewView

  return [
    ...headOf(review, kit),
    ...waitingOf(review, kit),
    ...fixesOf(review, kit),
    ...foundOf(review, kit),
    ...areasOf(review, kit),
    ...unprovenOf(review, kit),
    ...inboxOf(review, kit),
    section('review:verdict', 'VERDICT', COLOUR.sky, kit.width),
    verdictOf(review),
  ]
}

/** Where a finding went, its mark beside it: being read, by its call, while its round is; else a fix task, the inbox, or dropped, each Claude's call. */
function wentOf({ round, scope, call, fix, inbox, reviewer }: FindingPage): [Part, Part] {
  if (reviewer !== null) {
    return [{ text: `${callMark(call)} `, color: COLOUR.failed }, { text: `round ${round} · being read`, color: COLOUR.running }]
  }

  const scoped = scope === 'in' ? 'in scope' : 'out of scope'

  if (fix !== null) {
    return [{ text: `${MARK.failed} `, color: COLOUR.failed }, { text: `${scoped} · fix task ${fix}`, color: COLOUR.failed }]
  }

  return inbox === null
    ? [{ text: `${MARK.cancelled} `, color: COLOUR.notStarted }, { text: `${scoped} · dropped, Claude's call`, color: COLOUR.notStarted }]
    : [{ text: `${MARK.message} `, color: COLOUR.gold }, { text: `${scoped} · filed to the inbox, Claude's call`, color: COLOUR.gold }]
}

/** The rows a finding's title takes at most. */
const TITLE_ROWS = 3

/** A finding's opening words as its title: its words whole where they fit the title's rows, else as many as fit, ending "…". */
function titleOf(text: string, width: number): Line {
  const line = (words: string): Line => ({ key: 'finding:title', wraps: true, parts: [{ text: words, bold: true }] })
  const words = text.split(/\s+/)
  let kept = ''

  if (rowsOf(line(text), width) <= TITLE_ROWS) {
    return line(text)
  }

  for (const word of words) {
    const next = kept === '' ? word : `${kept} ${word}`

    if (rowsOf(line(`${next}…`), width) > TITLE_ROWS) {
      break
    }

    kept = next
  }

  return line(`${kept}…`)
}

/**
 * A finding read in full: its opening words, where it went, wrapping under
 * its mark so its area shows whole (D13, D19) — with its round, or while
 * the round is read its call and its reviewer — then all its words.
 */
export function findingLines(view: View, kit: Kit): Line[] {
  const page = view as FindingPage
  const [mark, went] = wentOf(page)
  const area = page.area === TESTS ? 'the tests' : areaOf(page.area)
  const after = page.reviewer === null ? ` · ${area} · round ${page.round}` : ` · ${page.call} · ${area} · reviewer ${page.reviewer}`

  return [
    titleOf(page.text, kit.width),
    { key: 'finding:went', mark, wraps: true, parts: [went, { text: after, color: COLOUR.secondary }] },
    heading('finding:rule', { text: '' }, [], kit.width),
    ...prose('finding', page.text),
  ]
}

/** A check a round ran, read in full: where it stands, under its mark, with its scenario, area and round; then its scenario's words. */
export function checkLines(view: View, kit: Kit): Line[] {
  const { round, scenario, standing, text } = view as CheckPage
  const proven = standing === 'proven'
  const color = proven ? COLOUR.done : COLOUR.needs

  return [
    {
      key: 'check:title',
      mark: { text: `${proven ? MARK.done : MARK.difference} `, color },
      wraps: true,
      parts: [
        { text: `${standing[0]?.toUpperCase() ?? ''}${standing.slice(1)}`, bold: true, color },
        { text: ` · ${scenario} · ${areaOf(scenario.split('.')[0] ?? scenario)} · round ${round}`, color: COLOUR.secondary },
      ],
    },
    heading('check:rule', { text: '' }, [], kit.width),
    ...prose('check', text ?? 'The spec holds no words for this scenario.'),
  ]
}
