/**
 * A unit's page on the board: the epic's page (20.8, 20.15.2) — This
 * session at its menu, and the epic's tab — and any other unit's tab
 * (20.15.1), which an epic shows too while its discovery runs before any
 * topic exists; and a finished phase of a linear unit read in full
 * (20.15.3).
 *
 * A topic, a stage or a phase under way that a session is in turns its ◐;
 * one no session is in is sky blue and still. Each line whose words carry
 * what waits — a topic's session and messages, the specification's count to
 * go — wraps under its mark rather than lose them at the edge. WAITING ON
 * YOU draws the questions the board holds only on the page of the unit the
 * session is in; any other unit's lists its own by their words.
 */
import { BAR_CELLS, COLOUR, INDENT, MARK, blank, counted, dayOf, heading, progressBar, prose, spread, type Kit, type Line, type Part } from '../draw.ts'
import type { View } from '../model.ts'
import { pageKey, tabKey } from '../pane.ts'
import type { ViewDrawing } from './index.ts'
import { STILL, latelyLines, phaseName, pointsSection, section, type Moment } from './words.ts'

type Session = 'this' | 'other' | null
type Now = { phase: string; since: string | null }

type TopicLine = {
  topic: string
  title: string
  state: 'decided' | 'discussing' | 'next' | 'not-started'
  decided: number
  total: number
  session: Session
  messages: number
  experiment: { id: string; running: boolean } | null
}

type Stage<State> = { state: State; session: Session }

type Epic = {
  unit: string
  title: string
  about: string
  started: string | null
  now: Now
  at_menu: boolean
  progress: { decided: number; total: number; discussing: number }
  topics: TopicLine[]
  spec: Stage<'waits' | 'running' | 'asking' | 'ready' | 'complete'>
  build: Stage<'waits' | 'building' | 'reviewing' | 'stopped' | 'finish' | 'complete'>
  set_aside: { topic: string; title: string; state: 'cancelled' | 'postponed'; horizon: string | null }[]
  lately: Moment[]
}

/** The head of a unit's page: its name and type, at its menu where the session is. */
const headOf = (title: string, type: string, atMenu: boolean): Line => ({
  key: 'unit:head',
  parts: [{ text: title, bold: true }, { text: ` · ${type}`, color: COLOUR.secondary }, ...(atMenu ? [{ text: ' · at its menu', color: COLOUR.running }] : [])],
})

/** What a unit is doing in each phase, as its dates line says it. */
const DOING: Readonly<Record<string, string>> = {
  discovery: 'in discovery',
  discussion: 'in discussion',
  investigation: 'investigating',
  specification: 'specifying',
  build: 'building',
  review: 'in review',
}

/** Where a unit has come to, on its dates line: the phase it is in since the day it began, its one session, or complete. */
function nowWords({ phase, since }: Now): string {
  if (phase === 'complete') {
    return since === null ? 'complete' : `complete ${dayOf(since)}`
  }

  if (phase === 'implementation') {
    return 'one session'
  }

  const doing = DOING[phase] ?? `in ${phase}`

  return since === null ? doing : `${doing} since ${dayOf(since)}`
}

const datesOf = (started: string | null, standing: string): Line => ({
  key: 'unit:dates',
  parts: [{ text: [...(started === null ? [] : [`started ${dayOf(started)}`]), standing].join(' · '), color: COLOUR.secondary }],
})

/** What runs where a session is in it turns; what runs where none is stands still. */
const runningMark = (session: Session, kit: Kit): Part => (session === null ? STILL : kit.spinner())

/** A topic's mark: decided, under way — turning where a session is in it, else still — or not started. */
function topicMark(topic: TopicLine, kit: Kit): Part {
  if (topic.state === 'decided') {
    return { text: MARK.done, color: COLOUR.done }
  }

  return topic.state === 'discussing' ? runningMark(topic.session, kit) : { text: MARK.waiting, color: COLOUR.notStarted }
}

