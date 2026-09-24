import { describe, expect, test, tier } from 'claude-code/testing'

import {
  IDLE,
  answerOf,
  footerRuns,
  geometry,
  linesOf,
  pad,
  startingRow,
  wrapRuns,
  type Footer,
  type Gate,
  type Line,
  type Option,
  type RowLine,
  type Sends,
  type Typed,
} from '../hooks/layout.ts'

tier('user')

const optionOf = (over: Partial<Option> = {}): Option => ({
  key: '1',
  word: null,
  head: 'Continue "Auth"',
  tail: null,
  cue: null,
  holder: null,
  detail: null,
  struck: false,
  recommended: false,
  ...over,
})

const COMMENT: Typed = {
  label: 'Comment',
  description: 'Request changes (triggers a fix round)',
  detail: null,
}

const gateOf = (over: Partial<Gate> = {}): Gate => ({
  question: 'Approve this task?',
  statement: '',
  options: [optionOf({ key: 'y', word: 'yes', head: 'Commit' })],
  typed: [],
  ...over,
})

const textOf = (runs: readonly { text: string }[]) =>
  runs.map(run => run.text).join('')

/** A line as it reads: its kind's mark, then its text, trailing space trimmed. */
const read = (line: Line): string => {
  switch (line.kind) {
    case 'rule':
      return '─'
    case 'blank':
      return ''
    case 'prose':
      return `${line.glyph ? '◆' : ' '} ${textOf(line.runs)}`
    case 'footer':
      return `» ${textOf(line.runs)}`.trimEnd()
    default:
      return `${line.kind[0]}${line.index} ${textOf(line.key)}${textOf(line.runs)}`.trimEnd()
  }
}

const rowsOf = (lines: Line[]) =>
  lines.filter((line): line is RowLine => line.kind === 'option' || line.kind === 'typed')

const HOLDER = 'in session (last active 4m ago)'

/** A row another session holds, its tail flagged. */
const held = (over: Partial<Option> = {}) =>
  optionOf({
    tail: 'discussion',
    cue: 'input moved',
    holder: HOLDER,
    struck: true,
    ...over,
  })

/** A row's label runs, the padding that fills its column dropped. */
const labelOf = (option: Option, columns = 120) =>
  rowsOf(linesOf(gateOf({ options: [option] }), columns))
    .flatMap(line => line.runs)
    .filter(run => run.text.trim() !== '')

