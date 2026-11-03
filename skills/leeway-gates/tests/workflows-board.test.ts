import type { On, RenderElement } from 'claude-code'
import { describe, expect, mock, test, tier, type Engine, type Mounted as MountedOf } from 'claude-code/testing'

import type { Board } from '../hooks/model.ts'
import BUILD from './fixtures/board-build.mjs'

tier('user')

/**
 * The person's home directory, as the process names it — under `/Users`,
 * since the kit's host check refuses macOS's automounted `/home`.
 */
const HOME = '/Users/person'

/** The workflows' system config directory where the process names none. */
const DEFAULT_CONFIG = `${HOME}/.config/leeway`

/** The session's project. */
const ROOT = '/Users/person/app'

const ENGINE = `${ROOT}/.claude/skills/leeway-engine/scripts/engine.cjs`

/** The announcement a session the mod applies to carries from its start. */
const ANNOUNCED = { LEEWAY_GATE_SURFACE: '1' }

/** An engine call the conversation makes, as Claude runs it. */
const ENGINE_CALL = { tool: 'Bash' as const, command: 'node .claude/skills/leeway-engine/scripts/engine.cjs task start pay 6.4' }

/** The same call made by a subagent. */
const SUBAGENT_CALL = { ...ENGINE_CALL, agentId: 'a1' }

/** What that call answers, which reaches the conversation as Claude Code answered it. */
const ENGINE_SAID = '{"ok":true,"started":"6.4"}\n'

/** The band on a 120-column terminal, 24 rows. */
const BAND = { hasSurvey: false, isWorking: false, maxRows: 24, bodyColumns: 120, scroll: { offset: 0, bodyRows: 23 }, view: {} }

const BAND_MOUNT = {
  plugin: 'leeway-gates',
  surface: 'terminal' as const,
  component: 'AbovePrompt' as const,
  requestId: 'band',
  viewport: { columns: 120, rows: 24 },
  props: BAND,
}

/** The pane docked at 64 columns, as every drawing in §20 is. */
const PANE_MOUNT = {
  plugin: 'leeway-gates',
  surface: 'terminal' as const,
  component: 'Pane' as const,
  requestId: 'board',
  props: { title: 'workflows', isFocused: false, bodyColumns: 64, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 400 }, view: {} },
}

/** What Claude Code draws in the band beneath the mod. */
const BENEATH: RenderElement = { type: 'Text', children: ['? for shortcuts'] }

/** The build as the engine answers it: This session in a build, three questions waiting on the person. */
const BUILD_BOARD = BUILD

/** What the engine answers: a board, its exit code and stdout. */
type Reply = { exitCode: number; stdout: string }

const boardReply = (board: unknown): Reply => ({ exitCode: 0, stdout: `${JSON.stringify({ ok: true, ...(board as object) })}\n` })

/**
 * The world beneath the mod: the process's environment (announced unless
 * told otherwise), the session's id and project, the conversations the
 * engine `marked`, and what `engine board` answers (`replies`, by the args
 * it was asked) and how long it `takes` on the clock, which starts at 10:00
 * on 21 Oct; the panes `open` from before the mod loaded; every Bash call
 * answers `ENGINE_SAID`. `boards`
 * records each `engine board` run by its args after the session's id,
 * `opened` each pane opened, `invalidations` each redraw asked, `beneath`
 * the rows the band beneath the banner was given, and `sent` whatever
 * reached the conversation or the prompt box.
 */
