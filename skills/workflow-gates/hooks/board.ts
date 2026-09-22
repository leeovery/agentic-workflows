/**
 * The gate's surface module: its own keys and pointer, no `$`, answering by
 * posting the pressed row back to the hooks module.
 *
 * Colours are theme keys, never values, so the bar resolves against the
 * person's theme — the ANSI themes included, where the palette is the
 * terminal's own and a raw colour would be ignored.
 */
import type { ClientSurface, RenderElement } from 'claude-code'

import {
  GAP,
  GLYPH_COLUMN,
  GUTTER,
  answerOf,
  chromeRows,
  geometry,
  linesOf,
  pad,
  questionLines,
  type Line,
  type Option,
  type Typed,
} from './layout.ts'

type Props =
  | {
      question: string
      options: Option[]
      typed: Typed[]
      columns: number
    }
  | undefined

type State = { cursor: number }

/** The prompt's own border, so the rule reads as the gate's top edge. */
const RULE = 'promptBorder'
/** The blue-violet the prompt and its dialogs already ask in. */
const ACCENT = 'permission'
const SELECTED = 'userMessageBackground'

const GLYPH = '◆'.padEnd(GLYPH_COLUMN)
const NO_GLYPH = ' '.repeat(GLYPH_COLUMN)
const RULE_CELL = '─'
const CURSOR = '▌'.padEnd(GUTTER)
const NO_CURSOR = ' '.repeat(GUTTER)
const KEY_GAP = ' '.repeat(GAP)

/**
 * What the listeners read, rather than what they closed over: they are
 * registered once, on the first draw, and a second gate in one turn redraws
 * this instance with new props.
 */
let shown: { options: readonly Option[]; lines: readonly Line[]; top: number } =
  { options: [], lines: [], top: 0 }

export default function GateBoard(
  props: Props,
  surface: ClientSurface<State>,
): RenderElement {
  const { Box, Text } = surface.elements

  const question = props?.question ?? ''
  const options = props?.options ?? []
  const typed = props?.typed ?? []
  const columns = props?.columns ?? 0

  if (surface.state === undefined) {
    surface.setState({ cursor: 0 })
    listen(surface)
  }

  const cursor = Math.min(surface.state?.cursor ?? 0, options.length - 1)
  const { keyWidth, labelWidth } = geometry(options, typed, columns)
  const lines = linesOf(options, typed, columns)

  shown = { options, lines, top: chromeRows(question, columns) }

  const row = (line: Line) => {
    const isTyped = line.option === null
    const isSelected = !isTyped && line.option === cursor
    const backgroundColor = isSelected ? SELECTED : undefined

    return Text({
      children: [
        Text({
          color: ACCENT,
          backgroundColor,
          children: isSelected ? CURSOR : NO_CURSOR,
        }),
        Text({
          color: isTyped ? undefined : ACCENT,
          dimColor: isTyped,
          backgroundColor,
          children: line.key.padEnd(keyWidth),
        }),
        Text({ backgroundColor, children: KEY_GAP }),
        ...pad(line.runs, labelWidth).map(run =>
          Text({
            dimColor: run.dim,
            italic: run.italic,
            strikethrough: run.strikethrough,
            backgroundColor,
            children: run.text,
          }),
        ),
      ],
    })
  }

  return Box({
    flexDirection: 'column',
    children: [
      Text({ color: RULE, children: RULE_CELL.repeat(Math.max(1, columns)) }),
      ...questionLines(question, columns).map((line, n) =>
        Text({
          children: [
            Text({
              color: ACCENT,
              bold: true,
              children: n === 0 ? GLYPH : NO_GLYPH,
            }),
            Text({ bold: true, children: line }),
          ],
        }),
      ),
      Text({ children: ' ' }),
      ...lines.map(row),
    ],
  })
}

/** Keys while the band has the focus, and the pointer over the rows. */
function listen(surface: ClientSurface<State>) {
  const answer = (index: number) => {
    const option = shown.options[index]

    if (option !== undefined) {
      surface.post({ answer: answerOf(option) })
    }
  }

  surface.onKey(({ key }) => {
    const cursor = surface.state?.cursor
    const count = shown.options.length

    if (cursor === undefined || count === 0) {
      return
    }

    if (key === 'up') {
      surface.setState({ cursor: (cursor - 1 + count) % count })
    } else if (key === 'down') {
      surface.setState({ cursor: (cursor + 1) % count })
    } else if (key === 'return') {
      answer(cursor)
    } else {
      answer(shown.options.findIndex(option => option.key === key))
    }
  })

  surface.onPointer(event => {
    const option = shown.lines[event.y - shown.top]?.option

    if (option === undefined || option === null) {
      return
    }

    if (event.type === 'down') {
      answer(option)
    } else if (event.type === 'move' && surface.state?.cursor !== option) {
      surface.setState({ cursor: option })
    }
  })
}
