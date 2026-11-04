/**
 * The views' suites share this: the pane's lines laid out as text, the rows
 * each line takes `width` cells across as the pane lays it out (draw.ts's
 * `drawLine`), so a view reads as §20 and the locked board draw it. A line
 * that wraps breaks at word breaks in the cells its marks and buttons leave,
 * a word longer than them broken across rows, each row after the first
 * hung under its marks; any other line is one row, cut at the edge with
 * "…". Trailing spaces are dropped.
 */
import { QUIET, waitingLines } from '../hooks/discuss.ts'
import { kitOf, type Kit, type Line, type Part } from '../hooks/draw.ts'
import type { Answer } from '../hooks/model.ts'
import { HOME, framed, type Nav } from '../hooks/pane.ts'
import { VIEWS } from '../hooks/views/index.ts'

/** The pane's width at 64 columns, inside its padding, as every drawing in §20 is. */
export const WIDTH = 62

const cells = (text: string) => [...text].length

const textOf = (parts: readonly Part[]) => parts.map(part => part.text).join('')

/** The words broken into rows of `room` cells at word breaks, a word longer than the room broken across rows. */
function wrapped(text: string, room: number): string[] {
  const rows: string[] = []
  let row = ''

  for (const word of text.split(' ')) {
    const joined = row === '' ? word : `${row} ${word}`

    if (cells(joined) <= room) {
      row = joined
      continue
    }

    if (row !== '') {
      rows.push(row)
    }

    let rest = [...word]

    while (rest.length > room) {
      rows.push(rest.slice(0, room).join(''))
      rest = rest.slice(room)
    }

    row = rest.join('')
  }

  return [...rows, row]
}

/** The rows a line takes `width` cells across. */
export function rowsDrawn(line: Line, width = WIDTH): string[] {
  const lead = textOf([...(line.marks ?? (line.mark === undefined ? [] : [line.mark])), ...(line.lead === undefined ? [] : [{ text: line.lead.label }])])
  const end = line.button?.label ?? ''
  const room = width - cells(lead) - cells(end)
  const words = textOf(line.parts)

  if (line.wraps !== true) {
    const cut = cells(words) <= room ? words : `${[...words].slice(0, room - 1).join('')}…`

    return [`${lead}${cut}${end}`.trimEnd()]
  }

  return wrapped(words, room).map((row, at) => (at === 0 ? `${lead}${row}${end}` : `${' '.repeat(cells(lead))}${row}`).trimEnd())
}

/** Every row the lines take. */
export const drawnRows = (lines: readonly Line[], width = WIDTH): string[] => lines.flatMap(line => rowsDrawn(line, width))

/**
 * The pane as it draws the engine's answer at `nav`, WAITING ON YOU drawn
 * from its questions with nothing queued: the tabs' row, then each line's
 * rows. The clock reads `clocked` where given, as the locked board's frozen
 * scene reads 0:00, else the time since at `now`.
 */
export function paneDrawn(answer: Answer, { nav = HOME, now = 0, clocked }: { nav?: Nav; now?: number; clocked?: string } = {}): string[] {
  const questions = answer?.kind === 'board' ? answer.board.questions : []
  const { kit } = kitOf(WIDTH, now, 0, nav.opened, () => waitingLines(questions, QUIET, WIDTH, now))
  const drawn = framed(answer, nav, VIEWS, clocked === undefined ? kit : { ...kit, clock: () => clocked })

  return [...(drawn.tabs === null ? [] : [drawn.tabs.map(tab => tab.label).join('   ')]), ...drawnRows(drawn.lines)]
}

/** A kit at the pane's width, the clock at `now`, nothing open and nothing waiting unless given. */
export const kitAt = (now = 0, waiting: () => Line[] = () => [], opened: readonly string[] = []): Kit => kitOf(WIDTH, now, 0, new Set(opened), waiting).kit

/** A drawing as written in a test, one row a line, its first line dropped. */
export const rows = (text: string): string[] => text.split('\n').slice(1, -1)
