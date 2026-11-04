import { describe, expect, test, tier } from 'claude-code/testing'

import {
  QUIET,
  discussedBanner,
  discussionIn,
  keptOf,
  live,
  pressedOn,
  readyLines,
  recorded,
  recordedIn,
  waitingLines,
  type Discussion,
} from '../hooks/discuss.ts'
import type { Line, Part } from '../hooks/draw.ts'
import { lastOffset } from '../hooks/pane.ts'
import BUILD from './fixtures/board-build.mjs'

tier('user')

/** The three questions waiting in the build: Q1 parked at 11:00, Q2 at 14:00, Q3 at 14:50. */
const QUESTIONS = BUILD.questions

/** 15:00 on the day they parked. */
const NOW = Date.parse('2026-10-21T15:00:00.000Z')

/** The pane's width at 64 columns, as every drawing in §20 is. */
const WIDTH = 62

const textOf = (parts: readonly Part[]) => parts.map(part => part.text).join('')

/** A line as drawn: its mark, its leading button, its words and its button. */
const shown = (line: Line) => `${line.mark?.text ?? ''}${line.lead?.label ?? ''}${textOf(line.parts)}${line.button?.label ?? ''}`

const discussion = (given: Partial<Discussion>): Discussion => ({ ...QUIET, ...given })

/** What a press on `key` says and leaves, against the three questions waiting. */
const press = (key: string, given: Partial<Discussion>) => pressedOn(key, discussion(given), QUESTIONS)

describe('WAITING ON YOU', () => {
  test('20.5.3, 20.6.4: as §20 draws it, Q1 queued — the heading\'s count and "▸ discuss all", each question\'s wording, what it parks and how long it has waited, and "queued ▸ unqueue" or "▸ discuss"', () => {
    const lines = waitingLines(QUESTIONS, discussion({ ready: ['Q1'] }), WIDTH, NOW)

    expect(lines.map(shown)).toEqual([
      'WAITING ON YOU ───────────────────────────── 3 · ▸ discuss all',
      '⚑ Q1 If the terminal closes while the review gate waits, should the release unwind as a decline does, or keep its commit for the operator to finish by hand?',
      '     parks 6.7 · waiting 4h                   queued ▸ unqueue',
      '⚑ Q2 When a re-merge fails at the review gate, should the notes the operator already saw stay on offer to accept, or should the run abort with the chunk notes saved?',
      '     parks 6.8, and 2 after it · waiting 1h          ▸ discuss',
      '⚑ Q3 While a regeneration runs as chunks, should plain mode (CI and agents) print a line as each part finishes, or one line when the whole wave is done?',
      '     parks 6.5 · waiting 10m                         ▸ discuss',
      ' ',
    ])
    expect(lines.filter(line => line.wraps).map(line => line.key)).toEqual(['q:Q1', 'q:Q2', 'q:Q3'])
    expect(lines.map(line => line.button?.key).filter(Boolean)).toEqual(['discuss:all', 'unqueue:Q1', 'discuss:Q2', 'discuss:Q3'])
  })

  test('20.6.11: while a queue is discussed, the one discussed reads "being discussed" with "▸ skip", those after it whom they follow, and the heading "▸ cancel all"; the last alone, "▸ cancel"', () => {
    const under = waitingLines(QUESTIONS, discussion({ discussing: 'Q2', queue: ['Q1'] }), WIDTH, NOW)
    const last = waitingLines(QUESTIONS, discussion({ discussing: 'Q2' }), WIDTH, NOW)
    const standing = (lines: Line[]) => lines.filter(line => line.key.startsWith('qt:')).map(shown)

    expect(shown(under[0] as Line)).toBe('WAITING ON YOU ────────────────────────────── 3 · ▸ cancel all')
    expect(standing(under)).toEqual([
      '     parks 6.7 · waiting 4h                           after Q2',
      '     parks 6.8, and 2 after it · waiti… being discussed ▸ skip',
      '     parks 6.5 · waiting 10m                         ▸ discuss',
    ])
    expect(under.map(line => line.button?.key).filter(Boolean)).toEqual(['discussion:cancel', 'discussion:skip', 'discuss:Q3'])
    expect(standing(last)[1]).toBe('     parks 6.8, and 2 after it · wai… being discussed ▸ cancel')
  })

  test('20.5.3: the heading carries "▸ discuss all" while more than one waits and any is neither queued nor discussed — the one discussed alone, or some queued; with every one queued or discussed, nothing', () => {
    const headed = (given: Partial<Discussion>, questions = QUESTIONS) => shown(waitingLines(questions, discussion(given), WIDTH, NOW)[0] as Line)
    const ALL = 'WAITING ON YOU ───────────────────────────── 3 · ▸ discuss all'

    expect([headed({ discussing: 'Q2' }), headed({ ready: ['Q1', 'Q3'] }), headed({})]).toEqual([ALL, ALL, ALL])
    expect(headed({ ready: ['Q1'] }, QUESTIONS.slice(0, 2))).toBe('WAITING ON YOU ───────────────────────────── 2 · ▸ discuss all')
    expect(headed({ ready: ['Q1', 'Q3'], discussing: 'Q2' })).toBe('WAITING ON YOU ───────────────────────────────────────────── 3')
    expect(headed({}, QUESTIONS.slice(0, 1)), 'one waiting').toBe('WAITING ON YOU ───────────────────────────────────────────── 1')
  })

  test('a question parking no task says so, one with a task after it names it, and one parked under a minute ago says so; with none waiting, nothing', () => {
    const [question] = QUESTIONS
    const lines = waitingLines([{ ...question!, parks: [], after: ['6.9'], since: '2026-10-21T14:59:30.000Z' }], QUIET, 80, NOW)

    expect(textOf((lines[2] as Line).parts).trim()).toBe('parks no task, and 6.9 after it · waiting under a minute')
    expect(waitingLines([], QUIET, WIDTH, NOW)).toEqual([])
  })

  test('12.13.14: no button on it answers a question — each discusses, unqueues, skips or cancels', () => {
    const labels = new Set(
      [discussion({ ready: ['Q1'] }), discussion({ discussing: 'Q1', queue: ['Q2'] }), discussion({ discussing: 'Q3' })]
        .flatMap(each => waitingLines(QUESTIONS, each, WIDTH, NOW))
        .flatMap(line => (line.button === undefined ? [] : [line.button.label])),
    )

    expect([...labels].sort()).toEqual(['▸ cancel', '▸ cancel all', '▸ discuss', '▸ discuss all', '▸ skip', '▸ unqueue'].sort())
  })
})

