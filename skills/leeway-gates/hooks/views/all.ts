/**
 * All work on the board (20.16): the project's units in progress, its
 * roadmap, its inbox by kind and its units complete, folded.
 *
 * A unit's second line, which ends in where a session is, wraps under its
 * indent rather than lose those words at the edge; an inbox item is one
 * line, cut with "…". The head's project name gives way with "…"; where
 * the session stands never does.
 */
import { COLOUR, INDENT, MARK, RUNNING_FRAMES, blank, counted, cutTo, folding, heading, spread, widthOf, type Kit, type Line, type Part } from '../draw.ts'
import type { View } from '../model.ts'
import { pageKey, tabKey } from '../pane.ts'
import type { ViewDrawing } from './index.ts'

type Work = { unit: string; title: string; type: string; phase: string; standing: string; waiting: number; session: 'this' | 'other' | null }

type All = {
  project: string
  at_start: boolean
  waiting: number
  units: Work[]
  roadmap: { horizon: string; items: { title: string; from: string | null }[] }[]
  inbox: { kind: string; title: string }[]
  complete: { unit: string; title: string; type: string }[]
}

const SESSIONS: Readonly<Record<'this' | 'other', string>> = { this: 'this session', other: 'another session' }

/** A unit in progress: its name with what waits on the person, opening its page — this session's unit its tab — then its type, phase, standing and where a session is. */
function workLines(work: Work, width: number): Line[] {
  const mark: Part = work.session === null ? { text: MARK.waiting, color: COLOUR.notStarted } : { text: RUNNING_FRAMES[0], color: COLOUR.running }
  const facts = [work.type, work.phase, ...(work.standing === '' ? [] : [work.standing]), ...(work.session === null ? [] : [SESSIONS[work.session]])]

  return [
    {
      key: `all:${work.unit}`,
      parts: spread([mark, { text: ` ${work.title}`, color: COLOUR.body }], work.waiting === 0 ? [] : [{ text: `${MARK.needs} ${work.waiting} waiting`, color: COLOUR.needs }], width),
      press: work.session === 'this' ? tabKey('unit') : pageKey(`unit:${work.unit}`),
    },
    { key: `all:${work.unit}:facts`, mark: { text: INDENT }, wraps: true, parts: [{ text: facts.join(' · '), color: COLOUR.secondary }] },
  ]
}

/** The kinds an inbox holds, each with its mark and colour, and how its count reads. */
const KINDS: readonly { kind: string; mark: Part; one: string; many: string; always: boolean }[] = [
  { kind: 'idea', mark: { text: MARK.call, color: COLOUR.gold }, one: 'idea', many: 'ideas', always: true },
  { kind: 'bug', mark: { text: MARK.failed, color: COLOUR.failed }, one: 'bug', many: 'bugs', always: true },
  { kind: 'quick-fix', mark: { text: MARK.call, color: COLOUR.gold }, one: 'quick-fix', many: 'quick-fixes', always: false },
]

/** The inbox's count by kind: its ideas and bugs, and its quick-fixes where it holds any. */
function inboxSummary(inbox: All['inbox']): string {
  return KINDS.flatMap(({ kind, one, many, always }) => {
    const count = inbox.filter(item => item.kind === kind).length

    return always || count > 0 ? [counted(count, one, many)] : []
  }).join(' · ')
}

function inboxLines(view: All, width: number): Line[] {
  const items = KINDS.flatMap(({ kind, mark }) => view.inbox.filter(item => item.kind === kind).map(item => ({ item, mark })))

  return [
    heading('all:inbox', { text: 'INBOX', bold: true, color: COLOUR.gold }, [{ text: inboxSummary(view.inbox), color: COLOUR.secondary }], width),
    ...items.map(({ item, mark }, at) => ({ key: `all:inbox:${at}`, parts: cutTo([{ ...mark, text: `${mark.text} ` }, { text: item.title, color: COLOUR.body }], width) })),
  ]
}

function roadmapLines(view: All, width: number): Line[] {
  const waiting = view.roadmap.reduce((sum, { items }) => sum + items.length, 0)

  return [
    heading('all:roadmap', { text: 'ROADMAP', bold: true, color: COLOUR.violet }, [{ text: `${waiting} waiting`, color: COLOUR.secondary }], width),
    ...view.roadmap.flatMap(({ horizon, items }) => [
      { key: `all:roadmap:${horizon}`, parts: [{ text: horizon, color: COLOUR.secondary }] },
      ...items.map((item, at) => ({ key: `all:roadmap:${horizon}:${at}`, parts: roadmapParts(item, width) })),
    ]),
  ]
}

/** A roadmap item's row: its title cut to leave whole the epic it was postponed from. */
function roadmapParts({ title, from }: All['roadmap'][number]['items'][number], width: number): Part[] {
  const postponed = from === null ? [] : [{ text: ` · postponed from ${from}`, color: COLOUR.secondary }]

  return [...cutTo([{ text: `${MARK.call} `, color: COLOUR.violet }, { text: title, color: COLOUR.body }], width - widthOf(postponed)), ...postponed]
}

function completeLines(view: All, kit: Kit): Line[] {
  if (view.complete.length === 0) {
    return []
  }

  const open = kit.isOpened('all:complete')

  return [
    blank('all:inbox'),
    folding('all:complete', { text: 'COMPLETE', bold: true, color: COLOUR.done }, [{ text: `${view.complete.length}`, color: COLOUR.secondary }], kit),
    ...(open
      ? view.complete.flatMap(done => [
          { key: `all:done:${done.unit}`, parts: [{ text: MARK.done, color: COLOUR.done }, { text: ` ${done.title}`, color: COLOUR.body }], press: pageKey(`unit:${done.unit}`) },
          { key: `all:done:${done.unit}:facts`, parts: [{ text: `${INDENT}${done.type}`, color: COLOUR.secondary }] },
        ])
      : []),
  ]
}

function headLine(view: All, width: number): Line {
  const standing: Part[] = view.at_start ? [{ text: ' · at the start menu', color: COLOUR.running }] : []
  const name = cutTo([{ text: 'All work', bold: true }, { text: ` · ${view.project}`, color: COLOUR.secondary }], width - widthOf(standing))

  return { key: 'all:head', parts: [...name, ...standing] }
}

function allLines(view: All, kit: Kit): Line[] {
  const facts: Part[] = [
    { text: `${view.units.length} in progress`, color: COLOUR.secondary },
    ...(view.waiting === 0 ? [] : [{ text: ' · ', color: COLOUR.secondary }, { text: `${MARK.needs} ${view.waiting} waiting on you`, color: COLOUR.needs }]),
    { text: ` · ${view.complete.length} complete`, color: COLOUR.secondary },
  ]

  return [
    headLine(view, kit.width),
    { key: 'all:facts', wraps: true, parts: facts },
    blank('all:head'),
    heading('all:progress', { text: 'IN PROGRESS', bold: true, color: COLOUR.sky }, [{ text: `${view.units.length}`, color: COLOUR.secondary }], kit.width),
    ...view.units.flatMap(work => workLines(work, kit.width)),
    blank('all:progress'),
    ...roadmapLines(view, kit.width),
    blank('all:roadmap'),
    ...inboxLines(view, kit.width),
    ...completeLines(view, kit),
  ]
}

export const ALL: ViewDrawing = {
  lines: (view, kit) => allLines(view as View & All, kit),
  name: () => 'all work',
}
