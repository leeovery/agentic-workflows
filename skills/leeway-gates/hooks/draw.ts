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
 * A drawn line: the mark a wrapped line hangs from, a button it leads with,
 * its words, which wrap or are cut at the edge, a button at its end; and
 * the key a press anywhere on its words addresses, where the line itself
 * opens something.
 */
export type Line = {
  key: string
  mark?: Part
  lead?: Button
  parts: Part[]
  wraps?: boolean
  button?: Button
  press?: string
}

/**
 * What a view draws with beyond its model: the pane's width, whether a
 * folding section is open, and what runs — its turning mark, and its clock
 * read at the drawing's time. What runs and what is clocked are recorded,
 * so the pane turns and ticks only a drawing that holds them.
 */
export type Kit = {
  width: number
  isOpened: (key: string) => boolean
  spinner: () => Part
  clock: (since: string) => string
}

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
 * folding sections open in `opened`.
 */
export function kitOf(width: number, now: number, frame: number, opened: ReadonlySet<string>): Drawn {
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
    },
  }
}

/** A run of text in its part's colour. */
export const textOf = (els: ElementTable, part: Part) =>
  els.Text({ bold: part.bold, dimColor: part.dim, color: part.color, children: [part.text] })

/** A button, drawn in the one colour every button on the board and the banner shares. */
export const buttonOf = (els: ElementTable, { key, label }: Button) =>
  els.Button({ key, plain: true, onPress: () => undefined, children: [els.Text({ color: COLOUR.thisView, children: [label] })] })

/** A line as the pane draws it. */
export function drawLine(els: ElementTable, line: Line): RenderElement {
  const { Box, Text, Button } = els
  const words = line.parts.map(part => textOf(els, part))

  return Box({
    key: line.key,
    children: [
      ...(line.mark === undefined ? [] : [textOf(els, line.mark)]),
      ...(line.lead === undefined ? [] : [buttonOf(els, line.lead)]),
      line.press === undefined
        ? Text({ wrap: line.wraps ? 'wrap' : 'truncate-end', children: words })
        : Button({ key: line.press, plain: true, onPress: () => undefined, children: words }),
      ...(line.button === undefined ? [] : [buttonOf(els, line.button)]),
    ],
  })
}