describe('READY TO DISCUSS', () => {
  test('20.6.4: as §20 draws it — its heading and count, each question queued by its number and the task it parks with its ✕, then "▸ send to Claude" and "▸ cancel all"', () => {
    const lines = readyLines(QUESTIONS, discussion({ ready: ['Q1'] }), WIDTH)

    expect(lines.map(shown)).toEqual([
      'READY TO DISCUSS ─────────────────────────────────────────── 1',
      '└ Q1  Every abort at the review gate unwinds                 ✕',
      '▸ send to Claude                                  ▸ cancel all',
    ])
    expect(lines.flatMap(line => [line.lead?.key, line.button?.key]).filter(Boolean)).toEqual(['drop:Q1', 'ready:send', 'ready:cancel'])
  })

  test('20.6.5, 20.S14: docked, scrolled to its end, the last row of a wrapped question shows above the box', () => {
    const lines = waitingLines(QUESTIONS.slice(0, 1), discussion({ ready: ['Q1'] }), 78, NOW)
    const box = readyLines(QUESTIONS, discussion({ ready: ['Q1'] }), 78)

    expect(lines.map(line => line.key)).toEqual(['waiting', 'q:Q1', 'qt:Q1', 'blank:waiting'])
    expect(lastOffset({ tabs: null, lines }, { lines: box, placement: 'dock', bodyRows: 9, offset: 0 }, 78), 'Q1 wraps to three rows: with the heading, six rows in the five the box leaves').toBe(1)
  })

  test('nothing while none is queued', () => {
    expect(readyLines(QUESTIONS, discussion({ discussing: 'Q1', queue: ['Q2'] }), WIDTH)).toEqual([])
  })
})

