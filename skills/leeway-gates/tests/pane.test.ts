import { describe, expect, test, tier } from 'claude-code/testing'

import { kitOf, widthOf, type Line, type Part } from '../hooks/draw.ts'
import { readingOf, type Answer, type Board, type Reading, type View } from '../hooks/model.ts'
import { BACK, HOME, argsOf, framed, pageKey, pressed, readOn, settled, tabKey, type Nav } from '../hooks/pane.ts'
import type { Views } from '../hooks/views/index.ts'
import BUILD from './fixtures/board-build.mjs'

tier('user')

const UNIT = 'token-aware-diff-sizing'

/** The build as the engine answers it, This session in the build. */
const build = BUILD

/** The same session moved on into the review phase, its view the review's. */
const review: Board = {
  ...build,
  place: { ...build.place, phase: 'review' },
  view: { kind: 'review', unit: UNIT, title: 'Token-aware diff sizing', type: 'feature' },
}

/** A task's page over This session's build, its line building since 10:00. */
const taskPage: Board = {
  ...build,
  view: { kind: 'task', unit: UNIT, line: { task: '6.4', title: 'A failed single-pass call is classified', since: '2026-10-21T10:00:00.000Z' } },
  beneath: build.view,
}

/** All work, which names no unit of its own. */
const allWork: Board = { ...build, tab: 'all', view: { kind: 'all', project: 'App' } }

/** Another unit's page, opened from All work. */
const fumiPage: Board = { ...allWork, view: { kind: 'unit', unit: 'fumi', title: 'Fumi' }, beneath: allWork.view }

const answered = (board: Board): Answer => ({ kind: 'board', board })

type Task = { task: string; title: string; since: string }

/**
 * Drawings standing in for the views, which come with their own slices: the
 * build names itself and draws one line; a task's page draws its line, its
 * running mark turned and its clock read from the kit.
 */
const VIEWS: Views = {
  build: { name: () => 'the build', lines: () => [{ key: 'build', parts: [{ text: 'the build' }] }] },
  review: { name: () => 'the review', lines: () => [{ key: 'review', parts: [{ text: 'the review' }] }] },
  task: {
    name: (view: View) => `${(view.line as Task).task} ${(view.line as Task).title}`,
    lines: (view, kit) => {
      const line = view.line as Task

      return [{ key: 'task', parts: [kit.spinner(), { text: ` ${line.task} ${line.title} building ${kit.clock(line.since)}` }] }]
    },
  },
}

const textOf = (parts: readonly Part[]) => parts.map(part => part.text).join('')
const shown = (lines: readonly Line[]) => lines.map(line => textOf(line.parts) + (line.button === undefined ? '' : line.button.label))

/** Where a run of presses takes the person, each on the board it was pressed on. */
function through(...presses: readonly (readonly [Board, string])[]): Nav {
  return presses.reduce<Nav>((nav, [board, key]) => pressed(nav, key, board, VIEWS) ?? nav, HOME)
}

/** Where a run of presses on one board takes the person. */
const walk = (board: Board, ...keys: string[]): Nav => through(...keys.map(key => [board, key] as const))

const draw = (answer: Answer, nav: Nav, frame = 0, now = Date.parse('2026-10-21T10:02:14.000Z')) => {
  const drawn = kitOf(62, now, frame, nav.opened)

  return { ...framed(answer, nav, VIEWS, drawn.kit), holds: drawn.holds }
}

