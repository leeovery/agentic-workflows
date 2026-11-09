/**
 * A bug's investigation on the board (20.12): This session in a bugfix's
 * investigation, and each part of its hunt read in full on its own page —
 * a hypothesis, an experiment, the root cause, what stepping back found
 * and an option of the fix direction (20.12.2); a call of Claude's opens
 * its entry.
 *
 * Its facts line, which ends in where it stands, wraps rather than lose
 * those words at the edge, as each question, decision and symptom does
 * under its mark. What runs turns: a validation being read, with its
 * clock, and the facts line while it validates. A validation's effort is
 * named only where it is above the medium every other agent runs at.
 */
import { COLOUR, INDENT, MARK, blank, counted, dayOf, heading, prose, spread, type Kit, type Line, type Part } from '../draw.ts'
import type { View } from '../model.ts'
import { pageKey } from '../pane.ts'
import type { ViewDrawing } from './index.ts'
import { header, section, titled } from './words.ts'

type Standing = 'investigating' | 'validating-root-cause' | 'fix-waits' | 'validating-fix' | 'concluded'
export type RaiseWait = {
  kind: string
  id: string
  text: string
  page: string | null
  raised_by: 'root-cause' | 'fix' | 'fix-direction' | null
  options: number | null
  lean_first: boolean | null
}
type Validation = { validation: 'root-cause' | 'fix'; effort: string | null; state: 'after' | 'not-started' | 'running' | 'lost' | 'done'; since: string | null; found: number }
type Option = { key: string; name: string; lean: boolean }

type Investigation = {
  unit: string
  title: string
  type: string
  project: string
  started: string | null
  standing: Standing
  waiting: RaiseWait[]
  decided: { id: string; text: string }[]
  symptoms: string[]
  hypotheses: { name: string; title: string; state: string }[]
  experiments: { name: string; title: string; showed: string }[]
  root_cause: { text: string; validated: boolean } | null
  validations: Validation[]
  since: { id: string; text: string }[]
  fix_direction: { state: 'after' | 'next' | 'asking' | 'picked'; stepped_back: string[]; options: Option[]; pick: string | null; fix: string | null }
}

/** Where it stands, at the end of its facts line: turning while it investigates or validates. */
function standingPart(standing: Standing, kit: Kit): Part[] {
  const turning = (words: string): Part[] => [kit.spinner(), { text: ` ${words}`, color: COLOUR.running }]

  switch (standing) {
    case 'concluded':
      return [{ text: `${MARK.done} concluded · the specification next`, color: COLOUR.done }]
    case 'fix-waits':
      return [{ text: `${MARK.needs} the fix direction waits on you`, color: COLOUR.needs }]
    case 'validating-root-cause':
      return turning('validating the root cause')
    case 'validating-fix':
      return turning('validating the fix')
    default:
      return turning('investigating')
  }
}

const confirmedOf = (view: Investigation) => view.hypotheses.filter(({ state }) => state === 'confirmed').length

function factsLine(view: Investigation, kit: Kit): Line {
  const counts = [counted(view.hypotheses.length, 'hypothesis', 'hypotheses'), `${confirmedOf(view)} confirmed`, counted(view.experiments.length, 'experiment')].join(' · ')

  return { key: 'hunt:facts', wraps: true, parts: [{ text: `${counts} · `, color: COLOUR.secondary }, ...standingPart(view.standing, kit)] }
}

/** What raised a question, as its second line says it. */
const RAISED: Readonly<Record<'root-cause' | 'fix', string>> = { 'root-cause': 'raised by the root-cause validation', fix: 'raised by the fix validation' }

/** What a validation raised, as a wait's second line says it; nothing for any other raise. */
const saidOf = (wait: RaiseWait): string => (wait.raised_by === 'root-cause' || wait.raised_by === 'fix' ? RAISED[wait.raised_by] : '')

/** The fix direction's wait by its options: Claude's lean first where it is the first row, else marked. */
const whichFix = (options: number, leanFirst: boolean | null) => `Which fix: ${counted(options, 'option')}, Claude's lean ${leanFirst === false ? 'marked' : 'first'}`

/**
 * A raise waiting in the investigation, on its view and on the unit's tab:
 * the fix direction's by its options, any other by its question; then what
 * raised it.
 */
