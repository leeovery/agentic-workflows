/**
 * An experiment on the board (20.13): This session in an experiment — its
 * question, its design frozen at approval, its runs, its verdict and the
 * topic that waits on it — and its report read in full.
 *
 * What runs turns only while the experiment runs; the topic waiting on it
 * is under way in no session, so its ◐ is sky blue and still.
 */
import { COLOUR, MARK, blank, dayOf, heading, prose, spread, type Kit, type Line, type Part } from '../draw.ts'
import type { View } from '../model.ts'
import { pageKey } from '../pane.ts'
import type { ViewDrawing } from './index.ts'
import { READ, STILL, section, titled } from './words.ts'

type Runs = { condition: string; of: number; done: number; median: number | null; unit: string | null }

type Experiment = {
  unit: string
  title: string
  type: string
  id: string
  question: string
  topic: string
  topic_title: string
  status: string
  approved: string | null
  verdict: string | null
  reason: string | null
  problem: string
  design: { heading: string | null; text: string }[]
  runs: Runs[]
  report: boolean
}

const CONCLUDED = 'concluded'
const ABANDONED = 'abandoned'

const sum = (runs: readonly Runs[], key: 'done' | 'of') => runs.reduce((total, line) => total + line[key], 0)

/** Where it stands, at the end of its facts line: running, concluded, or abandoned with its reason. */
function standingOf(view: Experiment, kit: Kit): Part[] {
  if (view.status === CONCLUDED) {
    return [{ text: `${MARK.done} concluded`, color: COLOUR.done }]
  }

  if (view.status === ABANDONED) {
    return [{ text: `${MARK.cancelled} abandoned${view.reason === null ? '' : `: ${view.reason}`}`, color: COLOUR.notStarted }]
  }

  return view.status === 'running' ? [kit.spinner(), { text: ' running', color: COLOUR.running }] : [{ text: view.status, color: COLOUR.secondary }]
}

function factsLine(view: Experiment, kit: Kit): Line {
  const said = [...(view.approved === null ? [] : [`approved ${dayOf(view.approved)}`]), ...(view.runs.length === 0 ? [] : [`${sum(view.runs, 'done')} of ${sum(view.runs, 'of')} runs`])]

  return { key: 'x:facts', wraps: true, parts: [{ text: said.map(fact => `${fact} · `).join(''), color: COLOUR.secondary }, ...standingOf(view, kit)] }
}

const questionLines = (view: Experiment, width: number): Line[] =>
  section(heading('x:question', { text: 'THE QUESTION', bold: true, color: COLOUR.sky }, [{ text: `from ${view.topic_title}`, color: COLOUR.secondary }], width), prose('x:problem', view.problem))

/** Its design, each of its sections' points: frozen once the person approved it. */
function designLines(view: Experiment, width: number): Line[] {
  return section(
    heading('x:design', { text: 'THE DESIGN', bold: true, color: COLOUR.violet }, [{ text: view.approved === null ? 'until you approve it' : 'frozen when you approved it', color: COLOUR.secondary }], width),
    view.design.flatMap(({ text }, at) => prose(`x:design:${at}`, text, COLOUR.body, COLOUR.violet)),
  )
}

/** A condition's runs: done, or turning while the experiment runs; its runs done of all and their median so far. */
function runsLine(view: Experiment, runs: Runs, kit: Kit): Line {
  const done = runs.done >= runs.of
  const mark: Part = done ? { text: MARK.done, color: COLOUR.done } : view.status === 'running' ? kit.spinner() : { text: MARK.waiting, color: COLOUR.notStarted }
  const median = runs.median === null ? '' : ` · median ${runs.median}${runs.unit === null ? '' : ` ${runs.unit}`}`

  return {
    key: `x:runs:${runs.condition}`,
    parts: spread([mark, { text: ` ${runs.condition}`, color: COLOUR.body }], [{ text: `${runs.done} of ${runs.of}${median}`, color: done ? COLOUR.secondary : COLOUR.running }], kit.width),
  }
}

const runsLines = (view: Experiment, kit: Kit): Line[] =>
  section(
    heading('x:runs', { text: 'RUNS', bold: true, color: COLOUR.sky }, [{ text: `${sum(view.runs, 'done')} of ${sum(view.runs, 'of')}`, color: COLOUR.secondary }], kit.width),
    view.runs.map(runs => runsLine(view, runs, kit)),
  )

/** The verdict once every run is in, wrapping under its mark, its ▸ read opening the report where it is written; abandoned, why. */
function verdictLine(view: Experiment): Line {
  if (view.verdict !== null) {
    return {
      key: 'x:verdict',
      mark: { text: `${MARK.done} `, color: COLOUR.done },
      wraps: true,
      parts: [{ text: view.verdict, color: COLOUR.body }],
      ...(view.report ? { button: { key: pageKey(`report:${view.topic}:${view.id}`), label: READ } } : {}),
    }
  }

  return view.status === ABANDONED
    ? { key: 'x:verdict', parts: [{ text: `${MARK.cancelled} `, color: COLOUR.notStarted }, { text: 'none: the experiment was abandoned', color: COLOUR.notStarted }] }
    : { key: 'x:verdict', parts: [{ text: `${MARK.waiting} `, color: COLOUR.notStarted }, { text: 'once every run is in', color: COLOUR.notStarted }] }
}

/** The topic that waits on it: its discussion, and once concluded its report. */
function waitsLine(view: Experiment, width: number): Line {
  const standing: Part = view.status === CONCLUDED && view.report ? { text: 'the report waits for it', color: COLOUR.needs } : { text: 'its discussion waits', color: COLOUR.secondary }

  return { key: 'x:waits:topic', parts: spread([STILL, { text: ` ${view.topic_title}`, color: COLOUR.body }], [standing], width) }
}

const experimentLines = (view: Experiment, kit: Kit): Line[] => [
  { key: 'x:head', wraps: true, parts: [{ text: `${view.id} ${view.question}`, bold: true }] },
  { key: 'x:where', parts: [{ text: `${view.title} · ${view.type} · an experiment for ${view.topic_title}`, color: COLOUR.secondary }] },
  factsLine(view, kit),
  blank('x:head'),
  ...questionLines(view, kit.width),
  ...designLines(view, kit.width),
  ...runsLines(view, kit),
  heading('x:verdict:head', { text: 'VERDICT', bold: true, color: COLOUR.sky }, [{ text: 'the rule, applied', color: COLOUR.secondary }], kit.width),
  verdictLine(view),
  blank('x:verdict'),
  heading('x:waits', { text: 'WAITS ON IT', bold: true, color: COLOUR.needs }, [{ text: '1 topic', color: COLOUR.secondary }], kit.width),
  waitsLine(view, kit.width),
]

type Report = { topic: string; topic_title: string; id: string; status: string; text: string }

/** The report read in full: where its experiment stands, and the topic it is for. */
const reportLines = (report: Report, kit: Kit): Line[] => [
  ...titled('x:report', [{ text: `${report.id} · the report`, bold: true }], [{ text: `${report.status} · for ${report.topic_title}`, color: COLOUR.secondary }], kit.width),
  ...prose('x:report:text', report.text),
]

export const EXPERIMENT: ViewDrawing = {
  lines: (view, kit) => experimentLines(view as View & Experiment, kit),
  name: () => 'the experiment',
}

export const EXPERIMENT_REPORT: ViewDrawing = {
  lines: (view, kit) => reportLines(view as View & Report, kit),
  name: view => `${(view as View & Report).id}'s report`,
}