/** Where a topic stands, at its row's right. */
const TOPIC_STANDING: Readonly<Record<TopicLine['state'], (topic: TopicLine) => Part>> = {
  decided: () => ({ text: 'decided', color: COLOUR.done }),
  discussing: ({ decided, total }) => ({ text: `${decided} of ${total} decided`, color: COLOUR.secondary }),
  next: () => ({ text: 'next', color: COLOUR.running }),
  'not-started': () => ({ text: 'not started', color: COLOUR.notStarted }),
}

/** What a topic's second line says: the experiment it waits on, where a session is, and the messages waiting. */
function topicFacts({ experiment, session, messages }: TopicLine): Part[] {
  const facts: Part[] = [
    ...(experiment === null
      ? []
      : [experiment.running ? { text: `${experiment.id} running`, color: COLOUR.running } : { text: `${experiment.id} concluded · the report waits`, color: COLOUR.needs }]),
    ...(session === null ? [] : [{ text: session === 'this' ? 'this session' : 'another session', color: COLOUR.running }]),
    ...(messages === 0 ? [] : [{ text: `${counted(messages, 'message')} waiting`, color: COLOUR.needs }]),
  ]

  return facts.flatMap((fact, at) => (at === 0 ? [fact] : [{ text: ' · ', color: COLOUR.secondary }, fact]))
}

/** A topic's row, opening This session for the topic the session is in and the topic's page for any other. */
function topicLines(topic: TopicLine, kit: Kit): Line[] {
  const facts = topicFacts(topic)

  return [
    {
      key: `epic:topic:${topic.topic}`,
      parts: spread([topicMark(topic, kit), { text: ` ${topic.title}`, color: COLOUR.body }], [TOPIC_STANDING[topic.state](topic)], kit.width),
      press: topic.session === 'this' ? tabKey('this') : pageKey(`topic:${topic.topic}`),
    },
    ...(facts.length === 0 ? [] : [{ key: `epic:topic:${topic.topic}:facts`, mark: { text: INDENT }, wraps: true, parts: facts }]),
  ]
}

/** A stage's one row under its heading: its mark, name and where it stands, wrapping under its mark. */
const stageLine = (key: string, mark: Part, name: string, words: Part): Line => ({
  key,
  mark: { ...mark, text: `${mark.text} ` },
  wraps: true,
  parts: [{ text: name, color: COLOUR.body }, { ...words, text: ` · ${words.text}` }],
})

const DONE: Part = { text: MARK.done, color: COLOUR.done }
const LATER: Part = { text: MARK.waiting, color: COLOUR.notStarted }
const NEEDS: Part = { text: MARK.needs, color: COLOUR.needs }

/** What waits on the person in a stage, in its words. */
const STAGE_NEEDS: Readonly<Record<string, string>> = {
  asking: 'waits on your answer',
  ready: 'ready to build · waits on you',
  stopped: 'stopped',
  finish: 'finish waits on you',
}

/** A stage's row while it waits on the person: flagged, saying for what. */
const needsLine = (key: string, name: string, state: string): Line => stageLine(key, NEEDS, name, { text: STAGE_NEEDS[state] ?? '', color: COLOUR.needs })

/** The specification's row: what it waits on, being written, waiting on the person's answer or their yes, or complete. */
function specLine({ spec, progress }: Epic, kit: Kit): Line {
  const name = 'Specification'

  if (spec.state === 'complete') {
    return stageLine('epic:spec', DONE, name, { text: 'complete', color: COLOUR.secondary })
  }

  if (spec.state === 'asking' || spec.state === 'ready') {
    return needsLine('epic:spec', name, spec.state)
  }

  if (spec.state === 'running') {
    return stageLine('epic:spec', runningMark(spec.session, kit), name, { text: 'being written', color: COLOUR.secondary })
  }

  const left = progress.total - progress.decided

  return stageLine('epic:spec', LATER, name, { text: left === 0 ? 'next' : `waits until every topic is decided · ${left} to go`, color: COLOUR.notStarted })
}

