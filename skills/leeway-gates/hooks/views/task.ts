/**
 * A task's pages (20.5.4–20.5.7, 15.2.14): the task's page, the task as
 * written, a round of its review read in full, a scenario's evidence and a
 * text evidence kept with its run.
 *
 * The task's page: its number and title, the title giving way; its phase,
 * the phase's name giving way to the task's mark and state (D10), and once
 * done, when it finished and how long it took; EVIDENCE, what running the
 * product proved of each of its scenarios, each opening on `▸ see`, or
 * `▸ read` where it is not proven (D16); WHAT IT DOES, with its count of
 * acceptance criteria and `▸ read the task`; for a fix task, WHAT IT FIXES
 * (D17); for a parked task, each question it waits on, with its `▸ discuss`
 * (20.5.6); once done, WHAT WAS DONE from its account, or that none was
 * written (D8), DIFFERS FROM THE TASK, always, saying so where nothing
 * differs (D14), and REVIEWS, each round's `▸ read` opening its two reports
 * (D15); and CALLS MADE. Nothing on it sends the account to the
 * conversation (20.5.7).
 */
import { COLOUR, MARK, blank, counted, cutTo, heading, prose, spread, widthOf, type Button, type Kit, type Line, type Part } from '../draw.ts'
import type { View } from '../model.ts'
import { pageKey } from '../pane.ts'
import { taskMark, taskState, type TaskLine } from './build.ts'

/** A finding of the review, as the engine's model holds it. */
export type Found = { round: number; finding: number | null; area: string; call: string; text: string }

/** A task's page, as the engine's model holds it. */
type TaskPage = View & {
  phase: number
  phase_name: string
  line: TaskLine
  started: string | null
  finished: string | null
  does: string
  criteria: number
  account: {
    done: string
    where: string
    tests: string
    differences: string[]
    figures: { files: number; added: number; removed: number; criteria: number }
  } | null
  reviews: { round: string; summary: string }[]
  calls: { id: string; text: string }[]
  ran: { scenario: string; criterion: string; standing: string }[] | null
  questions: string[]
  fixes: Found[]
}

/** The task as written, as the engine's model holds it. */
type WrittenPage = View & { task: string; title: string; sections: { heading: string; text: string }[] }

/** A round of a task's review, as the engine's model holds it. */
type RoundPage = View & { task: string; title: string; round: number; reports: { letter: string; text: string }[] }

/** A scenario of a task, as the engine's model holds it. */
type ScenarioPage = View & {
  task: string
  title: string
  scenario: string
  criterion: string
  standing: string
  at: string | null
  drive: string | null
  check: string | null
  evidence: { name: string; lines: number }[]
}

