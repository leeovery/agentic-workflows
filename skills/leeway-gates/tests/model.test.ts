import { describe, expect, test, tier } from 'claude-code/testing'

import { answerIn } from '../hooks/model.ts'
import BUILD from './fixtures/board-build.mjs'

tier('user')

const said = (answer: unknown) => `${JSON.stringify(answer)}\n`

describe('the engine\'s answer', () => {
  test('a board of the version this mod draws is drawn, its ok dropped', () => {
    expect(answerIn(said({ ok: true, ...BUILD }))).toEqual({ kind: 'board', board: BUILD })
  })

  test('another version is refused, by the version it is', () => {
    expect(answerIn(said({ ok: true, ...BUILD, version: 2 }))).toEqual({ kind: 'refused', version: 2 })
  })

  test('a refusal, words that read as no answer, and a board missing what the frame draws from give nothing to draw', () => {
    const { view: _, ...viewless } = BUILD

    expect(
      [said({ ok: false, error: 'board: there is no work unit "nope"' }), '', 'not json', said([BUILD]), said({ ok: true, ...viewless })].map(answerIn),
    ).toEqual([null, null, null, null, null])
  })
})
