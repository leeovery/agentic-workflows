/**
 * The gate's geometry and text shaping, shared by the hooks module and the
 * board: the hook sizes the `Client`'s region from it, the board draws into
 * that region with it. Any drift between the two is dead space under the last
 * row, or rows the pointer cannot reach.
 *
 * The engine states every gate as data, so nothing here parses markdown: a
 * row arrives already split into what it is and what it says about itself.
 */

/** One pressable row of the engine's gate payload. */
export type Option = {
  key: string
  word: string | null
  head: string
  tail: string | null
  struck: boolean
  recommended: boolean
}

/** One row of the payload a span or a natural reply can only answer. */
export type Typed = { label: string; description: string }

/** A run of a drawn line under one style. */
export type Run = {
  text: string
  dim?: boolean
  italic?: boolean
  strikethrough?: boolean
}

/**
 * One drawn line: which option it answers (`null` for a typed row), what its
 * key column shows (empty where a label wrapped), and the label's runs.
 */
export type Line = { option: number | null; key: string; runs: Run[] }

/** The selection gutter, and the space between the key column and the label. */
export const GUTTER = 2
export const GAP = 2

/** The `◆ ` the question opens with, and the indent a wrapped one keeps. */
export const GLYPH_COLUMN = 2

const MIN_LABEL = 8

const TAIL_SEPARATOR = ' — '
const RECOMMENDED = ' (recommended)'

/** What a row shows in its key column, and what pressing it answers with. */
export const answerOf = (option: Option) => option.word ?? option.key

/**
 * The row the cursor starts on, so Enter on arrival takes what the engine
 * recommends: that row, else the first not struck through, else the first.
 */
export function startingRow(options: readonly Option[]): number {
  const recommended = options.findIndex(option => option.recommended)

  return recommended !== -1
    ? recommended
    : Math.max(0, options.findIndex(option => !option.struck))
}

/** Fills a line out to `width`, so a selected row's background spans it. */
export function pad(runs: readonly Run[], width: number): Run[] {
  const short = width - runs.reduce((cells, run) => cells + run.text.length, 0)

  return short > 0 ? [...runs, { text: ' '.repeat(short) }] : [...runs]
}

/**
 * Greedy word wrap that keeps each run's styling: a label too long for its
 * column breaks onto the next line rather than being cut, so nothing the
 * engine wrote is lost. A line's words come back under one run per style,
 * and the space a break falls on is dropped rather than drawn.
 */
export function wrapRuns(runs: readonly Run[], width: number): Run[][] {
  const column = Math.max(1, width)
  const lines: Run[][] = []

  let line: { source: Run; run: Run }[] = []
  let used = 0
  let gap: { source: Run; text: string } | null = null

  const wrap = () => {
    lines.push(line.map(entry => entry.run))
    line = []
    used = 0
    gap = null
  }

  const add = (source: Run, text: string) => {
    const last = line.at(-1)

    if (last !== undefined && last.source === source) {
      last.run.text += text
    } else {
      line.push({ source, run: { ...source, text } })
    }

    used += text.length
  }

  for (const source of runs) {
    for (const piece of source.text.split(/(\s+)/)) {
      if (piece === '') {
        continue
      }

      if (piece.trim() === '') {
        gap = used > 0 ? { source, text: piece } : null
        continue
      }

      let word = piece

      while (word.length > column) {
        if (used > 0) {
          wrap()
        }

        add(source, word.slice(0, column))
        word = word.slice(column)
        wrap()
      }

      if (used > 0 && used + (gap?.text.length ?? 0) + word.length > column) {
        wrap()
      } else if (gap !== null) {
        add(gap.source, gap.text)
      }

      gap = null
      add(source, word)
    }
  }

  if (line.length > 0 || lines.length === 0) {
    wrap()
  }

  return lines
}

/**
 * The bar's two columns for a band this wide: the keys, and the labels beside
 * them. The bar has no frame, so the row is gutter, key, gap, label.
 */
export function geometry(
  options: readonly Option[],
  typed: readonly Typed[],
  columns: number,
) {
  const keyWidth = Math.max(
    1,
    ...options.map(option => answerOf(option).length),
    ...typed.map(row => row.label.length),
  )

  return {
    keyWidth,
    labelWidth: Math.max(MIN_LABEL, columns - GUTTER - keyWidth - GAP),
  }
}

const runsOfOption = (option: Option): Run[] => [
  { text: option.head, strikethrough: option.struck },
  ...(option.tail === null
    ? []
    : [{ text: `${TAIL_SEPARATOR}${option.tail}`, dim: true, italic: true }]),
  ...(option.recommended ? [{ text: RECOMMENDED }] : []),
]

/**
 * Every line the gate draws, in order, wrapped to the band: the pressable
 * rows and then the typed ones, each label's continuations carrying the
 * option they belong to so a pointer can land on them.
 */
export function linesOf(
  options: readonly Option[],
  typed: readonly Typed[],
  columns: number,
): Line[] {
  const { labelWidth } = geometry(options, typed, columns)

  const linesOfRow = (option: number | null, key: string, runs: Run[]) =>
    wrapRuns(runs, labelWidth).map((wrapped, n) => ({
      option,
      key: n === 0 ? key : '',
      runs: wrapped,
    }))

  return [
    ...options.flatMap((option, index) =>
      linesOfRow(index, answerOf(option), runsOfOption(option)),
    ),
    ...typed.flatMap(row =>
      linesOfRow(null, row.label, [{ text: row.description, dim: true }]),
    ),
  ]
}

/** How many lines the rows take: what the hook adds to the chrome. */
export const lineCount = (
  options: readonly Option[],
  typed: readonly Typed[],
  columns: number,
) => linesOf(options, typed, columns).length

/** The question, wrapped to the room the glyph leaves it. */
export const questionLines = (question: string, columns: number) =>
  wrapRuns([{ text: question }], columns - GLYPH_COLUMN).map(line =>
    line.map(run => run.text).join(''),
  )

/** The rows above the first option: the rule, the question, the space. */
export const chromeRows = (question: string, columns: number) =>
  2 + questionLines(question, columns).length
