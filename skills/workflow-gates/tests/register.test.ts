import type { On, RenderElement, RenderInput, RenderSurface } from 'claude-code'
import { describe, expect, test, tier, type Engine } from 'claude-code/testing'

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

const OPTIONS = [
  {
    key: 'y',
    word: 'yes',
    head: 'Commit and continue to next task',
    tail: null,
    struck: false,
    recommended: true,
  },
  {
    key: '2',
    word: null,
    head: 'Continue "Auth"',
    tail: 'discussion',
    struck: true,
    recommended: false,
  },
]

/** An epic menu: a topic another session holds above the one recommended. */
const HELD_FIRST = [
  {
    key: '1',
    word: null,
    head: 'Continue "Auth"',
    tail: 'discussion',
    struck: true,
    recommended: false,
  },
  {
    key: '2',
    word: null,
    head: 'Start "Billing"',
    tail: 'research',
    struck: false,
    recommended: false,
  },
  {
    key: '3',
    word: null,
    head: 'Continue "Search"',
    tail: 'specification',
    struck: false,
    recommended: true,
  },
]

const TYPED = [
  { label: 'Comment', description: 'Request changes (triggers a fix round)' },
]

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

/** An engine response stating a gate, as the surface announces it. */
function announced(
  options: readonly unknown[] = OPTIONS,
  after: readonly string[] = [],
): string {
  return [
    ...RESULT_SECTION,
    GATE_LINE,
    JSON.stringify({
      gate: 'task gate',
      question: 'Approve this task?',
      options,
      typed: TYPED,
    }),
    ...MENU_SECTION,
    ...after,
  ].join('\n')
}

/** The call the workflows make at a gate; the mod never reads the command. */
const ENGINE_CALL = {
  tool: 'Bash' as const,
  command: 'node .claude/skills/workflow-engine/scripts/engine.cjs render task-gate auth.implementation.auth-flow',
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
 * what a Bash call answers, and the prompts the mod submits.
 *
 * `calls` is what the mod asked of it, in order; `submits: false` takes the
 * submission but never lands it, which is the submit that fails. A submission
 * enters as core answers one, under the origin it arrived with;
 * `engineWrites` changes what the next Bash call answers.
 *
 * @param on the test's `on`
 * @param stdout what the engine wrote
 * @param options the surfaces attached, and whether a submission lands
 */
function world(
  on: On,
  stdout = '',
  options: { surfaces?: readonly RenderSurface[]; submits?: boolean } = {},
) {
  const { surfaces = ['terminal'], submits = true } = options

  const calls: string[] = []
  const submitted: string[] = []
  const written: { name: string; value?: string }[] = []

  let output = stdout

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: surfaces }))
  on('ui.render', () => BENEATH)
  on('ui.message', () => ({}))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))

  on('ui.invalidate', () => {
    calls.push('invalidate')

    return { value: undefined }
  })

  on('env.set', ($, e) => {
    written.push({ name: e.name, value: e.value })

    return { value: undefined }
  })

  on('prompt.submit', ($, e) => {
    calls.push(`submit ${e.text}`)
    submitted.push(e.text)

    if (!submits) {
      throw new Error('the prompt could not be sent')
    }

    return { text: e.text, origin: e.origin }
  })

  on('tool.call', { tool: 'Bash' }, () => ({
    result: { stdout: output, stderr: '', interrupted: false },
  }))

  const engineWrites = (next: string) => {
    output = next
  }

  return { calls, submitted, written, engineWrites }
}

/** A gate rendered in a main-conversation turn that has since ended. */
async function presented($: Engine) {
  await $.session.start(SESSION)
  await $.tool.call(ENGINE_CALL)
  await $.turn.complete(TURN_END)
}

/** The Bash result's own record, which is what the mod answers with. */
function stdoutOf(result: { result?: unknown }): string {
  return (result.result as { stdout: string }).stdout
}