describe('layout', () => {
  test('a row is pressed, and answers, by its word where it has one', () => {
    expect(answerOf(optionOf({ key: 'y', word: 'yes' }))).toBe('yes')
    expect(answerOf(optionOf({ key: '2' }))).toBe('2')
  })

  test('the cursor starts on the recommended row, wherever it sits', () => {
    const options = [
      optionOf({ key: '1', struck: true }),
      optionOf({ key: '2' }),
      optionOf({ key: '3', recommended: true }),
    ]

    expect(startingRow(options)).toBe(2)
  })

  test('with none recommended, the cursor starts on the first row not struck', () => {
    const options = [optionOf({ key: '1', struck: true }), optionOf({ key: '2' })]

    expect(startingRow(options)).toBe(1)
  })

  test('with every row struck and none recommended, the cursor starts on the first', () => {
    const options = [
      optionOf({ key: '1', struck: true }),
      optionOf({ key: '2', struck: true }),
    ]

    expect(startingRow(options)).toBe(0)
  })

  test('wrapping breaks on words and keeps each run styled', () => {
    const wrapped = wrapRuns(
      [
        { text: 'Approve this and the remaining' },
        { text: ' — in this phase', dim: true, italic: true },
      ],
      20,
    )

    expect(wrapped.map(textOf)).toEqual([
      'Approve this and the',
      'remaining — in this',
      'phase',
    ])

    expect(wrapped[1]?.at(-1), 'a line carries one run per style, not per word').toEqual({
      text: ' — in this',
      dim: true,
      italic: true,
    })
  })

  test('a word longer than its column breaks rather than overflowing', () => {
    expect(
      wrapRuns([{ text: 'supercalifragilistic' }], 8).map(line => line[0]?.text),
    ).toEqual(['supercal', 'ifragili', 'stic'])
  })

  test('a line is padded out to its column, and never past it', () => {
    expect(pad([{ text: 'yes' }], 6)).toEqual([{ text: 'yes' }, { text: '   ' }])
    expect(pad([{ text: 'yes' }], 2)).toEqual([{ text: 'yes' }])
  })

  test('the key column takes the widest key, pressable or typed', () => {
    expect(geometry(gateOf({ typed: [COMMENT] }), 60)).toEqual({
      keyWidth: 'Comment'.length,
      labelWidth: 60 - 2 - 'Comment'.length - 2,
    })
  })

  test('a narrow band keeps a floor under the label column', () => {
    expect(geometry(gateOf(), 6).labelWidth).toBe(8)
  })

  test('the band is the rule, the question, the rows and the footer, a blank between each', () => {
    const gate = gateOf({ typed: [COMMENT] })

    expect(linesOf(gate, 72).map(read)).toEqual([
      '─',
      '',
      '◆ Approve this task?',
      '',
      'o0 yes      Commit',
      't0 Comment  Request changes (triggers a fix round)',
      '',
      '» Click a row to choose · click it again to send · or just type',
    ])
  })

  test('the statement stands above the question, its lines its own, the glyph on the question alone', () => {
    const gate = gateOf({
      statement: 'Found existing review for Auth.\nReview covered 2 of 5 tasks.',
      question: 'Continue the review?',
    })

    expect(linesOf(gate, 72).map(read).slice(0, 7)).toEqual([
      '─',
      '',
      '  Found existing review for Auth.',
      '  Review covered 2 of 5 tasks.',
      '',
      '◆ Continue the review?',
      '',
    ])
  })

  test('a question too long for the band wraps past the glyph', () => {
    const gate = gateOf({ question: 'Conclude this discussion and mark as completed?' })

    expect(linesOf(gate, 32).map(read).slice(2, 5)).toEqual([
      '◆ Conclude this discussion and',
      '  mark as completed?',
      '',
    ])
  })

  test('the question is bold and the statement normal weight', () => {
    const gate = gateOf({ statement: 'Context.', question: 'Proceed?' })
    const prose = linesOf(gate, 72).flatMap(line => (line.kind === 'prose' ? [line.runs] : []))

    expect(prose).toEqual([
      [{ text: 'Context.' }],
      [{ text: 'Proceed?', bold: true }],
    ])
  })

  test('a row draws its head, its tail and its recommendation in one line', () => {
    const gate = gateOf({
      options: [optionOf({ key: 'y', word: 'yes', tail: 'research', recommended: true })],
    })
    const [line] = rowsOf(linesOf(gate, 72))

    expect(line).toMatchObject({ kind: 'option', index: 0 })

    expect(line?.runs.slice(0, 3)).toEqual([
      { text: 'Continue "Auth"' },
      { text: ' — research', dim: true, italic: true },
      { text: ' (recommended)' },
    ])
  })

  test('a cue draws plain after a dot, so it reads as a flag on the tail', () => {
    expect(labelOf(optionOf({ tail: 'discussion', cue: 'input moved' }))).toEqual([
      { text: 'Continue "Auth"' },
      { text: ' — discussion', dim: true, italic: true },
      { text: ' · input moved' },
    ])
  })

  test('a held row is struck from its head through its cue, its holder plain after the strike', () => {
    expect(labelOf(held({ recommended: true }))).toEqual([
      { text: 'Continue "Auth"', strikethrough: true },
      { text: ' — discussion', dim: true, italic: true, strikethrough: true },
      { text: ' · input moved', strikethrough: true },
      { text: ` · ${HOLDER}` },
      { text: ' (recommended)' },
    ])
  })

  test('a held row with no tail strikes its head alone', () => {
    expect(labelOf(held({ tail: null, cue: null }))).toEqual([
      { text: 'Continue "Auth"', strikethrough: true },
      { text: ` · ${HOLDER}` },
    ])
  })

  test('a held row wrapped over lines keeps its strike to the cue and its holder out of it', () => {
    const lines = rowsOf(linesOf(gateOf({ options: [held()] }), 32))
    const said = (struck: boolean) =>
      lines
        .flatMap(line => line.runs)
        .filter(run => (run.strikethrough === true) === struck)
        .map(run => run.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()

    expect(lines.length).toBeGreaterThan(2)
    expect(said(true)).toBe('Continue "Auth" — discussion · input moved')
    expect(said(false)).toBe(`· ${HOLDER}`)
  })

  test('a bare yes/no row draws its key alone, no label beside it', () => {
    const gate = gateOf({
      options: [
        optionOf({ key: 'y', word: 'yes', head: '' }),
        optionOf({ key: 'n', word: 'no', head: '' }),
      ],
    })
    const lines = rowsOf(linesOf(gate, 72))

    expect(lines.map(read)).toEqual(['o0 yes', 'o1 no'])
    expect(lines.flatMap(line => line.runs).every(run => run.text.trim() === '')).toBe(true)
  })

  test("a row's key is underlined where its word spells it", () => {
    const keyOf = (option: Option) =>
      rowsOf(linesOf(gateOf({ options: [option] }), 72))[0]?.key.filter(
        run => run.text.trim() !== '',
      )

    expect(keyOf(optionOf({ key: 'y', word: 'yes' }))).toEqual([
      { text: 'y', underline: true },
      { text: 'es' },
    ])

    expect(keyOf(optionOf({ key: 'e', word: 'reopen' })), 'the first time it appears').toEqual([
      { text: 'r' },
      { text: 'e', underline: true },
      { text: 'open' },
    ])

    expect(keyOf(optionOf({ key: 'y', word: 'Yes' })), 'whatever its case').toEqual([
      { text: 'Y', underline: true },
      { text: 'es' },
    ])
  })

  test('a key the word does not spell, and a bare number, draw with no underline', () => {
    const keysOf = (options: Option[]) =>
      rowsOf(linesOf(gateOf({ options }), 72)).map(line => line.key)

    const keys = keysOf([optionOf({ key: 'x', word: 'yes' }), optionOf({ key: '2' })])

    expect(keys.flat().some(run => run.underline === true)).toBe(false)
    expect(keys.map(textOf).map(text => text.trim())).toEqual(['yes', '2'])
  })

  test('a typed row draws dim, and belongs to no option', () => {
    const [line] = rowsOf(linesOf(gateOf({ options: [], typed: [COMMENT] }), 72))

    expect(line).toMatchObject({ kind: 'typed', index: 0 })
    expect(line?.key[0]).toEqual({ text: 'Comment', dim: true })
    expect(line?.runs[0]).toEqual({ text: COMMENT.description, dim: true })
  })

  test("a wrapped label's continuations carry the row, the key on the first line alone", () => {
    const head = 'Approve this and the remaining tasks in this phase automatically'
    const gate = gateOf({ options: [optionOf({ key: 'b', word: 'bounded', head })] })
    const lines = rowsOf(linesOf(gate, 40))

    expect(lines.length).toBeGreaterThan(1)
    expect(lines.map(line => line.index)).toEqual(lines.map(() => 0))
    expect(lines.map(line => textOf(line.key).trim())).toEqual([
      'bounded',
      ...lines.slice(1).map(() => ''),
    ])
  })

  test("a row's detail draws beneath it, dim, in the label column, its lines its own", () => {
    const gate = gateOf({
      options: [
        optionOf({ key: '1', head: 'Analyze', detail: 'Groupings are found.\nNames are kept.' }),
        optionOf({ key: '2', head: 'Unify' }),
      ],
    })
    const lines = rowsOf(linesOf(gate, 72))

    expect(lines.map(read)).toEqual([
      'o0 1  Analyze',
      'o0    Groupings are found.',
      'o0    Names are kept.',
      'o1 2  Unify',
    ])

    expect(lines[1]?.runs[0]).toEqual({ text: 'Groupings are found.', dim: true })
  })

  test('a detail too long for the label column wraps inside it', () => {
    const detail = 'All discussions are analyzed for natural groupings and kept.'
    const gate = gateOf({ options: [optionOf({ head: 'Analyze', detail })] })

    expect(rowsOf(linesOf(gate, 30)).map(read)).toEqual([
      'o0 1  Analyze',
      'o0    All discussions are',
      'o0    analyzed for natural',
      'o0    groupings and kept.',
    ])
  })

  test('every row line fills the band, so a background spans it', () => {
    const gate = gateOf({ typed: [COMMENT] })
    const width = (line: RowLine) => 2 + textOf(line.key).length + textOf(line.runs).length

    expect(rowsOf(linesOf(gate, 72)).map(width)).toEqual([72, 72])
  })

  test('the footer says how to answer, what a pick put in the prompt, and how to answer a typed row', () => {
    expect(footerRuns(IDLE)).toEqual([
      { text: 'Click a row to choose · click it again to send · or just type', dim: true },
    ])

    expect(footerRuns({ kind: 'picked', answer: 'yes' })).toEqual([
      { text: 'yes', bold: true },
      { text: ' is in your prompt · click it again or Enter to send', dim: true },
    ])

    expect(footerRuns({ kind: 'typed', label: 'Comment' })).toEqual([
      { text: 'Comment — press Esc, then type in the prompt', dim: true },
    ])
  })

  test('the footer says what waits to send when Claude finishes, and what a new gate kept from sending', () => {
    expect(footerRuns({ kind: 'queued', answer: 'yes' })).toEqual([
      { text: 'yes', bold: true },
      { text: ' sends when Claude finishes · click it again to take it back', dim: true },
    ])

    expect(footerRuns({ kind: 'dropped', answer: 'yes' })).toEqual([
      { text: 'your ', dim: true },
      { text: 'yes', bold: true },
      { text: " wasn't sent — the menu changed", dim: true },
    ])
  })

  test('a held row reads queued after the rest of its label, plain', () => {
    const gate = gateOf({ options: [optionOf({ key: 'y', word: 'yes', head: 'Commit', recommended: true })] })
    const [line] = rowsOf(linesOf(gate, 72, IDLE, { held: 'yes', dropped: null }))

    expect(textOf(line?.runs ?? []).trimEnd()).toBe('Commit (recommended) · queued')
    expect(line?.runs.find(run => run.text === ' · queued')).toEqual({ text: ' · queued' })
  })

  test('a typed row is named as the engine labels it, whatever it says', () => {
    expect(textOf(footerRuns({ kind: 'typed', label: 'Tell me what to change' }))).toBe(
      'Tell me what to change — press Esc, then type in the prompt',
    )
  })

  test('a range row asks for the numbers', () => {
    expect(textOf(footerRuns({ kind: 'typed', label: '1–12' }))).toBe(
      '1–12 — press Esc, then type the numbers in the prompt',
    )
  })

  test('the footer holds the height of the tallest thing it can say, whatever it says', () => {
    const range: Typed = { label: '1–12', description: 'Pick items', detail: null }
    const gate = gateOf({
      options: [optionOf({ key: 'y', word: 'yes' }), optionOf({ key: 'b', word: 'bounded' })],
      typed: [COMMENT, range],
    })

    const said: Footer[] = [
      IDLE,
      { kind: 'picked', answer: 'yes' },
      { kind: 'picked', answer: 'bounded' },
      { kind: 'typed', label: 'Comment' },
      { kind: 'typed', label: '1–12' },
    ]

    const natural = said.map(footer => wrapRuns(footerRuns(footer), 28).length)

    expect(new Set(natural).size, 'at 30 columns the states wrap unevenly').toBeGreaterThan(1)

    for (const columns of [30, 44, 72]) {
      const heights = said.map(footer => linesOf(gate, columns, footer).length)

      expect(new Set(heights).size, `${columns} columns`).toBe(1)
    }
  })

  test('the band holds its height whichever row is held and whatever the footer says, a dropped answer included', () => {
    const gate = gateOf({
      options: [
        optionOf({ key: 'y', word: 'yes', head: 'Commit and continue to the next task' }),
        optionOf({ key: 'b', word: 'bounded', head: 'Run the rest unattended' }),
      ],
      typed: [COMMENT],
    })
    const dropped = 'a-long-answer-from-the-last-menu'
    const answers = ['yes', 'bounded']

    const said: Footer[] = [
      IDLE,
      ...answers.flatMap(answer => [
        { kind: 'picked' as const, answer },
        { kind: 'queued' as const, answer },
      ]),
      { kind: 'typed', label: 'Comment' },
      { kind: 'dropped', answer: dropped },
    ]

    const rows = (held: string | null) =>
      rowsOf(linesOf(gate, 30, IDLE, { held, dropped: null })).length

    expect(rows('yes'), 'at 30 columns a held row wraps its mark').toBeGreaterThan(rows(null))

    for (const columns of [30, 44, 72]) {
      const heights = [null, ...answers].flatMap(held =>
        said.map(footer => linesOf(gate, columns, footer, { held, dropped }).length),
      )

      expect(new Set(heights).size, `${columns} columns`).toBe(1)
    }
  })

  test('the footer’s slot holds every word of a queued or a dropped answer’s footer', () => {
    const gate = gateOf({ options: [optionOf({ key: 'y', word: 'yes', head: 'Commit' })] })
    const dropped = 'a-long-answer-from-the-menu'
    const spaced = (text: string) => text.split(/\s+/).join(' ').trim()
    const said = (footer: Footer, columns: number, sends: Sends) =>
      spaced(
        linesOf(gate, columns, footer, sends)
          .flatMap(line => (line.kind === 'footer' ? [textOf(line.runs)] : []))
          .join(' '),
      )

    for (const columns of [30, 64]) {
      const queued: Footer = { kind: 'queued', answer: 'yes' }
      const gone: Footer = { kind: 'dropped', answer: dropped }

      expect(said(queued, columns, { held: 'yes', dropped: null }), `queued at ${columns}`).toBe(
        spaced(textOf(footerRuns(queued))),
      )
      expect(said(gone, columns, { held: null, dropped }), `dropped at ${columns}`).toBe(
        spaced(textOf(footerRuns(gone))),
      )
    }
  })

  test('the footer wraps at the gutter, a short state leaving the rest of its slot empty', () => {
    const gate = gateOf({ typed: [{ label: '1–12', description: 'Pick items', detail: null }] })
    const footer = (said: Footer) =>
      linesOf(gate, 30, said)
        .filter(line => line.kind === 'footer')
        .map(read)

    expect(footer(IDLE)).toEqual([
      '» Click a row to choose ·',
      '» click it again to send · or',
      '» just type',
    ])

    expect(footer({ kind: 'typed', label: '1–12' })).toEqual([
      '» 1–12 — press Esc, then type',
      '» the numbers in the prompt',
      '»',
    ])
  })
})
