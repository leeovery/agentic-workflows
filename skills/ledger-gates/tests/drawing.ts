/**
 * The views' suites share this: the pane's lines laid out as text, the rows
 * each line takes `width` cells across as the pane lays it out (draw.ts's
 * `drawLine`), so a view reads as §20 and the locked board draw it. A line
 * that wraps breaks at word breaks in the cells its marks and buttons leave,
 * a word longer than them broken across rows, each row after the first
 * hung under its marks, its end button at the right of the first; any
 * other line is one row, cut at the edge with "…", and one pressed whole
 * must fit, its words drawn in a button that never cuts them. Trailing
 * spaces are dropped.
 */
import { QUIET, waitingOf } from '../hooks/discuss.ts'
import { kitOf, wrappedRows, type Asked, type Kit, type Line, type Part } from '../hooks/draw.ts'
import type { Answer, View } from '../hooks/model.ts'
import { HOME, framed, type Nav } from '../hooks/pane.ts'
import { VIEWS, type ViewDrawing } from '../hooks/views/index.ts'

/** The pane's width at 64 columns, inside its padding, as every drawing in §20 is. */
export const WIDTH = 62

const cells = (text: string) => [...text].length

const textOf = (parts: readonly Part[]) => parts.map(part => part.text).join('')

/** The rows a line takes `width` cells across. */
export function rowsDrawn(line: Line, width = WIDTH): string[] {
  const lead = textOf([...(line.marks ?? (line.mark === undefined ? [] : [line.mark])), ...(line.lead === undefined ? [] : [{ text: line.lead.label }])])
  const end = line.button?.label ?? ''
  const room = width - cells(lead) - cells(end)
  const words = textOf(line.parts)

  if (line.press !== undefined && line.wraps !== true && cells(words) > room) {
    throw new Error(`the pressed line ${line.key} overflows its ${room} cells: ${words}`)
  }

  if (line.wraps !== true) {
    const cut = cells(words) <= room ? words : `${[...words].slice(0, room - 1).join('')}…`

    return [`${lead}${cut}${end}`.trimEnd()]
  }

  return wrappedRows(words, room).map((row, at) => (at === 0 ? `${lead}${end === '' ? row : row + ' '.repeat(room - cells(row))}${end}` : `${' '.repeat(cells(lead))}${row}`).trimEnd())
}

/** Every row the lines take. */
export const drawnRows = (lines: readonly Line[], width = WIDTH): string[] => lines.flatMap(line => rowsDrawn(line, width))

/**
 * The pane as it draws the engine's answer at `nav`, WAITING ON YOU drawn
 * from its questions with nothing queued, as the pane draws it for the
 * session's place: the tabs' row, then each line's
 * rows. The clock reads `clocked` where given, as the locked board's frozen
 * scene reads 0:00, else the time since at `now`.
 */
export function paneDrawn(answer: Answer, { nav = HOME, now = 0, clocked }: { nav?: Nav; now?: number; clocked?: string } = {}): string[] {
  const board = answer?.kind === 'board' ? answer.board : null
  const { kit } = kitOf(WIDTH, now, 0, nav.opened, asked => waitingOf(asked, board?.place.unit ?? null, board?.questions ?? [], QUIET, WIDTH, now))
  const drawn = framed(answer, nav, VIEWS, clocked === undefined ? kit : { ...kit, clock: () => clocked })

  return [...(drawn.tabs === null ? [] : [drawn.tabs.map(tab => tab.label).join('   ')]), ...drawnRows(drawn.lines)]
}

/** A kit at the pane's width, the clock at `now`, nothing open and nothing waiting unless given. */
export const kitAt = (now = 0, waiting: (asked?: Asked) => Line[] = () => [], opened: readonly string[] = []): Kit => kitOf(WIDTH, now, 0, new Set(opened), waiting).kit

/** The rows of a section, from its heading to the next blank, else the drawing's end. */
export function sectionOf(rows: readonly string[], heading: string): string[] {
  const from = rows.findIndex(row => row.startsWith(heading))
  const to = rows.indexOf('', from)

  return rows.slice(from, to === -1 ? undefined : to)
}

/** The drawings' clock: 21 Oct, 13:30. */
export const NOW = Date.parse('2026-10-21T13:30:00')

/** A drawing's text block, as §20 prints it, one row a line. */
export const block = (text: string) => text.replace(/^\n/, '').replace(/\n$/, '').split('\n')

/** What a line's first part is, by its key. */
export const markOf = (lines: readonly Line[], key: string) => lines.find(line => line.key === key)?.parts[0]

/** A line's mark, by its key. */
export const ownMarkOf = (lines: readonly Line[], key: string) => lines.find(line => line.key === key)?.mark

/** What a line presses, by its key. */
export const pressOf = (lines: readonly Line[], key: string) => lines.find(line => line.key === key)?.press

/** A view drawn at the pane's width at `now`, its folds opened, with what WAITING ON YOU would draw: its lines, its rows less the blank ones it ends on, and what it holds. */
export function drawn(drawing: ViewDrawing, view: View, { now = NOW, opened = [] as string[], waiting = [] as Line[] } = {}) {
  const { kit, holds } = kitOf(WIDTH, now, 0, new Set(opened), () => waiting)
  const lines = drawing.lines(view, kit)
  const text = drawnRows(lines)

  while (text.at(-1) === '') {
    text.pop()
  }

  return { lines, text, holds }
}