describe('where the person is on the pane, as the engine is asked for it', () => {
  test('This session at its top asks nothing beyond the session, following wherever its position puts it', () => {
    expect(argsOf(HOME)).toEqual([])
  })

  test('the unit\'s tab holds the unit it was opened on; All work names only its tab', () => {
    expect(argsOf(walk(build, tabKey('unit')))).toEqual(['--tab', 'unit', '--unit', UNIT])
    expect(argsOf(walk(build, tabKey('all')))).toEqual(['--tab', 'all'])
    expect(argsOf(walk(build, tabKey('unit'), tabKey('this')))).toEqual([])
  })

  test('a page opened over a tab is asked for by its ref and the unit of the view it was opened on, the newest on top', () => {
    expect(argsOf(walk(build, pageKey('task:6.4')))).toEqual(['--page', 'task:6.4', '--page-unit', UNIT])
    expect(argsOf(through([build, pageKey('task:6.4')], [taskPage, pageKey('task:6.4:round:1')]))).toEqual(['--page', 'task:6.4:round:1', '--page-unit', UNIT])
    expect(argsOf(through([build, tabKey('all')], [allWork, pageKey('unit:fumi')], [fumiPage, pageKey('task:1.1')]))).toEqual([
      '--tab',
      'all',
      '--page',
      'task:1.1',
      '--page-unit',
      'fumi',
    ])
  })

  test('a unit\'s page opened from All work carries the unit it names, on its tab or on This session at the start menu', () => {
    const atStart: Board = { ...allWork, tab: 'this', unit: null }

    expect(argsOf(through([build, tabKey('all')], [allWork, pageKey('unit:fumi')]))).toEqual(['--tab', 'all', '--page', 'unit:fumi', '--page-unit', 'fumi'])
    expect(argsOf(walk(atStart, pageKey('unit:fumi')))).toEqual(['--page', 'unit:fumi', '--page-unit', 'fumi'])
  })

  test('a page stays while the session moves beneath it, asked for in the unit it was opened in, until back, which shows This session where the session is now', () => {
    const reading = walk(build, pageKey('task:1.4'))

    expect(pressed(reading, 'anything', review, VIEWS), 'the session moving moves no page').toBeNull()
    expect(argsOf(reading), 'the build gone to review, the page still asked for').toEqual(['--page', 'task:1.4', '--page-unit', UNIT])
    expect(argsOf(pressed(reading, BACK, review, VIEWS) ?? reading), 'back: This session, the review').toEqual([])
  })

  test('back returns one page at a time; a tab opens at its top, leaving every page', () => {
    const deep = through([build, pageKey('task:6.4')], [taskPage, pageKey('task:6.4:written')])

    expect(argsOf(pressed(deep, BACK, taskPage, VIEWS) ?? deep)).toEqual(['--page', 'task:6.4', '--page-unit', UNIT])
    expect(argsOf(pressed(deep, tabKey('this'), taskPage, VIEWS) ?? deep)).toEqual([])
  })

  test('a fold opens and closes its section and asks nothing new', () => {
    const opened = walk(build, 'fold:phase:5')

    expect([...opened.opened]).toEqual(['phase:5'])
    expect(argsOf(opened)).toEqual([])
    expect([...walk(build, 'fold:phase:5', 'fold:phase:5').opened]).toEqual([])
  })

  test('the unit\'s tab is no press at the start menu, where there is no unit; a key not the pane\'s is none of its', () => {
    expect(pressed(HOME, tabKey('unit'), { ...build, unit: null }, VIEWS)).toBeNull()
    expect(pressed(HOME, 'board:toggle', build, VIEWS)).toBeNull()
  })
})

