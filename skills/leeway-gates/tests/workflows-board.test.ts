import type { On, RenderElement, RenderSurface } from 'claude-code'
import { describe, expect, mock, test, tier, type Engine, type Mounted as MountedOf } from 'claude-code/testing'

import type { Board } from '../hooks/model.ts'
import BUILD from './fixtures/board-build.mjs'
import REVIEW from './fixtures/board-review.mjs'
import TASK from './fixtures/board-task.mjs'

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

/** What Claude Code draws in a pane no plugin draws. */
const NO_PANE: RenderElement = { type: 'Box', children: [] }

/** The build as the engine answers it: This session in a build, three questions waiting on the person. */
const BUILD_BOARD = BUILD

/** What the engine answers: its exit code, stdout and stderr. */
type Reply = { exitCode: number; stdout: string; stderr?: string }

const boardReply = (board: unknown): Reply => ({ exitCode: 0, stdout: `${JSON.stringify({ ok: true, ...(board as object) })}\n` })

/** The engine refusing the read, its error on stderr as it exits. */
const refusal = (error: string): Reply => ({ exitCode: 1, stdout: '', stderr: `${JSON.stringify({ ok: false, error })}\n` })

/**
 * The world beneath the mod: the process's environment (announced unless
 * told otherwise), the session's id and project, the screens attached (the
 * terminal's alone unless given), the conversations the
 * engine `marked`, and what `engine board` answers (`replies`, by the args
 * it was asked) and how long it `takes` on the clock, which starts at 10:00
 * on 21 Oct; the panes `open` from before the mod loaded; every Bash call
 * answers `ENGINE_SAID` unless `said` answers it otherwise. `boards`
 * records each `engine board` run by its args after the session's id,
 * `opened` each pane opened, `invalidations` each redraw asked, `beneath`
 * the rows the band beneath the banner was given, `sent` whatever
 * reached the conversation or the prompt box, `scrolled` each scroll of
 * the pane Claude Code was left to move, and `files` what the mod
 * wrote, by path, beside what was there before it (`kept`), and the
 * discussion kept as each send was made (`atSend`); a send is dropped,
 * fails or is held open as told.
 */
function world(
  on: On,
  options: {
    env?: Readonly<Record<string, string>>
    surfaces?: readonly RenderSurface[]
    marked?: readonly string[]
    open?: readonly string[]
    replies?: (args: readonly string[]) => Reply
    kept?: Readonly<Record<string, string>>
  } = {},
) {
  const { env = ANNOUNCED, surfaces = ['terminal'], marked = ['s0', 's1'] } = options
  const clock = mock.clock(on, { now: Date.parse('2026-10-21T10:00:00.000Z') })
  const boards: { id: string; args: readonly string[] }[] = []
  const opened: unknown[] = []
  const beneath: number[] = []
  const sent: string[] = []
  const scrolled: number[] = []
  const counts = { invalidations: 0 }
  const panes = new Set<string>(options.open)
  const environment: Record<string, string> = { HOME, ...env }
  let replies = options.replies ?? (() => boardReply(UNDRAWN))
  let said = (_command: string): string => ENGINE_SAID
  let drops: string | undefined
  let fails = false
  let held: Promise<void> | null = null
  const atSend: (string | undefined)[] = []
  const files = new Map<string, string>(Object.entries(options.kept ?? {}))
  let sessionId = 's0'
  let takesMs = 0

  on('env.get', ($, e) => ({ value: environment[e.name] }))
  on('session.id', () => ({ value: sessionId }))
  on('session.root', () => ({ value: ROOT }))
  on('session.messages', () => ({ value: [] }))
  on('session.surfaces', () => ({ value: surfaces }))
  on('fs.exists', ($, e) => ({ value: marked.some(id => e.path === `${DEFAULT_CONFIG}/conversations/${id}/workflow`) || files.has(e.path) }))

  on('process.run', async ($, e) => {
    const [, engine, verb, id = '', ...args] = e.argv

    if (engine !== ENGINE || verb !== 'board') {
      throw new Error(`no such run: ${e.argv.join(' ')}`)
    }

    boards.push({ id, args })

    if (takesMs > 0) {
      await clock.sleep(takesMs)
    }

    const { exitCode, stdout, stderr = '' } = replies(args)

    return { value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false } }
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

  on('ui.render', { component: 'Pane' }, () => NO_PANE)

  on('ui.scroll', ($, e) => {
    scrolled.push(e.by)

    return {}
  })

  on('tool.call', { tool: 'Bash' }, ($, e) => ({ result: { stdout: said(e.command), stderr: '', interrupted: false } }))

  on('fs.read', ($, e) => {
    const text = files.get(e.path)

    if (text === undefined) {
      throw new Error(`ENOENT: ${e.path}`)
    }

    return { value: text }
  })

  on('fs.write', ($, e) => {
    files.set(e.path, e.text)

    return { value: undefined }
  })

  on('prompt.fill', ($, e) => {
    sent.push(`fill ${e.text}`)

    return { isFilled: true }
  })

  on('prompt.submit', async ($, e) => {
    atSend.push(files.get(`${DEFAULT_CONFIG}/conversations/${sessionId}/discussing.json`))

    if (held !== null) {
      await held
    }

    if (fails) {
      throw new Error('the prompt could not be sent')
    }

    if (drops !== undefined) {
      return { text: e.text, drop: drops }
    }

    sent.push(`submit ${e.text}`)

    return { text: e.text }
  })

  return {
    clock,
    boards,
    opened,
    beneath,
    sent,
    scrolled,
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
    files,
    /** Every Bash call answering as `next` does from now on. */
    answersCalls(next: (command: string) => string) {
      said = next
    },
    /** Each send dropped from now on, for `why`; sent again with none. */
    dropping(why: string | undefined) {
      drops = why
    },
    /** Each send failing from now on. */
    failing() {
      fails = true
    },
    /** Each send held open from now on, until the function this answers is called. */
    holding(): () => void {
      let release = () => undefined as void

      held = new Promise(resolve => {
        release = () => {
          held = null
          resolve()
        }
      })

      return () => release()
    },
    /** The discussion the conversation's folder kept as each send was made. */
    atSend,
  }
}

const UNIT = 'token-aware-diff-sizing'

/** The board with another banner, the rest as the build's. */
const withBanner = (banner: Board['banner']): Board => ({ ...UNDRAWN, banner })

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
  view: REVIEW,
  questions: [],
}

