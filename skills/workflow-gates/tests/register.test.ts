import type {
  On,
  PromptOrigin,
  RenderElement,
  RenderInput,
  RenderSurface,
  SessionMessage,
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

/** The band on a 72 by 24 terminal, not fullscreen: its rows are the terminal's. */
const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 24,
  bodyColumns: 72,
  scroll: { offset: 0, bodyRows: 23 },
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

/** Where the workflows record the project's answers, under the session's working directory. */
const PROJECT_MANIFEST = '.workflows/manifest.json'

/** A project that said yes to the gate surface. */
const OPTED_IN = JSON.stringify({ defaults: { gate_surface: true } })

/** Where a send leaves what it answered, under the session's working directory. */
const SENT = '/.workflows/.cache/.gates/sent.json'

const COMMIT = 'Commit and continue to next task'
const AUTH = 'Continue "Auth"'
const HOLDER = 'in session (last active 4m ago)'

const OPTIONS = [
  {
    key: 'y',
    word: 'yes',
    head: COMMIT,
    tail: null,
    cue: null,
    holder: null,
    detail: null,
    struck: false,
    recommended: true,
  },
  {
    key: '2',
    word: null,
    head: AUTH,
    tail: 'research',
    cue: null,
    holder: HOLDER,
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
    cue: null,
    holder: HOLDER,
    detail: null,
    struck: true,
    recommended: false,
  },
  {
    key: '2',
    word: null,
    head: 'Start "Billing"',
    tail: 'research',
    cue: null,
    holder: null,
    detail: null,
    struck: false,
    recommended: false,
  },
  {
    key: '3',
    word: null,
    head: 'Continue "Search"',
    tail: 'specification',
    cue: null,
    holder: null,
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
    cue: null,
    holder: null,
    detail: ANALYZE_DETAIL,
    struck: false,
    recommended: true,
  },
  {
    key: 'b',
    word: 'back',
    head: 'Return to the previous menu',
    tail: null,
    cue: null,
    holder: null,
    detail: null,
    struck: false,
    recommended: false,
  },
]

/** A menu taller than a short band: eight topics, the first recommended, then back. */
const LONG = [
  ...Array.from({ length: 8 }, (_, n) => ({
    key: String(n + 1),
    word: null,
    head: `Continue "Topic ${n + 1}"`,
    tail: null,
    cue: null,
    holder: null,
    detail: null,
    struck: false,
    recommended: n === 0,
  })),
  {
    key: 'b',
    word: 'back',
    head: 'Return to the previous menu',
    tail: null,
    cue: null,
    holder: null,
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
  "The options are on screen as buttons. The user's answer arrives as their next message — typed by them, or sent for them by the workflow-gates plugin when they press a row.",
  '',
]

/** The menu as the engine wrote it, the payload taken out. */
const TEXT_MENU = [...RESULT_SECTION, ...MENU_SECTION].join('\n')

const IDLE_FOOTER = 'Click to choose · click again to send · or type'

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

/** A call that only reads. */
const READ_CALL = { tool: 'Read' as const, file_path: '/work/README.md' }

/** The same read made inside a subagent's loop. */
const SUBAGENT_READ = { ...READ_CALL, agentId: 'a1' }

/** The session ending for a /clear, which goes on in the same process. */
const CLEARED = {
  reason: 'clear' as const,
  sessionId: 's0',
  resume: { id: 's0' },
}

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

/** The person leaving: the process ends, and a fresh one resumes it. */
const QUIT = {
  reason: 'prompt_input_exit' as const,
  sessionId: 's0',
  resume: { id: 's0' },
}

/** Another conversation resumed in this process in the ending one's place. */
const RESUMED = { ...QUIT, reason: 'resume' as const }

/** A message with no tool call in it. */
const said = (role: SessionMessage['role'], text: string): SessionMessage => ({
  role,
  text,
  toolUses: [],
})

/** A Bash call the model made and its answer, as the transcript holds them. */
const called = (id: string): SessionMessage[] => [
  {
    role: 'assistant',
    text: '',
    toolUses: [
      { tool_use_id: id, tool: 'Bash', input: { command: ENGINE_CALL.command } },
    ],
  },
  {
    role: 'user',
    text: '',
    toolUses: [],
    toolResults: [{ tool_use_id: id, text: '', isError: false }],
  },
]

/** A conversation at the task gate: its call, then the model's word at the stop. */
const AT_GATE = [
  said('user', '/workflow-start'),
  ...called('toolu_1'),
  said('assistant', TURN_END.answer),
]

/** The conversation once an answer at the task gate drew the next gate. */
const AT_NEXT_GATE = [
  ...AT_GATE,
  said('user', 'yes'),
  ...called('toolu_2'),
  said('assistant', 'Next.'),
]

/** The conversation once it moved on from the task gate by talk alone. */
const MOVED_ON = [
  ...AT_GATE,
  said('user', 'carry on'),
  said('assistant', 'Carried on.'),
]

/** The conversation once the task gate was answered, before anything more. */
const ANSWERED = [...AT_GATE, said('user', 'yes')]

/** The line Claude Code writes when the person's Esc stops a turn. */
const INTERRUPTION = said('user', '[Request interrupted by user]')

/** What Claude Code puts in the model's place, resuming after an Esc. */
const NO_RESPONSE = said('assistant', 'No response requested.')

/** Another conversation, at a gate of its own, stopped on the same words. */
const ELSEWHERE_AT_GATE = [
  said('user', '/workflow-start'),
  ...called('toolu_9'),
  said('assistant', TURN_END.answer),
]

/** The task gate as the payload states it, less its name. */
const TASK_GATE = {
  question: 'Approve this task?',
  statement: '',
  options: OPTIONS,
  typed: [COMMENT],
}

/** What a turn's end keeps of the conversation at the task gate. */
const KEPT_AT_GATE = {
  'band:toolu_1': {
    stamp: JSON.stringify(['assistant', TURN_END.answer, [], 'toolu_1']),
    gate: TASK_GATE,
    keptAt: 0,
  },
}

const DAY_MS = 24 * 60 * 60 * 1000

/** The band above the prompt, and the `Client` in it, as the surface mounts them. */
const MOUNT = {
  plugin: 'workflow-gates',
  surface: 'terminal' as const,
  component: 'AbovePrompt' as const,
  requestId: 'band',
  viewport: { columns: 72, rows: 24 },
  props: BAND,
}

/** The band with room for four rows at a time: the long menu on three pages. */
const SHORT_MOUNT = { ...MOUNT, props: { ...BAND, maxRows: 11 } }

/**
 * The world beneath the mod: the session it starts in, the project's
 * manifest, the surfaces attached, its transcript, what a Bash call answers,
 * the prompt box, the files it writes, the prompts it submits, and the
 * plugin's store.
 *
 * `manifest` is the text of the project's `.workflows/manifest.json` — a
 * project that said yes unless a test says otherwise, none at all for null —
 * and `pathsRead` each path the mod read.
 * `calls` is what the mod asked of it, in order; `fills: false` is a box that
 * refuses the text; `submits: false` takes the submission but never lands it,
 * which is the submit that fails, and `drops` refuses it with that reason;
 * `disk` holds each write a second on its clock, which is the clock the mod
 * reads; `lag` is awaited before a read of the transcript or the store is
 * answered. A submission made while idle resolves once the turn it opens has
 * started, as core's does; `engineWrites` changes what the next Bash call
 * answers, `reads` what the transcript holds, `resumesAs` the session's id,
 * and `stopsSubmitting` fails every submission from then on. The prompt box
 * holds what a fill put there until the person `types` over it, and
 * `boxHolds` reads it. `stored` is the store, holding `kept` at the start.
 *
 * @param engine the test's `$`, which opens the turns
 * @param on the test's `on`
 * @param stdout what the engine wrote
 * @param options the project's manifest, the surfaces attached, whether the
 *   box and a submission take, the clock a slow disk writes on, what holds a
 *   read up, and what the store holds
 */
function world(
  engine: Engine,
  on: On,
  stdout = '',
  options: {
    manifest?: string | null
    surfaces?: readonly RenderSurface[]
    fills?: boolean
    submits?: boolean
    drops?: string
    disk?: MockClock
    lag?: (read: 'transcript' | 'store') => Promise<void>
    kept?: Readonly<Record<string, unknown>>
  } = {},
) {
  const {
    manifest = OPTED_IN,
    surfaces = ['terminal'],
    fills = true,
    submits: isSubmitting = true,
    drops,
    disk,
    lag,
    kept = {},
  } = options

  const calls: string[] = []
  const filled: string[] = []
  const submitted: string[] = []
  const written: { name: string; value?: string }[] = []
  const files = new Map<string, string>()
  const pathsRead: string[] = []
  const stored = new Map(Object.entries(kept))
  const clock = disk ?? mock.clock(on)

  let output = stdout
  let box = ''
  let submits = isSubmitting
  let transcript: readonly SessionMessage[] = []
  let sessionId = 's0'
  let turns = 0

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('session.surfaces', () => ({ value: surfaces }))
  on('session.id', () => ({ value: sessionId }))
  on('store.keys', () => ({ value: [...stored.keys()] }))

  on('session.messages', async () => {
    await lag?.('transcript')

    return { value: [...transcript] }
  })

  on('store.get', async ($, e) => {
    await lag?.('store')

    return { value: stored.get(e.key) }
  })

  on('store.set', ($, e) => {
    stored.set(e.key, JSON.parse(JSON.stringify(e.value)))

    return { value: undefined }
  })

  on('store.delete', ($, e) => {
    stored.delete(e.key)

    return { value: undefined }
  })
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

    if (fills) {
      box = e.text
    }

    return { isFilled: fills }
  })

  on('prompt.read', () => ({ value: { text: box, cursor: box.length } }))

  on('fs.read', ($, e) => {
    pathsRead.push(e.path)

    if (manifest === null || e.path !== `${SESSION.cwd}/${PROJECT_MANIFEST}`) {
      throw new Error(`ENOENT: no such file, open '${e.path}'`)
    }

    return { value: manifest }
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

    if (drops !== undefined) {
      return { drop: drops }
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

  on('tool.call', { tool: 'Read' }, ($, e) => ({
    result: {
      type: 'text' as const,
      file: {
        filePath: e.file_path,
        content: '',
        numLines: 0,
        startLine: 1,
        totalLines: 0,
      },
    },
  }))

  const engineWrites = (next: string) => {
    output = next
  }

  const reads = (messages: readonly SessionMessage[]) => {
    transcript = messages
  }

  const resumesAs = (id: string) => {
    sessionId = id
  }

  const stopsSubmitting = () => {
    submits = false
  }

  const types = (text: string) => {
    box = text
  }

  return {
    calls,
    filled,
    submitted,
    written,
    files,
    pathsRead,
    stored,
    clock,
    engineWrites,
    reads,
    resumesAs,
    stopsSubmitting,
    types,
    boxHolds: () => box,
  }
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

/** A submission joining the running turn `turnId`. */
const joinFrom = (
  $: Engine,
  origin: PromptOrigin,
  turnId: string,
  text = 'yes',
) => $.prompt.submit({ text, wait: false, origin, turnId })

/** The person leaving the conversation, then a fresh load resuming it. */
async function quitAndResume($: Engine) {
  await $.session.end(QUIT)
  await $.session.start(SESSION)
}

/** What the last send recorded, read back as the mod wrote it. */
function sentIn(files: Map<string, string>): unknown {
  const [path, text] = [...files].at(-1) ?? ['', 'null']

  expect(path.endsWith(SENT), `${path} is the send record`).toBe(true)

  return JSON.parse(text)
}

/**
 * A plugin above the mod that leaves how each of the mod's hooks settled —
 * its `tool.call` hooks in `trace.json`, its `session.start` hook in
 * `start.json`: one that failed reads `caught`.
 */
const OBSERVED = {
  plugins: [
    {
      name: 'observer',
      tier: 'prepend' as const,
      register(on: On) {
        const outcomesOf = (trace: readonly { plugin: string; outcome: string }[]) =>
          JSON.stringify(
            trace
              .filter(link => link.plugin === 'workflow-gates')
              .map(link => link.outcome),
          )

        on('session.start', async ($, e, next) => {
          const result = await next(e)

          await $.fs.write('start.json', outcomesOf(next.trace))

          return result
        })

        on('tool.call', async ($, e, next) => {
          const result = await next(e)

          await $.fs.write('trace.json', outcomesOf(next.trace))

          return result
        })
      },
    },
  ],
}

/** How the mod's hooks settle when none of them fails. */
const PASSED = ['returned']

/** How the mod's hooks settled, as the observer left it in `file`. */
function outcomesIn(files: Map<string, string>, file = 'trace.json'): unknown {
  const [, text] = [...files].find(([path]) => path.endsWith(file)) ?? []

  return JSON.parse(text ?? 'null')
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

/** The pager as the band draws it: which page shows, of how many. */
async function pagerOf(ui: Band) {
  return (await linesOf(ui)).find(line => line.includes('↓ next'))?.trim()
}

/** A click on the pager's `word`, where the band draws it. */
async function turn(ui: Band, word: string) {
  const lines = await linesOf(ui)
  const y = lines.findIndex(line => line.includes('↓ next'))
  const x = lines[y]?.indexOf(word) ?? -1

  expect(x, `the pager shows ${word}`).toBeGreaterThanOrEqual(0)

  await ui.pointer({ type: 'down', x, y, button: 'left', in: 'gate' })
}

/** The line the cursor mark is on. */
async function cursorOf(ui: Band) {
  return (await linesOf(ui)).find(line => line.startsWith('▌'))?.trimEnd()
}

describe('register', () => {
  test('a project that said yes has the session announce the gate surface to every child it starts', async ($, on) => {
    const { written, pathsRead } = world($, on)

    await $.session.start(SESSION)

    expect(pathsRead).toEqual([`${SESSION.cwd}/${PROJECT_MANIFEST}`])
    expect(written).toEqual([{ name: 'WORKFLOWS_GATE_SURFACE', value: '1' }])
  })

  for (const answer of [
    { defaults: { gate_surface: false } },
    { defaults: { gate_surface: 'true' } },
    { defaults: { tmux_labels: true } },
    { work_units: {} },
    null,
  ]) {
    test(`a project whose manifest reads ${JSON.stringify(answer)} has nothing announced`, async ($, on) => {
      const { written } = world($, on, '', { manifest: JSON.stringify(answer) })

      await $.session.start(SESSION)

      expect(written).toEqual([])
    })
  }

  test('a project with no manifest has nothing announced, the hook never failing over it', OBSERVED, async ($, on) => {
    const { written, files } = world($, on, '', { manifest: null })

    await $.session.start(SESSION)

    expect(written).toEqual([])
    expect(outcomesIn(files, 'start.json')).toEqual(PASSED)
  })

  test('a manifest that does not parse has nothing announced, the hook never failing over it', OBSERVED, async ($, on) => {
    const { written, files } = world($, on, '', { manifest: '{not json' })

    await $.session.start(SESSION)

    expect(written).toEqual([])
    expect(outcomesIn(files, 'start.json')).toEqual(PASSED)
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

  test('a payload not directly above its menu states no gate, and passes through', async ($, on) => {
    const apart = announced().replace(
      `\n${MENU_SECTION[0]}`,
      `\n\n${MENU_SECTION[0]}`,
    )
    world($, on, apart)

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(ENGINE_CALL))).toBe(apart)

    await $.turn.complete(TURN_END)

    expect(await isDrawn($)).toBe(false)
  })

  test('with no terminal attached the menu stays text, the payload taken out', async ($, on) => {
    world($, on, announced(), { surfaces: ['vscode'] })

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(ENGINE_CALL))).toBe(TEXT_MENU)

    await $.turn.complete(TURN_END)

    expect(await isDrawn($)).toBe(false)
  })

  test('with another screen attached beside the terminal the menu stays text, so every screen shows it', async ($, on) => {
    world($, on, announced(), { surfaces: ['terminal', 'mobile'] })

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(ENGINE_CALL))).toBe(TEXT_MENU)

    await $.turn.complete(TURN_END)

    expect(await isDrawn($), 'the terminal draws no band for it').toBe(false)
  })

  test("a subagent's gate stays text, the payload taken out, and nothing is armed", async ($, on) => {
    const { calls } = world($, on, announced())

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(SUBAGENT_CALL))).toBe(TEXT_MENU)

    await $.turn.complete(TURN_END)

    expect(calls).toEqual([])
    expect(await isDrawn($)).toBe(false)
  })

  test('a refused call passes through untouched, the hook never failing over it', OBSERVED, async ($, on) => {
    const refused = { deny: 'Bash is not allowed here' }

    on('tool.call', { tool: 'Bash' }, () => refused)
    const { files } = world($, on, announced())

    await $.session.start(SESSION)

    expect(await $.tool.call(ENGINE_CALL)).toEqual(refused)
    expect(outcomesIn(files)).toEqual(PASSED)

    await $.turn.complete(TURN_END)

    expect(await isDrawn($)).toBe(false)
  })

  test('an errored call passes through untouched, the hook never failing over it', OBSERVED, async ($, on) => {
    const errored = {
      isError: true as const,
      result: 'Exit code 1',
      text: 'Exit code 1',
    }

    on('tool.call', { tool: 'Bash' }, () => errored)
    const { files } = world($, on, announced())

    await $.session.start(SESSION)

    expect(await $.tool.call(ENGINE_CALL)).toEqual(errored)
    expect(outcomesIn(files)).toEqual(PASSED)

    await $.turn.complete(TURN_END)

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
      props: { module: 'hooks/board.ts', width: 72, height: 10 },
    })

    expect(await ui.find({ text: '? for shortcuts' })).toBeDefined()

    expect(
      (await linesOf(ui)).map(line => line.trimEnd()),
      'the last line kept for the second row, held, to wrap onto',
    ).toEqual([
      '─'.repeat(72),
      '',
      '◆ Approve this task?',
      '',
      `▌ yes      ${COMMIT} (recommended)`,
      `  2        ${AUTH} — research · ${HOLDER}`,
      `  Comment  ${COMMENT.description}`,
      '',
      `  ${IDLE_FOOTER}`,
      '',
    ])

    expect(await runOf(ui, COMMENT.description), 'a typed row draws dim').toMatchObject({
      props: { dimColor: true },
    })

    expect(await runOf(ui, AUTH), 'a held row is struck').toMatchObject({
      props: { strikethrough: true },
    })

    expect(
      await runOf(ui, ' (recommended)'),
      'the recommendation is bold in the accent colour',
    ).toMatchObject({ props: { bold: true, color: 'permission' } })

    expect(
      (await runOf(ui, HOLDER))?.props.strikethrough,
      'what holds it stands after the strike',
    ).toBeUndefined()

    expect(await runOf(ui, IDLE_FOOTER), 'the footer is dim').toMatchObject({
      props: { dimColor: true },
    })

    expect(await ui.findAll({ type: 'Button', in: 'gate' })).toEqual([])

    await ui.unmount()
  })

  test('the statement draws directly above the question, level with its text', async ($, on) => {
    world($, on, announced({ statement: 'Found existing review for Auth.' }))

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    expect((await linesOf(ui)).slice(1, 5).map(line => line.trimEnd())).toEqual([
      '',
      '  Found existing review for Auth.',
      '◆ Approve this task?',
      '',
    ])

    expect(await runOf(ui, 'Found existing review for Auth.')).not.toMatchObject({
      props: { bold: true },
    })

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
        question: 'What would you like to do?',
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

  test('the band draws on the terminal alone', async ($, on) => {
    world($, on, announced())

    await presented($)

    expect(await $.ui.render({ ...DRAWING, surface: 'desktop' })).toEqual(
      BENEATH,
    )
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
      'yes is in your prompt · click again to send',
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
    const { files, filled, submitted } = world($, on, announced(), {
      submits: false,
    })

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'return', in: 'gate' })
    await ui.key({ key: 'return', in: 'gate' })

    expect(submitted).toEqual(['yes'])
    expect(filled, 'picked, cleared to send, put back').toEqual(['yes', '', 'yes'])
    expect(sentIn(files), 'no send is left recorded').toBeNull()
    expect(await ui.find({ type: 'Client', key: 'gate' })).toBeDefined()
    expect(await backgroundOf(ui, COMMIT)).toBe('diffAddedDimmed')
    expect(await footerOf(ui)).toBe(
      'yes is in your prompt · click again to send',
    )

    await ui.key({ key: 'return', in: 'gate' })

    expect(submitted).toEqual(['yes', 'yes'])
    expect(filled.at(-1)).toBe('yes')

    await ui.unmount()
  })

  test('a send a hook drops is no send: the answer goes back in the box and no send is left recorded', async ($, on) => {
    const { files, filled, submitted } = world($, on, announced(), {
      drops: 'held by another plugin',
    })

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'return', in: 'gate' })
    await ui.key({ key: 'return', in: 'gate' })

    expect(submitted).toEqual(['yes'])
    expect(filled, 'picked, cleared to send, put back').toEqual(['yes', '', 'yes'])
    expect(sentIn(files)).toBeNull()
    expect(await backgroundOf(ui, COMMIT), 'the pick holds').toBe('diffAddedDimmed')

    await ui.key({ key: 'return', in: 'gate' })

    expect(submitted, 'a press retries').toEqual(['yes', 'yes'])

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

  test('the arrows wrap round the rows', async ($, on) => {
    const { filled } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'up', in: 'gate' })
    await ui.key({ key: 'return', in: 'gate' })

    expect(filled, 'up from the first row lands on the last').toEqual(['2'])

    await ui.key({ key: 'down', in: 'gate' })
    await ui.key({ key: 'return', in: 'gate' })

    expect(filled, 'down from the last row lands on the first').toEqual([
      '2',
      'yes',
    ])

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

  test("a row's own key picks it where the key column shows a word, wherever the cursor is", async ($, on) => {
    const { filled } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'down', in: 'gate' })
    await ui.key({ key: 'y', in: 'gate' })

    expect(filled, 'the y of yes').toEqual(['yes'])

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

  test('the button coming up after a click does nothing more: a click picks once, never sends', async ($, on) => {
    const { filled, submitted } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)
    const y = await lineOf(ui, COMMIT)

    await ui.pointer({ type: 'down', x: 4, y, button: 'left', in: 'gate' })
    await ui.pointer({ type: 'up', x: 4, y, button: 'left', in: 'gate' })

    expect(filled).toEqual(['yes'])
    expect(submitted).toEqual([])

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

    await hover(ui, COMMENT.description)

    expect(await footerOf(ui), 'resting on it says nothing').toMatch(
      /^yes is in your prompt/,
    )

    await click(ui, COMMENT.description)

    expect(calls, 'the box and the pick are left alone').toEqual([])
    expect(await footerOf(ui)).toBe(
      'Comment — Esc, then type it in the prompt',
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
      '1–2 — Esc, then type the numbers in the prompt',
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

  test('a menu taller than the band shows its rows a page at a time over a pager, the region exactly the band’s height', async ($, on) => {
    world($, on, announced({ options: LONG }))

    await presented($)

    const ui = await $.ui.mount(SHORT_MOUNT)

    expect(await ui.find({ type: 'Client', key: 'gate' })).toMatchObject({
      props: { height: 11 },
    })

    expect((await linesOf(ui)).map(line => line.trimEnd())).toEqual([
      '─'.repeat(72),
      '',
      '◆ Approve this task?',
      '',
      '▌ 1        Continue "Topic 1" (recommended)',
      '  2        Continue "Topic 2"',
      '  3        Continue "Topic 3"',
      '  4        Continue "Topic 4"',
      '  ↑ previous   ↓ next   page 1 of 3',
      '',
      `  ${IDLE_FOOTER}`,
    ])

    const heights = [(await linesOf(ui)).length]

    await turn(ui, '↓ next')
    heights.push((await linesOf(ui)).length)
    await turn(ui, '↓ next')
    heights.push((await linesOf(ui)).length)

    expect(await lineOf(ui, '↓ next'), 'the pager stays put under a short last page').toBe(8)

    await click(ui, 'Return to the previous')
    heights.push((await linesOf(ui)).length)

    expect(heights, 'first page, second, last, a pick on it').toEqual([11, 11, 11, 11])

    await ui.unmount()
  })

  test('the pager draws its presses in the accent colour, one that goes nowhere dim', async ($, on) => {
    world($, on, announced({ options: LONG }))

    await presented($)

    const ui = await $.ui.mount(SHORT_MOUNT)

    expect(await runOf(ui, '↑ previous')).toMatchObject({ props: { dimColor: true } })
    expect(await runOf(ui, '↓ next')).toMatchObject({ props: { color: 'permission' } })
    expect((await runOf(ui, '↓ next'))?.props.dimColor).toBeFalsy()

    await ui.unmount()
  })

  test('a click on next turns the page and puts the cursor on its first row, and previous turns back', async ($, on) => {
    const { filled } = world($, on, announced({ options: LONG }))

    await presented($)

    const ui = await $.ui.mount(SHORT_MOUNT)

    await turn(ui, '↓ next')

    expect(await pagerOf(ui)).toBe('↑ previous   ↓ next   page 2 of 3')
    expect(await cursorOf(ui)).toBe('▌ 5        Continue "Topic 5"')

    await ui.key({ key: 'return', in: 'gate' })

    expect(filled, 'Enter takes the row the page opened on').toEqual(['5'])

    await turn(ui, '↑ previous')

    expect(await pagerOf(ui)).toBe('↑ previous   ↓ next   page 1 of 3')
    expect(await cursorOf(ui)).toBe('▌ 1        Continue "Topic 1" (recommended)')

    await ui.unmount()
  })

  test('a click on a press that goes nowhere, or on where the pager stands, does nothing', async ($, on) => {
    const { calls } = world($, on, announced({ options: LONG }))

    await presented($)

    const ui = await $.ui.mount(SHORT_MOUNT)
    const first = await linesOf(ui)

    calls.length = 0

    await turn(ui, '↑ previous')
    await turn(ui, 'page 1 of 3')

    expect(await linesOf(ui), 'no page before the first').toEqual(first)

    await turn(ui, '↓ next')
    await turn(ui, '↓ next')

    const last = await linesOf(ui)

    await turn(ui, '↓ next')

    expect(await linesOf(ui), 'no page after the last').toEqual(last)
    expect(calls, 'nothing reaches the prompt').toEqual([])

    await ui.unmount()
  })

  test('the arrows cross pages both ways and wrap round the rows, the page following the cursor', async ($, on) => {
    world($, on, announced({ options: LONG }))

    await presented($)

    const ui = await $.ui.mount(SHORT_MOUNT)

    for (let press = 0; press < 4; press += 1) {
      await ui.key({ key: 'down', in: 'gate' })
    }

    expect(await pagerOf(ui)).toMatch(/page 2 of 3$/)
    expect(await cursorOf(ui)).toBe('▌ 5        Continue "Topic 5"')

    await ui.key({ key: 'up', in: 'gate' })

    expect(await pagerOf(ui)).toMatch(/page 1 of 3$/)
    expect(await cursorOf(ui)).toBe('▌ 4        Continue "Topic 4"')

    for (let press = 0; press < 4; press += 1) {
      await ui.key({ key: 'up', in: 'gate' })
    }

    expect(await pagerOf(ui), 'up from the first row').toMatch(/page 3 of 3$/)
    expect(await cursorOf(ui)).toBe('▌ back     Return to the previous menu')

    await ui.key({ key: 'down', in: 'gate' })

    expect(await pagerOf(ui), 'down from the last row').toMatch(/page 1 of 3$/)
    expect(await cursorOf(ui)).toBe('▌ 1        Continue "Topic 1" (recommended)')

    await ui.unmount()
  })

  test('a row’s own key picks it on whatever page it sits, the page turning to it', async ($, on) => {
    const { filled } = world($, on, announced({ options: LONG }))

    await presented($)

    const ui = await $.ui.mount(SHORT_MOUNT)

    await ui.key({ key: 'b', in: 'gate' })

    expect(filled).toEqual(['back'])
    expect(await pagerOf(ui)).toMatch(/page 3 of 3$/)
    expect(await cursorOf(ui)).toBe('▌ back     Return to the previous menu')

    await ui.key({ key: '6', in: 'gate' })

    expect(filled).toEqual(['back', '6'])
    expect(await pagerOf(ui)).toMatch(/page 2 of 3$/)

    await ui.unmount()
  })

  test('the pointer resting on a row moves the cursor there, the page staying put', async ($, on) => {
    world($, on, announced({ options: LONG }))

    await presented($)

    const ui = await $.ui.mount(SHORT_MOUNT)

    await turn(ui, '↓ next')
    await hover(ui, 'Topic 7')

    expect(await backgroundOf(ui, 'Continue "Topic 7"')).toBe('selectionBg')
    expect(await cursorOf(ui)).toBe('▌ 7        Continue "Topic 7"')
    expect(await pagerOf(ui)).toMatch(/page 2 of 3$/)

    await ui.unmount()
  })

  test('a page of typed rows alone leaves the cursor where it was', async ($, on) => {
    const { filled } = world($, on, announced({ options: LONG }))

    await presented($)

    const ui = await $.ui.mount({ ...MOUNT, props: { ...BAND, maxRows: 10 } })

    await turn(ui, '↓ next')
    await turn(ui, '↓ next')
    await turn(ui, '↓ next')

    expect(await pagerOf(ui)).toMatch(/page 4 of 4$/)
    expect(await cursorOf(ui), 'no row of the page is under the cursor').toBeUndefined()

    await ui.key({ key: 'return', in: 'gate' })

    expect(filled, 'the first row of the page before').toEqual(['7'])

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

  test('a /clear takes the gate off the band, leaving no row of it to press', async ($, on) => {
    const { calls } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await click(ui, COMMIT)

    calls.length = 0

    await $.session.end(CLEARED)

    expect(calls).toEqual(['invalidate'])
    expect(await ui.find({ type: 'Client', key: 'gate' })).toBeUndefined()
    expect(await isDrawn($)).toBe(false)

    await ui.unmount()
  })

  test('a background turn after a /clear brings back no gate from before it', async ($, on) => {
    world($, on, announced())

    await presented($)
    await $.session.end(CLEARED)
    await submitFrom($, { kind: 'task-notification' })
    await $.turn.complete(TURN_END)

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

  test('an Esc after the answer rendered the next gate leaves the band empty', async ($, on) => {
    const { engineWrites } = world($, on, announced())

    await presented($)
    await submitFrom($, { kind: 'composer' }, 'yes')

    engineWrites(announced({ options: HELD_FIRST }))

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(INTERRUPTED)

    expect(await isDrawn($), 'neither the answered gate nor the half-rendered one').toBe(false)
  })

  test('an Esc once the answer called any tool, a read as much as a write, leaves the band empty', async ($, on) => {
    world($, on, announced())

    await presented($)
    await submitFrom($, { kind: 'composer' }, 'yes')
    await $.tool.call(READ_CALL)
    await $.turn.complete(INTERRUPTED)

    expect(await isDrawn($)).toBe(false)
  })

  test("an Esc after a subagent's tool call alone still puts the answered gate back", async ($, on) => {
    world($, on, announced())

    await presented($)
    await submitFrom($, { kind: 'composer' }, 'yes')
    await $.tool.call(SUBAGENT_READ)
    await $.turn.complete(INTERRUPTED)

    expect(await isDrawn($)).toBe(true)
  })

  test('an Esc on a turn anyone else started leaves the band as it is, the pick on it included, whatever the turn called', async ($, on) => {
    world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await click(ui, COMMIT)
    await submitFrom($, { kind: 'task-notification' })
    await $.tool.call(READ_CALL)
    await $.turn.complete(INTERRUPTED)

    expect(await backgroundOf(ui, COMMIT)).toBe('diffAddedDimmed')
    expect(await footerOf(ui)).toMatch(/^yes is in your prompt/)

    await ui.unmount()
  })

  test('an Esc on a turn anyone else started, once it rendered another gate, empties the band: the model is at that gate’s stop', async ($, on) => {
    const { engineWrites } = world($, on, announced())

    await presented($)
    await submitFrom($, { kind: 'task-notification' })

    engineWrites(announced({ options: HELD_FIRST }))

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(INTERRUPTED)

    expect(await isDrawn($), 'neither the gate it began over nor the half-rendered one').toBe(false)
  })

  test('an Esc on a turn anyone else started, once it rendered the same gate again, leaves the band as it is', async ($, on) => {
    const { engineWrites } = world($, on, announced())

    await presented($)
    await submitFrom($, { kind: 'task-notification' })

    engineWrites(announced())

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(INTERRUPTED)

    const ui = await $.ui.mount(MOUNT)

    expect(await lineOf(ui, COMMIT)).toBeGreaterThan(0)

    await ui.unmount()
  })

  test('a turn anyone else started leaves the band live through it, and its end leaves the band as it was', async ($, on) => {
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

      expect(await isDrawn($), `${origin.kind}: the band stays through it`).toBe(true)

      await $.turn.complete(TURN_END)

      expect(await isDrawn($), `${origin.kind}: and after it`).toBe(true)
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

    expect(await isDrawn($), 'the background turn leaves the gate').toBe(true)

    await $.turn.start({ text: '', turnId: 't2' })
    await $.turn.complete(TURN_END)

    expect(await isDrawn($)).toBe(false)
  })

  test('a submission over a running turn does not say who opens the next', async ($, on) => {
    world($, on, announced())

    await presented($)
    await joinFrom($, { kind: 'task-notification' }, 't0', 'done')
    await $.turn.start({ text: 'yes', turnId: 't1' })
    await $.turn.complete(TURN_END)

    expect(await isDrawn($)).toBe(false)
  })

  test('a reply the person sends into a turn anyone else started takes the band down at once, and its end puts nothing back', async ($, on) => {
    const { engineWrites } = world($, on, announced())

    await presented($)

    engineWrites('')

    const theirs: PromptOrigin[] = [
      { kind: 'composer' },
      { kind: 'bridge' },
      { kind: 'plugin', name: 'workflow-gates' },
    ]

    for (const [n, origin] of theirs.entries()) {
      await submitFrom($, { kind: 'task-notification' })
      await joinFrom($, origin, `t${n + 1}`)

      expect(await isDrawn($), `${origin.kind}: at the reply`).toBe(false)

      await $.turn.complete(TURN_END)

      expect(await isDrawn($), `${origin.kind}: at the turn's end`).toBe(false)

      engineWrites(announced())

      await $.tool.call(ENGINE_CALL)
      await $.turn.complete(TURN_END)

      engineWrites('')
    }
  })

  test('a submission from anyone else joining that turn leaves the band as it is', async ($, on) => {
    const { engineWrites } = world($, on, announced())

    await presented($)

    engineWrites('')

    await submitFrom($, { kind: 'task-notification' })
    await joinFrom($, { kind: 'task-notification' }, 't1', 'done')
    await $.turn.complete(TURN_END)

    expect(await isDrawn($)).toBe(true)
  })

  test('a send pressed while anyone else’s turn runs is held: the row reads queued, the footer says when it sends, and the prompt box is emptied', async ($, on) => {
    const { filled, submitted } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await click(ui, COMMIT)

    expect(submitted, 'nothing but the turn’s own').toEqual(['ping'])
    expect(filled, 'picked, then taken out of the box').toEqual(['yes', ''])
    expect(await backgroundOf(ui, COMMIT)).toBe('diffAddedDimmed')
    expect(await lineOf(ui, `${COMMIT} (recommended) · queued`)).toBeGreaterThan(0)
    expect((await runOf(ui, /^ · queued$/))?.props.dimColor, 'plain').toBeUndefined()
    expect(await footerOf(ui)).toBe(
      'yes sends when Claude finishes · click to undo',
    )
    expect(await runOf(ui, /^yes$/), 'the footer names it in bold').toMatchObject({
      props: { bold: true },
    })

    await ui.unmount()
  })

  test('a press on the held row takes it back to a pick, its answer in the box again', async ($, on) => {
    const { filled, submitted } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await click(ui, COMMIT)
    await click(ui, COMMIT)

    expect(filled).toEqual(['yes', '', 'yes'])
    expect(submitted).toEqual(['ping'])
    expect(await lineOf(ui, '· queued')).toBe(-1)
    expect(await footerOf(ui)).toMatch(/^yes is in your prompt/)

    await $.turn.complete(TURN_END)

    expect(submitted, 'a pick waits for its own send').toEqual(['ping'])

    await ui.unmount()
  })

  test('a press on another row picks it in place of the held one, which never sends', async ($, on) => {
    const { filled, submitted } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await click(ui, COMMIT)
    await click(ui, AUTH)

    expect(filled).toEqual(['yes', '', '2'])
    expect(await lineOf(ui, '· queued')).toBe(-1)
    expect(await backgroundOf(ui, AUTH)).toBe('diffAddedDimmed')
    expect(await footerOf(ui)).toMatch(/^2 is in your prompt/)

    await $.turn.complete(TURN_END)

    expect(submitted).toEqual(['ping'])

    await ui.unmount()
  })

  test('the turn’s end sends the held answer while the same gate is on the band, and the band comes down as that turn starts', async ($, on) => {
    const { files, submitted } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await click(ui, COMMIT)
    await ui.unmount()
    await $.turn.complete(TURN_END)

    expect(submitted).toEqual(['ping', 'yes'])
    expect(sentIn(files)).toEqual({
      answer: 'yes',
      question: 'Approve this task?',
      label: COMMIT,
    })
    expect(await isDrawn($)).toBe(false)
  })

  test('a turn that presents the same gate again still sends the held answer', async ($, on) => {
    const { submitted, engineWrites } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await click(ui, COMMIT)
    await ui.unmount()

    engineWrites(announced())

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(TURN_END)

    expect(submitted).toEqual(['ping', 'yes'])
  })

  test('a turn that draws another gate drops the held answer unsent, and the new gate’s footer says so until a click', async ($, on) => {
    const { submitted, engineWrites } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await click(ui, COMMIT)

    engineWrites(announced({ options: HELD_FIRST }))

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(TURN_END)

    expect(submitted).toEqual(['ping'])
    expect(await lineOf(ui, 'Start "Billing"')).toBeGreaterThan(0)
    expect(await footerOf(ui)).toBe('yes not sent — the menu changed')
    expect(await runOf(ui, /^yes$/), 'the answer named in bold').toMatchObject({
      props: { bold: true },
    })

    await click(ui, 'Start "Billing"')

    expect(await footerOf(ui)).toMatch(/^2 is in your prompt/)

    await ui.unmount()
  })

  test('a pick goes with its gate when a turn draws another over it, its answer out of the prompt box', async ($, on) => {
    const { engineWrites, boxHolds } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)

    expect(boxHolds()).toBe('yes')

    engineWrites(announced({ options: HELD_FIRST }))

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(TURN_END)

    expect(await footerOf(ui)).toBe(IDLE_FOOTER)
    expect(boxHolds(), 'no answer to the old gate left to send to the new one').toBe('')

    await ui.unmount()
  })

  test('a draft the person edited from a pick stays in the prompt box when its gate goes', async ($, on) => {
    const { engineWrites, boxHolds, types } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await ui.unmount()

    types('yes, and add tests')
    engineWrites(announced({ options: HELD_FIRST }))

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(TURN_END)

    expect(boxHolds()).toBe('yes, and add tests')
  })

  test('a press while the held answer is being sent does nothing', async ($, on) => {
    const disk = mock.clock(on)
    const { filled, submitted } = world($, on, announced(), { disk })

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await click(ui, COMMIT)

    const ending = $.turn.complete(TURN_END)

    await disk.settle()
    await ui.post({ answer: '2' }, { in: 'gate' })
    await disk.advance(1000)
    await ending

    expect(filled).toEqual(['yes', ''])
    expect(submitted).toEqual(['ping', 'yes'])

    await ui.unmount()
  })

  test('an Esc on anyone else’s turn hands a held answer back to the prompt as a pick, nothing sent', async ($, on) => {
    const { filled, submitted } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await click(ui, COMMIT)
    await $.turn.complete(INTERRUPTED)

    expect(submitted).toEqual(['ping'])
    expect(filled).toEqual(['yes', '', 'yes'])
    expect(await lineOf(ui, '· queued')).toBe(-1)
    expect(await footerOf(ui)).toMatch(/^yes is in your prompt/)

    await ui.unmount()
  })

  test('an Esc after that turn rendered the same gate again hands a held answer back as a pick, nothing sent', async ($, on) => {
    const { filled, submitted, engineWrites } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await click(ui, COMMIT)

    engineWrites(announced())

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(INTERRUPTED)

    expect(submitted).toEqual(['ping'])
    expect(filled).toEqual(['yes', '', 'yes'])
    expect(await footerOf(ui)).toMatch(/^yes is in your prompt/)

    await ui.unmount()
  })

  test('an Esc after that turn rendered another gate drops a held answer unsent, the band empty', async ($, on) => {
    const { filled, submitted, engineWrites } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await click(ui, COMMIT)
    await ui.unmount()

    engineWrites(announced({ options: HELD_FIRST }))

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(INTERRUPTED)

    expect(submitted).toEqual(['ping'])
    expect(filled, 'never handed back').toEqual(['yes', ''])
    expect(await isDrawn($)).toBe(false)
  })

  test('a pick whose gate an Esc empties from the band leaves the prompt box too, while the box still holds it', async ($, on) => {
    const { engineWrites, boxHolds } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await ui.unmount()

    engineWrites(announced({ options: HELD_FIRST }))

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(INTERRUPTED)

    expect(boxHolds()).toBe('')
  })

  test('a held answer that fails to send goes back to the prompt as a pick, no send left recorded', async ($, on) => {
    const { files, filled, stopsSubmitting } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await click(ui, COMMIT)

    stopsSubmitting()

    await $.turn.complete(TURN_END)

    expect(filled).toEqual(['yes', '', 'yes'])
    expect(sentIn(files)).toBeNull()
    expect(await footerOf(ui)).toMatch(/^yes is in your prompt/)

    await ui.unmount()
  })

  test('a reply the person types while an answer is held takes the band down, and the held answer never sends', async ($, on) => {
    const { submitted } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await click(ui, COMMIT)
    await ui.unmount()
    await joinFrom($, { kind: 'composer' }, 't1', 'hold on')

    expect(await isDrawn($)).toBe(false)

    await $.turn.complete(TURN_END)

    expect(submitted).toEqual(['ping', 'hold on'])
  })

  test('the band holds its height through a pick, a hold, a take-back and a dropped answer', async ($, on) => {
    const { engineWrites } = world($, on, announced())

    await presented($)

    const ui = await $.ui.mount({ ...MOUNT, props: { ...BAND, bodyColumns: 40 } })
    const heightOf = async () =>
      (await ui.find({ type: 'Client', key: 'gate' }))?.props.height
    const heights = [(await linesOf(ui)).length]

    await submitFrom($, { kind: 'task-notification' })

    for (let press = 0; press < 3; press += 1) {
      await click(ui, AUTH)
      heights.push((await linesOf(ui)).length)
    }

    expect(heights, 'idle, picked, held, taken back').toEqual(
      Array(4).fill(await heightOf()),
    )

    await click(ui, AUTH)

    engineWrites(announced({ options: DETAILED }))

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(TURN_END)

    const dropped = [(await linesOf(ui)).length]

    await click(ui, 'Analyze for groupings')
    dropped.push((await linesOf(ui)).length)

    expect(dropped, 'the dropped note, then a pick').toEqual(
      Array(2).fill(await heightOf()),
    )

    await ui.unmount()
  })

  test('a held answer is not kept: the conversation resumed shows its gate unpicked', async ($, on) => {
    const { reads, submitted } = world($, on, announced())

    reads(AT_GATE)

    await presented($)

    let ui = await $.ui.mount(MOUNT)

    await submitFrom($, { kind: 'task-notification' })
    await click(ui, COMMIT)
    await click(ui, COMMIT)
    await ui.unmount()
    await quitAndResume($)

    ui = await $.ui.mount(MOUNT)

    expect(await lineOf(ui, 'Approve this task?')).toBe(2)
    expect(await lineOf(ui, '· queued')).toBe(-1)
    expect(await footerOf(ui)).toBe(IDLE_FOOTER)
    expect(submitted).toEqual(['ping'])

    await ui.unmount()
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

  test('a turn’s end keeps the gate on the band, stamped where the transcript ends, and one ending on nothing keeps nothing', async ($, on) => {
    const { stored, reads, engineWrites } = world($, on, announced())

    reads(AT_GATE)

    await presented($)

    expect(Object.fromEntries(stored)).toEqual(KEPT_AT_GATE)

    engineWrites('')
    reads(MOVED_ON)

    await submitFrom($, { kind: 'composer' }, 'carry on')
    await $.turn.complete(TURN_END)

    expect(stored.size).toBe(0)
  })

  test('a gate on the band when the conversation is left is drawn again, as it was, when it is resumed', async ($, on) => {
    const { reads } = world($, on, announced({ options: DETAILED }))

    reads(AT_GATE)

    await presented($)

    let ui = await $.ui.mount(MOUNT)
    const before = await linesOf(ui)

    await ui.unmount()
    await $.session.end(QUIT)

    ui = await $.ui.mount(MOUNT)

    expect(
      await ui.find({ type: 'Client', key: 'gate' }),
      'leaving takes it down',
    ).toBeUndefined()

    await $.session.start(SESSION)

    expect(await linesOf(ui), 'the band on screen draws it again').toEqual(before)

    await ui.unmount()
  })

  test('an answer taken back with Esc, then the conversation left, draws the gate again when it is resumed', async ($, on) => {
    const { reads } = world($, on, announced())

    reads(AT_GATE)

    await presented($)

    reads(ANSWERED)

    await submitFrom($, { kind: 'composer' }, 'yes')

    reads([...ANSWERED, INTERRUPTION])

    await $.turn.complete(INTERRUPTED)

    expect(await isDrawn($), 'the Esc puts it back').toBe(true)

    await quitAndResume($)

    expect(await isDrawn($)).toBe(true)
  })

  test('an answer taken back while the transcript moves after the Esc is still drawn again, stamped as the conversation is left', async ($, on) => {
    const { reads } = world($, on, announced())

    reads(AT_GATE)

    await presented($)

    reads(ANSWERED)

    await submitFrom($, { kind: 'composer' }, 'yes')
    await $.turn.complete(INTERRUPTED)

    reads(AT_GATE)

    await quitAndResume($)

    expect(await isDrawn($)).toBe(true)
  })

  test('the lines Claude Code writes around an interrupted turn move no stamp: the gate is kept the same with them as without', async ($, on) => {
    const { stored, reads } = world($, on, announced())
    const endings = [[], [INTERRUPTION], [INTERRUPTION, NO_RESPONSE]]

    await $.session.start(SESSION)

    for (const ending of endings) {
      reads([...AT_GATE, ...ending])

      await $.tool.call(ENGINE_CALL)
      await $.turn.complete(TURN_END)

      expect(Object.fromEntries(stored), `${ending.length} lines past the stop`).toEqual(KEPT_AT_GATE)
    }
  })

  test('an answer taken back with Esc before any call, then the conversation left, draws the gate again when it is resumed past the lines written around the stop', async ($, on) => {
    const { reads } = world($, on, announced())

    reads(AT_GATE)

    await presented($)

    reads(ANSWERED)

    await submitFrom($, { kind: 'composer' }, 'yes')
    await $.turn.complete(INTERRUPTED)

    reads([...ANSWERED, INTERRUPTION])

    await $.session.end(QUIT)

    reads([...ANSWERED, INTERRUPTION, NO_RESPONSE])

    await $.session.start(SESSION)

    expect(await isDrawn($)).toBe(true)
  })

  test('an answer that drew the next gate: the next gate is drawn when the conversation is resumed', async ($, on) => {
    const { reads, engineWrites } = world($, on, announced())

    reads(AT_GATE)

    await presented($)
    await submitFrom($, { kind: 'composer' }, 'yes')

    engineWrites(announced({ options: HELD_FIRST }))
    reads(AT_NEXT_GATE)

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(TURN_END)
    await quitAndResume($)

    const ui = await $.ui.mount(MOUNT)

    expect(await lineOf(ui, 'Start "Billing"')).toBeGreaterThan(0)
    expect(await lineOf(ui, COMMIT)).toBe(-1)

    await ui.unmount()
  })

  test('a conversation keeps one gate: the next takes the place of the last', async ($, on) => {
    const { stored, reads, engineWrites } = world($, on, announced())

    reads(AT_GATE)

    await presented($)
    await submitFrom($, { kind: 'composer' }, 'yes')

    engineWrites(announced({ options: HELD_FIRST }))
    reads(AT_NEXT_GATE)

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(TURN_END)

    expect(stored.size).toBe(1)
    expect([...stored.values()]).toMatchObject([{ gate: { options: HELD_FIRST } }])
  })

  test('a conversation that moved on while the mod was not loaded draws nothing when resumed, and what was kept for it goes', async ($, on) => {
    const { stored, reads } = world($, on, announced())

    reads(AT_GATE)

    await presented($)
    await $.session.end(QUIT)

    reads(MOVED_ON)

    await $.session.start(SESSION)

    expect(await isDrawn($)).toBe(false)
    expect(stored.size).toBe(0)
  })

  test('a conversation that moved on through a call and came to rest on the same words draws nothing when resumed', async ($, on) => {
    const { reads } = world($, on, announced())

    reads(AT_GATE)

    await presented($)
    await $.session.end(QUIT)

    reads([
      ...AT_GATE,
      said('user', 'again'),
      ...called('toolu_2'),
      said('assistant', TURN_END.answer),
    ])

    await $.session.start(SESSION)

    expect(await isDrawn($)).toBe(false)
  })

  test('a resume under another session id draws the gate all the same', async ($, on) => {
    const { reads, resumesAs } = world($, on, announced())

    reads(AT_GATE)

    await presented($)
    await $.session.end(QUIT)

    resumesAs('s1')

    await $.session.start(SESSION)

    expect(await isDrawn($)).toBe(true)
  })

  test('each conversation keeps its own gate, and a resume in this process draws the resumed one’s, never the one it left', async ($, on) => {
    const { reads, engineWrites } = world($, on, announced())

    reads(AT_GATE)

    await presented($)
    await $.session.end(RESUMED)

    expect(await isDrawn($), 'the one left, still in the transcript').toBe(false)

    reads([said('user', 'what next?')])

    expect(await isDrawn($), 'the resumed one kept none').toBe(false)

    engineWrites(announced({ options: HELD_FIRST }))

    await submitFrom($, { kind: 'composer' }, 'go on')
    await $.tool.call(ENGINE_CALL)

    reads(ELSEWHERE_AT_GATE)

    await $.turn.complete(TURN_END)
    await $.session.end(RESUMED)

    reads(AT_GATE)

    const ui = await $.ui.mount(MOUNT)

    expect(await lineOf(ui, COMMIT)).toBeGreaterThan(0)
    expect(await lineOf(ui, 'Start "Billing"')).toBe(-1)

    await ui.unmount()
  })

  test('a /clear draws nothing in the new conversation, and the cleared one’s gate comes back when it is resumed', async ($, on) => {
    const { reads } = world($, on, announced())

    reads(AT_GATE)

    await presented($)
    await $.session.end(CLEARED)

    reads([])

    expect(await isDrawn($)).toBe(false)

    await $.session.end(RESUMED)

    reads(AT_GATE)

    expect(await isDrawn($)).toBe(true)
  })

  test('a transcript not there to read as the session starts is read at a later drawing', async ($, on) => {
    const { reads } = world($, on, announced())

    reads(AT_GATE)

    await presented($)
    await $.session.end(QUIT)

    reads([])

    await $.session.start(SESSION)

    expect(await isDrawn($), 'nothing to read yet').toBe(false)

    reads(AT_GATE)

    expect(await isDrawn($)).toBe(true)
  })

  test('a module loaded into a conversation at a gate, as a reload of its files does, draws the gate at its first drawing', async ($, on) => {
    const { reads } = world($, on, announced(), { kept: KEPT_AT_GATE })

    reads(AT_GATE)

    const ui = await $.ui.mount(MOUNT)

    expect(await lineOf(ui, 'Approve this task?')).toBe(2)

    await ui.unmount()
  })

  test('a turn that starts while the band is read back takes no gate from before it', async ($, on) => {
    const clock = mock.clock(on)
    let isSlow = false

    const { reads } = world($, on, announced(), {
      disk: clock,
      lag: async read => {
        if (isSlow && read === 'transcript') {
          await clock.sleep(1000)
        }
      },
    })

    reads(AT_GATE)

    await presented($)
    await $.session.end(QUIT)

    isSlow = true

    const starting = $.session.start(SESSION)

    await clock.settle()

    isSlow = false

    await submitFrom($, { kind: 'composer' }, 'yes')
    await clock.advance(1000)
    await starting

    expect(await isDrawn($)).toBe(false)
  })

  test('a load in the middle of a turn, its read-back overtaken by the turn’s end, leaves what that turn kept', async ($, on) => {
    const clock = mock.clock(on)
    let isSlow = false

    const { stored, reads, engineWrites } = world($, on, announced(), {
      disk: clock,
      lag: async read => {
        if (isSlow && read === 'store') {
          await clock.sleep(1000)
        }
      },
    })

    reads(AT_GATE)

    await presented($)
    await $.session.end(QUIT)

    reads(ANSWERED)
    isSlow = true

    const starting = $.session.start(SESSION)

    await clock.settle()

    isSlow = false
    engineWrites(announced({ options: HELD_FIRST }))
    reads(AT_NEXT_GATE)

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(TURN_END)
    await clock.advance(1000)
    await starting

    expect(stored.size).toBe(1)
    expect([...stored.values()]).toMatchObject([{ gate: { options: HELD_FIRST } }])
  })

  test('a conversation whose first call moves, as a compaction does, keeps its gate under where it stands now alone', async ($, on) => {
    const { stored, reads, engineWrites } = world($, on, announced())

    reads(AT_GATE)

    await presented($)
    await submitFrom($, { kind: 'composer' }, 'yes')

    engineWrites(announced({ options: HELD_FIRST }))
    reads([
      said('user', 'The conversation so far.'),
      ...called('toolu_2'),
      said('assistant', 'Next.'),
    ])

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(TURN_END)

    expect([...stored.keys()]).toEqual(['band:toolu_2'])
  })

  test('a transcript already holding the next conversation as one ends keeps nothing of the band for it', async ($, on) => {
    const { reads } = world($, on, announced())

    reads(AT_GATE)

    await presented($)

    reads(ELSEWHERE_AT_GATE)

    await $.session.end(RESUMED)
    await quitAndResume($)

    expect(await isDrawn($), 'nothing drawn in the next').toBe(false)

    reads(AT_GATE)

    await quitAndResume($)

    expect(await isDrawn($), 'the one that ended keeps its own').toBe(true)
  })

  test('a gate kept longer than a transcript is kept goes as a session starts, and a newer one stays', async ($, on) => {
    const [record] = Object.values(KEPT_AT_GATE)
    const { stored, clock } = world($, on, announced(), {
      kept: {
        'band:toolu_old': { ...record, keptAt: 0 },
        'band:toolu_new': { ...record, keptAt: 2 * DAY_MS },
        'band:toolu_bad': 'not a kept band',
      },
    })

    await clock.set(31 * DAY_MS)
    await $.session.start(SESSION)

    expect([...stored.keys()]).toEqual(['band:toolu_new'])
  })
})