/** The build and review's row: after the specification, building, in review, stopped, finish waiting on the person, or complete. */
function buildLine({ build }: Epic, kit: Kit): Line {
  const name = 'Build and review'

  if (build.state === 'waits') {
    return stageLine('epic:build', LATER, name, { text: 'after the specification', color: COLOUR.notStarted })
  }

  if (build.state === 'complete') {
    return stageLine('epic:build', DONE, name, { text: 'complete', color: COLOUR.secondary })
  }

  if (build.state === 'stopped' || build.state === 'finish') {
    return needsLine('epic:build', name, build.state)
  }

  return stageLine('epic:build', runningMark(build.session, kit), name, { text: build.state === 'building' ? 'building' : 'in review', color: COLOUR.secondary })
}

/** Where the epic has come to, on its dates line: its discovery complete the day the map was approved until a topic starts, then in discussion; past it, the phase it is in. */
function epicStanding({ now, progress }: Epic): string {
  if (now.phase !== 'discussion') {
    return nowWords(now)
  }

  if (progress.decided > 0 || progress.discussing > 0) {
    return 'in discussion'
  }

  return now.since === null ? 'discovery complete' : `discovery complete ${dayOf(now.since)}`
}

/** A topic set aside, opening its page. */
const asideLine = (aside: Epic['set_aside'][number], width: number): Line => ({
  key: `epic:aside:${aside.topic}`,
  parts: spread(
    [aside.state === 'cancelled' ? { text: MARK.cancelled, color: COLOUR.notStarted } : { text: MARK.postponed, color: COLOUR.violet }, { text: ` ${aside.title}`, color: COLOUR.body }],
    [aside.state === 'cancelled' ? { text: 'cancelled', color: COLOUR.notStarted } : { text: `postponed${aside.horizon === null ? '' : ` · roadmap ${aside.horizon}`}`, color: COLOUR.violet }],
    width,
  ),
  press: pageKey(`topic:${aside.topic}`),
})

const stageHeading = (key: string, name: string, width: number, summary: Part[] = []) => heading(key, { text: name, bold: true, color: COLOUR.sky }, summary, width)

function epicLines(view: Epic, kit: Kit): Line[] {
  const { decided, total, discussing } = view.progress
  const of = `${decided} of ${total}`

  return [
    headOf(view.title, 'epic', view.at_menu),
    ...prose('unit:about', view.about),
    datesOf(view.started, epicStanding(view)),
    {
      key: 'unit:progress',
      parts: [...progressBar(decided, total, BAR_CELLS), { text: `  ${decided} of ${counted(total, 'topic')} decided${discussing > 0 ? ` · ${discussing} in discussion` : ''}`, color: COLOUR.secondary }],
    },
    blank('unit:head'),
    stageHeading('epic:discovery', 'DISCOVERY', kit.width, [{ text: `${of} decided`, color: COLOUR.secondary }]),
    ...view.topics.flatMap(topic => topicLines(topic, kit)),
    blank('epic:discovery'),
    stageHeading('epic:definition', 'DEFINITION', kit.width),
    specLine(view, kit),
    blank('epic:definition'),
    stageHeading('epic:delivery', 'DELIVERY', kit.width),
    buildLine(view, kit),
    blank('epic:delivery'),
    ...section(
      heading('epic:aside', { text: 'SET ASIDE', bold: true, color: COLOUR.secondary }, [{ text: `${view.set_aside.length}`, color: COLOUR.secondary }], kit.width),
      view.set_aside.map(aside => asideLine(aside, kit.width)),
    ),
    ...latelyLines('epic:lately', view.lately, kit),
  ]
}

type Phase = { phase: string; state: 'complete' | 'running' | 'stopped' | 'waits' | 'later'; words: string; on: string | null; session: Session; page: boolean }
type Waiting = { kind: 'map' | 'gap' | 'ready' | 'question' | 'finish'; id: string; text: string }

