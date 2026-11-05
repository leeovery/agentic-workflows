/**
 * The workflows board's drawing kit, shared by the pane, its views and the
 * banner: the colours, each with one meaning; the marks; a line as parts
 * with its buttons; a section's heading with its rule and count; a complete
 * section folding to its heading; and what runs, its ◐ turned to the frame
 * and its clock read from when it began.
 *
 * The board is not held to the engine's design system: it mirrors the
 * conversation's and uses what a pane can do, so its colours are values,
 * never the theme's keys.
 */
import type { ElementTable, RenderElement } from 'claude-code'
import type { Question } from './model.ts'

/** Each colour means one thing, on the board and on the banner alike. */
export const COLOUR = {
  needs: '#f5a97f',
  running: '#86d4cc',
  done: '#a3c98a',
  failed: '#ee7a8c',
  notStarted: '#6e7799',
  /** This view: the active tab, and every button. */
  thisView: '#a9a1e1',
  /** Body text: names, questions and prose, softer than a title's white. */
  body: '#c3c9e3',
  /** Secondary facts. */
  secondary: '#a3abd0',
  rule: '#3d4260',
  /** Section headings beside the state colours: what a task does, its reviews, the calls made. */
  sky: '#7fb4f0',
  violet: '#c0a7f0',
  gold: '#e3c78a',
} as const

/** One mark per meaning in every drawing. */
export const MARK = {
  done: '✓',
  needs: '⚑',
  failed: '✗',
  waiting: '○',
  call: '◇',
  round: '◆',
  difference: '△',
  message: '»',
  sent: '→',
  cancelled: '–',
  postponed: '↷',
  replaces: '↺',
} as const

/** What runs, turned a quarter at each frame. */
export const RUNNING_FRAMES = ['◐', '◓', '◑', '◒'] as const

/** A run of a line's text, in its colour. */
export type Part = { text: string; color?: string; bold?: boolean; dim?: boolean }

/** A button: what a press addresses, and what it reads. */
export type Button = { key: string; label: string }

/**
 * A drawn line: the mark a wrapped line hangs from — one run, or several,
 * as the progress bar's cells — a button it leads with, its words, which
 * wrap or are cut at the edge, a button at its end; and the key a press
 * anywhere on its words addresses, where the line itself opens something.
 */
export type Line = {
  key: string
  mark?: Part
  marks?: Part[]
  lead?: Button
  parts: Part[]
  wraps?: boolean
  button?: Button
  press?: string
}

/**
 * What a view draws with beyond its model: the pane's width, whether a
 * folding section is open, and what runs — its turning mark, and its clock
 * read at the drawing's time; the drawing's time, for when a moment was;
 * and WAITING ON YOU, the questions waiting on
 * the person with where each stands in the discussion (`discuss.ts`), for a
 * view to place where its drawing has it — the session's, or a unit's own
 * a page holds, which a press queues only where they are the session's
 * unit's. What runs and what is clocked are recorded, so the pane turns and
 * ticks only a drawing that holds them.
 */
export type Kit = {
  width: number
  isOpened: (key: string) => boolean
  spinner: () => Part
  clock: (since: string) => string
  now: number
  waiting: (asked?: Asked) => Line[]
}

/** Questions of a unit's a page holds, whatever unit the session is in. */
export type Asked = { unit: string; questions: readonly Question[] }

/** A kit and what the drawing it served holds: anything turning, any clock. */
export type Drawn = { kit: Kit; holds: { turns: boolean; clocks: boolean } }

/** The cells a run of parts takes. */
export const widthOf = (parts: readonly Part[]) =>
  parts.reduce((cells, part) => cells + [...part.text].length, 0)

/** The parts cut to `room` cells, the last ending in "…" where any were cut. */
export function cutTo(parts: readonly Part[], room: number): Part[] {
  if (widthOf(parts) <= room) {
    return [...parts]
  }

  const kept: Part[] = []
  let left = Math.max(0, room - 1)

  for (const part of parts) {
    const chars = [...part.text]

    if (chars.length > left) {
      kept.push({ ...part, text: `${chars.slice(0, left).join('')}…` })
      break
    }

    kept.push(part)
    left -= chars.length
  }

  return kept
}

/**
 * Left and right on one line of `width` cells, the gap filled; where both
 * do not fit, the left is cut, so a title gives way to its state.
 */
export function spread(
  left: readonly Part[],
  right: readonly Part[],
  width: number,
  fill: Part = { text: ' ' },
): Part[] {
  const room = width - widthOf(right)
  const kept = cutTo(left, room - 1)

  return [...kept, { ...fill, text: fill.text.repeat(Math.max(1, room - widthOf(kept))) }, ...right]
}

const RULE: Part = { text: '─', color: COLOUR.rule }