describe('register', () => {
  test('the session announces the gate surface to every child it starts', async ($, on) => {
    const { written } = world(on)

    await $.session.start(SESSION)

    expect(written).toEqual([{ name: 'WORKFLOWS_GATE_SURFACE', value: '1' }])
  })

  test('a stated gate is cut out of what the model reads, the rest left alone', async ($, on) => {
    world(on, announced())

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(ENGINE_CALL))).toBe(
      [...RESULT_SECTION, ...DRAWN_MENU].join('\n'),
    )
  })

  test('a section under the menu stands where the menu stood', async ($, on) => {
    const after = ['=== DISPLAY: what follows (emit verbatim) ===', 'Still here.']
    world(on, announced(OPTIONS, after))

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(ENGINE_CALL))).toBe(
      [...RESULT_SECTION, ...DRAWN_MENU.slice(0, 2), ...after].join('\n'),
    )
  })

  test('output stating no gate is answered as it came', async ($, on) => {
    const plain = [...RESULT_SECTION, ...MENU_SECTION].join('\n')
    world(on, plain)

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(ENGINE_CALL))).toBe(plain)
  })

  test('a menu with no pressable row stays text', async ($, on) => {
    world(on, announced([]))

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(ENGINE_CALL))).toBe(announced([]))
  })

  test('with no terminal attached the model prints the menu itself', async ($, on) => {
    world(on, announced(), { surfaces: ['vscode'] })

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(ENGINE_CALL))).toBe(announced())
  })

  test("a subagent's gate stays text, and nothing is armed", async ($, on) => {
    const { calls } = world(on, announced())

    await $.session.start(SESSION)

    expect(stdoutOf(await $.tool.call(SUBAGENT_CALL))).toBe(announced())

    await $.turn.complete(TURN_END)

    expect(calls).toEqual([])
    expect(await $.ui.render(DRAWING)).toEqual(BENEATH)
  })

  test('the gate waits for the turn to end before it draws', async ($, on) => {
    const { calls } = world(on, announced())

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

  test('an interrupted turn still leaves the person at the gate', async ($, on) => {
    world(on, announced())

    await $.session.start(SESSION)
    await $.tool.call(ENGINE_CALL)
    await $.turn.complete({ ...TURN_END, reason: 'aborted', isAborted: true })

    expect(await $.ui.render(DRAWING)).not.toEqual(BENEATH)
  })

  test("a subagent's turn ending draws nothing; the conversation's does", async ($, on) => {
    const { calls } = world(on, announced())

    await $.session.start(SESSION)
    await $.tool.call(ENGINE_CALL)
    await $.turn.complete({ ...TURN_END, turnId: 't1', agentId: 'a1' })

    expect(calls).toEqual([])
    expect(await $.ui.render(DRAWING)).toEqual(BENEATH)

    await $.turn.complete(TURN_END)

    expect(await $.ui.render(DRAWING)).not.toEqual(BENEATH)
  })

  test('a drawn gate puts its rows in the band, over what was there', async ($, on) => {
    world(on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    expect(await ui.find({ type: 'Client', key: 'gate' })).toMatchObject({
      props: { module: 'hooks/board.ts', width: 72, height: 6 },
    })

    expect(await ui.find({ text: '? for shortcuts' })).toBeDefined()
    expect(await ui.find({ in: 'gate', text: 'Approve this task?' })).toBeDefined()
    expect(await ui.find({ in: 'gate', text: 'yes' })).toBeDefined()

    const typed = await ui.findAll({
      type: 'Text',
      in: 'gate',
      text: TYPED[0]?.description,
    })

    expect(typed.at(-1), 'a typed row draws dim').toMatchObject({
      props: { dimColor: true },
    })

    expect(await ui.findAll({ type: 'Button', in: 'gate' })).toEqual([])

    await ui.unmount()
  })

  test('the band yields to a survey', async ($, on) => {
    world(on, announced())

    await presented($)

    const drawn = await $.ui.render({
      ...DRAWING,
      props: { ...BAND, hasSurvey: true },
    })

    expect(drawn).toEqual(BENEATH)
  })

  test('pressing a row submits its word, and the gate goes once it lands', async ($, on) => {
    const { calls, submitted } = world(on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    calls.length = 0

    await ui.key({ key: 'return', in: 'gate' })

    expect(submitted, 'Enter takes the row the cursor is on').toEqual(['yes'])

    expect(calls, 'the band is redrawn after the answer is in, never before').toEqual([
      'submit yes',
      'invalidate',
    ])

    await ui.redraw()

    expect(await ui.find({ type: 'Client', key: 'gate' })).toBeUndefined()

    await ui.unmount()
  })

  test('a submission that fails leaves the row there to press again', async ($, on) => {
    const { calls } = world(on, announced(), { submits: false })

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    calls.length = 0

    await ui.key({ key: 'return', in: 'gate' })

    expect(calls, 'the answer was put, and nothing cleared behind it').toEqual([
      'submit yes',
    ])

    await ui.redraw()

    expect(await ui.find({ type: 'Client', key: 'gate' })).toBeDefined()

    await ui.unmount()
  })

  test('the arrows move the cursor, and Enter takes the row it is on', async ($, on) => {
    const { submitted } = world(on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'down', in: 'gate' })
    await ui.key({ key: 'return', in: 'gate' })

    expect(submitted).toEqual(['2'])

    await ui.unmount()
  })

  test('Enter on arrival takes the recommended row, never a held one above it', async ($, on) => {
    const { submitted } = world(on, announced(HELD_FIRST))

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'return', in: 'gate' })

    expect(submitted).toEqual(['3'])

    await ui.unmount()
  })

  test('a redraw of the same gate leaves the cursor where the person put it', async ($, on) => {
    const { submitted } = world(on, announced(HELD_FIRST))

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'up', in: 'gate' })
    await ui.redraw({ ...BAND, scroll: { offset: 4, bodyRows: 12 } })
    await ui.key({ key: 'return', in: 'gate' })

    expect(submitted).toEqual(['2'])

    await ui.unmount()
  })

  test("another gate on the same board starts the cursor by its own rows", async ($, on) => {
    const { submitted, engineWrites } = world(on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: 'down', in: 'gate' })

    engineWrites(announced(HELD_FIRST))

    await $.tool.call(ENGINE_CALL)
    await $.turn.complete(TURN_END)
    await ui.redraw()
    await ui.key({ key: 'return', in: 'gate' })

    expect(submitted).toEqual(['3'])

    await ui.unmount()
  })

  test("a row's own key presses it, and one with no word answers as its key", async ($, on) => {
    const { submitted } = world(on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.key({ key: '2', in: 'gate' })

    expect(submitted).toEqual(['2'])

    await ui.unmount()
  })

  test('a click lands on the row under it, wrapped lines included', async ($, on) => {
    const { submitted } = world(on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.pointer({ type: 'down', x: 4, y: 4, button: 'left', in: 'gate' })

    expect(submitted, 'the second row sits one line under the first').toEqual(['2'])

    await ui.unmount()
  })

  test('a post naming no row of the gate on screen submits nothing', async ($, on) => {
    const { submitted } = world(on, announced())

    await presented($)

    const ui = await $.ui.mount(MOUNT)

    await ui.post({ answer: 'sudo rm -rf /' }, { in: 'gate' })

    expect(submitted).toEqual([])

    await ui.unmount()
  })

  test('the turn that answers the gate takes it off the band', async ($, on) => {
    world(on, announced())

    await presented($)
    await $.turn.start({ text: 'yes', turnId: 't1' })

    expect(await $.ui.render(DRAWING)).toEqual(BENEATH)
  })

  test('a gate still armed when a turn begins never draws', async ($, on) => {
    world(on, announced())

    await $.session.start(SESSION)
    await $.tool.call(ENGINE_CALL)
    await $.turn.start({ text: 'yes', turnId: 't1' })
    await $.turn.complete({ ...TURN_END, turnId: 't1' })

    expect(await $.ui.render(DRAWING)).toEqual(BENEATH)
  })
})