type Unit = {
  unit: string
  title: string
  type: string
  about: string
  started: string | null
  now: Now
  at_menu: boolean
  here: boolean
  progress: { complete: number; total: number }
  waiting: Waiting[]
  phases: Phase[]
  lately: Moment[]
}

/** What a phase under way is doing, at its row's right. */
const RUNNING: Readonly<Record<string, string>> = {
  discovery: 'shaping',
  discussion: 'discussing',
  investigation: 'investigating',
  specification: 'in review',
  build: 'building',
  review: 'reviewing',
  implementation: 'working',
}

/** The types whose tab's progress line names the phase the unit is in. */
const SAYS_PHASE: ReadonlySet<string> = new Set(['feature', 'cross-cutting'])

/** Where a unit has come to that its tab's progress line never names: discovery, where it begins, and complete. */
const UNNAMED: ReadonlySet<string> = new Set(['discovery', 'complete'])

/** Each phase's row on the unit's tab, the epic's build and review one stage while its discovery runs. */
function phasesOf(view: Unit): Phase[] {
  if (view.type !== 'epic') {
    return view.phases
  }

  return [...view.phases.filter(({ phase }) => phase !== 'build' && phase !== 'review'), { phase: 'build and review', state: 'later', words: '', on: null, session: null, page: false }]
}

/** What a press on a phase's row opens: This session for the phase the session is in, else a finished phase's own page. */
function phasePress(phase: Phase): string | undefined {
  if (phase.session === 'this') {
    return tabKey('this')
  }

  return phase.page ? pageKey(`phase:${phase.phase}`) : undefined
}

/** A phase's row: what it produced, and where it stands — complete on its day, under way, stopped, waiting on the person, or what it comes after. */
function phaseLine(phase: Phase, before: Phase | undefined, kit: Kit): Line {
  const name: Part[] = [{ text: ` ${phaseName(phase.phase)}`, color: COLOUR.body }, ...(phase.words === '' || phase.state === 'later' ? [] : [{ text: ` · ${phase.words}`, color: COLOUR.secondary }])]
  const press = phasePress(phase)
  const row = (mark: Part, standing: Part): Line => ({ key: `unit:phase:${phase.phase}`, parts: spread([mark, ...name], [standing], kit.width), ...(press === undefined ? {} : { press }) })

  if (phase.state === 'complete') {
    return row(DONE, { text: phase.on === null ? 'complete' : `complete ${dayOf(phase.on)}`, color: COLOUR.done })
  }

  if (phase.state === 'stopped' || phase.state === 'waits') {
    return row(NEEDS, { text: phase.state === 'stopped' ? 'stopped' : 'waits on you', color: COLOUR.needs })
  }

  if (phase.state === 'running') {
    return row(runningMark(phase.session, kit), { text: RUNNING[phase.phase] ?? 'under way', color: COLOUR.running })
  }

  const after = phase.words !== '' ? phase.words : before === undefined ? '' : `after the ${before.phase}`

  return row(LATER, { text: after, color: COLOUR.notStarted })
}

/** What waits on the person, by its words: the map with what it holds, a gap by its words, ready to build's yes, a question by its number, finish. */
const WAITING_WORDS: Readonly<Record<Waiting['kind'], (waiting: Waiting) => string>> = {
  map: ({ text }) => `Approve the map: ${text}`,
  gap: ({ text }) => text,
  ready: () => 'Ready to build: the outline and the phase cut, for your yes',
  question: ({ id, text }) => `${id} ${text}`,
  finish: () => 'Finish: the report of every round, and your verdict on each call you changed',
}

/** WAITING ON YOU's count: a build's questions wait on the board, a spec's gaps and its yes are asked in the conversation. */
const waitingCount = (waiting: readonly Waiting[]) => (waiting.every(({ kind }) => kind === 'question') ? `${waiting.length}` : `${waiting.length} · asked in the conversation`)