/**
 * A section's heading: its name, a rule running to the edge, and its count
 * or summary at the rule's end, before its button where it has one.
 */
export function heading(key: string, name: Part, summary: readonly Part[], width: number, button?: Button): Line {
  return button === undefined
    ? { key, parts: spread([name, { text: ' ' }], [{ text: ' ' }, ...summary], width, RULE) }
    : {
        key,
        parts: spread([name, { text: ' ' }], [{ text: ' ' }, ...summary, { text: ' ' }], width - widthOf([{ text: button.label }]), RULE),
        button,
      }
}

/** The key a press on a folding section's button addresses. */
export const foldKey = (key: string) => `fold:${key}`

/** A complete section's heading: folded to this one line with "▸ show", open with "▾ hide". */
export const folding = (key: string, name: Part, summary: readonly Part[], kit: Kit): Line =>
  heading(key, name, summary, kit.width, {
    key: foldKey(key),
    label: kit.isOpened(key) ? '▾ hide' : '▸ show',
  })

/** An empty line. */
export const blank = (key: string): Line => ({ key: `blank:${key}`, parts: [{ text: ' ' }] })

/** A running clock, minutes and seconds since `since`, at `now`. */
export function clockOf(since: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000))

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * A kit for one drawing at `width`, `now` and the spinner's `frame`, the
 * folding sections open in `opened`, WAITING ON YOU drawn by `waiting`.
 */
export function kitOf(
  width: number,
  now: number,
  frame: number,
  opened: ReadonlySet<string>,
  waiting: (asked?: Asked) => Line[] = () => [],
): Drawn {
  const holds = { turns: false, clocks: false }

  return {
    holds,
    kit: {
      width,
      isOpened: key => opened.has(key),
      spinner: () => {
        holds.turns = true

        return { text: RUNNING_FRAMES[frame % RUNNING_FRAMES.length] ?? RUNNING_FRAMES[0], color: COLOUR.running }
      },
      clock: since => {
        holds.clocks = true

        return clockOf(since, now)
      },
      now,
      waiting,
    },
  }
}

/** A run of text in its part's colour. */
export const textOf = (els: ElementTable, part: Part) =>
  els.Text({ bold: part.bold, dimColor: part.dim, color: part.color, children: [part.text] })

/** A button, drawn in the one colour every button on the board and the banner shares. */
export const buttonOf = (els: ElementTable, { key, label }: Button) =>
  els.Button({ key, plain: true, onPress: () => undefined, children: [els.Text({ color: COLOUR.thisView, children: [label] })] })

/** The runs a line's words hang beside: its marks, else its mark. */
const marksOf = (line: Line): Part[] => line.marks ?? (line.mark === undefined ? [] : [line.mark])