describe('the pane as drawn', () => {
  test('the three tabs, This session shown, with the rule beneath heavy under it', () => {
    const { tabs, lines } = draw(answered(build), HOME)

    expect(tabs?.map(tab => [tab.label, tab.isActive])).toEqual([
      ['⌂ This session', true],
      ['≡ Token-aware diff sizing', false],
      ['≡ All work', false],
    ])
    expect(textOf(lines[0]?.parts ?? [])).toBe(`${'━'.repeat(14)}${'─'.repeat(48)}`)
    expect(widthOf(lines[0]?.parts ?? [])).toBe(62)
    expect(lines[0]?.parts.find(part => part.text.startsWith('━'))?.color).toBe('#a9a1e1')
  })

  test('the tab the engine answered is the one shown; at the start menu the unit\'s tab is not there', () => {
    expect(draw(answered({ ...build, tab: 'all' }), walk(build, tabKey('all'))).tabs?.map(tab => tab.isActive)).toEqual([false, false, true])
    expect(draw(answered({ ...build, unit: null }), HOME).tabs?.map(tab => tab.label)).toEqual(['⌂ This session', '≡ All work'])
  })

  test('a unit\'s name too long for the tab row is cut to fit beside the other two', () => {
    const long = { unit: UNIT, title: 'A unit whose name runs well past the room the tab row leaves it' }
    const tabs = draw(answered({ ...build, unit: long }), HOME).tabs ?? []

    expect(tabs[1]?.label.endsWith('…')).toBe(true)
    expect(widthOf(tabs.map(tab => ({ text: tab.label }))) + 6).toBe(62)
  })

  test('the view shown is drawn beneath the tabs; a kind with no drawing draws nothing there', () => {
    expect(shown(draw(answered(build), HOME).lines).slice(1)).toEqual([' ', 'the build'])
    expect(shown(draw(answered({ ...build, view: { kind: 'discovery' } }), HOME).lines).slice(1)).toEqual([' '])
  })

  test('a page leads with the way back, naming what the tab shows beneath it now', () => {
    const nav = walk(build, pageKey('task:6.4'))

    expect(shown(draw(answered(taskPage), nav).lines).slice(1, 4)).toEqual([' ', '← back to the build', ' '])
    expect(shown(draw(answered({ ...taskPage, beneath: review.view }), nav).lines)[2], 'the session gone on to review').toBe('← back to the review')
    expect(shown(draw(answered({ ...taskPage, beneath: { kind: 'discovery' } }), nav).lines)[2], 'beneath it a kind with no drawing').toBe('← back')
  })

  test('a page opened over a page names the page beneath it, wherever the session has gone', () => {
    const nav = through([build, pageKey('task:6.4')], [taskPage, pageKey('task:6.4:written')])
    const written = answered({ ...taskPage, view: { kind: 'task-written', unit: UNIT }, beneath: review.view })

    expect(shown(draw(written, nav).lines)[2]).toBe('← back to 6.4 A failed single-pass call is classified')
  })

  test('a page the engine cannot draw says why beneath the way back; a tab\'s view, beneath the tabs', () => {
    const nav = walk(build, pageKey('task:9.9'))
    const unavailable = { kind: 'unavailable', reason: 'task 9.9 of token-aware-diff-sizing is not in the tracker' }
    const { lines } = draw(answered({ ...taskPage, view: unavailable }), nav)

    expect(shown(lines).slice(2)).toEqual(['← back to the build', ' ', 'task 9.9 of token-aware-diff-sizing is not in the tracker'])
    expect(lines.at(-1)).toMatchObject({ wraps: true, parts: [{ color: '#a3abd0' }] })
    expect(shown(draw(answered({ ...build, view: unavailable }), HOME).lines).slice(2)).toEqual(['task 9.9 of token-aware-diff-sizing is not in the tracker'])
  })

  test('a version this board does not know is refused in a line, nothing of it drawn', () => {
    const { tabs, lines } = draw({ kind: 'refused', version: 9 }, walk(build, pageKey('task:6.4')))

    expect(tabs).toBeNull()
    expect(shown(lines)).toEqual([
      "This board draws version 8 of the engine's board, and the engine answers version 9: nothing is drawn until they match.",
    ])
  })

  test('with nothing answered, only the way back from a page is drawn, naming a page beneath it alone', () => {
    expect(draw(null, HOME)).toMatchObject({ tabs: null, lines: [] })
    expect(shown(draw(null, walk(build, pageKey('task:6.4'))).lines)).toEqual(['← back', ' '])
    expect(shown(draw(null, through([build, pageKey('task:6.4')], [taskPage, pageKey('task:6.4:written')])).lines)[0]).toBe(
      '← back to 6.4 A failed single-pass call is classified',
    )
  })
})