function world(
  on: On,
  options: {
    env?: Readonly<Record<string, string>>
    marked?: readonly string[]
    open?: readonly string[]
    replies?: (args: readonly string[]) => Reply
  } = {},
) {
  const { env = ANNOUNCED, marked = ['s0', 's1'] } = options
  const clock = mock.clock(on, { now: Date.parse('2026-10-21T10:00:00.000Z') })
  const boards: { id: string; args: readonly string[] }[] = []
  const opened: unknown[] = []
  const beneath: number[] = []
  const sent: string[] = []
  const counts = { invalidations: 0 }
  const panes = new Set<string>(options.open)
  const environment: Record<string, string> = { HOME, ...env }
  let replies = options.replies ?? (() => boardReply(BUILD_BOARD))
  let sessionId = 's0'
  let takesMs = 0

  on('env.get', ($, e) => ({ value: environment[e.name] }))
  on('session.id', () => ({ value: sessionId }))
  on('session.root', () => ({ value: ROOT }))
  on('session.messages', () => ({ value: [] }))
  on('session.surfaces', () => ({ value: ['terminal'] }))
  on('fs.exists', ($, e) => ({ value: marked.some(id => e.path === `${DEFAULT_CONFIG}/conversations/${id}/workflow`) }))

  on('process.run', async ($, e) => {
    const [, engine, verb, id = '', ...args] = e.argv

    if (engine !== ENGINE || verb !== 'board') {
      throw new Error(`no such run: ${e.argv.join(' ')}`)
    }

    boards.push({ id, args })

    if (takesMs > 0) {
      await clock.sleep(takesMs)
    }

    const { exitCode, stdout } = replies(args)

    return { value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  on('ui.open', ($, e) => {
    panes.add(e.id)
    opened.push({ id: e.id, title: e.title, columns: e.columns, rows: e.rows })

    return { value: { isPlaced: true } }
  })

  on('ui.close', ($, e) => {
    panes.delete(e.id)

    return { value: undefined }
  })

  on('ui.panes', () => ({ value: [...panes].map(id => ({ id, title: 'workflows', isShown: true, isFocused: false, isPlaced: true })) }))

  on('ui.invalidate', ($, e, next) => {
    counts.invalidations += 1

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    beneath.push(e.props.maxRows)

    return BENEATH
  })

  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: ENGINE_SAID, stderr: '', interrupted: false } }))

  on('prompt.fill', ($, e) => {
    sent.push(`fill ${e.text}`)

    return { isFilled: true }
  })

  on('prompt.submit', ($, e) => {
    sent.push(`submit ${e.text}`)

    return { text: e.text }
  })

  return {
    clock,
    boards,
    opened,
    beneath,
    sent,
    counts,
    panes,
    /** The engine answering from now on as `next` does. */
    answers(next: (args: readonly string[]) => Reply) {
      replies = next
    },
    /** The conversation going on as another, a /clear's or a resume's. */
    becomes(id: string) {
      sessionId = id
    },
    /** Each `engine board` run taking `ms` on the clock from now on. */
    takes(ms: number) {
      takesMs = ms
    },
  }
}

const UNIT = 'token-aware-diff-sizing'

/** The board with another banner, the rest as the build's. */
const withBanner = (banner: Board['banner']): Board => ({ ...BUILD_BOARD, banner })

/** The session moved on into the review phase. */
const REVIEW_BOARD: Board = {
  ...BUILD_BOARD,
  place: { ...BUILD_BOARD.place, phase: 'review' },
  banner: {
    state: 'running',
    name: 'Token-aware diff sizing',
    facts: [
      { text: 'feature', needs: false },
      { text: 'review', needs: false },
      { text: 'round 1 reading', needs: false },
    ],
  },
  view: { kind: 'review', unit: UNIT },
}

/** A drawing as the tests read it, the band's or the pane's. */
type Mounted = Pick<MountedOf<'terminal'>, 'drawn' | 'find' | 'findAll'>

/** The banner's words: the line it draws them in, its button apart. */
async function bannerOf(ui: Mounted): Promise<string | undefined> {
  return (await ui.find({ type: 'Text' }))?.text
}

/** The innermost run the drawing shows `text` in. */
async function runOf(ui: Mounted, text: string) {
  return (await ui.findAll({ type: 'Text', text })).at(-1)
}

/** What the board's button reads. */
async function toggleOf(ui: Mounted): Promise<string | undefined> {
  return (await ui.find({ key: 'board:toggle' }))?.text
}