describe('a press', () => {
  test('20.6.2, 12.13.12: "▸ discuss" queues its question after those queued, "▸ discuss all" every one neither queued nor discussed, oldest first; neither says anything', () => {
    expect(press('discuss:Q3', { ready: ['Q2'] })).toEqual({ discussion: discussion({ ready: ['Q2', 'Q3'] }), line: null })
    expect(press('discuss:all', { ready: ['Q2'] })).toEqual({ discussion: discussion({ ready: ['Q2', 'Q1', 'Q3'] }), line: null })
    expect(press('discuss:all', { discussing: 'Q2' })).toEqual({ discussion: discussion({ ready: ['Q1', 'Q3'], discussing: 'Q2' }), line: null })
    expect(press('discuss:Q2', { ready: ['Q2'] }), 'queued already').toEqual({ discussion: discussion({ ready: ['Q2'] }), line: null })
    expect(press('discuss:Q2', { discussing: 'Q2' }), 'under discussion').toEqual({ discussion: discussion({ discussing: 'Q2' }), line: null })
  })

  test('20.6.4: "▸ unqueue", ✕ and the box\'s "▸ cancel all" take questions back out, saying nothing and leaving the discussion', () => {
    const given = { ready: ['Q1', 'Q3'], discussing: 'Q2' }

    expect(press('unqueue:Q1', given)).toEqual({ discussion: discussion({ ready: ['Q3'], discussing: 'Q2' }), line: null })
    expect(press('drop:Q3', given)).toEqual({ discussion: discussion({ ready: ['Q1'], discussing: 'Q2' }), line: null })
    expect(press('ready:cancel', given)).toEqual({ discussion: discussion({ discussing: 'Q2' }), line: null })
  })

  test('20.6.6: "▸ send to Claude" makes the box the discussion, saying so in one line — one question with its wording, several by number in the order queued, "all" when it holds every one waiting', () => {
    expect(press('ready:send', { ready: ['Q2'] })).toEqual({
      discussion: discussion({ discussing: 'Q2' }),
      line: 'Ready to discuss Q2: When a re-merge fails at the review gate, should the notes the operator already saw stay on offer to accept, or should the run abort with the chunk notes saved?',
    })
    expect(press('ready:send', { ready: ['Q3', 'Q1'] })).toEqual({
      discussion: discussion({ discussing: 'Q3', queue: ['Q1'] }),
      line: 'Ready to discuss 2 waiting questions, in this order: Q3, Q1.',
    })
    expect(press('ready:send', { ready: ['Q2', 'Q3', 'Q1'] })?.line).toBe('Ready to discuss all 3 waiting questions, in this order: Q2, Q3, Q1.')
    expect(press('ready:send', {}), 'an empty box sends nothing').toEqual({ discussion: QUIET, line: null })
  })

  test('20.6.7: a queue sent while a discussion is under way joins its end: "Also ready to discuss Q2, after Q1."', () => {
    expect(press('ready:send', { ready: ['Q2'], discussing: 'Q1' })).toEqual({
      discussion: discussion({ discussing: 'Q1', queue: ['Q2'] }),
      line: 'Also ready to discuss Q2, after Q1.',
    })
    expect(press('ready:send', { ready: ['Q3', 'Q2'], discussing: 'Q1', queue: ['Q4'] })?.line).toBe('Also ready to discuss Q3, Q2, after Q4.')
  })

  test('20.6.8: "▸ skip" sets the one discussed back to waiting and moves to the next; "▸ cancel" and "▸ cancel all" set it and every one after it back — one line each', () => {
    expect(press('discussion:skip', { discussing: 'Q1', queue: ['Q2', 'Q3'], ready: ['Q4'] })).toEqual({
      discussion: discussion({ discussing: 'Q2', queue: ['Q3'], ready: ['Q4'] }),
      line: 'Skip Q1 for now; it stays waiting. Next: Q2.',
    })
    expect(press('discussion:cancel', { discussing: 'Q1', queue: ['Q2'], ready: ['Q3'] })).toEqual({
      discussion: discussion({ ready: ['Q3'] }),
      line: 'Set Q1, Q2 aside; they stay waiting.',
    })
    expect(press('discussion:cancel', { discussing: 'Q1' })?.line).toBe('Set Q1 aside; it stays waiting.')
    expect(press('discussion:skip', { discussing: 'Q1' }), 'nothing after it to skip to').toEqual({ discussion: discussion({ discussing: 'Q1' }), line: null })
    expect(press('discussion:cancel', {}), 'nothing discussed').toEqual({ discussion: QUIET, line: null })
  })

  test('20.6.3, 12.13.13: every line a press says is one line, and none raises: each names questions by number, never a verb', () => {
    const lines = [
      press('ready:send', { ready: ['Q1'] }),
      press('ready:send', { ready: ['Q1', 'Q2'] }),
      press('ready:send', { ready: ['Q3'], discussing: 'Q1' }),
      press('discussion:skip', { discussing: 'Q1', queue: ['Q2'] }),
      press('discussion:cancel', { discussing: 'Q1', queue: ['Q2'] }),
    ].map(said => said?.line ?? '')

    expect(lines.every(line => line !== '' && !line.includes('\n') && !/engine|raise/.test(line))).toBe(true)
  })

  test('a key that is not the discussion\'s is left to the pane', () => {
    expect(['tab:unit', 'page:task:6.4', 'fold:phase-1', 'back', 'board:toggle'].map(key => press(key, {}))).toEqual([null, null, null, null, null])
  })
})