export function raiseLines(wait: RaiseWait, key: string): Line[] {
  const said = saidOf(wait)
  const asked = wait.options === null ? wait.text : whichFix(wait.options, wait.lean_first)

  return [
    { key, mark: { text: `${MARK.needs} `, color: COLOUR.needs }, wraps: true, parts: [{ text: asked, color: COLOUR.body }] },
    ...(said === '' ? [] : [{ key: `${key}:said`, mark: { text: INDENT }, wraps: true, parts: [{ text: said, color: COLOUR.notStarted }] }]),
  ]
}

const waitingLines = (view: Investigation, width: number): Line[] =>
  section(
    heading('hunt:waiting', { text: 'WAITING ON YOU', bold: true, color: COLOUR.needs }, [{ text: `${view.waiting.length} · asked in the conversation`, color: COLOUR.secondary }], width),
    view.waiting.flatMap(wait => raiseLines(wait, `hunt:waiting:${wait.id}`)),
  )

const decidedLines = (view: Investigation, width: number): Line[] =>
  section(
    heading('hunt:decided', { text: 'DECIDED', bold: true, color: COLOUR.done }, [{ text: `${view.decided.length} · yours`, color: COLOUR.secondary }], width),
    view.decided.map(({ id, text }) => ({ key: `hunt:decided:${id}`, mark: { text: `${MARK.done} `, color: COLOUR.done }, wraps: true, parts: [{ text, color: COLOUR.body }], press: pageKey(`entry:${id}`) })),
  )

const symptomLines = (view: Investigation, width: number): Line[] =>
  section(
    heading('hunt:symptoms', { text: 'SYMPTOMS', bold: true, color: COLOUR.failed }, [{ text: `${view.symptoms.length}`, color: COLOUR.secondary }], width),
    view.symptoms.map((text, at) => ({ key: `hunt:symptom:${at}`, mark: { text: '· ', color: COLOUR.failed }, wraps: true, parts: [{ text, color: COLOUR.body }] })),
  )

/** A hypothesis's mark and its state's words, as its row and its page say them. */
const HYPOTHESIS: Readonly<Record<string, [Part, Part]>> = {
  confirmed: [{ text: MARK.done, color: COLOUR.done }, { text: 'confirmed', color: COLOUR.done }],
  'ruled-out': [{ text: MARK.cancelled, color: COLOUR.notStarted }, { text: 'ruled out', color: COLOUR.secondary }],
  intended: [{ text: MARK.cancelled, color: COLOUR.notStarted }, { text: 'intended · your rule', color: COLOUR.secondary }],
  suspected: [{ text: MARK.waiting, color: COLOUR.notStarted }, { text: 'suspected', color: COLOUR.notStarted }],
}

const hypothesisOf = (state: string): [Part, Part] => HYPOTHESIS[state] ?? [{ text: MARK.waiting, color: COLOUR.notStarted }, { text: state, color: COLOUR.secondary }]

const hypothesisLines = (view: Investigation, width: number): Line[] =>
  section(
    heading('hunt:hypotheses', { text: 'HYPOTHESES', bold: true, color: COLOUR.sky }, [{ text: `${confirmedOf(view)} confirmed`, color: COLOUR.secondary }], width),
    view.hypotheses.map(({ name, title, state }) => {
      const [mark, words] = hypothesisOf(state)

      return { key: `hunt:h:${name}`, parts: spread([mark, { text: ` ${name} ${title}`, color: COLOUR.body }], [words], width), press: pageKey(`hunt:${name}`) }
    }),
  )

const experimentLines = (view: Investigation, width: number): Line[] =>
  section(
    heading('hunt:experiments', { text: 'EXPERIMENTS', bold: true, color: COLOUR.violet }, [{ text: `${view.experiments.length}`, color: COLOUR.secondary }], width),
    view.experiments.map(({ name, title, showed }) => ({
      key: `hunt:e:${name}`,
      parts: spread([{ text: MARK.done, color: COLOUR.done }, { text: ` ${name} ${title}`, color: COLOUR.body }], [{ text: showed, color: COLOUR.secondary }], width),
      press: pageKey(`hunt:${name}`),
    })),
  )

/** The root cause's opening: its first sentence. */
const openingOf = (text: string) => text.split(/(?<=[.!?])\s/)[0] ?? text

const causeStanding = (validated: boolean) => (validated ? 'validated' : 'being validated')

