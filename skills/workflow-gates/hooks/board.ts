/**
 * The gate's surface module: its own keys and pointer, no `$`. A press posts
 * the row back to the hooks module, which picks it into the prompt or, on the
 * row already picked, sends it — holding it while Claude works, until a press
 * takes it back; a click on a typed row only tells the person how to answer
 * it.
 *
 * Colours are theme keys, never values, so the band resolves against the
 * person's theme — the ANSI themes included, where the palette is the
 * terminal's own and a raw colour would be ignored.
 */
import type { ClientSurface, RenderElement } from 'claude-code'

import {
  GLYPH_COLUMN,
  GUTTER,
  IDLE,
  answerOf,
  linesOf,
  startingRow,
  type Footer,
  type Gate,
  type Line,
  type RowLine,
  type Run,
  type Sends,
} from './layout.ts'

type Props = Sends & { gate: Gate; picked: string | null; columns: number }

/**
 * The cursor, the typed row whose hint the footer shows, and the rows they
 * belong to: another gate's rows start both afresh.
 */
type State = { cursor: number; hint: string | null; rows: string }

/** The prompt's own border, so the rule reads as the gate's top edge. */
const RULE = 'promptBorder'
/** The blue-violet the prompt and its dialogs already ask in. */
const ACCENT = 'permission'
const HOVERED = 'selectionBg'
const PICKED = 'diffAddedDimmed'

const GLYPH = '◆'.padEnd(GLYPH_COLUMN)
const NO_GLYPH = ' '.repeat(GLYPH_COLUMN)
const RULE_CELL = '─'
const CURSOR = '▌'.padEnd(GUTTER)
const NO_CURSOR = ' '.repeat(GUTTER)

/**
 * What the listeners read, rather than what they closed over: they are
 * registered once, on the first draw, and a redraw can hand this instance
 * another gate's rows.
 */
let shown: { gate: Gate; lines: readonly Line[] } = {
  gate: { question: '', statement: '', options: [], typed: [] },
  lines: [],
}

/**
 * The footer follows the last click: a typed row's hint, else the answer
 * held or picked, else the one a new gate kept from sending.
 */
function footerOf(
  hint: string | null,
  picked: string | null,
  { held, dropped }: Sends,
): Footer {
  if (hint !== null) {
    return { kind: 'typed', label: hint }
  }

  if (held !== null) {
    return { kind: 'queued', answer: held }
  }

  if (picked !== null) {
    return { kind: 'picked', answer: picked }
  }

  return dropped === null ? IDLE : { kind: 'dropped', answer: dropped }
}

export default function GateBoard(
  { gate, picked, held, dropped, columns }: Props,
  surface: ClientSurface<State>,
): RenderElement {
  const { Box, Text } = surface.elements

  if (surface.state === undefined) {
    listen(surface)
  }

  const rows = JSON.stringify(gate.options)
  const state =
    surface.state?.rows === rows
      ? surface.state
      : { cursor: startingRow(gate.options), hint: null, rows }

  if (state !== surface.state) {
    surface.setState(state)
  }

  const sends = { held, dropped }
  const footer = footerOf(state.hint, picked, sends)
  const lines = linesOf(gate, columns, footer, sends)
  const pickedRow = gate.options.findIndex(
    option => answerOf(option) === (held ?? picked),
  )

  shown = { gate, lines }

  const styled = (run: Run, color?: string, backgroundColor?: string) =>
    Text({
      color,
      backgroundColor,
      bold: run.bold,
      dimColor: run.dim,
      italic: run.italic,
      strikethrough: run.strikethrough,
      underline: run.underline,
      children: run.text,
    })

  const row = (line: RowLine) => {
    const isOption = line.kind === 'option'
    const isCursor = isOption && line.index === state.cursor
    const backgroundColor =
      isOption && line.index === pickedRow
        ? PICKED
        : isCursor
          ? HOVERED
          : undefined

    return Text({
      children: [
        Text({
          color: ACCENT,
          backgroundColor,
          children: isCursor ? CURSOR : NO_CURSOR,
        }),
        ...line.key.map(run =>
          styled(run, isOption ? ACCENT : undefined, backgroundColor),
        ),
        ...line.runs.map(run => styled(run, undefined, backgroundColor)),
      ],
    })
  }

  const draw = (line: Line): RenderElement => {
    switch (line.kind) {
      case 'rule':
        return Text({
          color: RULE,
          children: RULE_CELL.repeat(Math.max(1, columns)),
        })
      case 'blank':
        return Text({ children: ' ' })
      case 'prose':
        return Text({
          children: [
            line.glyph
              ? Text({ color: ACCENT, bold: true, children: GLYPH })
              : Text({ children: NO_GLYPH }),
            ...line.runs.map(run => styled(run)),
          ],
        })
      case 'footer':
        return Text({
          children: [
            Text({ children: NO_CURSOR }),
            ...line.runs.map(run => styled(run)),
          ],
        })
      default:
        return row(line)
    }
  }

  return Box({ flexDirection: 'column', children: lines.map(draw) })
}

/**
 * Keys while the band has the focus, and the pointer over the rows: both move
 * the cursor and press a row; a click on a typed row shows its hint.
 */
function listen(surface: ClientSurface<State>) {
  const update = (state: State, change: Partial<State>) => {
    const next = { ...state, ...change }

    if (next.cursor !== state.cursor || next.hint !== state.hint) {
      surface.setState(next)
    }
  }

  const press = (state: State, index: number) => {
    const option = shown.gate.options[index]

    if (option !== undefined) {
      update(state, { cursor: index, hint: null })
      surface.post({ answer: answerOf(option) })
    }
  }

  surface.onKey(({ key }) => {
    const state = surface.state
    const count = shown.gate.options.length

    if (state === undefined || count === 0) {
      return
    }

    if (key === 'up') {
      update(state, { cursor: (state.cursor - 1 + count) % count })
    } else if (key === 'down') {
      update(state, { cursor: (state.cursor + 1) % count })
    } else if (key === 'return') {
      press(state, state.cursor)
    } else {
      press(
        state,
        shown.gate.options.findIndex(option => option.key === key),
      )
    }
  })

  surface.onPointer(event => {
    const state = surface.state
    const line = shown.lines[event.y]

    if (state === undefined || line === undefined) {
      return
    }

    if (line.kind === 'option' && event.type === 'down') {
      press(state, line.index)
    } else if (line.kind === 'option' && event.type === 'move') {
      update(state, { cursor: line.index })
    } else if (line.kind === 'typed' && event.type === 'down') {
      update(state, { hint: shown.gate.typed[line.index]?.label ?? null })
    }
  })
}