describe('the discussion against what waits', () => {
  test('a question no longer waiting leaves the box and the discussion wherever it stood, the next after it then under discussion', () => {
    expect(live(discussion({ ready: ['Q4', 'Q3'], discussing: 'Q4', queue: ['Q5', 'Q2'] }), QUESTIONS)).toEqual(discussion({ ready: ['Q3'], discussing: 'Q2' }))
  })

  test('12.13.17: those Claude recorded leave the discussion, the box as it was', () => {
    expect(recorded(discussion({ ready: ['Q3'], discussing: 'Q1', queue: ['Q2', 'Q4'] }), ['Q1', 'Q2'])).toEqual(discussion({ ready: ['Q3'], discussing: 'Q4' }))
  })

  test('20.6.9: a receipt answered or set aside names those recorded; explained again, any other answer, or no receipt, none', () => {
    const said = (receipt: unknown) => `${JSON.stringify({ ok: true, receipt })}\n`

    expect(
      [
        said('Q1 answered · task 6.7 builds again · 2 waiting on you · next: Q2'),
        said('Q2, Q1 set aside · still waiting · 3 waiting on you · next: Q3'),
        said('Q1 still open, explained again · still waiting · 3 waiting on you'),
        `${JSON.stringify({ ok: true, raise: 'abc', open: true })}\n`,
        'not json',
        `${JSON.stringify({ ok: true, receipt: 'Q1 answered · task 6.7 builds again · nothing waiting on you' })}\n=== MENU\n`,
      ].map(recordedIn),
    ).toEqual([['Q1'], ['Q2', 'Q1'], [], [], [], ['Q1']])
  })

  test('P16: kept as {"discussing", "queue"} by number, never the box; read back with the box empty, and nothing from a file that holds no discussion', () => {
    const kept = keptOf(discussion({ ready: ['Q3'], discussing: 'Q1', queue: ['Q2'] }))

    expect(JSON.parse(kept)).toEqual({ discussing: 'Q1', queue: ['Q2'] })
    expect(discussionIn(kept)).toEqual(discussion({ discussing: 'Q1', queue: ['Q2'] }))
    expect(discussionIn(keptOf(QUIET))).toEqual(QUIET)
    expect([null, '', '{"discussing":', '[]', '{"discussing":"Q1"}', '{"discussing":7,"queue":[]}'].map(discussionIn)).toEqual(Array(6).fill(QUIET))
  })
})

describe('the banner', () => {
  const banner = BUILD.banner!
  const facts = (given: Partial<Discussion>) => {
    const { banner: drawn, buttons } = discussedBanner(banner, discussion(given), QUESTIONS)

    return [drawn.facts.map(fact => (fact.needs ? `⚑ ${fact.text}` : fact.text)).join(' · '), buttons.map(button => button.label).join(' ')]
  }

  test('20.2.4: questions waiting keep the build\'s facts, with "▸ discuss all" for several and "▸ discuss" for one', () => {
    expect(facts({})).toEqual(['feature · build · 1 building · 1 in review · ⚑ 3 waiting on you', '▸ discuss all'])
    expect(discussedBanner(banner, QUIET, QUESTIONS.slice(0, 1)).buttons).toEqual([{ key: 'discuss:Q1', label: '▸ discuss' }])
    expect(discussedBanner(banner, QUIET, []).buttons).toEqual([])
  })

  test('20.2.4: questions queued, how many, with "▸ send to Claude" and "▸ cancel all"', () => {
    expect(facts({ ready: ['Q1'] })).toEqual(['feature · build · ⚑ 1 queued to discuss', '▸ send to Claude ▸ cancel all'])
  })

  test('20.2.4: a question discussed, with the task it parks and how many more are to discuss and queued; "▸ skip" and "▸ cancel all" while more follow, else "▸ cancel", "▸ send to Claude" while more are queued', () => {
    expect(facts({ discussing: 'Q1', queue: ['Q2', 'Q3'] })).toEqual([
      'feature · build · ⚑ Discussing Q1 · task 6.7 "Every abort at the review gate unwinds" · 2 more to discuss',
      '▸ skip ▸ cancel all',
    ])
    expect(facts({ discussing: 'Q1', ready: ['Q3'] })).toEqual(['feature · build · ⚑ Discussing Q1 · task 6.7 "Every abort at the review gate unwinds" · 1 queued', '▸ send to Claude ▸ cancel'])
  })

  test('20.2.4, 12.13.22: a build stopped keeps "stopped" leading the facts, and its mark, while questions are queued or discussed; a question parking no task names none', () => {
    const stopped = { ...banner, state: 'needs' as const, facts: [{ text: 'stopped', needs: false }, ...banner.facts] }
    const [question] = QUESTIONS
    const drawn = (given: Partial<Discussion>) => discussedBanner(stopped, discussion(given), [{ ...question!, parks: [] }]).banner

    expect(drawn({ discussing: 'Q1' }).state).toBe('needs')
    expect([drawn({ discussing: 'Q1' }), drawn({ ready: ['Q1'] })].map(({ facts }) => facts.map(fact => fact.text))).toEqual([
      ['stopped', 'feature', 'build', 'Discussing Q1'],
      ['stopped', 'feature', 'build', '1 queued to discuss'],
    ])
  })
})
