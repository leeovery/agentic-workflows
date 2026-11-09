import { describe, expect, test, tier } from 'claude-code/testing'

import { answerIn, readingOf } from '../hooks/model.ts'
import BUILD from './fixtures/board-build.mjs'

tier('user')

const said = (answer: unknown) => `${JSON.stringify(answer)}\n`

describe('the engine\'s answer', () => {
  test('a board of the version this mod draws is drawn, its ok dropped', () => {
    expect(answerIn(said({ ok: true, ...BUILD }))).toEqual({ kind: 'board', board: BUILD })
  })

  test('a view the engine cannot draw is a board still, its reason with it', () => {
    const unavailable = { ...BUILD, view: { kind: 'unavailable', reason: 'pay\'s build has not begun' } }

    expect(answerIn(said({ ok: true, ...unavailable }))).toEqual({ kind: 'board', board: unavailable })
  })

  test('another version is refused, by the version it is', () => {
    expect(answerIn(said({ ok: true, ...BUILD, version: 7 }))).toEqual({ kind: 'refused', version: 7 })
  })

  test('a refusal, words that read as no answer, and a board missing what the frame draws from, or with something beneath a page that is no view, give nothing to draw', () => {
    const { view: _, ...viewless } = BUILD
    const { beneath: __, ...beneathless } = BUILD

    expect(
      [
        said({ ok: false, error: 'board: there is no work unit "nope"' }),
        '',
        'not json',
        said([BUILD]),
        said({ ok: true, ...viewless }),
        said({ ok: true, ...beneathless }),
        said({ ok: true, ...BUILD, beneath: { unit: 'pay' } }),
      ].map(answerIn),
    ).toEqual([null, null, null, null, null, null, null])
  })

  test('a run that exits with the engine\'s error is refused; one that timed out or never started, or a child a signal ended, is not', () => {
    const board = said({ ok: true, ...BUILD })

    expect(
      [
        readingOf({ stdout: '', stderr: said({ ok: false, error: 'board: no page is named "shelf:1"' }) }),
        readingOf(null),
        readingOf({ stdout: '', stderr: '' }),
        readingOf({ stdout: board, stderr: '' }),
      ].map(({ answer, isRefused }) => [answer?.kind ?? null, isRefused]),
    ).toEqual([
      [null, true],
      [null, false],
      [null, false],
      ['board', false],
    ])
  })
})