/** `text` wrapped at word breaks into rows of `room` cells, a word longer than the room broken across rows. */
export function wrappedRows(text: string, room: number): string[] {
  const rows: string[] = []
  let row = ''

  for (const word of text.split(' ')) {
    const joined = row === '' ? word : `${row} ${word}`

    if ([...joined].length <= room) {
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

/**
 * The rows a line takes `width` cells across, as `drawLine` lays it out:
 * one, or for a line that wraps, as many as its words wrap to in the cells
 * its mark, leading button and end button leave beside them.
 */
export function rowsOf(line: Line, width: number): number {
  if (line.wraps !== true) {
    return 1
  }

  const beside = widthOf([
    ...marksOf(line),
    ...[line.lead, line.button].flatMap(button => (button === undefined ? [] : [{ text: button.label }])),
  ])

  return wrappedRows(line.parts.map(part => part.text).join(''), Math.max(1, width - beside)).length
}

/** A line as the pane draws it. */
export function drawLine(els: ElementTable, line: Line): RenderElement {
  const { Box, Text, Button } = els
  const words = line.parts.map(part => textOf(els, part))

  return Box({
    key: line.key,
    children: [
      ...marksOf(line).map(mark => textOf(els, mark)),
      ...(line.lead === undefined ? [] : [buttonOf(els, line.lead)]),
      line.press === undefined
        ? Text({ wrap: line.wraps ? 'wrap' : 'truncate-end', children: words })
        : Button({ key: line.press, plain: true, onPress: () => undefined, children: words }),
      ...(line.button === undefined ? [] : [buttonOf(els, line.button)]),
    ],
  })
}

/** A list item's opening: its bullet or number, and its words. */
const ITEM = /^\s*(?:[-*]|(\d+)\.)\s+(.*)$/

/** A fenced block's fence. */
const FENCE = /^\s*```/

/** A heading's opening. */
const HEADING = /^#+\s+(.*)$/

/**
 * A body of prose as the board draws it (20.4.5): each paragraph one line
 * wrapping at the edge; each list item one line hung under its mark, its
 * number for a numbered one; a heading's words bold; and a fenced block —
 * a diagram, a captured screen — each of its lines as written, cut at the
 * edge, never wrapped.
 */
export function prose(key: string, text: string, color: string = COLOUR.body, markColor: string = COLOUR.secondary): Line[] {
  const lines: Line[] = []
  let open: Line | null = null
  let isFenced = false
  const add = (line: Omit<Line, 'key'>): Line => {
    const added: Line = { key: `${key}:${lines.length}`, ...line }

    lines.push(added)

    return added
  }

  for (const raw of text.split('\n')) {
    const item = ITEM.exec(raw)
    const titled = HEADING.exec(raw)

    if (FENCE.test(raw)) {
      isFenced = !isFenced
      open = null
    } else if (isFenced) {
      add({ parts: [{ text: raw === '' ? ' ' : raw, color }] })
    } else if (raw.trim() === '') {
      open = null
    } else if (item !== null) {
      open = add({ mark: { text: item[1] === undefined ? '· ' : `${item[1]}. `, color: markColor }, wraps: true, parts: [{ text: item[2] ?? '', color }] })
    } else if (titled !== null) {
      open = null
      add({ parts: [{ text: titled[1] ?? '', color, bold: true }] })
    } else if (open === null) {
      open = add({ wraps: true, parts: [{ text: raw.trim(), color }] })
    } else {
      open.parts = open.parts.map(part => ({ ...part, text: `${part.text} ${raw.trim()}` }))
    }
  }

  return lines
}

/** A count and its noun: "1 acceptance criterion", "6 acceptance criteria". */
export const counted = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

/** A title then the words after it, `width` cells across: the title giving way with "…", the words after it whole. */
export const titledLine = (key: string, title: Part, after: readonly Part[], width: number): Line => ({
  key,
  parts: [...cutTo([title], width - widthOf(after)), ...after],
})

/**
 * Words that carry what waits, then the state and the button that end them,
 * `width` cells across: the words wrapped at word breaks under `indent`,
 * never cut, the state and the button kept at the right of the last row —
 * a row of their own where the words leave no room beside them. The last
 * row is keyed `key`, each before it `{key}:{n}`.
 */
export function endedRows(key: string, indent: string, words: Part, right: readonly Part[], width: number, button?: Button): Line[] {
  const room = width - [...indent].length
  const end = width - (button === undefined ? 0 : [...button.label].length)
  const rows: string[] = []

  for (const word of words.text.split(' ')) {
    const last = rows.at(-1)

    if (last !== undefined && [...`${last} ${word}`].length <= room) {
      rows[rows.length - 1] = `${last} ${word}`
    } else {
      rows.push(word)
    }
  }

  const row = (text: string): Part => ({ ...words, text: `${indent}${text}` })
  const ending = rows.at(-1) ?? ''
  const fits = widthOf([row(ending)]) + 1 + widthOf(right) <= end
  const before = fits ? rows.slice(0, -1) : rows

  return [
    ...before.map((text, at): Line => ({ key: `${key}:${at}`, parts: [row(text)] })),
    { key, parts: spread(fits ? [row(ending)] : [], right, end), ...(button === undefined ? {} : { button }) },
  ]
}
/** The indent a second line takes under an item's mark. */
export const INDENT = '     '

/** How many cells a progress bar has at most. */
export const BAR_CELLS = 8

/** A progress bar of `cells`, `done` of `total` filled in sage, the rest in the rule's slate. */
export function progressBar(done: number, total: number, cells: number): Part[] {
  const filled = total === 0 ? 0 : Math.round((done / total) * cells)

  return [
    { text: '▰'.repeat(filled), color: COLOUR.done },
    { text: '▱'.repeat(cells - filled), color: COLOUR.rule },
  ]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** A day as the board says it, "17 Jul", from an ISO date or time; the words as given where they read as no date. */
export function dayOf(at: string): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(at) ? new Date(`${at}T00:00:00`) : new Date(at)

  return Number.isNaN(day.getTime()) ? at : `${day.getDate()} ${MONTHS[day.getMonth()]}`
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * When a moment was, at `now`: "just now", minutes or hours ago within the
 * day, the day and time within the week, else the day.
 */
export function whenOf(at: string, now: number): string {
  const ago = now - Date.parse(at)

  if (ago < MINUTE) {
    return 'just now'
  }

  if (ago < HOUR) {
    return `${Math.floor(ago / MINUTE)}m ago`
  }

  if (ago < DAY) {
    return `${Math.floor(ago / HOUR)}h ago`
  }

  const time = new Date(at)

  return ago < 7 * DAY ? `${dayOf(at)} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}` : dayOf(at)
}