/** Each line the pane drew, its padding and rules squeezed. */
async function paneLines(ui: Mounted): Promise<string[]> {
  return (await ui.findAll({ type: 'Box' })).slice(1).map(found => found.text.replace(/─+/g, '─').replace(/\s+/g, ' ').trim())
}

type Clock = ReturnType<typeof mock.clock>

/** What a drawing shows, without the attribution Claude Code tags its root with. */
async function drawnOf(ui: Mounted): Promise<unknown> {
  const { part: _, ...shown } = (await ui.drawn()) as RenderElement & { part?: unknown }

  return shown
}

/** A drawing mounted once the board has been read for the conversation. */
async function mounted($: Engine, clock: Clock, mount: typeof BAND_MOUNT | typeof PANE_MOUNT = BAND_MOUNT, requestId = mount.requestId) {
  const ui = await $.ui.mount({ ...mount, requestId })

  await clock.settle()

  return ui
}

/** An engine call, the conversation's or a subagent's, and what it answered, once the board's read is done. */
async function engineCall($: Engine, clock: Clock, call: typeof ENGINE_CALL | typeof SUBAGENT_CALL = ENGINE_CALL) {
  const answered = await $.tool.call(call)

  await clock.settle()

  return answered
}

describe('the banner', () => {
  test('names the work in bold after its state\'s mark, its facts in grey, what waits on the person in peach behind a ⚑, the board\'s button at its right', async ($, on) => {
    const { clock } = world(on)
    const ui = await mounted($, clock)

    expect(await bannerOf(ui)).toBe('◐ Token-aware diff sizing · feature · build · 1 building · 1 in review · ⚑ 3 waiting on you')
    expect((await runOf(ui, 'Token-aware diff sizing'))?.props.bold).toBe(true)
    expect((await runOf(ui, '◐ '))?.props.color).toBe('#86d4cc')
    expect((await runOf(ui, '1 in review'))?.props.color).toBe('#a3abd0')
    expect((await runOf(ui, '⚑ 3 waiting on you'))?.props.color).toBe('#f5a97f')
    expect(await toggleOf(ui)).toBe('▸ show board')
  })

  test('its mark is the session\'s state: ◐ running, ⚑ waiting on the person, ✓ done, none where neither', async ($, on) => {
    const { clock, answers } = world(on)
    const ui = await mounted($, clock)
    const shown: (string | undefined)[] = []

    for (const state of ['running', 'needs', 'done', 'idle'] as const) {
      answers(() => boardReply(withBanner({ state, name: 'Pay', facts: [{ text: 'feature', needs: false }] })))
      await engineCall($, clock)
      shown.push(await bannerOf(ui))
    }

    expect(shown).toEqual(['◐ Pay · feature', '⚑ Pay · feature', '✓ Pay · feature', 'Pay · feature'])
  })

  test('takes a line of its own above the band, which draws in the rows it leaves', async ($, on) => {
    const { clock, beneath } = world(on)
    const ui = await mounted($, clock)

    expect(await ui.drawn()).toMatchObject({ type: 'Box', props: { flexDirection: 'column' }, children: [{ props: { key: 'banner' } }, BENEATH] })
    expect(beneath.at(-1)).toBe(23)
  })

  test('is cut from its right end where the band is too narrow, its button kept', async ($, on) => {
    const { clock } = world(on)
    const banner = await (await mounted($, clock)).find({ key: 'banner' })

    expect(banner?.props).toMatchObject({ flexDirection: 'row', justifyContent: 'flex-end', width: 120 })
    expect(banner?.children.map(child => [(child as { type: string }).type, (child as { props: { wrap?: string } }).props.wrap])).toEqual([
      ['Text', 'truncate-end'],
      ['Button', undefined],
    ])
  })

  test('a survey holds the band alone, and the band keeps all its rows', async ($, on) => {
    const { clock, beneath } = world(on)
    const ui = await $.ui.mount({ ...BAND_MOUNT, props: { ...BAND, hasSurvey: true } })

    await clock.settle()

    expect(await drawnOf(ui)).toEqual(BENEATH)
    expect(beneath.at(-1)).toBe(24)
  })
})