/** A text evidence kept with a run, as the engine's model holds it. */
type EvidencePage = View & { task: string; scenario: string; name: string; text: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const twoDigits = (value: number) => String(value).padStart(2, '0')

/** A moment as the board says it: "20 Oct 00:03". */
export function dayAndTime(at: string): string {
  const when = new Date(at)

  return `${when.getDate()} ${MONTHS[when.getMonth()] ?? ''} ${twoDigits(when.getHours())}:${twoDigits(when.getMinutes())}`
}

/** How long a task took: "12m", "1h 5m". */
function tookOf(started: string, finished: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(finished) - Date.parse(started)) / 60_000))

  if (minutes < 1) {
    return 'under a minute'
  }

  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${minutes % 60 === 0 ? '' : ` ${minutes % 60}m`}`
}

/** A section's heading, its count or summary where it has one. */
const section = (key: string, name: string, color: string, width: number, summary?: string): Line =>
  heading(key, { text: name, bold: true, color }, summary === undefined ? [] : [{ text: summary, color: COLOUR.secondary }], width)

/** A rule beneath a page's title. */
const rule = (key: string, width: number): Line => heading(key, { text: '' }, [], width)

/** A line with its words at the left and its button at the right edge. */
const buttoned = (key: string, left: Part[], button: Button, width: number, right: Part[] = []): Line => ({
  key,
  parts: spread(left, right, width - widthOf([{ text: button.label }])),
  button,
})

/**
 * The task's phase and where it stands: the mark, and the state where the
 * task is not done, stay whole, the phase's name giving way to them (D10).
 */
function standingOf({ phase, phase_name: name, line }: TaskPage, kit: Kit): Line {
  const state = taskState(line, kit)
  const right: Part[] = [{ text: ' · ', color: COLOUR.secondary }, taskMark(line, kit), ...(line.state === 'done' ? [] : [{ ...state, text: ` ${state.text}` }])]

  return { key: 'task:standing', parts: [...cutTo([{ text: `Phase ${phase} · ${name}`, color: COLOUR.secondary }], kit.width - widthOf(right)), ...right] }
}

/** When a done task finished and how long it took. */
function finishedOf({ line, started, finished }: TaskPage): Line[] {
  if (line.state !== 'done' || finished === null) {
    return []
  }

  return [{ key: 'task:finished', parts: [{ text: `done ${dayAndTime(finished)}${started === null ? '' : ` · took ${tookOf(started, finished)}`}`, color: COLOUR.done }] }]
}

/** EVIDENCE (15.2.14): each scenario by what running the product proved of it. */
function evidenceOf({ line, ran }: TaskPage, kit: Kit): Line[] {
  if (ran === null || ran.length === 0) {
    return []
  }

  const proven = ran.filter(({ standing }) => standing === 'proven').length
  const others = [...new Set(ran.map(({ standing }) => standing).filter(standing => standing !== 'proven'))]
  const summary = [...(proven > 0 ? [`${proven} proven`] : []), ...others.map(standing => `${ran.filter(each => each.standing === standing).length} ${standing}`)]

  return [
    section('evidence', 'EVIDENCE', COLOUR.sky, kit.width, summary.join(' · ')),
    ...ran.map(({ scenario, criterion, standing }) => {
      const key = `evidence:${scenario}`
      const opens = pageKey(`task:${line.task}:scenario:${scenario}`)

      return standing === 'proven'
        ? buttoned(key, [{ text: `${MARK.done} `, color: COLOUR.done }, { text: criterion, color: COLOUR.body }], { key: opens, label: '▸ see' }, kit.width)
        : buttoned(key, [{ text: `${MARK.difference} `, color: COLOUR.needs }, { text: criterion, color: COLOUR.body }], { key: opens, label: '▸ read' }, kit.width, [
            { text: `${standing} `, color: COLOUR.notStarted },
          ])
    }),
    blank('evidence'),
  ]
}

/** WHAT IT DOES: the task's goal, its count of acceptance criteria, and the task as written a press away. */
const doesOf = ({ line, does, criteria }: TaskPage, kit: Kit): Line[] => [
  section('does', 'WHAT IT DOES', COLOUR.sky, kit.width),
  ...prose('does', does),
  buttoned('does:count', [{ text: counted(criteria, 'acceptance criterion', 'acceptance criteria'), color: COLOUR.secondary }], { key: pageKey(`task:${line.task}:written`), label: '▸ read the task' }, kit.width),
]

/** WHAT IT FIXES, for a fix task: each finding of the review that went to it (D17). */
const fixesOf = ({ fixes }: TaskPage, kit: Kit): Line[] =>
  fixes.length === 0
    ? []
    : [
        blank('fixes'),
        section('fixes', 'WHAT IT FIXES', COLOUR.failed, kit.width, `${fixes.length}`),
        ...fixes.map(({ round, finding, text }) => ({
          key: `fixes:${round}:${finding}`,
          mark: { text: '· ', color: COLOUR.failed },
          wraps: true,
          parts: [{ text, color: COLOUR.body }],
        })),
      ]

/** Whether a line of WAITING ON YOU is one of a question's rows: its words, or its standing's. */
const isRowOf = (key: string, question: string) => key === `q:${question}` || key === `qt:${question}` || key.startsWith(`qt:${question}:`)

/** The questions parking the task, as WAITING ON YOU draws them, each with its "▸ discuss" (20.5.6). */
function parkedOn({ questions }: TaskPage, kit: Kit): Line[] {
  if (questions.length === 0) {
    return []
  }

  return [
    blank('asks'),
    section('asks', 'WAITING ON YOU', COLOUR.needs, kit.width),
    ...kit.waiting().filter(line => questions.some(question => isRowOf(line.key, question))),
  ]
}

/** The account's figures: the criteria it proves, the files changed and the lines added and removed. */
function figuresOf({ criteria, files, added, removed }: NonNullable<TaskPage['account']>['figures']): Line {
  return {
    key: 'done:figures',
    parts: [
      { text: `${MARK.done} `, color: COLOUR.done },
      { text: `Proves ${counted(criteria, 'criterion', 'criteria')} · ${counted(files, 'file')} changed · +${added} −${removed}`, color: COLOUR.secondary },
    ],
  }
}

/** DIFFERS FROM THE TASK: every way the work differs, one △ line each, or that nothing does (D14). */
function differsOf(differences: readonly string[], kit: Kit): Line[] {
  return [
    blank('differs'),
    section('differs', 'DIFFERS FROM THE TASK', COLOUR.needs, kit.width, differences.length === 0 ? 'none' : `${differences.length}`),
    ...(differences.length === 0
      ? [{ key: 'differs:none', parts: [{ text: 'Nothing differs from the task as written.', color: COLOUR.secondary }] }]
      : differences.map((text, at) => ({ key: `differs:${at}`, mark: { text: `${MARK.difference} `, color: COLOUR.needs }, wraps: true, parts: [{ text, color: COLOUR.body }] }))),
  ]
}

/** The round a review summary's heading names, null for a settlement's. */
const roundOf = (heading: string): string | null => /^Round (\d+)$/.exec(heading)?.[1] ?? null

/** REVIEWS: each round's summary, its two reports a press away (D15); a settlement's summary on its own. */
function reviewsOf({ line, reviews }: TaskPage, kit: Kit): Line[] {
  if (reviews.length === 0) {
    return []
  }

  const rounds = reviews.filter(({ round }) => roundOf(round) !== null).length

  return [
    blank('reviews'),
    section('reviews', 'REVIEWS', COLOUR.violet, kit.width, counted(rounds, 'round')),
    ...reviews.map(({ round, summary }, at): Line => {
      const said: Part[] = [{ text: `${MARK.round} `, color: COLOUR.violet }, { text: round, color: COLOUR.body }, { text: ` · ${summary}`, color: COLOUR.secondary }]
      const number = roundOf(round)

      return number === null
        ? { key: `reviews:${at}`, parts: cutTo(said, kit.width) }
        : buttoned(`reviews:${at}`, said, { key: pageKey(`task:${line.task}:round:${number}`), label: '▸ read' }, kit.width)
    }),
  ]
}

/** WHAT WAS DONE, once the task is done: its account, or that none was written (D8); then what differs and its reviews. */
function doneOf(page: TaskPage, kit: Kit): Line[] {
  const { account } = page

  if (page.line.state !== 'done' && account === null) {
    return []
  }

  const head = [blank('done'), section('done', 'WHAT WAS DONE', COLOUR.done, kit.width)]

  if (account === null) {
    return [...head, ...prose('done', 'No account was written for this task as it landed.', COLOUR.secondary), ...reviewsOf(page, kit)]
  }

  return [
    ...head,
    ...prose('done', account.done),
    ...prose('where', account.where, COLOUR.secondary, COLOUR.done),
    ...prose('tests', account.tests, COLOUR.secondary, COLOUR.done),
    figuresOf(account.figures),
    ...differsOf(account.differences, kit),
    ...reviewsOf(page, kit),
  ]
}

/** CALLS MADE: each call the task made, read in full a press away. */
const callsOf = ({ calls }: TaskPage, kit: Kit): Line[] =>
  calls.length === 0
    ? []
    : [
        blank('calls'),
        section('calls', 'CALLS MADE', COLOUR.gold, kit.width, `${calls.length}`),
        ...calls.map(({ id, text }) =>
          buttoned(`calls:${id}`, [{ text: `${MARK.call} `, color: COLOUR.gold }, { text, color: COLOUR.body }], { key: pageKey(`entry:${id}`), label: '▸ read' }, kit.width),
        ),
      ]

/** A task's number and title, as a page's title and its way back name it. */
const named = (task: string, title: string) => `${task} ${title}`

/** The task's page (the header's). */
export function taskLines(view: View, kit: Kit): Line[] {
  const page = view as TaskPage

  return [
    { key: 'task:title', parts: cutTo([{ text: named(page.line.task, page.line.title), bold: true }], kit.width) },
    standingOf(page, kit),
    ...finishedOf(page),
    blank('task'),
    ...evidenceOf(page, kit),
    ...doesOf(page, kit),
    ...fixesOf(page, kit),
    ...parkedOn(page, kit),
    ...doneOf(page, kit),
    ...callsOf(page, kit),
  ]
}

/** The task's page, as a way back names it: by its number (15.2.14). */
export const taskName = (view: View) => (view as TaskPage).line.task

/** A page's title over a task: its own name in its colour, then the task's number and title. */
const titled = (key: string, name: string, color: string, task: string, title: string, width: number): Line => ({
  key,
  parts: cutTo([{ text: name, bold: true, color }, { text: ` · ${named(task, title)}`, color: COLOUR.secondary }], width),
})

/** The task as written, each section under its heading. */
export function writtenLines(view: View, kit: Kit): Line[] {
  const { task, title, sections } = view as WrittenPage

  return [
    titled('written:title', 'The task', COLOUR.sky, task, title, kit.width),
    ...sections.flatMap(({ heading: name, text }, at) => [
      blank(`written:${at}`),
      section(`written:${at}`, name.toUpperCase(), COLOUR.sky, kit.width),
      ...prose(`written:${at}`, text),
    ]),
  ]
}

/** A round of the task's review: both reviewers' reports, A then B (D15). */
export function roundLines(view: View, kit: Kit): Line[] {
  const { task, title, round, reports } = view as RoundPage

  return [
    titled('round:title', `Review round ${round}`, COLOUR.violet, task, title, kit.width),
    rule('round:rule', kit.width),
    ...reports.flatMap(({ letter, text }, at) => [
      ...(at === 0 ? [] : [blank(`round:${letter}`)]),
      section(`round:${letter}`, `REPORT ${letter.toUpperCase()}`, COLOUR.violet, kit.width),
      ...prose(`round:${letter}`, text),
    ]),
  ]
}

/** What running the product proved of a scenario, and when the run that decides it was recorded. */
function provedOf({ standing, at }: ScenarioPage): Line {
  const mark: Part = standing === 'proven' ? { text: `${MARK.done} ${standing}`, color: COLOUR.done } : { text: `${MARK.difference} ${standing}`, color: COLOUR.needs }

  return { key: 'scenario:standing', wraps: true, parts: [mark, ...(at === null ? [] : [{ text: ` · run by the verify setup · ${dayAndTime(at)}`, color: COLOUR.secondary }])] }
}

/** A section of a scenario's page, its prose beneath its heading, then a blank. */
const block = (key: string, name: string, text: string, width: number): Line[] => [section(key, name, COLOUR.sky, width), ...prose(key, text), blank(key)]

/** A scenario's evidence (15.2.14): what it proved, what its run drives and checks, and the text evidence kept with it. */
export function scenarioLines(view: View, kit: Kit): Line[] {
  const page = view as ScenarioPage
  const { task, scenario, criterion, drive, check, evidence } = page

  return [
    { key: 'scenario:title', wraps: true, parts: [{ text: criterion, bold: true }] },
    provedOf(page),
    rule('scenario:rule', kit.width),
    ...(drive === null
      ? [{ key: 'scenario:unwritten', parts: [{ text: 'The spec holds no words for this scenario.', color: COLOUR.secondary }] }, blank('scenario')]
      : block('drive', 'DRIVE', drive, kit.width)),
    ...(check === null ? [] : block('check', 'CHECK', check, kit.width)),
    ...(evidence.length === 0
      ? []
      : [
          section('kept', 'EVIDENCE', COLOUR.sky, kit.width, 'kept with the run'),
          ...evidence.map(({ name, lines }, at) =>
            buttoned(`kept:${at}`, [{ text: `${name} · ${counted(lines, 'line')}`, color: COLOUR.body }], { key: pageKey(`task:${task}:scenario:${scenario}:evidence:${at + 1}`), label: '▸ open' }, kit.width),
          ),
        ]),
  ]
}

/** A text evidence whole, each of its lines as captured, cut at the edge. */
export function evidenceLines(view: View, kit: Kit): Line[] {
  const { scenario, name, text } = view as EvidencePage

  return [
    { key: 'evidence:title', parts: cutTo([{ text: name, bold: true }, { text: ` · ${scenario}`, color: COLOUR.secondary }], kit.width) },
    rule('evidence:rule', kit.width),
    ...text.replace(/\n$/, '').split('\n').map((line, at) => ({ key: `evidence:${at}`, parts: [{ text: line === '' ? ' ' : line, color: COLOUR.body }] })),
  ]
}

/** The page's name for a way back to it. */
export const writtenName = (view: View) => (view as WrittenPage).task
export const roundName = (view: View) => `round ${(view as RoundPage).round}`
export const scenarioName = (view: View) => (view as ScenarioPage).scenario
export const evidenceName = (view: View) => (view as EvidencePage).name
