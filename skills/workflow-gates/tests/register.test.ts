import type {
  On,
  PromptOrigin,
  RenderElement,
  RenderInput,
  RenderSurface,
} from 'claude-code'
import {
  describe,
  expect,
  mock,
  test,
  tier,
  type Engine,
  type MockClock,
  type Mounted,
} from 'claude-code/testing'

tier('user')

const SESSION = {
  cwd: '/work',
  surface: 'terminal' as RenderSurface,
  isInteractive: true,
}

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 12,
  bodyColumns: 72,
  scroll: { offset: 0, bodyRows: 12 },
  view: {},
}

const DRAWING: RenderInput<'AbovePrompt', 'terminal'> = {
  surface: 'terminal',
  component: 'AbovePrompt',
  requestId: 'band',
  viewport: { columns: 72, rows: 24 },
  props: BAND,
}

/** What the engine draws in the band beneath the mod. */
const BENEATH: RenderElement = { type: 'Text', children: ['? for shortcuts'] }

const GATE_LINE = '=== GATE (json for a gate surface — never display) ==='

/** Where a send leaves what it answered, under the session's working directory. */
const SENT = '/.workflows/.cache/.gates/sent.json'

const COMMIT = 'Commit and continue to next task'
const AUTH = 'Continue "Auth"'

const OPTIONS = [
  {
    key: 'y',
    word: 'yes',
    head: COMMIT,
    tail: null,
    detail: null,
    struck: false,
    recommended: true,
  },
  {
    key: '2',
    word: null,
    head: AUTH,
    tail: 'discussion',
    detail: null,
    struck: true,
    recommended: false,
  },
]

/** An epic menu: a topic another session holds above the one recommended. */
const HELD_FIRST = [
  {
    key: '1',
    word: null,
    head: AUTH,
    tail: 'discussion',
    detail: null,
    struck: true,
    recommended: false,
  },
  {
    key: '2',
    word: null,
    head: 'Start "Billing"',
    tail: 'research',
    detail: null,
    struck: false,
    recommended: false,
  },
  {
    key: '3',
    word: null,
    head: 'Continue "Search"',
    tail: 'specification',
    detail: null,
    struck: false,
    recommended: true,
  },
]

const ANALYZE_DETAIL = 'All discussions are analyzed for natural groupings.'

/** A specification menu: a row with its detail over a back row. */
const DETAILED = [
  {
    key: '1',
    word: null,
    head: 'Analyze for groupings',
    tail: null,
    detail: ANALYZE_DETAIL,
    struck: false,
    recommended: true,
  },
  {
    key: 'b',
    word: 'back',
    head: 'Return to the previous menu',
    tail: null,
    detail: null,
    struck: false,
    recommended: false,
  },
]

const COMMENT = {
  label: 'Comment',
  description: 'Request changes (triggers a fix round)',
  detail: null,
}

const RANGE = {
  label: '1–2',
  description: 'Select item(s) to work on',
  detail: null,
}

const RESULT_SECTION = [
  '=== DISPLAY: task result (emit verbatim as a code block) ===',
  'Task 1.1 — the login form validates',
]

const MENU_SECTION = [
  "=== MENU: task gate (emit verbatim as markdown, then STOP for the user's response) ===",
  '· · · · · · · · · · · ·',
  '**`◆ Approve this task?`**',
  '',
  '**`y/yes`** → Commit and continue to next task',
  '',
]

const DRAWN_MENU = [
  '=== MENU: task gate (drawn above the prompt — do NOT emit it; stop and wait) ===',
  "The options are on screen. The user's choice, or anything they type, arrives as their next message.",
  '',
]

const IDLE_FOOTER =
  'Click a row to choose · click it again to send · or just type'

type Stated = {
  options?: readonly unknown[]
  typed?: readonly unknown[]
  question?: string
  statement?: string
}

/** An engine response stating a gate, as the surface announces it. */
function announced(stated: Stated = {}, after: readonly string[] = []): string {
  const {
    options = OPTIONS,
    typed = [COMMENT],
    question = 'Approve this task?',
    statement = '',
  } = stated

  return [
    ...RESULT_SECTION,
    GATE_LINE,
    JSON.stringify({ gate: 'task gate', question, statement, options, typed }),
    ...MENU_SECTION,
    ...after,
  ].join('\n')
}