describe('showing and hiding the board', () => {
  test('a pane still up from before the mod reloaded is drawn, and the banner says it can be hidden', async ($, on) => {
    const { clock } = world(on, { open: ['board'] })

    await mounted($, clock, PANE_MOUNT)

    expect(await toggleOf(await mounted($, clock))).toBe('hide board')
  })

  test('"▸ show board" opens the pane, titled workflows, and reads "hide board"; pressed again, the pane closes', async ($, on) => {
    const { clock, opened, panes } = world(on)
    const ui = await mounted($, clock)

    await ui.press({ key: 'board:toggle' })
    expect(opened).toEqual([{ id: 'board', title: 'workflows', columns: 60, rows: 28 }])
    expect([...panes]).toEqual(['board'])
    expect(await toggleOf(ui)).toBe('hide board')

    await ui.press({ key: 'board:toggle' })
    expect([...panes]).toEqual([])
    expect(await toggleOf(ui)).toBe('▸ show board')
  })
})

describe('the pane', () => {
  test('draws its three tabs, This session shown, the rule heavy beneath it', async ($, on) => {
    const { clock } = world(on)
    const lines = await paneLines(await mounted($, clock, PANE_MOUNT))

    expect(lines.slice(0, 2)).toEqual(['⌂ This session ≡ Token-aware diff sizing ≡ All work', '━━━━━━━━━━━━━━─'])
  })

  test('a tab pressed reads the board for that tab, one call each', async ($, on) => {
    const { clock, boards } = world(on)
    const ui = await mounted($, clock, PANE_MOUNT)

    await ui.press({ key: 'tab:unit' })
    await ui.press({ key: 'tab:all' })
    await ui.press({ key: 'tab:this' })

    expect(boards.map(({ args }) => args)).toEqual([[], ['--tab', 'unit', '--unit', UNIT], ['--tab', 'all'], []])
  })

  test('a press that leaves the person where they are reads nothing', async ($, on) => {
    const { clock, boards } = world(on)
    const ui = await mounted($, clock, PANE_MOUNT)

    await ui.press({ key: 'tab:this' })

    expect(boards).toHaveLength(1)
  })

  test('where the person went stays while the session moves beneath it, and This session follows the session', async ($, on) => {
    let phase = 'build'
    const { clock, boards, answers } = world(on)

    answers(args => boardReply(args.includes('--tab') ? { ...BUILD_BOARD, tab: 'unit' } : phase === 'build' ? BUILD_BOARD : REVIEW_BOARD))

    const pane = await mounted($, clock, PANE_MOUNT)
    const band = await mounted($, clock)

    await pane.press({ key: 'tab:unit' })
    phase = 'review'
    await engineCall($, clock)
    expect(boards.at(-1)?.args, "the session moved, the unit's tab asked for still").toEqual(['--tab', 'unit', '--unit', UNIT])

    await pane.press({ key: 'tab:this' })
    expect(boards.at(-1)?.args).toEqual([])
    expect(await bannerOf(band)).toBe('◐ Token-aware diff sizing · feature · review · round 1 reading')
  })

  test('a version this board does not know is refused: no banner, and the pane says so in a line', async ($, on) => {
    const { clock } = world(on, { replies: () => boardReply({ ...BUILD_BOARD, version: 2 }) })

    expect(await drawnOf(await mounted($, clock))).toEqual(BENEATH)
    expect(await paneLines(await mounted($, clock, PANE_MOUNT))).toEqual([
      "This board draws version 1 of the engine's board, and the engine answers version 2: nothing is drawn until they match.",
    ])
  })

  test('an engine that refuses or fails draws nothing', async ($, on) => {
    const { clock } = world(on, { replies: () => ({ exitCode: 1, stdout: '' }) })

    expect(await drawnOf(await mounted($, clock))).toEqual(BENEATH)
    expect(await paneLines(await mounted($, clock, PANE_MOUNT))).toEqual([])
  })
})