/**
 * WAITING ON YOU on the unit's tab: on the unit the session is in, its
 * build's questions as every view lists them, the board holding them; else
 * each by its words — a build's waiting on the board, the rest asked in the
 * conversation.
 */
function waitingLines(view: Unit, kit: Kit): Line[] {
  if (view.waiting.length === 0) {
    return []
  }

  const held = kit.waiting()

  if (view.here && view.waiting.every(({ kind }) => kind === 'question') && held.length > 0) {
    return held
  }

  return section(
    heading('unit:waiting', { text: 'WAITING ON YOU', bold: true, color: COLOUR.needs }, [{ text: waitingCount(view.waiting), color: COLOUR.secondary }], kit.width),
    view.waiting.map(waiting => ({
      key: `unit:waiting:${waiting.id}`,
      mark: { text: `${MARK.needs} `, color: COLOUR.needs },
      wraps: true,
      parts: [{ text: WAITING_WORDS[waiting.kind](waiting), color: COLOUR.body }],
    })),
  )
}

function unitLines(view: Unit, kit: Kit): Line[] {
  const phases = phasesOf(view)
  const complete = phases.filter(({ state }) => state === 'complete').length
  const inPhase = SAYS_PHASE.has(view.type) && !UNNAMED.has(view.now.phase) ? ` · in ${view.now.phase}` : ''

  return [
    headOf(view.title, view.type, view.at_menu),
    ...prose('unit:about', view.about),
    datesOf(view.started, nowWords(view.now)),
    { key: 'unit:progress', parts: [...progressBar(complete, phases.length, phases.length), { text: `  ${complete} of ${counted(phases.length, 'phase')} complete${inPhase}`, color: COLOUR.secondary }] },
    blank('unit:head'),
    ...waitingLines(view, kit),
    heading('unit:phases', { text: 'PHASES', bold: true, color: COLOUR.sky }, [], kit.width),
    ...phases.map((phase, at) => phaseLine(phase, phases[at - 1], kit)),
    blank('unit:phases'),
    ...latelyLines('unit:lately', view.lately, kit),
  ]
}

/** A finished phase's sections' colour on its page: the discussion's decisions sage, as DECIDED is; else sky blue. */
const PAGE_COLOUR: Readonly<Record<string, string>> = { discussion: COLOUR.done }

type PhasePage = { title: string; phase: string; on: string | null; words: string; sections: { heading: string; text: string }[] }

/** A finished phase read in full: the day it closed and what it produced, then each of its sections, counted. */
const phasePageLines = (page: PhasePage, kit: Kit): Line[] => [
  { key: 'phase:title', wraps: true, parts: [{ text: phaseName(page.phase), bold: true }, { text: ` · ${page.title}`, color: COLOUR.secondary }] },
  {
    key: 'phase:standing',
    wraps: true,
    parts: [{ text: `${MARK.done} complete${page.on === null ? '' : ` ${dayOf(page.on)}`}`, color: COLOUR.done }, ...(page.words === '' ? [] : [{ text: ` · ${page.words}`, color: COLOUR.secondary }])],
  },
  blank('phase:head'),
  ...page.sections.flatMap((held, at) => pointsSection(`phase:${at}`, held.heading, held.text, PAGE_COLOUR[page.phase] ?? COLOUR.sky, kit.width)),
]

export const EPIC: ViewDrawing = {
  lines: (view, kit) => epicLines(view as View & Epic, kit),
  name: view => (view as View & Epic).title,
}

export const UNIT: ViewDrawing = {
  lines: (view, kit) => unitLines(view as View & Unit, kit),
  name: view => (view as View & Unit).title,
}

export const PHASE: ViewDrawing = {
  lines: (view, kit) => phasePageLines(view as View & PhasePage, kit),
  name: view => `the ${(view as View & PhasePage).phase}`,
}
