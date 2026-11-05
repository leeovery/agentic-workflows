import { describe, expect, test, tier } from 'claude-code/testing'

import { COLOUR, RUNNING_FRAMES } from '../hooks/draw.ts'
import type { View } from '../hooks/model.ts'
import { EXPERIMENT, EXPERIMENT_REPORT } from '../hooks/views/experiment.ts'
import { block, drawn, markOf } from './drawing.ts'
import E1 from './fixtures/board-experiment.mjs'

tier('user')

describe('an experiment on the board (20.13)', () => {
  test('20.S21: This session in an experiment running is §20.13\'s drawing at 64 columns: the question, the design frozen at approval with its rule, each condition\'s runs and median so far, and the topic that waits on it', () => {
    expect(drawn(EXPERIMENT, E1).text).toEqual(
      block(`
E1 What does a real fumi cost at launch?
Fumi · epic · an experiment for Scale and performance
approved 2 Sep · 26 of 40 runs · ◐ running

THE QUESTION ────────────────────── from Scale and performance
Measured so far: sixteen bare NSWindows created, placed one
per Space and shown non-activating in 242 ms total.

THE DESIGN ─────────────────────── frozen when you approved it
· Measures the time from launch to the last fumi shown on its
  Space
· 20 cold launches of 16 bare windows: the floor, again
· 20 cold launches of 25 real fumis, the top of your open set
  (~20–25)
· The rule: if the 25th real fumi is on screen in under 1
  second, eager restore stands as decided; at 1 second or
  more, placing fumis beyond the active Space lazily is open
  again.

RUNS ──────────────────────────────────────────────── 26 of 40
✓ 16 bare windows                     20 of 20 · median 0.24 s
◐ 25 real fumis                        6 of 20 · median 0.67 s

VERDICT ──────────────────────────────────── the rule, applied
○ once every run is in

WAITS ON IT ────────────────────────────────────────── 1 topic
◐ Scale and performance                   its discussion waits
`),
    )
  })

  test('D30: what runs turns, while the topic waiting on it, under way in no session, is sky blue and still', () => {
    const { lines, holds } = drawn(EXPERIMENT, E1)

    expect(markOf(lines, 'x:waits:topic')).toEqual({ text: RUNNING_FRAMES[0], color: COLOUR.sky })
    expect(holds.turns).toBe(true)
  })

  test('concluded: the verdict opens the report, the topic\'s report waits for it, and nothing turns', () => {
    const concluded = { ...E1, status: 'concluded', verdict: '0.68 s, under 1 second: eager restore stands', runs: [{ ...(E1.runs as object[])[0] }, { condition: '25 real fumis', of: 20, done: 20, median: 0.68, unit: 's' }], report: true } as View
    const { text, lines, holds } = drawn(EXPERIMENT, concluded)

    expect(text[2]).toBe('approved 2 Sep · 40 of 40 runs · ✓ concluded')
    expect(text.slice(-5)).toEqual([
      'VERDICT ──────────────────────────────────── the rule, applied',
      '✓ 0.68 s, under 1 second: eager restore stands          ▸ read',
      '',
      'WAITS ON IT ────────────────────────────────────────── 1 topic',
      '◐ Scale and performance                the report waits for it',
    ])
    expect(lines.find(line => line.key === 'x:verdict')?.button?.key).toBe('page:report:scale-and-performance:E1')
    expect(holds.turns).toBe(false)
  })

  test('a verdict too long for its row wraps under its mark, ▸ read on its first row', () => {
    const verdict = '0.68 s for the 25 real fumis, under the 1 second the rule set: eager restore stands as designed'
    const concluded = { ...E1, status: 'concluded', verdict, report: true } as View

    expect(drawn(EXPERIMENT, concluded).text.slice(-6, -3)).toEqual([
      'VERDICT ──────────────────────────────────── the rule, applied',
      '✓ 0.68 s for the 25 real fumis, under the 1 second the  ▸ read',
      '  rule set: eager restore stands as designed',
    ])
  })

  test('20.13.3: abandoned, its facts line says so with its reason', () => {
    expect(drawn(EXPERIMENT, { ...E1, status: 'abandoned', reason: 'the topic was cancelled' } as View).text.slice(2, 4)).toEqual(['approved 2 Sep · 26 of 40 runs · – abandoned: the topic was', 'cancelled'])
  })

  test('its report carries where it stands and the topic it is for', () => {
    const report = { kind: 'experiment-report', unit: 'fumi', topic: 'scale-and-performance', topic_title: 'Scale and performance', id: 'E1', status: 'concluded', text: 'Eager restore stands.' }

    expect(drawn(EXPERIMENT_REPORT, report).text).toEqual(['E1 · the report', 'concluded · for Scale and performance', ` ${'─'.repeat(60)}`, 'Eager restore stands.'])
  })
})