/** The call the workflows make at a gate; the mod never reads the command. */
const ENGINE_CALL = {
  tool: 'Bash' as const,
  command:
    'node .claude/skills/workflow-engine/scripts/engine.cjs render task-gate auth.implementation.auth-flow',
}

/** The same call made inside a subagent's loop. */
const SUBAGENT_CALL = { ...ENGINE_CALL, agentId: 'a1' }

/** The main conversation's turn ending with its answer given. */
const TURN_END = {
  answer: 'The gate is on screen.',
  durationMs: 1200,
  isAborted: false,
  turnId: 't0',
  reason: 'answer' as const,
}

/** The main conversation's turn ended by the person's Esc. */
const INTERRUPTED = { ...TURN_END, isAborted: true, reason: 'aborted' as const }

/** The band above the prompt, and the `Client` in it, as the surface mounts them. */
const MOUNT = {
  plugin: 'workflow-gates',
  surface: 'terminal' as const,
  component: 'AbovePrompt' as const,
  requestId: 'band',
  viewport: { columns: 72, rows: 24 },
  props: BAND,
}

/**
 * The world beneath the mod: the session it starts in, the surfaces attached,
 * what a Bash call answers, the prompt box, the files it writes, and the
 * prompts it submits.
 *
 * `calls` is what the mod asked of it, in order; `fills: false` is a box that
 * refuses the text; `submits: false` takes the submission but never lands it,
 * which is the submit that fails; `disk` holds each write a second on its
 * clock. A submission made while idle resolves once the turn it opens has
 * started, as core's does; `engineWrites` changes what the next Bash call
 * answers.
 *
 * @param engine the test's `$`, which opens the turns
 * @param on the test's `on`
 * @param stdout what the engine wrote
 * @param options the surfaces attached, whether the box and a submission
 *   take, and the clock a slow disk writes on
 */
function world(
  engine: Engine,
  on: On,
  stdout = '',
  options: {
    surfaces?: readonly RenderSurface[]
    fills?: boolean
    submits?: boolean
    disk?: MockClock
  } = {},
) {
  const { surfaces = ['terminal'], fills = true, submits = true, disk } = options

  const calls: string[] = []
  const filled: string[] = []
  const submitted: string[] = []
  const written: { name: string; value?: string }[] = []
  const files = new Map<string, string>()

  let output = stdout
  let turns = 0

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: surfaces }))
  on('ui.render', () => BENEATH)
  on('ui.message', () => ({}))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  on('ui.invalidate', ($, e, next) => {
    calls.push('invalidate')

    return next(e)
  })

  on('env.set', ($, e) => {
    written.push({ name: e.name, value: e.value })

    return { value: undefined }
  })

  on('prompt.fill', ($, e) => {
    calls.push(`fill ${e.text}`)
    filled.push(e.text)

    return { isFilled: fills }
  })

  on('fs.write', async ($, e) => {
    calls.push('write')
    files.set(e.path, e.text)

    await disk?.sleep(1000)

    return { value: undefined }
  })

  on('prompt.submit', async ($, e) => {
    calls.push(`submit ${e.text}`)
    submitted.push(e.text)

    if (!submits) {
      throw new Error('the prompt could not be sent')
    }

    if (e.turnId === undefined) {
      turns += 1
      await engine.turn.start({ text: e.text, turnId: `t${turns}` })
    }

    return { text: e.text, origin: e.origin }
  })

  on('tool.call', { tool: 'Bash' }, () => ({
    result: { stdout: output, stderr: '', interrupted: false },
  }))

  const engineWrites = (next: string) => {
    output = next
  }

  return { calls, filled, submitted, written, files, engineWrites }
}

/** A gate rendered in a main-conversation turn that has since ended. */
async function presented($: Engine) {
  await $.session.start(SESSION)
  await $.tool.call(ENGINE_CALL)
  await $.turn.complete(TURN_END)
}

/** A submission made while idle from somewhere other than this mod's band. */
const submitFrom = ($: Engine, origin: PromptOrigin, text = 'ping') =>
  $.prompt.submit({ text, wait: false, origin })

/** What the last send recorded, read back as the mod wrote it. */
function sentIn(files: Map<string, string>): unknown {
  const [path, text] = [...files].at(-1) ?? ['', 'null']

  expect(path.endsWith(SENT), `${path} is the send record`).toBe(true)

  return JSON.parse(text)
}

