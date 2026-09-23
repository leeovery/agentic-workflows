/**
 * The gate's geometry and text shaping, shared by the hooks module and the
 * board: the band is one list of lines, which the hook counts to size the
 * `Client`'s region and the board draws line for line. Any drift between the
 * two is dead space under the last row, or rows the pointer cannot reach.
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
  detail: string | null
  struck: boolean
  recommended: boolean
}

/** One row of the payload a span or a natural reply can only answer. */
export type Typed = {
  label: string
  description: string
  detail: string | null
}

/** A gate as the engine states it, less its name. */
export type Gate = {
  question: string
  statement: string
  options: Option[]
  typed: Typed[]
}

/** A run of a drawn line under one style. */
export type Run = {
  text: string
  bold?: boolean
  dim?: boolean
  italic?: boolean
  strikethrough?: boolean
  underline?: boolean
}

/**
 * What the footer says: how to answer, what a pick put in the prompt, or how
 * to answer the typed row last clicked.
 */
export type Footer =
  | { kind: 'idle' }
  | { kind: 'picked'; answer: string }
  | { kind: 'typed'; label: string }

/**
 * A line of a row: its wrapped label or its detail, each carrying the row so
 * a pointer lands on any of them. The key column, filled on the first line
 * alone, and the label are padded out so a background spans the band.
 */
export type RowLine = {
  kind: 'option' | 'typed'
  index: number
  key: Run[]
  runs: Run[]
}

/** One line of the band, top to bottom. */
export type Line =
  | { kind: 'rule' }
  | { kind: 'blank' }
  | { kind: 'prose'; glyph: boolean; runs: Run[] }
  | RowLine
  | { kind: 'footer'; runs: Run[] }

/** The cursor's gutter, where the footer also sits. */
export const GUTTER = 2

/** The `◆ ` the question opens with; the statement lines up past it. */
export const GLYPH_COLUMN = 2

export const IDLE: Footer = { kind: 'idle' }

const GAP = 2
const MIN_LABEL = 8

const TAIL_SEPARATOR = ' — '
const RECOMMENDED = ' (recommended)'

const IDLE_HINT =
  'Click a row to choose · click it again to send · or just type'
const PICKED_HINT = ' is in your prompt · click it again or Enter to send'

/** A typed row's label that is a span of numbers, as the engine writes one. */
const RANGE = /^\d+–\d+$/

const RULE: Line = { kind: 'rule' }
const BLANK: Line = { kind: 'blank' }

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

/** Fills a line out to `width`, so a background spans it. */
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

/** Text whose lines are its own, each wrapped to `width`; none for no text. */
const paragraphs = (
  text: string,
  width: number,
  style: Omit<Run, 'text'> = {},
) =>
  text === ''
    ? []
    : text
        .split('\n')
        .flatMap(line => wrapRuns([{ ...style, text: line }], width))

/**
 * The band's two columns at this width: the keys, and the labels beside
 * them. The band has no frame, so a row is gutter, key, gap, label.
 */
export function geometry(gate: Gate, columns: number) {
  const keyWidth = Math.max(
    1,
    ...gate.options.map(option => answerOf(option).length),
    ...gate.typed.map(row => row.label.length),
  )

  return {
    keyWidth,
    labelWidth: Math.max(MIN_LABEL, columns - GUTTER - keyWidth - GAP),
  }
}

/**
 * The key column's runs: the word with the row's key underlined where the
 * word spells it, as a menu marks its accelerator; a bare key as it is.
 */
function keyRuns(option: Option): Run[] {
  const shown = answerOf(option)
  const at =
    option.word === null
      ? -1
      : shown.toLowerCase().indexOf(option.key.toLowerCase())

  if (at === -1) {
    return [{ text: shown }]
  }

  const end = at + option.key.length

  return [
    { text: shown.slice(0, at) },
    { text: shown.slice(at, end), underline: true },
    { text: shown.slice(end) },
  ].filter(run => run.text !== '')
}

