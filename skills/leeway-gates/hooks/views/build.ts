/**
 * The build's This session (20.5.1–20.5.3): its header; the progress bar
 * with the tasks done of all, the phase of the cut and how many run — before
 * the tracker holds any task, how far the build has come as the start
 * menu's row says it, in their place — ending
 * "⚑ stopped until you answer" once nothing can go on (D6), the line
 * wrapping under its facts (D11); WAITING ON YOU, the phase's own of the
 * unit's one list: the questions as the kit draws them, then every other
 * wait, asked in the conversation, by its words, each opening its page where
 * it has one; then every phase of the cut, and of the review's fixes past
 * it, in order — a complete one folded to its heading, one not yet written
 * saying so, the others listing their tasks, each a press away from its
 * page.
 *
 * A task's line, its mark and its state, are the review's fix tasks' too,
 * and WAITING ON YOU the review's and a quick-fix's (`views/review.ts`,
 * `views/quick-fix.ts`).
 */
import { BAR_CELLS, COLOUR, MARK, blank, folding, heading, progressBar, spread, titledLine, type Kit, type Line, type Part } from '../draw.ts'
import type { View } from '../model.ts'
import { pageKey } from '../pane.ts'
import { section } from './words.ts'

/** A task's state on the board, as the engine's model holds it. */
export type TaskState = 'done' | 'building' | 'in-review' | 'at-gate' | 'behind' | 'failed' | 'waits' | 'after' | 'not-started' | 'closed'

/** A task's line, as the engine's model holds it. */
export type TaskLine = { task: string; title: string; state: TaskState; since: string | null; on: string[] }

/** A phase of the build, as the engine's model holds it. */
export type BuildPhase = {
  phase: number
  name: string
  state: 'not-written' | 'written' | 'running' | 'complete' | 'merging'
  done: number
  total: number
  tasks: TaskLine[]
}

/** What waits on the person in the phase, as the engine's model holds it. */
export type Waiting = { kind: string; id: string; text: string; page: string | null }

/** The build's This session, as the engine's model holds it. */
export type BuildView = View & {
  kind: 'build'
  title: string
  type: string
  progress: { done: number; total: number; phase: number; phases: number; running: number; stopped: boolean; untasked: string | null }
  waiting: Waiting[]
  phases: BuildPhase[]
}

/** WAITING ON YOU (the header's), its lines keyed under `key`. */
export function waitingLines(key: string, waiting: readonly Waiting[], kit: Kit): Line[] {
  const asked = waiting.filter(({ kind }) => kind !== 'question')
  const parked = waiting.some(({ kind }) => kind === 'question') ? kit.waiting() : []

  return [
    ...parked,
    ...section(
      heading(key, { text: 'WAITING ON YOU', bold: true, color: COLOUR.needs }, [{ text: `${asked.length} · asked in the conversation`, color: COLOUR.secondary }], kit.width),
      asked.map(({ id, text, page }) => ({
        key: `${key}:${id}`,
        mark: { text: `${MARK.needs} `, color: COLOUR.needs },
        wraps: true,
        parts: [{ text, color: COLOUR.body }],
        ...(page === null ? {} : { press: pageKey(page) }),
      })),
    ),
  ]
}

/** What a running task's state reads, its clock where it has one. */
const running = (words: string, since: string | null, kit: Kit): Part => ({
  text: since === null ? words : `${words} ${kit.clock(since)}`,
  color: COLOUR.running,
})

/** A task's mark, in its state's colour. */
export function taskMark({ state }: TaskLine, kit: Kit): Part {
  switch (state) {
    case 'done':
      return { text: MARK.done, color: COLOUR.done }
    case 'building':
    case 'in-review':
      return kit.spinner()
    case 'waits':
    case 'at-gate':
      return { text: MARK.needs, color: COLOUR.needs }
    case 'failed':
      return { text: MARK.failed, color: COLOUR.failed }
    case 'closed':
      return { text: MARK.cancelled, color: COLOUR.notStarted }
    default:
      return { text: MARK.waiting, color: COLOUR.notStarted }
  }
}