/** The Bash result's own record, which is what the mod answers with. */
function stdoutOf(result: { result?: unknown }): string {
  return (result.result as { stdout: string }).stdout
}

/** Whether the band draws a gate over what the engine draws beneath. */
async function isDrawn($: Engine) {
  return JSON.stringify(await $.ui.render(DRAWING)) !== JSON.stringify(BENEATH)
}

type Band = Mounted<'terminal', 'AbovePrompt'>

/** What an element of a drawn tree shows, its children's text in order. */
const shownIn = (node: unknown): string =>
  typeof node === 'string'
    ? node
    : ((node as { children?: unknown[] }).children ?? []).map(shownIn).join('')

/** Every line the board drew in its region, top to bottom, as it reads. */
async function linesOf(ui: Band) {
  const board = (await ui.drawn({ in: 'gate' })) as { children: unknown[] }

  return board.children.map(shownIn)
}

/** The line of the region showing `text`: where the pointer lands on it. */
async function lineOf(ui: Band, text: string) {
  return (await linesOf(ui)).findIndex(line => line.includes(text))
}

/** A click on the line showing `text`. */
async function click(ui: Band, text: string) {
  const y = await lineOf(ui, text)

  expect(y, `a line shows ${text}`).toBeGreaterThanOrEqual(0)

  await ui.pointer({ type: 'down', x: 4, y, button: 'left', in: 'gate' })
}

/** The pointer resting on the line showing `text`. */
async function hover(ui: Band, text: string) {
  await ui.pointer({ type: 'move', x: 4, y: await lineOf(ui, text), in: 'gate' })
}

/** The innermost element the board drew showing `text`: a run, not its line. */
async function runOf(ui: Band, text: string | RegExp) {
  return (await ui.findAll({ type: 'Text', in: 'gate', text })).at(-1)
}

/** The background a row's head draws on. */
async function backgroundOf(ui: Band, head: string) {
  return (await runOf(ui, head))?.props.backgroundColor
}

/** What the footer says: the last lines the board drew with words, as one. */
async function footerOf(ui: Band) {
  const lines = (await linesOf(ui)).map(line => line.trim())
  const end = lines.findLastIndex(line => line !== '')
  const start = lines.slice(0, end).findLastIndex(line => line === '') + 1

  return lines.slice(start, end + 1).join(' ')
}