const labelRuns = (option: Option): Run[] => [
  { text: option.head, strikethrough: option.struck },
  ...(option.tail === null
    ? []
    : [{ text: `${TAIL_SEPARATOR}${option.tail}`, dim: true, italic: true }]),
  ...(option.recommended ? [{ text: RECOMMENDED }] : []),
]

/** The pressable rows and then the typed ones, each followed by its detail. */
function rowLines(gate: Gate, columns: number): RowLine[] {
  const { keyWidth, labelWidth } = geometry(gate, columns)

  const linesOfRow = (
    kind: RowLine['kind'],
    index: number,
    key: Run[],
    label: Run[],
    detail: string | null,
  ): RowLine[] =>
    [
      ...wrapRuns(label, labelWidth),
      ...paragraphs(detail ?? '', labelWidth, { dim: true }),
    ].map((runs, n) => ({
      kind,
      index,
      key: pad(n === 0 ? key : [], keyWidth + GAP),
      runs: pad(runs, labelWidth),
    }))

  return [
    ...gate.options.flatMap((option, index) =>
      linesOfRow(
        'option',
        index,
        keyRuns(option),
        labelRuns(option),
        option.detail,
      ),
    ),
    ...gate.typed.flatMap((row, index) =>
      linesOfRow(
        'typed',
        index,
        [{ text: row.label, dim: true }],
        [{ text: row.description, dim: true }],
        row.detail,
      ),
    ),
  ]
}

// A click leaves the keys with the band; only the person can hand them back.
const typedHint = (label: string) =>
  RANGE.test(label)
    ? `${label} — press Esc, then type the numbers in the prompt`
    : `${label} — press Esc, then type in the prompt`

/** The footer's words: dim, the pick named in bold. */
export function footerRuns(footer: Footer): Run[] {
  switch (footer.kind) {
    case 'idle':
      return [{ text: IDLE_HINT, dim: true }]
    case 'picked':
      return [
        { text: footer.answer, bold: true },
        { text: PICKED_HINT, dim: true },
      ]
    case 'typed':
      return [{ text: typedHint(footer.label), dim: true }]
  }
}

const footerLines = (footer: Footer, columns: number) =>
  wrapRuns(footerRuns(footer), columns - GUTTER)

/**
 * The footer, in a slot as tall as the tallest thing it can say for this
 * gate, so a click never moves the rows above it.
 */
function footerSlot(gate: Gate, footer: Footer, columns: number): Line[] {
  const states: Footer[] = [
    IDLE,
    ...gate.options.map(option => ({
      kind: 'picked' as const,
      answer: answerOf(option),
    })),
    ...gate.typed.map(row => ({ kind: 'typed' as const, label: row.label })),
  ]

  const rows = Math.max(
    ...states.map(state => footerLines(state, columns).length),
  )
  const said = footerLines(footer, columns)

  return Array.from({ length: rows }, (_, n) => ({
    kind: 'footer',
    runs: said[n] ?? [],
  }))
}

/** Lines standing as a block: a blank under them, nothing at all for none. */
const block = (lines: Line[]): Line[] =>
  lines.length === 0 ? [] : [...lines, BLANK]

/**
 * Every line the band draws for a gate, top to bottom: the rule, the
 * statement, the question (none when the gate asks nothing), the rows and
 * the footer, a blank between each. How many there are is the region's height
 * whatever the footer says.
 */
export function linesOf(
  gate: Gate,
  columns: number,
  footer: Footer = IDLE,
): Line[] {
  const width = columns - GLYPH_COLUMN
  const statement = paragraphs(gate.statement, width)
  const question = paragraphs(gate.question, width, { bold: true })
  const prose = (runs: Run[], glyph: boolean): Line => ({
    kind: 'prose',
    glyph,
    runs,
  })

  return [
    RULE,
    BLANK,
    ...block(statement.map(runs => prose(runs, false))),
    ...block(question.map((runs, n) => prose(runs, n === 0))),
    ...rowLines(gate, columns),
    BLANK,
    ...footerSlot(gate, footer, columns),
  ]
}
