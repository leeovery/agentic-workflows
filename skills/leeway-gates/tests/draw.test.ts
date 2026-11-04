import { describe, expect, test, tier } from 'claude-code/testing'

import { RUNNING_FRAMES, blank, clockOf, cutTo, folding, heading, kitOf, rowsOf, spread, widthOf, type Part } from '../hooks/draw.ts'

tier('user')

const textOf = (parts: readonly Part[]) => parts.map(part => part.text).join('')

/** A kit at 40 cells, the clock at the epoch, its first frame, nothing opened. */
const kit = (opened: readonly string[] = [], frame = 0, now = 0) => kitOf(40, now, frame, new Set(opened))

describe('a line', () => {
  test('words that fit stand whole; words that do not are cut to the room, ending in "…"', () => {
    expect(textOf(cutTo([{ text: 'twelve cells' }], 12))).toBe('twelve cells')
    expect(textOf(cutTo([{ text: 'twelve' }, { text: ' cells' }], 9))).toBe('twelve c…')
    expect(widthOf(cutTo([{ text: 'twelve' }, { text: ' cells' }], 9))).toBe(9)
  })

  test('spreads its words to the left and its state to the right, the title giving way to the state', () => {
    expect(textOf(spread([{ text: '6.1 merge' }], [{ text: 'done' }], 20))).toBe('6.1 merge       done')
    expect(textOf(spread([{ text: '6.3 re-runs from the start' }], [{ text: 'in review 0:40' }], 30))).toBe('6.3 re-runs fr… in review 0:40')
    expect(widthOf(spread([{ text: '6.3 re-runs from the start' }], [{ text: 'in review 0:40' }], 30))).toBe(30)
  })

  test('an empty line is one blank', () => {
    expect(blank('x')).toEqual({ key: 'blank:x', parts: [{ text: ' ' }] })
  })

  test('takes the rows its words wrap to at word breaks, beside its mark and buttons, as §20 draws a question at 64 columns', () => {
    const question = (text: string) => ({ key: 'q', mark: { text: '⚑ ' }, wraps: true, parts: [{ text }] })
    const q1 = question('Q1 If the terminal closes while the review gate waits, should the release unwind as a decline does, or keep its commit for the operator to finish by hand?')

    expect([rowsOf(q1, 62), rowsOf(q1, 78), rowsOf(q1, 80), rowsOf(q1, 40)], 'the words wrapped beside the mark').toEqual([3, 3, 3, 5])
    expect(rowsOf({ ...q1, mark: undefined, button: { key: 'b', label: '▸ read' } }, 59), 'its button beside the words').toBe(4)
    expect(rowsOf({ key: 'w', wraps: true, parts: [{ text: `a ${'x'.repeat(25)} b` }] }, 10), 'a word longer than the row broken across rows').toBe(4)
    expect(rowsOf({ ...q1, wraps: undefined }, 10), 'a line that is cut, never wrapped').toBe(1)
  })
})

describe('a section\'s heading', () => {
  test('its name, a rule running to the edge, and its count at the rule\'s end', () => {
    const line = heading('waiting', { text: 'WAITING ON YOU' }, [{ text: '3' }], 40)

    expect(textOf(line.parts)).toBe(`WAITING ON YOU ${'─'.repeat(23)} 3`)
    expect(widthOf(line.parts)).toBe(40)
    expect(line.button).toBeUndefined()
  })

  test('with a button, the rule stops short of it, the button at the right edge', () => {
    const line = heading('waiting', { text: 'WAITING ON YOU' }, [{ text: '3 ·' }], 40, { key: 'discuss:all', label: '▸ discuss all' })

    expect(textOf(line.parts)).toBe(`WAITING ON YOU ${'─'.repeat(7)} 3 · `)
    expect(widthOf(line.parts) + widthOf([{ text: '▸ discuss all' }])).toBe(40)
    expect(line.button).toEqual({ key: 'discuss:all', label: '▸ discuss all' })
  })

  test('a complete section folds to its heading with "▸ show", and opens with "▾ hide"', () => {
    const name = { text: 'PHASE 5 · The remediation floor' }
    const summary = [{ text: 'complete' }]

    expect(folding('phase:5', name, summary, kit().kit).button).toEqual({ key: 'fold:phase:5', label: '▸ show' })
    expect(folding('phase:5', name, summary, kit(['phase:5']).kit).button).toEqual({ key: 'fold:phase:5', label: '▾ hide' })
  })
})

describe('what runs', () => {
  test('its ◐ turns a quarter at each frame, in the running colour', () => {
    const marks = [0, 1, 2, 3, 4].map(frame => kit([], frame).kit.spinner())

    expect(marks.map(mark => mark.text)).toEqual([...RUNNING_FRAMES, RUNNING_FRAMES[0]])
    expect(new Set(marks.map(mark => mark.color))).toEqual(new Set(['#86d4cc']))
  })

  test('its clock reads minutes and seconds since it began, never less than nothing', () => {
    const began = '2026-10-21T10:00:00.000Z'
    const at = Date.parse(began)

    expect([clockOf(began, at), clockOf(began, at + 134_000), clockOf(began, at + 3_600_000), clockOf(began, at - 5_000)]).toEqual([
      '0:00',
      '2:14',
      '60:00',
      '0:00',
    ])
  })

  test('a drawing holds what turns and what is clocked only where it drew them', () => {
    const plain = kit()
    const turning = kit()
    const clocked = kit()

    turning.kit.spinner()
    clocked.kit.clock('2026-10-21T10:00:00.000Z')

    expect([plain.holds, turning.holds, clocked.holds]).toEqual([
      { turns: false, clocks: false },
      { turns: true, clocks: false },
      { turns: false, clocks: true },
    ])
  })
})