describe('register', () => {
  test('the session announces the gate surface to every child it starts', async ($, on) => {
    const { written } = world($, on)

    await $.session.start(SESSION)

    expect(written).toEqual([{ name: 'WORKFLOWS_GATE_SURFACE', value: '1' }])
  })

  test('a stated gate is cut out of what the model reads, the rest left alone', async ($, on) => {
    world($, on, announced())

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(ENGINE_CALL))).toBe(
      [...RESULT_SECTION, ...DRAWN_MENU].join('\n'),
    )
  })

  test('a section under the menu stands where the menu stood', async ($, on) => {
    const after = [
      '=== DISPLAY: what follows (emit verbatim) ===',
      'Still here.',
    ]
    world($, on, announced({}, after))

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(ENGINE_CALL))).toBe(
      [...RESULT_SECTION, ...DRAWN_MENU.slice(0, 2), ...after].join('\n'),
    )
  })

  test('output stating no gate is answered as it came', async ($, on) => {
    const plain = [...RESULT_SECTION, ...MENU_SECTION].join('\n')
    world($, on, plain)

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(ENGINE_CALL))).toBe(plain)
  })

  test('a menu with no pressable row stays text', async ($, on) => {
    world($, on, announced({ options: [] }))

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(ENGINE_CALL))).toBe(
      announced({ options: [] }),
    )
  })

  test('with no terminal attached the model prints the menu itself', async ($, on) => {
    world($, on, announced(), { surfaces: ['vscode'] })

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(ENGINE_CALL))).toBe(announced())

    await $.turn.complete(TURN_END)

    expect(await isDrawn($)).toBe(false)
  })

  test("a subagent's gate stays text, and nothing is armed", async ($, on) => {
    const { calls } = world($, on, announced())

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(SUBAGENT_CALL))).toBe(announced())

    await $.turn.complete(TURN_END)

    expect(calls).toEqual([])
    expect(await isDrawn($)).toBe(false)
  })

  test("a subagent's turn ending draws nothing; the conversation's does", async ($, on) => {
    const { calls } = world($, on, announced())

    await $.session.start(SESSION)
    await $.tool.call(ENGINE_CALL)
    await $.turn.complete({ ...TURN_END, turnId: 't1', agentId: 'a1' })

    expect(calls).toEqual([])
    expect(await isDrawn($)).toBe(false)

    await $.turn.complete(TURN_END)

    expect(await isDrawn($)).toBe(true)
  })

  test('the gate waits for the turn to end before it draws', async ($, on) => {
    const { calls } = world($, on, announced())

    await $.session.start(SESSION)

    const ui = await $.ui.mount(MOUNT)

    await $.tool.call(ENGINE_CALL)

    expect(calls, 'nothing redraws while the model is still writing').toEqual([])

    await ui.redraw()

    expect(await ui.find({ type: 'Client', key: 'gate' })).toBeUndefined()

    await $.turn.complete(TURN_END)

    expect(calls).toEqual(['invalidate'])

    await ui.redraw()

    expect(await ui.find({ type: 'Client', key: 'gate' })).toBeDefined()

    await ui.unmount()
  })

  test('an Esc on the turn that rendered a gate discards it, so nothing half-rendered draws', async ($, on) => {
    const { calls } = world($, on, announced())

    await $.session.start(SESSION)
    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(INTERRUPTED)

    expect(calls).toEqual([])
    expect(await isDrawn($)).toBe(false)

    await $.turn.complete(TURN_END)

    expect(await isDrawn($), 'the discarded gate is gone for good').toBe(false)
  })

  test('a drawn gate puts its rows in the band, over what was there', async ($, on) => {
    world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    expect(await ui.find({ type: 'Client', key: 'gate' })).toMatchObject({
      props: { module: 'hooks/board.ts', width: 72, height: 9 },
    })

    expect(await ui.find({ text: '? for shortcuts' })).toBeDefined()

    expect((await linesOf(ui)).map(line => line.trimEnd())).toEqual([
      '─'.repeat(72),
      '',
      '◆ Approve this task?',
      '',
      `▌ yes      ${COMMIT} (recommended)`,
      `  2        ${AUTH} — discussion`,
      `  Comment  ${COMMENT.description}`,
      '',
      `  ${IDLE_FOOTER}`,
    ])

    expect(await runOf(ui, COMMENT.description), 'a typed row draws dim').toMatchObject({
      props: { dimColor: true },
    })

    expect(await runOf(ui, AUTH), 'a held row is struck').toMatchObject({
      props: { strikethrough: true },
    })

    expect(await runOf(ui, IDLE_FOOTER), 'the footer is dim').toMatchObject({
      props: { dimColor: true },
    })

    expect(await ui.findAll({ type: 'Button', in: 'gate' })).toEqual([])

    await ui.unmount()
  })

  test('the statement draws above the question, level with its text', async ($, on) => {
    world($, on, announced({ statement: 'Found existing review for Auth.' }))

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    expect((await linesOf(ui)).slice(1, 6).map(line => line.trimEnd())).toEqual([
      '',
      '  Found existing review for Auth.',
      '',
      '◆ Approve this task?',
      '',
    ])

    expect(await runOf(ui, 'Found existing review for Auth.')).not.toMatchObject({
      props: { bold: true },
    })

    await ui.unmount()
  })

  test('a gate that asks nothing draws no question: the statement stands alone', async ($, on) => {
    world($, on, announced({ statement: 'Found existing plan for Auth.', question: '' }))

    await presented($)

    const ui = await $.ui.mount(MOUNT)
    const lines = await linesOf(ui)

    expect(lines.slice(1, 5).map(line => line.trimEnd())).toEqual([
      '',
      '  Found existing plan for Auth.',
      '',
      `▌ yes      ${COMMIT} (recommended)`,
    ])

    expect(lines.some(line => line.includes('◆'))).toBe(false)

    await ui.unmount()
  })

  test("a row's detail draws beneath it, dim, level with its label", async ($, on) => {
    world($, on, announced({ options: DETAILED }))

    await presented($)

    const ui = await $.ui.mount(MOUNT)
    const lines = await linesOf(ui)
    const row = await lineOf(ui, 'Analyze for groupings')

    expect(lines[row + 1]?.trimEnd(), 'the cursor bar runs down the whole row').toBe(
      `▌          ${ANALYZE_DETAIL}`,
    )
    expect(lines[row + 1]?.indexOf(ANALYZE_DETAIL)).toBe(
      lines[row]?.indexOf('Analyze for groupings'),
    )

    expect(await runOf(ui, ANALYZE_DETAIL)).toMatchObject({
      props: { dimColor: true },
    })

    await ui.unmount()
  })

  test('the shortcut letter is underlined in its word, and a bare number is not', async ($, on) => {
    world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    expect(await runOf(ui, /^y$/)).toMatchObject({
      props: { underline: true, color: 'permission' },
    })
    expect((await runOf(ui, /^es$/))?.props.underline).toBeUndefined()
    expect((await runOf(ui, /^2$/))?.props.underline).toBeUndefined()

    await ui.unmount()
  })

  test('the region is exactly as tall as the drawing, whatever the footer says', async ($, on) => {
    world(
      $,
      on,
      announced({
        options: DETAILED,
        typed: [RANGE],
        question: '',
        statement: 'Specification Overview\nTwo discussions are ready to be grouped.',
      }),
    )

    await presented($)

    const widths = [
      { columns: 72, row: 'Analyze for groupings', answer: '1' },
      { columns: 36, row: 'Return to the previous', answer: 'back' },
    ]

    for (const { columns, row, answer } of widths) {
      const ui = await $.ui.mount({
        ...MOUNT,
        props: { ...BAND, bodyColumns: columns },
      })
      const height = (await ui.find({ type: 'Client', key: 'gate' }))?.props.height
      const heights = [(await linesOf(ui)).length]

      await click(ui, row)
      heights.push((await linesOf(ui)).length)

      expect(await footerOf(ui), 'a pick is on the footer').toMatch(`${answer} is in your`)

      await click(ui, RANGE.description)
      heights.push((await linesOf(ui)).length)

      expect(await footerOf(ui), 'the typed hint is on the footer').toMatch(/prompt$/)
      expect(heights, `${columns} columns: idle, picked, hinted`).toEqual([
        height,
        height,
        height,
      ])

      await ui.unmount()
    }
  })

  test('the band yields to a survey', async ($, on) => {
    world($, on, announced())

    await presented($)

    const drawn = await $.ui.render({
      ...DRAWING,
      props: { ...BAND, hasSurvey: true },
    })

    expect(drawn).toEqual(BENEATH)
  })

  test('a click picks: the answer goes in the prompt box and its row is marked, nothing sent', async ($, on) => {
    const { calls, filled, submitted } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    calls.length = 0

    await click(ui, COMMIT)

    expect(filled).toEqual(['yes'])
    expect(submitted).toEqual([])
    expect(calls).toEqual(['fill yes', 'invalidate'])

    expect(await backgroundOf(ui, COMMIT)).toBe('diffAddedDimmed')
    expect(await footerOf(ui)).toBe(
      'yes is in your prompt · click it again or Enter to send',
    )
    expect(await runOf(ui, /^yes$/), 'the footer names the pick in bold').toMatchObject({
      props: { bold: true },
    })

    await ui.unmount()
  })

  test('picking another row replaces the box and moves the mark', async ($, on) => {
    const { filled, submitted } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await click(ui, COMMIT)
    await click(ui, AUTH)

    expect(filled).toEqual(['yes', '2'])
    expect(submitted).toEqual([])

    expect(await backgroundOf(ui, AUTH)).toBe('diffAddedDimmed')
    expect(await backgroundOf(ui, COMMIT)).toBeUndefined()
    expect(await footerOf(ui)).toMatch(/^2 is in your prompt/)

    await ui.unmount()
  })

  test('a second click on the picked row sends it: the box cleared, the send recorded, then submitted', async ($, on) => {
    const { calls, files, submitted } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await click(ui, COMMIT)

    calls.length = 0

    await click(ui, COMMIT)

    expect(submitted).toEqual(['yes'])

    expect(calls, 'the turn the answer opens takes the band down').toEqual([
      'fill ',
      'write',
      'submit yes',
      'invalidate',
    ])

    expect(sentIn(files)).toEqual({
      answer: 'yes',
      question: 'Approve this task?',
      label: COMMIT,
    })

    await ui.redraw()

    expect(await ui.find({ type: 'Client', key: 'gate' })).toBeUndefined()

    await ui.unmount()
  })

  test('a statement-only gate records an empty question', async ($, on) => {
    const { files } = world(
      $,
      on,
      announced({ options: DETAILED, statement: 'Overview.', question: '' }),
    )

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await click(ui, 'Return to the previous')
    await click(ui, 'Return to the previous')

    expect(sentIn(files)).toEqual({
      answer: 'back',
      question: '',
      label: 'Return to the previous menu',
    })

    await ui.unmount()
  })

  test('Enter picks the row the cursor is on, and sends it once picked', async ($, on) => {
    const { filled, submitted } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'return', in: 'gate' })

    expect(filled).toEqual(['yes'])
    expect(submitted).toEqual([])

    await ui.key({ key: 'return', in: 'gate' })

    expect(submitted).toEqual(['yes'])

    await ui.unmount()
  })

  test('a box that refuses the answer marks nothing, so the next press picks again', async ($, on) => {
    const { filled, submitted } = world($, on, announced(), { fills: false })

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'return', in: 'gate' })
    await ui.key({ key: 'return', in: 'gate' })

    expect(filled).toEqual(['yes', 'yes'])
    expect(submitted).toEqual([])
    expect(await backgroundOf(ui, COMMIT)).toBe('selectionBg')
    expect(await footerOf(ui)).toBe(IDLE_FOOTER)

    await ui.unmount()
  })

  test('a send that fails puts the answer back in the box, so the pick holds and a press retries', async ($, on) => {
    const { filled, submitted } = world($, on, announced(), { submits: false })

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'return', in: 'gate' })
    await ui.key({ key: 'return', in: 'gate' })

    expect(submitted).toEqual(['yes'])
    expect(filled, 'picked, cleared to send, put back').toEqual(['yes', '', 'yes'])
    expect(await ui.find({ type: 'Client', key: 'gate' })).toBeDefined()
    expect(await backgroundOf(ui, COMMIT)).toBe('diffAddedDimmed')
    expect(await footerOf(ui)).toBe(
      'yes is in your prompt · click it again or Enter to send',
    )

    await ui.key({ key: 'return', in: 'gate' })

    expect(submitted).toEqual(['yes', 'yes'])
    expect(filled.at(-1)).toBe('yes')

    await ui.unmount()
  })

  test('a press while a send is under way sends nothing more', async ($, on) => {
    const disk = mock.clock(on)
    const { submitted } = world($, on, announced(), { disk })

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.post({ answer: 'yes' }, { in: 'gate' })

    const sending = ui.post({ answer: 'yes' }, { in: 'gate' })

    await disk.settle()

    const again = ui.post({ answer: 'yes' }, { in: 'gate' })

    await disk.settle()
    await disk.advance(1000)
    await Promise.all([sending, again])

    expect(submitted).toEqual(['yes'])

    await ui.unmount()
  })

  test('the arrows move the cursor, and Enter picks the row it is on', async ($, on) => {
    const { filled } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'down', in: 'gate' })
    await ui.key({ key: 'return', in: 'gate' })

    expect(filled).toEqual(['2'])

    await ui.unmount()
  })

  test('Enter on arrival picks the recommended row, never a held one above it', async ($, on) => {
    const { filled } = world($, on, announced({ options: HELD_FIRST }))

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'return', in: 'gate' })

    expect(filled).toEqual(['3'])

    await ui.unmount()
  })

  test('a redraw of the same gate leaves the cursor where the person put it', async ($, on) => {
    const { filled } = world($, on, announced({ options: HELD_FIRST }))

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'up', in: 'gate' })
    await ui.redraw({ ...BAND, scroll: { offset: 4, bodyRows: 12 } })
    await ui.key({ key: 'return', in: 'gate' })

    expect(filled).toEqual(['2'])

    await ui.unmount()
  })

  test('another gate on the same board starts the cursor by its own rows', async ($, on) => {
    const { filled, engineWrites } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'down', in: 'gate' })

    engineWrites(announced({ options: HELD_FIRST }))

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(TURN_END)
    await ui.redraw()
    await ui.key({ key: 'return', in: 'gate' })

    expect(filled).toEqual(['3'])

    await ui.unmount()
  })

  test("a row's own key picks it and takes the cursor there, so Enter then sends it", async ($, on) => {
    const { filled, submitted } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: '2', in: 'gate' })

    expect(filled, 'one with no word answers as its key').toEqual(['2'])

    await ui.key({ key: 'return', in: 'gate' })

    expect(submitted).toEqual(['2'])

    await ui.unmount()
  })

  test('a click lands on the row under it: the second row sits on the sixth line', async ($, on) => {
    const { filled } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.pointer({ type: 'down', x: 4, y: 5, button: 'left', in: 'gate' })

    expect(filled).toEqual(['2'])

    await ui.unmount()
  })

  test("a click on a row's detail picks that row", async ($, on) => {
    const { filled } = world($, on, announced({ options: DETAILED }))

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await click(ui, ANALYZE_DETAIL)
    await click(ui, 'Return to the previous')

    expect(filled).toEqual(['1', 'back'])

    await ui.unmount()
  })

  test('the pointer moves the cursor, and the picked row keeps its colour under it', async ($, on) => {
    world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await hover(ui, AUTH)

    expect(await backgroundOf(ui, AUTH)).toBe('selectionBg')
    expect(await backgroundOf(ui, COMMIT)).toBeUndefined()

    await click(ui, AUTH)

    expect(await backgroundOf(ui, AUTH), 'picked, the cursor on it').toBe(
      'diffAddedDimmed',
    )

    await hover(ui, COMMIT)

    expect(await backgroundOf(ui, COMMIT)).toBe('selectionBg')
    expect(await backgroundOf(ui, AUTH)).toBe('diffAddedDimmed')
    expect(await lineOf(ui, '▌ yes'), 'the cursor mark follows').toBeGreaterThan(0)

    await ui.unmount()
  })

  test('a click on a typed row says how to type it, and changes nothing else', async ($, on) => {
    const { calls } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await click(ui, COMMIT)

    calls.length = 0

    await click(ui, COMMENT.description)

    expect(calls, 'the box and the pick are left alone').toEqual([])
    expect(await footerOf(ui)).toBe(
      'Comment — press Esc, then type in the prompt',
    )
    expect(await backgroundOf(ui, COMMIT)).toBe('diffAddedDimmed')

    await click(ui, AUTH)

    expect(await footerOf(ui), 'the footer follows the last click').toMatch(
      /^2 is in your prompt/,
    )

    await ui.unmount()
  })

  test('a click on a range row asks for the numbers', async ($, on) => {
    world($, on, announced({ typed: [RANGE] }))

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await click(ui, RANGE.description)

    expect(await footerOf(ui)).toBe(
      '1–2 — press Esc, then type the numbers in the prompt',
    )

    await ui.unmount()
  })

  test('a post naming no row of the gate on screen does nothing', async ($, on) => {
    const { filled, submitted } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.post({ answer: 'sudo rm -rf /' }, { in: 'gate' })
    await ui.post({ answer: 'sudo rm -rf /' }, { in: 'gate' })

    expect(filled).toEqual([])
    expect(submitted).toEqual([])

    await ui.unmount()
  })

  test('the turn that answers the gate takes it off the band', async ($, on) => {
    world($, on, announced())

    await presented($)
    await $.turn.start({ text: 'yes', turnId: 't1' })

    expect(await isDrawn($)).toBe(false)
  })

  test('a gate still armed when a turn begins never draws', async ($, on) => {
    world($, on, announced())

    await $.session.start(SESSION)
    await $.tool.call(ENGINE_CALL)
    await $.turn.start({ text: 'yes', turnId: 't1' })
    await $.turn.complete({ ...TURN_END, turnId: 't1' })

    expect(await isDrawn($)).toBe(false)
  })

  test('an Esc on the turn a press opened puts its gate back, unpicked', async ($, on) => {
    world($, on, announced())

    await presented($)

    let ui = await $.ui.mount(MOUNT)

    await click(ui, COMMIT)
    await click(ui, COMMIT)
    await ui.unmount()

    expect(await isDrawn($)).toBe(false)

    await $.turn.complete(INTERRUPTED)

    ui = await $.ui.mount(MOUNT)

    expect(await lineOf(ui, 'Approve this task?')).toBe(2)
    expect(await backgroundOf(ui, COMMIT)).toBe('selectionBg')
    expect(await footerOf(ui)).toBe(IDLE_FOOTER)

    await ui.unmount()
  })

  test('an Esc on a turn the person typed puts the gate back', async ($, on) => {
    world($, on, announced())

    await presented($)
    await submitFrom($, { kind: 'composer' }, 'hold on')
    await $.turn.complete(INTERRUPTED)

    expect(await isDrawn($)).toBe(true)
  })

  test('an Esc after the answer rendered the next gate drops it and puts the answered one back', async ($, on) => {
    const { engineWrites } = world($, on, announced())

    await presented($)
    await submitFrom($, { kind: 'composer' }, 'yes')

    engineWrites(announced({ options: HELD_FIRST }))

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(INTERRUPTED)

    const ui = await $.ui.mount(MOUNT)

    expect(await lineOf(ui, COMMIT), 'the gate the person answered').toBeGreaterThan(0)
    expect(await lineOf(ui, 'Start "Billing"'), 'not the one half-rendered').toBe(-1)

    await ui.unmount()
  })

  test('a turn the person did not start, ending with no gate, puts the gate back', async ($, on) => {
    const { engineWrites } = world($, on, announced())

    await presented($)

    engineWrites('')

    const others: PromptOrigin[] = [
      { kind: 'task-notification' },
      { kind: 'scheduled-trigger' },
      { kind: 'peer' },
      { kind: 'sdk' },
      { kind: 'auto-continuation' },
      { kind: 'plugin', name: 'another-plugin' },
    ]

    for (const origin of others) {
      await submitFrom($, origin)

      expect(await isDrawn($), `${origin.kind}: the turn takes it down`).toBe(false)

      await $.turn.complete(TURN_END)

      expect(await isDrawn($), `${origin.kind}: and puts it back`).toBe(true)
    }
  })

  test('a turn the person started, ending with no gate, puts nothing back', async ($, on) => {
    const { engineWrites } = world($, on, announced())

    const theirs: PromptOrigin[] = [
      { kind: 'composer' },
      { kind: 'bridge' },
      { kind: 'plugin', name: 'workflow-gates' },
    ]

    await $.session.start(SESSION)

    for (const origin of theirs) {
      await $.tool.call(ENGINE_CALL)
      await $.turn.complete(TURN_END)

      engineWrites('')

      await submitFrom($, origin, 'yes')
      await $.turn.complete(TURN_END)

      expect(await isDrawn($), origin.kind).toBe(false)

      engineWrites(announced())
    }
  })

  test("the person's press, sent and answered with no gate, puts nothing back", async ($, on) => {
    world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await click(ui, COMMIT)
    await click(ui, COMMIT)
    await ui.unmount()
    await $.turn.complete(TURN_END)

    expect(await isDrawn($)).toBe(false)
  })

  test('a turn no submission opened counts as the person’s', async ($, on) => {
    world($, on, announced())

    await presented($)
    await $.turn.start({ text: '', turnId: 't1' })
    await $.turn.complete(TURN_END)

    expect(await isDrawn($)).toBe(false)
  })

  test('a turn no submission opened after a background one is still the person’s', async ($, on) => {
    const { engineWrites } = world($, on, announced())

    await presented($)

    engineWrites('')

    await submitFrom($, { kind: 'task-notification' })
    await $.turn.complete(TURN_END)

    expect(await isDrawn($), 'the background turn puts the gate back').toBe(true)

    await $.turn.start({ text: '', turnId: 't2' })
    await $.turn.complete(TURN_END)

    expect(await isDrawn($)).toBe(false)
  })

  test('a submission over a running turn does not say who opens the next', async ($, on) => {
    world($, on, announced())

    await presented($)
    await $.prompt.submit({
      text: 'done',
      wait: false,
      origin: { kind: 'task-notification' },
      turnId: 't0',
    })
    await $.turn.start({ text: 'yes', turnId: 't1' })
    await $.turn.complete(TURN_END)

    expect(await isDrawn($)).toBe(false)
  })

  test('a background turn that renders a gate draws its own', async ($, on) => {
    const { engineWrites } = world($, on, announced())

    await presented($)
    await submitFrom($, { kind: 'task-notification' })

    engineWrites(announced({ options: HELD_FIRST }))

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(TURN_END)

    const ui = await $.ui.mount(MOUNT)

    expect(await lineOf(ui, 'Start "Billing"')).toBeGreaterThan(0)
    expect(await lineOf(ui, COMMIT)).toBe(-1)

    await ui.unmount()
  })

  test('a turn’s end forgets the gate it began over', async ($, on) => {
    world($, on, announced())

    await presented($)
    await submitFrom($, { kind: 'composer' }, 'tell me more')
    await $.turn.complete(TURN_END)
    await $.turn.complete(INTERRUPTED)

    expect(await isDrawn($)).toBe(false)
  })
})
