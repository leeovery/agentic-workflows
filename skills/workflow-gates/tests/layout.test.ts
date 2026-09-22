import { describe, expect, test, tier } from 'claude-code/testing'

import {
  answerOf,
  chromeRows,
  geometry,
  lineCount,
  linesOf,
  pad,
  questionLines,
  wrapRuns,
  type Option,
  type Typed,
} from '../hooks/layout.ts'

tier('user')

const optionOf = (over: Partial<Option> = {}): Option => ({
  key: '1',
  word: null,
  head: 'Continue "Auth"',
  tail: null,
  struck: false,
  recommended: false,
  ...over,
})

const TYPED: Typed[] = [
  { label: 'Comment', description: 'Request changes (triggers a fix round)' },
]

describe('layout', () => {
  test('a row is pressed, and answers, by its word where it has one', () => {
    expect(answerOf(optionOf({ key: 'y', word: 'yes' }))).toBe('yes')
    expect(answerOf(optionOf({ key: '2' }))).toBe('2')
  })

  test('wrapping breaks on words and keeps each run styled', () => {
    const wrapped = wrapRuns(
      [
        { text: 'Approve this and the remaining' },
        { text: ' — in this phase', dim: true, italic: true },
      ],
      20,
    )

    expect(wrapped.map(line => line.map(run => run.text).join(''))).toEqual([
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
    const options = [optionOf({ key: 'y', word: 'yes' })]

    expect(geometry(options, TYPED, 60)).toEqual({
      keyWidth: 'Comment'.length,
      labelWidth: 60 - 2 - 'Comment'.length - 2,
    })
  })

  test('a narrow band keeps a floor under the label column', () => {
    expect(geometry([optionOf({ key: 'y', word: 'yes' })], [], 6).labelWidth).toBe(8)
  })

  test('a row draws its head, its tail and its recommendation in one line', () => {
    const lines = linesOf(
      [optionOf({ key: 'y', word: 'yes', tail: 'research', recommended: true })],
      [],
      60,
    )

    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ option: 0, key: 'yes' })

    expect(lines[0]?.runs.slice(0, 3)).toEqual([
      { text: 'Continue "Auth"', strikethrough: false },
      { text: ' — research', dim: true, italic: true },
      { text: ' (recommended)' },
    ])
  })

  test('a struck row carries the strike on its head alone', () => {
    const [line] = linesOf([optionOf({ struck: true, tail: 'discussion' })], [], 60)

    expect(line?.runs[0]).toEqual({
      text: 'Continue "Auth"',
      strikethrough: true,
    })

    expect(line?.runs[1]?.strikethrough).toBeUndefined()
  })

  test('a typed row belongs to no option, so nothing can press it', () => {
    const lines = linesOf([optionOf()], TYPED, 60)

    expect(lines.map(line => line.option)).toEqual([0, null])
    expect(lines[1]?.key).toBe('Comment')
  })

  test("a wrapped label's continuations answer the row above them", () => {
    const head = 'Approve this and the remaining tasks in this phase automatically'
    const lines = linesOf([optionOf({ key: 'b', word: 'bounded', head })], [], 40)

    expect(lines.length).toBeGreaterThan(1)
    expect(lines.map(line => line.option)).toEqual(lines.map(() => 0))
    expect(lines.map(line => line.key)).toEqual(['bounded', ...lines.slice(1).map(() => '')])
  })

  test('the rows the region needs are counted, never estimated', () => {
    const options = [optionOf({ key: 'y', word: 'yes' }), optionOf({ key: '2' })]

    expect(lineCount(options, TYPED, 60)).toBe(
      linesOf(options, TYPED, 60).length,
    )

    expect(lineCount(options, TYPED, 60)).toBe(3)
  })

  test('the chrome is the rule, the question and the space under it', () => {
    expect(chromeRows('Approve this task?', 60)).toBe(3)
  })

  test('a question too long for the band takes the rows it wraps onto', () => {
    const question = 'Conclude this discussion and mark as completed?'

    expect(questionLines(question, 30)).toEqual([
      'Conclude this discussion and',
      'mark as completed?',
    ])

    expect(chromeRows(question, 30)).toBe(4)
  })
})
