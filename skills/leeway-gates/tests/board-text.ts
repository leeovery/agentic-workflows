/**
 * A view's lines as the pane lays them out `width` cells across, as text:
 * a line that wraps wraps at word breaks beside its mark, leading button and
 * end button, as `draw.ts` wraps it, its later rows hanging under its mark;
 * any other is cut at the edge with "…" (`drawLine`), and one pressed whole
 * must fit, its words drawn in a button that never cuts them. Each row's
 * trailing spaces dropped, and the blank rows the drawing ends on.
 */
import { cutTo, kitOf, widthOf, wrappedRows, type Line, type Part } from '../hooks/draw.ts'
import type { View } from '../hooks/model.ts'
import type { ViewDrawing } from '../hooks/views/index.ts'

const textOf = (parts: readonly Part[]) => parts.map(part => part.text).join('')

/** One line's rows. */
function rowsOf(line: Line, width: number): string[] {
  const mark = line.mark?.text ?? ''
  const lead = line.lead?.label ?? ''
  const button = line.button?.label ?? ''
  const room = width - widthOf([{ text: mark + lead + button }])

  if (line.press !== undefined && line.wraps !== true && widthOf(line.parts) > room) {
    throw new Error(`the pressed line ${line.key} overflows its ${room} cells: ${textOf(line.parts)}`)
  }

  if (line.wraps !== true) {
    return [`${mark}${lead}${textOf(cutTo(line.parts, room))}${button}`]
  }

  const [first = '', ...rest] = wrappedRows(textOf(line.parts), room)
  const hang = ' '.repeat([...(mark + lead)].length)

  return [`${mark}${lead}${button === '' ? first : first.padEnd(room) + button}`, ...rest.map(row => `${hang}${row}`)]
}

/** The lines as text, `width` cells across. */
export function textIn(lines: readonly Line[], width: number): string[] {
  const rows = lines.flatMap(line => rowsOf(line, width)).map(row => row.trimEnd())

  while (rows.at(-1) === '') {
    rows.pop()
  }

  return rows
}

/** The body of a 64-column pane, inside its padding. */
export const BODY = 62

/** A drawing's text block, as §20 prints it, one row a line. */
export const block = (text: string) => text.replace(/^\n/, '').replace(/\n$/, '').split('\n')

/** The drawings' clock: 21 Oct, 13:30. */
export const NOW = Date.parse('2026-10-21T13:30:00')

/** What a line's first part is, by its key. */
export const markOf = (lines: readonly Line[], key: string) => lines.find(line => line.key === key)?.parts[0]

/** A line's mark, by its key. */
export const ownMarkOf = (lines: readonly Line[], key: string) => lines.find(line => line.key === key)?.mark

/** What a line presses, by its key. */
export const pressOf = (lines: readonly Line[], key: string) => lines.find(line => line.key === key)?.press

/** A view drawn at the pane's 64 columns at `now`, its folds opened, with what WAITING ON YOU would draw. */
export function drawn(drawing: ViewDrawing, view: View, { now = NOW, opened = [] as string[], waiting = [] as Line[] } = {}) {
  const { kit, holds } = kitOf(BODY, now, 0, new Set(opened), () => waiting)
  const lines = drawing.lines(view, kit)

  return { lines, text: textIn(lines, BODY), holds }
}
