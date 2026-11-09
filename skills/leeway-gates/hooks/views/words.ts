/**
 * What the board's views other than the build's and the review's share: a
 * page's title, standing and rule; a line's facts under its indent; a
 * document's sections as the board lists them; and a moment of a unit
 * lately in words, with its mark and when.
 *
 * A line's facts say what it waits on, and wrap under the indent rather
 * than lose those words at the edge, the button that reads it in full on
 * the last of its rows.
 */
import { COLOUR, INDENT, MARK, RUNNING_FRAMES, blank, heading, prose, spread, titledLine, whenOf, wrappedRows, type Kit, type Line, type Part } from '../draw.ts'
import { pageKey } from '../pane.ts'

/** A view's header, `width` cells across: its title in bold, giving way with "…", with what it is whole, then its facts, wrapping rather than lose any at the edge (20.4.5). */
export const header = (key: string, title: string, rest: readonly Part[], facts: string, width: number): Line[] => [
  titledLine(`${key}:head`, { text: title, bold: true }, rest, width),
  { key: `${key}:where`, wraps: true, parts: [{ text: facts, color: COLOUR.secondary }] },
]

/** A page's title, wrapping, its standing beneath, and the rule under them. */
export const titled = (key: string, title: Part[], standing: readonly Part[], width: number): Line[] => [
  { key: `${key}:title`, wraps: true, parts: title },
  ...(standing.length === 0 ? [] : [{ key: `${key}:standing`, wraps: true, parts: [...standing] }]),
  heading(`${key}:rule`, { text: '' }, [], width),
]

/** The button that reads a line in full. */
export const READ = '▸ read'

/**
 * A line's facts under its indent, wrapping, the button that reads `ref` in
 * full on its last row — that row wrapped again to leave the cell between
 * its words and the button, so no word of it is cut at the edge.
 */
export function factLines(key: string, said: string, width: number, ref?: string): Line[] {
  const button = ref === undefined ? undefined : { key: pageKey(ref), label: READ }
  const room = width - (button?.label.length ?? 0)
  const wrapped = wrappedRows(said, room - INDENT.length)
  const rows = button === undefined ? wrapped : [...wrapped.slice(0, -1), ...wrappedRows(wrapped.at(-1) ?? '', room - INDENT.length - 1)]

  return rows.map((row, at) => {
    const parts = [{ text: `${INDENT}${row}`, color: COLOUR.notStarted }]

    if (at < rows.length - 1) return { key: `${key}:${at}`, parts }
    return button === undefined ? { key, parts } : { key, parts: spread(parts, [], room), button }
  })
}

/** A section's lines, its heading first and a blank after it; nothing where it holds nothing. */
export const section = (head: Line, lines: readonly Line[]): Line[] => (lines.length === 0 ? [] : [head, ...lines, blank(head.key)])

/** Sections of a spec named by number, as the board lists them: "§1, 4, 15". */
export const sectionsOf = (numbers: readonly string[]) => (numbers.length === 0 ? 'nothing' : `§${numbers.join(', ')}`)

/** A document's section as the board lists it: its heading in capitals with its count, each of its points as prose, its items under their marks in its colour. */
export function pointsSection(key: string, name: string, text: string, color: string, width: number): Line[] {
  const points = prose(key, text, COLOUR.body, color)

  return section(heading(key, { text: name.toUpperCase(), bold: true, color }, [{ text: `${points.length}`, color: COLOUR.secondary }], width), points)
}

/** What runs, in a view the person reads while nothing in it is under way in any session: ◐ in sky blue, still. */
export const STILL: Part = { text: RUNNING_FRAMES[0], color: COLOUR.sky }

/** A moment of a unit lately, as the engine carries it. */
export type Moment = { kind: string; at: string; topic: string | null; detail: string | null; count?: number }

const mark = (text: string, color: string): Part => ({ text, color })

/** A phase's name as a sentence starts it. */
export const phaseName = (phase: string) => `${phase.charAt(0).toUpperCase()}${phase.slice(1)}`

/** A type with its article: "an epic", "a feature". */
const typed = (type: string) => `${/^[aeiou]/.test(type) ? 'an' : 'a'} ${type}`

/** Messages a topic took in, by how many and, for one, who sent it. */
const tookIn = ({ topic, detail, count = 1 }: Moment) =>
  count > 1 ? `${topic} took in ${count} messages` : `${topic} took in a message${detail === null ? '' : ` from ${detail}`}`

/** Each moment's mark and words, by its kind. */
const MOMENTS: Readonly<Record<string, (moment: Moment) => [Part, string]>> = {
  created: ({ detail }) => [mark(MARK.done, COLOUR.done), detail === null ? 'Started' : `Started as ${typed(detail)}`],
  'map-approved': ({ detail }) => [mark(MARK.done, COLOUR.done), `Map approved${detail === null ? '' : ` · ${detail}`}`],
  postponed: ({ topic, detail }) => [mark(MARK.postponed, COLOUR.violet), `${topic} postponed to the roadmap${detail === null ? '' : ` · ${detail}`}`],
  cancelled: ({ topic }) => [mark(MARK.cancelled, COLOUR.notStarted), `${topic} cancelled`],
  reactivated: ({ topic }) => [mark(MARK.waiting, COLOUR.notStarted), `${topic} back on the map`],
  moved: ({ detail }) => [mark(MARK.done, COLOUR.done), detail === null ? 'Moved' : `Became ${typed(detail)}`],
  sent: ({ topic, detail }) => [mark(MARK.message, COLOUR.gold), detail === null ? `A message sent to ${topic}` : `${detail} sent a message to ${topic}`],
  answered: moment => [mark(MARK.message, COLOUR.gold), tookIn(moment)],
  'spec-landed': ({ detail }) => [mark(MARK.done, COLOUR.done), `Specification written${detail === null ? '' : ` · ${detail}`}`],
  pass: ({ detail }) => [mark(MARK.round, COLOUR.violet), `Pass ${detail}`],
  asked: ({ detail }) => [mark(MARK.needs, COLOUR.needs), `Pass ${detail}`],
  round: ({ detail }) => [mark(MARK.round, COLOUR.violet), `Review round ${detail}`],
  completed: () => [mark(MARK.done, COLOUR.done), 'Complete'],
  started: ({ topic, detail }) => [mark(RUNNING_FRAMES[0], COLOUR.running), `${topic ?? phaseName(detail ?? 'a phase')} started`],
  raised: ({ detail }) => [mark(MARK.needs, COLOUR.needs), `${detail} raised`],
  'task-started': ({ detail }) => [mark(RUNNING_FRAMES[0], COLOUR.running), `${detail} started`],
  'task-failed': ({ detail }) => [mark(MARK.failed, COLOUR.failed), `${detail} failed`],
  'task-finished': ({ detail }) => [mark(MARK.done, COLOUR.done), `${detail} done`],
}

/** LATELY: each moment, newest first, its words cut before when it was. */
export function latelyLines(key: string, moments: readonly Moment[], kit: Kit): Line[] {
  return section(
    heading(key, { text: 'LATELY', bold: true, color: COLOUR.violet }, [], kit.width),
    moments.map((moment, at) => {
      const [marked, words] = MOMENTS[moment.kind]?.(moment) ?? [mark('·', COLOUR.secondary), moment.kind]

      return {
        key: `${key}:${at}`,
        parts: spread([marked, { text: ` ${words}`, color: COLOUR.body }], [{ text: whenOf(moment.at, kit.now), color: COLOUR.secondary }], kit.width),
      }
    }),
  )
}