describe('what reads the board', () => {
  test('every engine call, the conversation\'s or a subagent\'s, reads it once after, its result as Claude Code answered it', async ($, on) => {
    const { clock, boards } = world(on)

    await mounted($, clock)

    expect(await engineCall($, clock)).toEqual({ result: { stdout: ENGINE_SAID, stderr: '', interrupted: false } })
    expect(boards).toHaveLength(2)

    await engineCall($, clock, SUBAGENT_CALL)
    expect(boards).toHaveLength(3)
  })

  test('the session moving is drawn at the next engine call', async ($, on) => {
    const { clock, answers } = world(on)
    const ui = await mounted($, clock)

    answers(() => boardReply(REVIEW_BOARD))
    await engineCall($, clock)

    expect(await bannerOf(ui)).toBe('◐ Token-aware diff sizing · feature · review · round 1 reading')
  })

  test('a command that is no engine call reads nothing', async ($, on) => {
    const { clock, boards } = world(on)

    await mounted($, clock)
    await $.tool.call({ tool: 'Bash', command: 'git status' })
    await clock.settle()

    expect(boards).toHaveLength(1)
  })

  test('calls made while a read runs are answered by one more read after it, never one each', async ($, on) => {
    const { clock, boards, takes } = world(on)

    await mounted($, clock)
    takes(400)

    for (const _ of [1, 2, 3]) {
      await $.tool.call(ENGINE_CALL)
      await clock.settle()
    }

    await clock.advance(400)
    await clock.advance(400)

    expect(boards).toHaveLength(3)
  })

  test('the board is read once for each conversation it draws in, and redrawn without reading', async ($, on) => {
    const { clock, boards, becomes } = world(on)
    const ui = await mounted($, clock)

    await clock.advance(5000)
    await mounted($, clock, BAND_MOUNT, 'again')
    expect(boards.map(({ id }) => id)).toEqual(['s0'])

    becomes('s1')
    await mounted($, clock, BAND_MOUNT, 'resumed')
    expect(boards.map(({ id }) => id)).toEqual(['s0', 's1'])
    expect(await bannerOf(ui)).toBe('◐ Token-aware diff sizing · feature · build · 1 building · 1 in review · ⚑ 3 waiting on you')
  })

  for (const [where, options] of [
    ['a session that did not announce', { env: {} }],
    ['a conversation the engine has not marked', { marked: [] }],
  ] as const) {
    test(`${where} reads nothing and draws nothing`, async ($, on) => {
      const { clock, boards } = world(on, options)

      expect(await drawnOf(await mounted($, clock))).toEqual(BENEATH)
      await engineCall($, clock)

      expect(boards).toEqual([])
    })
  }
})

describe('what turns', () => {
  test('with the board hidden, nothing turns and nothing is read, however long the clock runs', async ($, on) => {
    const { clock, boards, counts } = world(on)

    await mounted($, clock)
    counts.invalidations = 0
    await clock.advance(5000)

    expect([counts.invalidations, boards.length]).toEqual([0, 1])
  })

  test('with the board up and nothing running in it, the clock redraws nothing and reads nothing', async ($, on) => {
    const { clock, boards, counts } = world(on)
    const band = await mounted($, clock)

    await band.press({ key: 'board:toggle' })
    await mounted($, clock, PANE_MOUNT)
    counts.invalidations = 0
    await clock.advance(5000)

    expect([counts.invalidations, boards.length]).toEqual([0, 1])
  })
})

describe('the conversation, whether the board is up or hidden', () => {
  test('gets each engine call\'s result as Claude Code answered it, and nothing the board does reaches it or the prompt box', async ($, on) => {
    const { clock, sent } = world(on)
    const band = await mounted($, clock)
    const hidden = await engineCall($, clock)

    await band.press({ key: 'board:toggle' })

    const pane = await mounted($, clock, PANE_MOUNT)
    const up = await engineCall($, clock)

    await pane.press({ key: 'tab:all' })
    await pane.press({ key: 'tab:this' })
    await band.press({ key: 'board:toggle' })

    expect(up).toEqual(hidden)
    expect(sent).toEqual([])
  })
})