describe('where the engine refuses what the pane asks, or a read times out', () => {
  /** The engine exiting with its error: the unit the place names has left the project. */
  const REFUSED = readingOf({ stdout: '', stderr: '{"ok":false,"error":"there is no work unit \\"fumi\\""}\n' })

  /** A read whose child was killed at its timeout, so the run rejected. */
  const TIMED_OUT = readingOf(null)

  /** A read whose child a signal ended, with nothing said. */
  const KILLED = readingOf({ stdout: '', stderr: '' })

  /** At most `pages` pages open. */
  const within = (pages: number) => (nav: Nav) => nav.pages.length <= pages

  /** An engine answering a board where `isAnswered`, and `past` elsewhere, recording what it was asked. */
  const engine = (isAnswered: (nav: Nav) => boolean, past: Reading = REFUSED) => {
    const asked: string[][] = []
    const read = async (nav: Nav): Promise<Reading> => {
      asked.push(argsOf(nav))

      return isAnswered(nav) ? { answer: answered(build), isRefused: false } : past
    }

    return { asked, read }
  }

  test('a refused page drops back to what lies beneath it, which is read instead', async () => {
    const { asked, read } = engine(within(0))
    const { nav, answer } = await readOn(walk(build, pageKey('task:6.4')), read)

    expect({ nav: argsOf(nav), answer, asked }).toEqual({ nav: [], answer: answered(build), asked: [['--page', 'task:6.4', '--page-unit', UNIT], []] })
  })

  test('a refused page drops itself alone, the page beneath it answered', async () => {
    const { asked, read } = engine(within(1))
    const { nav } = await readOn(through([build, pageKey('task:6.4')], [taskPage, pageKey('task:6.4:written')]), read)

    expect([argsOf(nav), asked.length]).toEqual([['--page', 'task:6.4', '--page-unit', UNIT], 2])
  })

  test('refused, the pane unwinds a level at a time — each page, then the unit\'s tab — to This session\'s top', async () => {
    const { asked, read } = engine(nav => nav.tab === 'this')
    const fumi = { ...build, unit: { unit: 'fumi', title: 'Fumi' }, view: { kind: 'unit', unit: 'fumi' } }
    const deep = through([fumi, tabKey('unit')], [fumi, pageKey('task:1.1')], [{ ...taskPage, view: { ...taskPage.view, unit: 'fumi' } }, pageKey('task:1.1:written')])
    const { nav, answer } = await readOn(deep, read)

    expect({ nav: [nav.tab, nav.unit, nav.pages], answer, asked }).toEqual({
      nav: ['this', null, []],
      answer: answered(build),
      asked: [
        ['--tab', 'unit', '--unit', 'fumi', '--page', 'task:1.1:written', '--page-unit', 'fumi'],
        ['--tab', 'unit', '--unit', 'fumi', '--page', 'task:1.1', '--page-unit', 'fumi'],
        ['--tab', 'unit', '--unit', 'fumi'],
        [],
      ],
    })
  })

  for (const [how, past] of [
    ['timed out', TIMED_OUT],
    ['was ended by a signal', KILLED],
  ] as const) {
    test(`a place whose read ${how} is kept, read once, a page drawing its way back alone`, async () => {
      const { asked, read } = engine(within(0), past)
      const page = through([build, tabKey('unit')], [build, pageKey('task:6.4')])
      const { nav, answer } = await readOn(page, read)

      expect([nav, answer, asked.length]).toEqual([page, null, 1])
      expect(shown(draw(answer, nav).lines)).toEqual(['← back', ' '])
    })
  }

  test('a page answered is kept, read once', async () => {
    const { asked, read } = engine(within(1))
    const page = walk(build, pageKey('task:6.4'))

    expect([(await readOn(page, read)).nav, asked.length]).toEqual([page, 1])
  })

  test('a read that unwound the pane settles it there, keeping a fold pressed meanwhile; a press elsewhere meanwhile stands', () => {
    const asked = walk(build, tabKey('unit'), pageKey('task:6.4'))
    const unwound = HOME

    expect(settled(asked, asked, unwound)).toEqual(unwound)

    const folded = pressed(asked, 'fold:phase:5', build, VIEWS) ?? asked
    const kept = settled(folded, asked, unwound)

    expect([argsOf(kept), [...kept.opened]]).toEqual([[], ['phase:5']])

    const elsewhere = pressed(asked, tabKey('all'), build, VIEWS) ?? asked

    expect(settled(elsewhere, asked, unwound)).toBe(elsewhere)
  })

  test('This session\'s top, refused, is read once, nothing answered', async () => {
    const { asked, read } = engine(() => false)

    expect([(await readOn(HOME, read)).answer, asked]).toEqual([null, [[]]])
  })
})

describe('what runs, while the pane is up', () => {
  test('a task building turns its ◐ a quarter each frame and nothing else on the pane moves', () => {
    const nav = walk(build, pageKey('task:6.4'))
    const frames = [0, 1, 2, 3].map(frame => shown(draw(answered(taskPage), nav, frame).lines))
    const task = frames.map(lines => lines.at(-1))

    expect(task).toEqual(['◐', '◓', '◑', '◒'].map(mark => `${mark} 6.4 A failed single-pass call is classified building 2:14`))
    expect(new Set(frames.map(lines => JSON.stringify(lines.slice(0, -1)))).size).toBe(1)
  })

  test('its clock is read at the drawing\'s time', () => {
    const nav = walk(build, pageKey('task:6.4'))

    expect(shown(draw(answered(taskPage), nav, 0, Date.parse('2026-10-21T10:00:40.000Z')).lines).at(-1)).toEndWith('building 0:40')
  })

  test('a drawing holds what turns and is clocked only where something runs in it', () => {
    expect(draw(answered(taskPage), walk(build, pageKey('task:6.4'))).holds).toEqual({ turns: true, clocks: true })
    expect(draw(answered(build), HOME).holds).toEqual({ turns: false, clocks: false })
  })
})