/** The build's board with a view no drawing draws, so the pane holds its tabs alone. */
const UNDRAWN: Board = { ...BUILD_BOARD, view: { kind: 'undrawn' } }

/** Task 1.4's page open over `board`, This session's view beneath it. */
const taskOver = (board: Board): Board => ({ ...board, view: TASK, beneath: board.view })

/** A drawing as the tests read it, the band's or the pane's. */
type Mounted = Pick<MountedOf<'terminal'>, 'drawn' | 'find' | 'findAll'>

/** The banner's words: the line it draws them in, cut from its right, its button apart. */
async function bannerOf(ui: Mounted): Promise<string | undefined> {
  return (await ui.findAll({ type: 'Text' })).find(found => found.props.wrap === 'truncate-end')?.text
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

/** The pane's lines beneath its tabs and their rule, blanks left out. */
async function underTabs(ui: Mounted): Promise<string[]> {
  return (await paneLines(ui)).slice(2).filter(line => line !== '')
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

  test('takes the band\'s last line, directly above the prompt, beneath what the band draws in the rows it leaves', async ($, on) => {
    const { clock, beneath } = world(on)
    const ui = await mounted($, clock)

    expect(await ui.drawn()).toMatchObject({ type: 'Box', props: { flexDirection: 'column' }, children: [BENEATH, { props: { key: 'banner' } }] })
    expect(beneath.at(-1)).toBe(23)
  })

  test('is cut from its right end where the band is too narrow, its buttons kept', async ($, on) => {
    const { clock } = world(on)
    const banner = await (await mounted($, clock)).find({ key: 'banner' })

    expect(banner?.props).toMatchObject({ flexDirection: 'row', justifyContent: 'flex-end', width: 120 })
    expect(banner?.children.map(child => [(child as { type: string }).type, (child as { props: { wrap?: string } }).props.wrap])).toEqual([
      ['Text', 'truncate-end'],
      ['Button', undefined],
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

    answers(args => boardReply(args.includes('--tab') ? { ...UNDRAWN, tab: 'unit' } : phase === 'build' ? UNDRAWN : { ...REVIEW_BOARD, view: UNDRAWN.view }))

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

  test('a unit gone from the project unwinds its tab to This session: the banner stays, the tabs are drawn and pressed, and the gone unit is asked for no more', async ($, on) => {
    let isGone = false
    const { clock, boards, answers } = world(on)

    answers(args => (isGone && args.includes('--unit') ? refusal(`there is no work unit "${UNIT}"`) : boardReply(args.includes('--tab') ? { ...UNDRAWN, tab: args[1] } : UNDRAWN)))

    const pane = await mounted($, clock, PANE_MOUNT)
    const band = await mounted($, clock)

    await pane.press({ key: 'tab:unit' })
    isGone = true
    await engineCall($, clock)

    expect(boards.slice(-2).map(({ args }) => args), 'the unit refused, This session read in its place').toEqual([['--tab', 'unit', '--unit', UNIT], []])
    expect(await bannerOf(band)).toBe('◐ Token-aware diff sizing · feature · build · 1 building · 1 in review · ⚑ 3 waiting on you')
    expect((await paneLines(pane)).slice(0, 2)).toEqual(['⌂ This session ≡ Token-aware diff sizing ≡ All work', '━━━━━━━━━━━━━━─'])

    const before = boards.length

    await engineCall($, clock)
    await pane.press({ key: 'tab:all' })
    await pane.press({ key: 'tab:this' })

    expect(boards.slice(before).map(({ args }) => args), 'the next call reads This session alone').toEqual([[], ['--tab', 'all'], []])
  })

  test('a line that wraps keeps its words whole in the room before its ▸ read, a button at the right that opens its page', async ($, on) => {
    const verdict = '0.68 s for the 25 real fumis, under the 1 second the rule set: eager restore stands as designed'
    const experiment = { kind: 'experiment', unit: 'fumi', title: 'Fumi', type: 'epic', id: 'E1', question: 'What does a real fumi cost?', topic: 'scale', topic_title: 'Scale', status: 'concluded', approved: '2026-09-02', verdict, reason: null, problem: '', design: [], runs: [], report: true }
    const { clock, boards } = world(on, { replies: () => boardReply({ ...BUILD_BOARD, view: experiment }) })
    const pane = await mounted($, clock, PANE_MOUNT)

    expect((await pane.findAll({ type: 'Box', text: verdict })).map(found => found.props.flexGrow)).toContain(1)
    expect((await pane.findAll({ type: 'Text', text: verdict })).map(found => found.props.wrap)).toContain('wrap')
    expect((await pane.find({ key: 'x:verdict' }))?.text).toBe(`✓ ${verdict}▸ read`)
    expect((await pane.find({ key: 'page:report:scale:E1' }))?.text).toBe('▸ read')
    await pane.press({ key: 'page:report:scale:E1' })
    expect(boards.at(-1)?.args).toEqual(['--page', 'report:scale:E1', '--page-unit', 'fumi'])
  })

  test('a version this board does not know is refused: no banner, and the pane says so in a line', async ($, on) => {
    const { clock } = world(on, { replies: () => boardReply({ ...BUILD_BOARD, version: 4 }) })

    expect(await drawnOf(await mounted($, clock))).toEqual(BENEATH)
    expect(await paneLines(await mounted($, clock, PANE_MOUNT))).toEqual([
      "This board draws version 3 of the engine's board, and the engine answers version 4: nothing is drawn until they match.",
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
    const resumed = await mounted($, clock, BAND_MOUNT, 'resumed')
    expect(boards.map(({ id }) => id)).toEqual(['s0', 's1'])
    expect(await bannerOf(resumed), 'the same board in another conversation, drawn').toBe(
      '◐ Token-aware diff sizing · feature · build · 1 building · 1 in review · ⚑ 3 waiting on you',
    )
  })

  test('a read that answers what is drawn already redraws nothing', async ($, on) => {
    const { clock, counts } = world(on)

    await mounted($, clock)
    counts.invalidations = 0
    await engineCall($, clock)

    expect(counts.invalidations).toBe(0)
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

  test('a session that did not announce draws no pane, one still up from before a reload among it, and reads nothing for it', async ($, on) => {
    const { clock, boards } = world(on, { env: {}, open: ['board'] })

    expect(await drawnOf(await mounted($, clock, PANE_MOUNT))).toEqual(NO_PANE)
    expect(boards).toEqual([])
  })

  test('with another screen attached beside the terminal, Remote Control\'s, neither the banner nor the pane draws', async ($, on) => {
    const { clock } = world(on, { surfaces: ['terminal', 'mobile'], open: ['board'] })

    expect(await drawnOf(await mounted($, clock))).toEqual(BENEATH)
    expect(await drawnOf(await mounted($, clock, PANE_MOUNT))).toEqual(NO_PANE)
  })
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
    const { clock, boards, counts } = world(on, { replies: () => boardReply(UNDRAWN) })
    const band = await mounted($, clock)

    await band.press({ key: 'board:toggle' })
    await mounted($, clock, PANE_MOUNT)
    counts.invalidations = 0
    await clock.advance(5000)

    expect([counts.invalidations, boards.length]).toEqual([0, 1])
  })
})

describe('the conversation, whether the board is up or hidden', () => {
  test('gets each engine call\'s result as Claude Code answered it, and moving about the board sends nothing to it or the prompt box', async ($, on) => {
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


/** Where the mod keeps the discussion: in the conversation's folder. */
const DISCUSSING = `${DEFAULT_CONFIG}/conversations/s0/discussing.json`

/** The discussion as the mod kept it, null where it kept none. */
const keptIn = (files: ReadonlyMap<string, string>): unknown => {
  const text = files.get(DISCUSSING)

  return text === undefined ? null : JSON.parse(text)
}

/** A drawn element's key. */
const keyOf = (child: unknown) => String((child as { props: { key?: string } }).props.key)

/** The banner's buttons by their keys, the board's own last. */
async function bannerButtons(ui: Mounted): Promise<string[]> {
  return ((await ui.find({ key: 'banner' }))?.children ?? []).filter(child => (child as RenderElement).type === 'Button').map(keyOf)
}

/** The keys of what the drawing's element `key` holds, in order. */
async function keysIn(ui: Mounted, key: string): Promise<string[]> {
  return ((await ui.find({ key }))?.children ?? []).map(keyOf)
}

/** The build's board with only these questions waiting, oldest first, its view undrawn. */
const waitingOnly = (...numbers: string[]): Board => ({
  ...UNDRAWN,
  questions: UNDRAWN.questions.filter(({ question }) => numbers.includes(question)),
})

/** A command recording what became of a question, as Claude runs it. */
const raising = (verb: string) => ({ tool: 'Bash' as const, command: `node .claude/skills/leeway-engine/scripts/engine.cjs raise ${verb}` })

/** What the engine answers each Bash call: one recording a question its receipt, `line`. */
const receipt = (line: string) => (command: string) => (command.includes(' raise ') ? `${JSON.stringify({ ok: true, receipt: line })}\n` : ENGINE_SAID)

/** The pane docked with `rows` rows to its body, or seated inline. */
const paneAt = (placement: 'dock' | 'inline', rows: number) => ({
  ...PANE_MOUNT,
  props: { ...PANE_MOUNT.props, placement, scroll: { offset: 0, bodyRows: rows } },
})

/** The person's wheel over the pane, `by` rows. */
const wheel = (by: number, rows: number) => ({
  component: 'Pane' as const,
  requestId: 'board',
  offset: 0,
  by,
  bodyRows: rows,
  contentRows: rows,
  origin: { kind: 'person' as const },
})

/** The banner in the build: its first facts, then `facts`. */
const building = (facts: string) => `◐ Token-aware diff sizing · feature · build · ${facts}`

/** Q2 under discussion, as the banner names it. */
const DISCUSSING_Q2 = building('⚑ Discussing Q2 · task 6.8 "A failed re-merge aborts with every chunk\'s notes saved"')

const Q2_SENT = 'submit Ready to discuss Q2: When a re-merge fails at the review gate, should the notes the operator already saw stay on offer to accept, or should the run abort with the chunk notes saved?'

/** READY TO DISCUSS's lines, as the pane draws them, their rules squeezed. */
async function boxIn(pane: Mounted): Promise<string[]> {
  return (await pane.findAll({ type: 'Box' }))
    .filter(found => String(found.props.key ?? '').startsWith('ready'))
    .map(found => found.text.replace(/─+/g, '─').replace(/\s+/g, ' ').trim())
}

describe('ready to discuss', () => {
  test('20.S3: "▸ discuss" queues its question in READY TO DISCUSS on every tab, and nothing reaches the conversation or the prompt box', async ($, on) => {
    const { clock, sent, files } = world(on, { replies: args => boardReply({ ...waitingOnly('Q2'), tab: args.includes('--tab') ? args[1] : 'this' }) })
    const pane = await mounted($, clock, PANE_MOUNT)
    const band = await mounted($, clock)
    const box = ['READY TO DISCUSS ─ 1', "└ Q2 A failed re-merge aborts with every chunk's notes sav… ✕", '▸ send to Claude ▸ cancel all']

    await band.press({ key: 'discuss:Q2' })

    for (const tab of ['tab:this', 'tab:unit', 'tab:all']) {
      await pane.press({ key: tab })
      expect(await boxIn(pane), tab).toEqual(box)
    }

    expect(sent).toEqual([])
    expect(keptIn(files)).toBe(null)
  })

  test('12.S32: a question pressed reaches nothing; "▸ discuss all" queues every one waiting, oldest first; sent, one message names those queued in their order; no button answers a question', async ($, on) => {
    const { clock, sent, answers } = world(on, { replies: () => boardReply(waitingOnly('Q3')) })
    const pane = await mounted($, clock, PANE_MOUNT)
    const band = await mounted($, clock)
    const labels = new Set<string>()
    const opens = (found: { props: { key?: unknown } }) => String(found.props.key).startsWith('page:') || String(found.props.key).startsWith('fold:')
    const seen = async () => {
      for (const found of [...(await pane.findAll({ type: 'Button' })), ...(await band.findAll({ type: 'Button' }))]) {
        if (!opens(found)) labels.add(found.text)
      }
    }

    await seen()
    await band.press({ key: 'discuss:Q3' })
    answers(() => boardReply(BUILD_BOARD))
    await engineCall($, clock)
    await seen()
    await band.press({ key: 'ready:cancel' })
    await seen()
    await band.press({ key: 'discuss:all' })
    await seen()
    expect(sent).toEqual([])
    expect((await boxIn(pane)).filter(line => line.startsWith('└'))).toEqual([
      '└ Q1 Every abort at the review gate unwinds ✕',
      '└ Q2 A failed re-merge aborts with every chunk\'s notes sav… ✕',
      '└ Q3 An `r` that becomes a chunked run narrates its parts ✕',
    ])

    await pane.press({ key: 'drop:Q1' })
    await band.press({ key: 'ready:send' })
    await seen()

    expect(sent).toEqual(['submit Ready to discuss 2 waiting questions, in this order: Q2, Q3.'])
    expect([...labels].sort()).toEqual(
      ['▸ cancel all', '▸ discuss', '▸ discuss all', '▸ send to Claude', 'hide board', '▸ skip', '▸ unqueue', '✕', '⌂ This session', '≡ All work', '≡ Token-aware diff sizing'].sort(),
    )
  })

  test('20.S4: "▸ send to Claude" sends the queue as one message in the order queued, keeps the discussion where the engine reads it, and the banner says what is discussed', async ($, on) => {
    const { clock, sent, files, atSend } = world(on)
    const pane = await mounted($, clock, PANE_MOUNT)
    const band = await mounted($, clock)

    await band.press({ key: 'discuss:all' })
    await pane.press({ key: 'drop:Q3' })
    expect(await bannerOf(band)).toBe(building('⚑ 2 queued to discuss'))
    expect(await bannerButtons(band)).toEqual(['ready:send', 'ready:cancel', 'board:toggle'])

    await pane.press({ key: 'ready:send' })

    expect(sent).toEqual(['submit Ready to discuss 2 waiting questions, in this order: Q1, Q2.'])
    expect(keptIn(files)).toEqual({ discussing: 'Q1', queue: ['Q2'] })
    expect(atSend, 'kept before the line is sent, for the engine to read as Claude answers it').toEqual([JSON.stringify({ discussing: 'Q1', queue: ['Q2'] })])
    expect(await bannerOf(band)).toBe(building('⚑ Discussing Q1 · task 6.7 "Every abort at the review gate unwinds" · 1 more to discuss'))
    expect(await bannerButtons(band)).toEqual(['discussion:skip', 'discussion:cancel', 'board:toggle'])
    expect(await boxIn(pane), 'the box sent empties').toEqual([])
  })

  test('20.2.4: one question waiting puts "▸ discuss" on the banner, which queues it; sent alone, it goes with its wording', async ($, on) => {
    const { clock, sent } = world(on, { replies: () => boardReply(waitingOnly('Q2')) })
    const band = await mounted($, clock)

    expect(await bannerButtons(band)).toEqual(['discuss:Q2', 'board:toggle'])
    expect((await band.find({ key: 'discuss:Q2' }))?.text).toBe('▸ discuss')

    await band.press({ key: 'discuss:Q2' })
    await band.press({ key: 'ready:send' })

    expect(sent).toEqual([Q2_SENT])
  })

  test('20.S5, 12.S36: "▸ skip" puts exactly one line in the conversation, the question waiting again and the next under discussion; with none after it, "▸ cancel" in its place', async ($, on) => {
    const { clock, sent, files } = world(on)
    const band = await mounted($, clock)

    await band.press({ key: 'discuss:all' })
    await band.press({ key: 'ready:send' })
    sent.length = 0

    await band.press({ key: 'discussion:skip' })
    expect(sent).toEqual(['submit Skip Q1 for now; it stays waiting. Next: Q2.'])
    expect(keptIn(files)).toEqual({ discussing: 'Q2', queue: ['Q3'] })

    await band.press({ key: 'discussion:skip' })
    expect(sent.slice(1)).toEqual(['submit Skip Q2 for now; it stays waiting. Next: Q3.'])
    expect(keptIn(files)).toEqual({ discussing: 'Q3', queue: [] })
    expect(await bannerButtons(band)).toEqual(['discussion:cancel', 'board:toggle'])
    expect((await band.find({ key: 'discussion:cancel' }))?.text).toBe('▸ cancel')
  })

  test('12.S36: "▸ cancel all" sets the question discussed and every one after it back to waiting in one line, and "▸ cancel" the last alone', async ($, on) => {
    const { clock, sent, files } = world(on)
    const band = await mounted($, clock)

    await band.press({ key: 'discuss:all' })
    await band.press({ key: 'ready:send' })
    sent.length = 0

    expect((await band.find({ key: 'discussion:cancel' }))?.text).toBe('▸ cancel all')
    await band.press({ key: 'discussion:cancel' })
    expect(sent).toEqual(['submit Set Q1, Q2, Q3 aside; they stay waiting.'])
    expect(keptIn(files)).toEqual({ discussing: null, queue: [] })
    expect(await bannerOf(band)).toBe(building('1 building · 1 in review · ⚑ 3 waiting on you'))

    await band.press({ key: 'discuss:all' })
    await band.press({ key: 'ready:send' })
    await band.press({ key: 'discussion:skip' })
    await band.press({ key: 'discussion:skip' })
    await band.press({ key: 'discussion:cancel' })
    expect(sent.slice(-1)).toEqual(['submit Set Q3 aside; it stays waiting.'])
  })

  test('20.6.4: a row\'s ✕ and the box\'s "▸ cancel all" take questions back out, saying nothing to Claude and keeping nothing', async ($, on) => {
    const { clock, sent, files } = world(on)
    const pane = await mounted($, clock, PANE_MOUNT)
    const band = await mounted($, clock)

    await band.press({ key: 'discuss:all' })
    await pane.press({ key: 'drop:Q1' })
    await pane.press({ key: 'drop:Q3' })
    expect((await boxIn(pane)).filter(line => line.startsWith('└'))).toEqual(["└ Q2 A failed re-merge aborts with every chunk's notes sav… ✕"])

    await pane.press({ key: 'ready:cancel' })
    expect(await boxIn(pane)).toEqual([])
    expect(sent).toEqual([])
    expect(keptIn(files)).toBe(null)
  })

  test('20.S6: Q1 answered, its receipt takes it out of the discussion, the next under discussion, and the board no longer lists it', async ($, on) => {
    const { clock, files, answers, answersCalls } = world(on)
    const band = await mounted($, clock)

    await band.press({ key: 'discuss:all' })
    await band.press({ key: 'ready:send' })

    answers(() => boardReply(waitingOnly('Q2', 'Q3')))
    answersCalls(receipt('Q1 answered · task 6.7 builds again · 2 waiting on you · next: Q2'))
    await engineCall($, clock, raising('answer 3f9a --pick 1'))

    expect(keptIn(files)).toEqual({ discussing: 'Q2', queue: ['Q3'] })
    expect(await bannerOf(band)).toBe(`${DISCUSSING_Q2} · 1 more to discuss`)
  })

  test('12.13.17: questions recorded set aside leave the discussion and wait on; "I don\'t follow", a draw and a subagent\'s call leave it as it stands', async ($, on) => {
    const { clock, files, answersCalls } = world(on)
    const band = await mounted($, clock)

    await band.press({ key: 'discuss:all' })
    await band.press({ key: 'ready:send' })

    answersCalls(receipt('Q1 still open, explained again · still waiting · 3 waiting on you'))
    await engineCall($, clock, raising('answer 3f9a --didnt-follow'))
    answersCalls(receipt('Q1, Q2 set aside · still waiting · 3 waiting on you · next: Q3'))
    await engineCall($, clock, raising('draw token-aware-diff-sizing Q1'))
    await engineCall($, clock, { ...raising('aside token-aware-diff-sizing Q1 Q2'), agentId: 'a1' })
    expect(keptIn(files)).toEqual({ discussing: 'Q1', queue: ['Q2', 'Q3'] })

    await engineCall($, clock, raising('aside token-aware-diff-sizing Q1 Q2'))
    expect(keptIn(files)).toEqual({ discussing: 'Q3', queue: [] })
    expect(await bannerOf(band)).toBe(building('⚑ Discussing Q3 · task 6.5 "An `r` that becomes a chunked run narrates its parts"'))
  })

  test('12.S37: a question raised and left half-answered stays under discussion as the conversation moves on, and waiting on the board', async ($, on) => {
    const { clock, files } = world(on, { replies: () => boardReply(waitingOnly('Q1')) })
    const band = await mounted($, clock)

    await band.press({ key: 'discuss:Q1' })
    await band.press({ key: 'ready:send' })
    await engineCall($, clock, raising('draw token-aware-diff-sizing Q1'))
    await engineCall($, clock)

    expect(keptIn(files)).toEqual({ discussing: 'Q1', queue: [] })
    expect(await bannerOf(band)).toBe(building('⚑ Discussing Q1 · task 6.7 "Every abort at the review gate unwinds"'))
  })

  test('a send Claude Code drops leaves the queue in the box and the discussion as it was', async ($, on) => {
    const { clock, sent, files, dropping } = world(on)
    const band = await mounted($, clock)

    await band.press({ key: 'discuss:all' })
    dropping('a hook dropped it')
    await band.press({ key: 'ready:send' })

    expect(sent).toEqual([])
    expect(keptIn(files)).toEqual({ discussing: null, queue: [] })
    expect(await bannerOf(band)).toBe(building('⚑ 3 queued to discuss'))
  })

  test('a conversation picked up again finds its discussion as its folder keeps it', async ($, on) => {
    const { clock } = world(on, { kept: { [DISCUSSING]: JSON.stringify({ discussing: 'Q2', queue: ['Q3'] }) } })

    expect(await bannerOf(await mounted($, clock))).toBe(`${DISCUSSING_Q2} · 1 more to discuss`)
  })

  test('a press while a line is being sent sends nothing more', async ($, on) => {
    const { clock, sent, files, holding } = world(on)
    const band = await mounted($, clock)

    await band.press({ key: 'discuss:all' })

    const release = holding()
    const sending = band.press({ key: 'ready:send' })

    await clock.settle()
    await band.press({ key: 'discussion:cancel' })
    release()
    await sending

    expect(sent).toEqual(['submit Ready to discuss all 3 waiting questions, in this order: Q1, Q2, Q3.'])
    expect(keptIn(files)).toEqual({ discussing: 'Q1', queue: ['Q2', 'Q3'] })
  })

  test('a send that fails leaves the queue in the box and the discussion as it was', async ($, on) => {
    const { clock, sent, files, failing } = world(on)
    const band = await mounted($, clock)

    await band.press({ key: 'discuss:all' })
    failing()
    await band.press({ key: 'ready:send' })

    expect(sent).toEqual([])
    expect(keptIn(files)).toEqual({ discussing: null, queue: [] })
    expect(await bannerOf(band)).toBe(building('⚑ 3 queued to discuss'))
  })

  test('a /clear\'s conversation starts with no discussion, reading its own folder, and keeps its own there, the earlier one\'s left as it was', async ($, on) => {
    const earlier = JSON.stringify({ discussing: 'Q2', queue: ['Q3'] })
    const { clock, files, becomes } = world(on, { kept: { [DISCUSSING]: earlier } })

    expect(await bannerOf(await mounted($, clock))).toBe(`${DISCUSSING_Q2} · 1 more to discuss`)

    becomes('s1')

    const cleared = await mounted($, clock, BAND_MOUNT, 'cleared')

    expect(await bannerOf(cleared)).toBe(building('1 building · 1 in review · ⚑ 3 waiting on you'))

    await cleared.press({ key: 'discuss:all' })
    await cleared.press({ key: 'ready:send' })

    expect(JSON.parse(files.get(`${DEFAULT_CONFIG}/conversations/s1/discussing.json`) ?? 'null')).toEqual({ discussing: 'Q1', queue: ['Q2', 'Q3'] })
    expect(files.get(DISCUSSING)).toBe(earlier)
  })

  test('a question the board no longer lists is neither drawn, pressed nor kept', async ($, on) => {
    const { clock, sent, files, answers } = world(on)
    const pane = await mounted($, clock, PANE_MOUNT)
    const band = await mounted($, clock)

    await band.press({ key: 'discuss:all' })
    answers(() => boardReply(waitingOnly('Q1', 'Q3')))
    await engineCall($, clock)
    expect(await bannerOf(band)).toBe(building('⚑ 2 queued to discuss'))

    await pane.press({ key: 'drop:Q1' })
    await band.press({ key: 'ready:send' })

    expect(sent).toEqual(['submit Ready to discuss Q3: While a regeneration runs as chunks, should plain mode (CI and agents) print a line as each part finishes, or one line when the whole wave is done?'])
    expect(keptIn(files)).toEqual({ discussing: 'Q3', queue: [] })
  })

  test('20.S14: docked, a pane grown past how far it was scrolled draws from the top again', async ($, on) => {
    const { clock } = world(on, { replies: () => boardReply(UNDRAWN) })
    const pane = await mounted($, clock, paneAt('dock', 6))
    const band = await mounted($, clock)

    await band.press({ key: 'discuss:all' })
    await pane.press({ key: 'drop:Q2' })
    await pane.press({ key: 'drop:Q3' })
    await $.ui.scroll(wheel(3, 6))
    expect(await keysIn(pane, 'scrolled')).toEqual(['tabs:rule', 'blank:tabs'])

    await pane.redraw(paneAt('dock', 12).props)

    expect(await keysIn(pane, 'scrolled')).toEqual(['tabs', 'tabs:rule', 'blank:tabs'])
  })

  test('20.S14: docked, READY TO DISCUSS stays at the pane\'s foot while the person scrolls what is above it, no further than its last line', async ($, on) => {
    const { clock, scrolled } = world(on, { replies: () => boardReply(UNDRAWN) })
    const pane = await mounted($, clock, paneAt('dock', 6))
    const band = await mounted($, clock)
    const box = ['blank:foot', 'ready', 'ready:Q1', 'ready:actions']
    const above = ['tabs', 'tabs:rule', 'blank:tabs']

    expect((await pane.drawn()).props, 'nothing queued, Claude Code scrolls the board').not.toHaveProperty('height')

    await band.press({ key: 'discuss:all' })
    await pane.press({ key: 'drop:Q2' })
    await pane.press({ key: 'drop:Q3' })
    expect((await pane.drawn()).props).toMatchObject({ height: 6 })
    expect(await keysIn(pane, 'scrolled')).toEqual(above)
    expect(await keysIn(pane, 'foot')).toEqual(box)

    await $.ui.scroll(wheel(3, 6))
    expect(await keysIn(pane, 'scrolled')).toEqual(above.slice(1))
    expect(await keysIn(pane, 'foot')).toEqual(box)

    await $.ui.scroll(wheel(-3, 6))
    expect(await keysIn(pane, 'scrolled')).toEqual(above)
    expect(scrolled, 'the pane scrolled it itself').toEqual([])
  })

  test('20.S25: inline, READY TO DISCUSS comes after the list and the board scrolls as one, Claude Code\'s', async ($, on) => {
    const { clock, scrolled } = world(on, { replies: () => boardReply(UNDRAWN) })
    const pane = await mounted($, clock, paneAt('inline', 6))
    const band = await mounted($, clock)

    await band.press({ key: 'discuss:all' })
    await pane.press({ key: 'drop:Q2' })
    await pane.press({ key: 'drop:Q3' })
    await $.ui.scroll(wheel(3, 6))

    const drawn = await pane.drawn()

    expect(drawn.props).not.toHaveProperty('height')
    expect((drawn.children as unknown[]).map(keyOf)).toEqual(['tabs', 'tabs:rule', 'blank:tabs', 'blank:foot', 'ready', 'ready:Q1', 'ready:actions'])
    expect(scrolled).toEqual([3])
  })
})

describe('the build and the review on the pane', () => {
  test('20.5.3: WAITING ON YOU stands in the build\'s This session, and a press on a row\'s "▸ discuss" there queues its question, saying nothing to Claude', async ($, on) => {
    const { clock, sent } = world(on, { replies: () => boardReply(BUILD_BOARD) })
    const pane = await mounted($, clock, PANE_MOUNT)

    expect((await paneLines(pane)).filter(line => line.endsWith('▸ discuss'))).toHaveLength(3)

    await pane.press({ key: 'discuss:Q2' })

    const shown = await paneLines(pane)
    const at = shown.findIndex(line => line.startsWith('parks 6.8'))

    expect([await boxIn(pane), shown.slice(at, at + 2)]).toEqual([
      ['READY TO DISCUSS ─ 1', "└ Q2 A failed re-merge aborts with every chunk's notes sav… ✕", '▸ send to Claude ▸ cancel all'],
      ['parks 6.8, and 2 after it · waiting under a minute', 'queued ▸ unqueue'],
    ])
    expect(sent).toEqual([])
  })

  test('20.S8: a task\'s page stays while the session moves from the build into the review phase, and back names the review and shows it', async ($, on) => {
    let phase = 'build'
    const { clock, answers } = world(on)

    answers(args => {
      const board = phase === 'build' ? BUILD_BOARD : REVIEW_BOARD

      return boardReply(args.includes('--page') ? taskOver(board) : board)
    })

    const pane = await mounted($, clock, PANE_MOUNT)

    await pane.press({ key: 'fold:phase:1' })
    await pane.press({ key: 'page:task:1.4' })
    expect((await underTabs(pane))[0]).toBe('← back to the build')

    phase = 'review'
    await engineCall($, clock)
    expect((await underTabs(pane)).slice(0, 2)).toEqual(['← back to the review', '1.4 180-second shipped release timeout'])

    await pane.press({ key: 'back' })
    expect((await underTabs(pane))[0]).toBe('Token-aware diff sizing · review')
  })

  test('2.S8, 12.S40: a done task\'s page shows its account as written on the pane, and opening it reaches neither the conversation nor the prompt box; a call\'s ▸ read opens its entry\'s page', async ($, on) => {
    const { clock, sent, boards } = world(on, { replies: args => boardReply(args.includes('--page') ? taskOver(BUILD_BOARD) : BUILD_BOARD) })
    const pane = await mounted($, clock, PANE_MOUNT)

    await pane.press({ key: 'fold:phase:1' })
    await pane.press({ key: 'page:task:1.4' })

    const shown = await paneLines(pane)

    expect(shown.filter(line => /^(WHAT WAS DONE|DIFFERS FROM THE TASK|REVIEWS|CALLS MADE) /.test(line))).toHaveLength(4)
    expect(shown.join(' ')).toContain('With no timeout set at any level, a release-notes call now gets 180 seconds per attempt')
    expect(sent).toEqual([])

    expect((await pane.find({ key: 'page:entry:e3a1' }))?.text).toBe('▸ read')
    await pane.press({ key: 'page:entry:e3a1' })
    expect(boards.at(-1)?.args).toEqual(['--page', 'entry:e3a1', '--page-unit', 'token-aware-diff-sizing'])
  })
})