const causeLines = (view: Investigation, width: number): Line[] =>
  view.root_cause === null
    ? []
    : section(heading('hunt:cause', { text: 'ROOT CAUSE', bold: true, color: COLOUR.failed }, [{ text: causeStanding(view.root_cause.validated), color: COLOUR.secondary }], width), [
        { key: 'hunt:root-cause', wraps: true, parts: [{ text: openingOf(view.root_cause.text), color: COLOUR.body }], press: pageKey('hunt:root-cause') },
      ])

/** An effort above the medium every other agent runs at, as the board names it. */
const ABOVE_MEDIUM: Readonly<Record<string, string>> = { high: 'high', xhigh: 'extra-high', max: 'max' }

/** A validation's name, with its effort where it runs above medium. */
function validationName({ validation, effort }: Validation): string {
  const named = effort === null ? undefined : ABOVE_MEDIUM[effort]

  return `${validation === 'root-cause' ? 'Root cause' : 'Fix'}${named === undefined ? '' : ` · ${named}`}`
}

/** What a validation waits on before what it validates is logged. */
const AFTER: Readonly<Record<Validation['validation'], string>> = { 'root-cause': 'after the root cause', fix: 'after the fix direction' }

/** A validation's mark and where it stands: its clock while it is read. */
function validationStanding(line: Validation, kit: Kit): [Part, Part] {
  switch (line.state) {
    case 'running':
      return [kit.spinner(), { text: line.since === null ? 'reading' : `reading ${kit.clock(line.since)}`, color: COLOUR.running }]
    case 'done':
      return [{ text: MARK.done, color: COLOUR.done }, { text: line.found === 0 ? 'nothing found' : `${line.found} found, acted on`, color: COLOUR.secondary }]
    case 'lost':
      return [{ text: MARK.failed, color: COLOUR.failed }, { text: 'lost', color: COLOUR.failed }]
    case 'not-started':
      return [{ text: MARK.waiting, color: COLOUR.notStarted }, { text: 'not started', color: COLOUR.notStarted }]
    default:
      return [{ text: MARK.waiting, color: COLOUR.notStarted }, { text: AFTER[line.validation], color: COLOUR.notStarted }]
  }
}

/** A validation's line: its mark, its name, and where it stands. */
function validationLine(line: Validation, kit: Kit): Line {
  const [mark, standing] = validationStanding(line, kit)

  return { key: `hunt:v:${line.validation}`, parts: spread([mark, { text: ` ${validationName(line)}`, color: COLOUR.body }], [standing], kit.width) }
}

const validationLines = (view: Investigation, kit: Kit): Line[] =>
  section(
    heading('hunt:validation', { text: 'VALIDATION', bold: true, color: COLOUR.sky }, [{ text: 'both always run', color: COLOUR.secondary }], kit.width),
    view.validations.map(line => validationLine(line, kit)),
  )

const callLines = (view: Investigation, width: number): Line[] =>
  section(
    heading('hunt:calls', { text: "CLAUDE'S CALLS", bold: true, color: COLOUR.gold }, [{ text: `${view.since.length} · since you last looked`, color: COLOUR.secondary }], width),
    view.since.map(({ id, text }) => ({ key: `hunt:call:${id}`, mark: { text: `${MARK.call} `, color: COLOUR.gold }, wraps: true, parts: [{ text, color: COLOUR.body }], press: pageKey(`entry:${id}`) })),
  )

/** The fix direction's heading summary, by where it stands: none while it is being set out, which its row says. */
function fixSummary({ fix_direction: fix }: Investigation): Part[] {
  const summary = fix.state === 'asking' ? counted(fix.options.length, 'option') : fix.state === 'picked' ? 'yours' : fix.state === 'after' ? 'after the root cause' : null

  return summary === null ? [] : [{ text: summary, color: COLOUR.secondary }]
}

/** An option's row: its key and name, Claude's lean marked while the person is asked, the person's pick once picked. */
function optionLine(view: Investigation, option: Option): Line {
  const fix = view.fix_direction
  const picked = fix.state === 'picked'
  const mark: Part = !picked ? { text: `${option.key} `, color: COLOUR.needs } : fix.pick === option.key ? { text: `${MARK.done} `, color: COLOUR.done } : { text: `${MARK.cancelled} `, color: COLOUR.notStarted }
  const said: Part[] = !picked ? (option.lean ? [{ text: " · Claude's lean", color: COLOUR.secondary }] : []) : fix.pick === option.key ? [{ text: ' · your pick', color: COLOUR.done }] : []

  return { key: `hunt:option:${option.key}`, mark, wraps: true, parts: [{ text: option.name, color: COLOUR.body }, ...said], press: pageKey(`option:${option.key}`) }
}