/** A task's state, as its line ends with it (20.5.2), in its colour. */
export function taskState({ state, since, on }: TaskLine, kit: Kit): Part {
  switch (state) {
    case 'done':
      return { text: 'done', color: COLOUR.done }
    case 'building':
      return running('building', since, kit)
    case 'in-review':
      return running('in review', since, kit)
    case 'waits':
      return { text: `waits on ${on.join(', ')}`, color: COLOUR.needs }
    case 'at-gate':
      return { text: 'at its gate', color: COLOUR.needs }
    case 'failed':
      return { text: 'failed', color: COLOUR.failed }
    case 'after':
    case 'behind':
      return { text: `after ${on.join(', ')}`, color: COLOUR.notStarted }
    case 'closed':
      return { text: 'closed', color: COLOUR.notStarted }
    default:
      return { text: 'waiting', color: COLOUR.notStarted }
  }
}

/** A task's line: its mark, number and title, its state at the right, the title giving way; a press opens its page. */
export const taskLineOf = (line: TaskLine, kit: Kit): Line => ({
  key: `task:${line.task}`,
  parts: spread([taskMark(line, kit), { text: ` ${line.task} ${line.title}`, color: COLOUR.body }], [taskState(line, kit)], kit.width),
  press: pageKey(`task:${line.task}`),
})

/** The progress bar's cells, done of all, filled in sage; none before the first task. */
function barOf({ done, total }: BuildView['progress']): Part[] {
  return total === 0 ? [] : [...progressBar(done, total, Math.min(BAR_CELLS, total)), { text: '  ' }]
}

/** How far the build has come, wrapping under its facts so the stop shows whole. */
function progressOf(progress: BuildView['progress']): Line {
  const { done, total, phase, phases, running: runs, stopped, untasked } = progress
  const far = untasked === null ? [`${done} of ${total} tasks done`, `phase ${phase} of ${phases}`] : [untasked]
  const facts = [...far, ...(runs > 0 ? [`${runs} running`] : [])]

  return {
    key: 'build:progress',
    marks: barOf(progress),
    wraps: true,
    parts: [
      { text: facts.join(' · '), color: COLOUR.secondary },
      ...(stopped ? [{ text: ' · ', color: COLOUR.secondary }, { text: `${MARK.needs} stopped until you answer`, color: COLOUR.needs }] : []),
    ],
  }
}

/** A phase's heading name, sage once complete, sky blue while still to come. */
const phaseName = ({ phase, name, state }: BuildPhase): Part => ({
  text: `PHASE ${phase} · ${name}`,
  bold: true,
  color: state === 'complete' ? COLOUR.done : COLOUR.sky,
})

/** A phase: one not yet written says so; a complete one folds; any other lists its tasks under its count. */
function phaseLines(phase: BuildPhase, kit: Kit): Line[] {
  const key = `phase:${phase.phase}`
  const tasks = () => phase.tasks.map(line => taskLineOf(line, kit))

  if (phase.state === 'not-written') {
    return [heading(key, phaseName(phase), [{ text: 'not yet written', color: COLOUR.secondary }], kit.width)]
  }

  if (phase.state === 'complete') {
    return [folding(key, phaseName(phase), [{ text: 'complete', color: COLOUR.done }], kit), ...(kit.isOpened(key) ? tasks() : []), blank(key)]
  }

  const summary: Part =
    phase.state === 'merging'
      ? { text: 'its merge waits on you', color: COLOUR.needs }
      : { text: `${phase.done} of ${phase.total} done`, color: COLOUR.secondary }

  return [heading(key, phaseName(phase), [summary], kit.width), ...tasks(), blank(key)]
}

/** The build's This session (the header's). */
export function buildLines(view: View, kit: Kit): Line[] {
  const build = view as BuildView

  return [
    titledLine('build:head', { text: build.title, bold: true }, [{ text: ` · ${build.type} · build phase`, color: COLOUR.secondary }], kit.width),
    progressOf(build.progress),
    blank('build:head'),
    ...waitingLines('build:waiting', build.waiting, kit),
    ...build.phases.flatMap(phase => phaseLines(phase, kit)),
  ]
}