function fixLines(view: Investigation, width: number): Line[] {
  const fix = view.fix_direction
  const head = heading('hunt:fix', { text: 'FIX DIRECTION', bold: true, color: COLOUR.sky }, fixSummary(view), width)

  if (fix.state === 'after' || fix.state === 'next') {
    const words = fix.state === 'after' ? 'once the root cause is validated' : 'being set out'

    return [head, { key: 'hunt:fix:none', parts: [{ text: `${MARK.waiting} `, color: COLOUR.notStarted }, { text: words, color: COLOUR.notStarted }] }]
  }

  const back: Line[] =
    fix.stepped_back.length === 0
      ? []
      : [{ key: 'hunt:fix:back', wraps: true, parts: [{ text: `Stepped back first: ${fix.stepped_back.join(' ')}`, color: COLOUR.secondary }], press: pageKey('hunt:stepped-back') }]
  const ownWords: Line[] =
    fix.state === 'picked' && fix.pick === null && fix.fix !== null
      ? [{ key: 'hunt:fix:own', mark: { text: `${MARK.done} `, color: COLOUR.done }, wraps: true, parts: [{ text: fix.fix, color: COLOUR.body }, { text: ' · yours', color: COLOUR.done }] }]
      : []

  return [head, ...back, ...fix.options.map(option => optionLine(view, option)), ...ownWords]
}

const investigationLines = (view: Investigation, kit: Kit): Line[] => [
  ...header('hunt', view.title, [{ text: ' · investigation', color: COLOUR.secondary }], [view.project, view.type, ...(view.started === null ? [] : [`started ${dayOf(view.started)}`])].join(' · '), kit.width),
  factsLine(view, kit),
  blank('hunt:head'),
  ...waitingLines(view, kit.width),
  ...decidedLines(view, kit.width),
  ...symptomLines(view, kit.width),
  ...hypothesisLines(view, kit.width),
  ...experimentLines(view, kit.width),
  ...causeLines(view, kit.width),
  ...validationLines(view, kit),
  ...callLines(view, kit.width),
  ...fixLines(view, kit.width),
]

type HuntPage = { item: 'hypothesis' | 'experiment' | 'root-cause' | 'stepped-back' | 'option'; name: string | null; title: string; state: string | null; text: string }

const AN_OPTION: Part = { text: 'an option', color: COLOUR.secondary }

/** An option's standing on its page. */
const OPTION: Readonly<Record<string, Part>> = {
  lean: { text: "Claude's lean", color: COLOUR.secondary },
  picked: { text: `${MARK.done} your pick`, color: COLOUR.done },
  option: AN_OPTION,
}

/** A page's title and where it stands, by what it reads. */
function pageHead(page: HuntPage): [string, Part] {
  switch (page.item) {
    case 'hypothesis':
      return [`${page.name} ${page.title}`, hypothesisOf(page.state ?? '')[1]]
    case 'experiment':
      return [`${page.name} ${page.title}`, { text: page.state ?? '', color: COLOUR.secondary }]
    case 'root-cause':
      return ['Root cause', { text: causeStanding(page.state === 'validated'), color: COLOUR.secondary }]
    case 'stepped-back':
      return ['What stepping back found', { text: 'before the options', color: COLOUR.secondary }]
    default:
      return [`${page.name} ${page.title}`, OPTION[page.state ?? ''] ?? AN_OPTION]
  }
}

/** A part of the hunt read in full: its title, where it stands, and its words. */
function huntPageLines(page: HuntPage, kit: Kit): Line[] {
  const [title, standing] = pageHead(page)

  return [...titled('hunt:page', [{ text: title, bold: true }], [standing], kit.width), ...prose('hunt:page:text', page.text)]
}

export const INVESTIGATION: ViewDrawing = {
  lines: (view, kit) => investigationLines(view as View & Investigation, kit),
  name: () => 'the investigation',
}

export const HUNT: ViewDrawing = {
  lines: (view, kit) => huntPageLines(view as View & HuntPage, kit),
  name: view => pageHead(view as View & HuntPage)[0],
}
