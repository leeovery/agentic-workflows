import type { On, RenderElement, RenderInput } from 'claude-code'
import { describe, expect, test, tier, type Engine } from 'claude-code/testing'

tier('user')

/** The screens the redraw draws on: the terminal app's and the Desktop app's. */
const SURFACES = ['terminal', 'desktop'] as const

type Surface = (typeof SURFACES)[number]

/**
 * The person's home directory, as the process names it — under `/Users`,
 * since the kit's host check refuses macOS's automounted `/home`.
 */
const HOME = '/Users/person'

/** The folder of the conversation `id`, in the workflows' system config directory. */
const folderOf = (id: string) => `${HOME}/.config/workflows/conversations/${id}`

const ENGINE = 'node .claude/skills/workflow-engine/scripts/engine.cjs'

const MANIFEST_SET = `${ENGINE} manifest set payments.specification.ledger status=completed`

/** What Claude Code draws for a row the mod leaves alone. */
const ENGINE_ROW: RenderElement = { type: 'Text', children: ["Claude Code's row"] }

type Position = { name: string; phase?: string; topic?: string; task?: string }

/**
 * The world beneath the mod: the process's environment, the session's id,
 * and the files — the folders the engine `marked`, the positions kept in
 * them. A Bash call answers an empty stdout, the engine's `moves` applied to
 * the files first, as the engine writes the position while it runs. Claude
 * Code draws a ToolUse row as `ENGINE_ROW`, and a spinner as its props' word
 * and suffix; `reads` counts the position reads, `invalidations` the redraws
 * the mod asked for.
 */
function world(
  on: On,
  options: { marked?: readonly string[]; positions?: Readonly<Record<string, Position>> } = {},
) {
  const { marked = ['s0'], positions = {} } = options
  const files = new Map<string, string>([
    ...marked.map(id => [`${folderOf(id)}/workflow`, ''] as const),
    ...Object.entries(positions).map(
      ([id, position]) => [`${folderOf(id)}/position.json`, JSON.stringify(position)] as const,
    ),
  ])
  const counts = { reads: 0, invalidations: 0 }
  let sessionId = 's0'
  let moves: (() => void) | null = null

  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? HOME : undefined }))
  on('session.id', () => ({ value: sessionId }))
  on('fs.exists', ($, e) => ({ value: files.has(e.path) }))

  on('fs.read', ($, e) => {
    if (e.path.endsWith('/position.json')) {
      counts.reads += 1
    }

    const text = files.get(e.path)

    if (text === undefined) {
      throw new Error(`ENOENT: ${e.path}`)
    }

    return { value: text }
  })

  on('tool.call', { tool: 'Bash' }, ($, e) => {
    moves?.()

    return { result: { stdout: '', stderr: '', interrupted: false } }
  })

  on('ui.render', { component: 'ToolUse' }, () => ENGINE_ROW)

  on('ui.render', { component: 'Spinner' }, ($, e) => ({
    type: 'Text',
    children: [`${e.props.word}${e.props.suffix}`],
  }))

  on('ui.invalidate', ($, e, next) => {
    counts.invalidations += 1

    return next(e)
  })

  return {
    counts,
    /** The engine marking the conversation `id` as one that runs the workflows. */
    marks(id: string) {
      files.set(`${folderOf(id)}/workflow`, '')
    },
    /** The engine's calls that move the position, each placing the conversation at `position`. */
    places(position: Position) {
      moves = () => files.set(`${folderOf(sessionId)}/position.json`, JSON.stringify(position))
    },
    resumesAs(id: string) {
      sessionId = id
    },
  }
}

/** A ToolUse row on `surface`. */
const rowOf = (
  surface: Surface,
  input: unknown,
  props: Partial<RenderInput<'ToolUse', Surface>['props']> = {},
  columns = 80,
): RenderInput<'ToolUse', Surface> => ({
  surface,
  component: 'ToolUse',
  requestId: 'toolu_1',
  viewport: { columns, rows: 24 },
  props: {
    tool_use_id: 'toolu_1',
    tool: 'Bash',
    input,
    isRunning: false,
    isErrored: false,
    isInterrupted: false,
    ...props,
  },
})

/** The spinner on `surface`, its word as Claude Code sampled it. */
const spinnerOf = (surface: Surface, word = surface === 'desktop' ? 'Working' : 'Sauteing') =>
  ({
    surface,
    component: 'Spinner',
    requestId: 'main',
    props: { word, message: null, suffix: '…', mode: 'thinking' },
  }) as RenderInput<'Spinner', Surface>

/** The text an element shows, its children's joined. */
function textOf(element: unknown): string {
  if (typeof element === 'string') {
    return element
  }

  const { children } = (element ?? {}) as { children?: unknown }

  if (Array.isArray(children)) {
    return children.map(textOf).join('')
  }

  return typeof children === 'string' ? children : ''
}

/** The props of the marker an engine call's row draws. */
function markerProps(element: unknown): unknown {
  const [marker] = ((element as { children?: unknown[] }).children ?? []) as { props?: unknown }[]

  return marker?.props ?? {}
}

async function drawn($: Engine, input: RenderInput): Promise<unknown> {
  return $.ui.render(input)
}

describe('an engine call\'s row', () => {
  for (const surface of SURFACES) {
    test(`draws as the call it is, on one line — ${surface}`, async ($, on) => {
      world(on)

      expect(textOf(await drawn($, rowOf(surface, { command: MANIFEST_SET })))).toBe(
        '▪ manifest set · payments.specification.ledger status=completed',
      )
      expect(
        textOf(await drawn($, rowOf(surface, { command: `${ENGINE} render epic-menu`, description: 'Render the menu' }))),
      ).toBe('▪ render epic-menu')
    })

    test(`is cut to the row's width — ${surface}`, async ($, on) => {
      world(on)

      const row = await drawn($, rowOf(surface, { command: MANIFEST_SET }, {}, 30))

      expect(textOf(row)).toBe('▪ manifest set · payments.spe…')
      expect((row as { props?: unknown }).props).toEqual({ wrap: 'truncate-end' })
    })

    test(`its marker says how the call stands: dim while it runs, the error colour where it errored or was cut — ${surface}`, async ($, on) => {
      world(on)

      const command = { command: MANIFEST_SET }

      expect(markerProps(await drawn($, rowOf(surface, command)))).toEqual({})
      expect(markerProps(await drawn($, rowOf(surface, command, { isRunning: true })))).toEqual({ dimColor: true })
      expect(markerProps(await drawn($, rowOf(surface, command, { isErrored: true })))).toEqual({ color: 'error' })
      expect(markerProps(await drawn($, rowOf(surface, command, { isInterrupted: true })))).toEqual({ color: 'error' })
    })

    test(`any other command, a call run beside another, and an unmarked conversation draw as Claude Code does — ${surface}`, async ($, on) => {
      const { resumesAs } = world(on)

      for (const command of ['git status', `${MANIFEST_SET} && git status`, `${MANIFEST_SET} 2>&1`]) {
        expect(await drawn($, rowOf(surface, { command })), command).toEqual(ENGINE_ROW)
      }

      expect(await drawn($, rowOf(surface, {})), 'no command').toEqual(ENGINE_ROW)

      resumesAs('s9')

      expect(await drawn($, rowOf(surface, { command: MANIFEST_SET })), 'unmarked').toEqual(ENGINE_ROW)
    })
  }

  test('a surface other than the terminal app\'s or the Desktop app\'s draws as Claude Code does', async ($, on) => {
    world(on)

    for (const surface of ['vscode', 'mobile'] as const) {
      expect(
        await $.ui.render({ ...rowOf('terminal', { command: MANIFEST_SET }), surface } as RenderInput),
        surface,
      ).toEqual(ENGINE_ROW)
    }
  })

  test('a conversation the engine marks later draws its calls from then on', async ($, on) => {
    const { marks } = world(on, { marked: [] })

    expect(await drawn($, rowOf('terminal', { command: MANIFEST_SET }))).toEqual(ENGINE_ROW)

    marks('s0')

    expect(textOf(await drawn($, rowOf('terminal', { command: MANIFEST_SET })))).toMatch(/^▪ manifest set/)
  })
})

describe('the spinner', () => {
  for (const surface of SURFACES) {
    test(`says the phase the conversation works in, the ellipsis Claude Code's — ${surface}`, async ($, on) => {
      world(on, { positions: { s0: { name: 'pay', phase: 'discussion', topic: 'ledger' } } })

      expect(textOf(await drawn($, spinnerOf(surface)))).toBe('Discussing…')
    })

    test(`in implementation, the task in flight with it — ${surface}`, async ($, on) => {
      world(on, { positions: { s0: { name: 'pay', phase: 'implementation', topic: 'ledger', task: '2.3' } } })

      expect(textOf(await drawn($, spinnerOf(surface)))).toBe('Implementing task 2.3…')
    })

    test(`keeps Claude Code's word with no position, at a work unit's menu, and in an unmarked conversation — ${surface}`, async ($, on) => {
      const { places, resumesAs } = world(on, { positions: { s9: { name: 'pay', phase: 'discussion', topic: 'ledger' } } })
      const word = spinnerOf(surface).props.word

      expect(textOf(await drawn($, spinnerOf(surface))), 'no position').toBe(`${word}…`)

      places({ name: 'pay' })
      await $.tool.call({ tool: 'Bash', command: `${ENGINE} session label pay` })

      expect(textOf(await drawn($, spinnerOf(surface))), 'a work unit\'s menu').toBe(`${word}…`)

      resumesAs('s9')

      expect(textOf(await drawn($, spinnerOf(surface))), 'unmarked').toBe(`${word}…`)
    })

    test(`reads the position once for each conversation it draws in, and again when an engine call moves it — ${surface}`, async ($, on) => {
      const { counts, places } = world(on, { positions: { s0: { name: 'pay', phase: 'discussion', topic: 'ledger' } } })

      await drawn($, spinnerOf(surface))
      await drawn($, spinnerOf(surface))
      await $.tool.call({ tool: 'Bash', command: `${ENGINE} manifest get pay status` })

      expect(counts.reads).toBe(1)

      places({ name: 'pay', phase: 'specification', topic: 'ledger' })
      await $.tool.call({ tool: 'Bash', command: `${ENGINE} session label pay specification ledger` })

      expect(counts.reads).toBe(2)
      expect(counts.invalidations).toBe(1)
      expect(textOf(await drawn($, spinnerOf(surface)))).toBe('Specifying…')
      expect(counts.reads).toBe(2)
    })
  }

  test('a call that leaves the word as it was asks for no redraw, and a subagent\'s call reads nothing', async ($, on) => {
    const { counts } = world(on, { positions: { s0: { name: 'pay', phase: 'discussion', topic: 'ledger' } } })

    await drawn($, spinnerOf('terminal'))
    await $.tool.call({ tool: 'Bash', command: `${ENGINE} session label pay discussion ledger` })

    expect([counts.reads, counts.invalidations]).toEqual([2, 0])

    const inSubagent = { tool: 'Bash' as const, command: `${ENGINE} task start pay ledger ledger-2-3`, agentId: 'a1' }

    await $.tool.call(inSubagent)

    expect(counts.reads).toBe(2)
  })

  test('each phase and project-level place says its own work', async ($, on) => {
    const { places } = world(on)
    const cases: [Position, string][] = [
      [{ name: 'pay', phase: 'discovery', topic: 'pay' }, 'Shaping'],
      [{ name: 'pay', phase: 'research', topic: 'ledger' }, 'Researching'],
      [{ name: 'pay', phase: 'experiment', topic: 'ledger' }, 'Experimenting'],
      [{ name: 'pay', phase: 'investigation', topic: 'pay' }, 'Investigating'],
      [{ name: 'pay', phase: 'scoping', topic: 'pay' }, 'Scoping'],
      [{ name: 'pay', phase: 'planning', topic: 'ledger' }, 'Planning'],
      [{ name: 'pay', phase: 'implementation', topic: 'ledger' }, 'Implementing'],
      [{ name: 'pay', phase: 'review', topic: 'ledger' }, 'Reviewing'],
      [{ name: 'roadmap' }, 'Roadmapping'],
      [{ name: 'baseline' }, 'Assessing'],
      [{ name: 'pay', phase: 'deploying', topic: 'ledger' }, 'Sauteing'],
    ]

    for (const [position, word] of cases) {
      places(position)
      await $.tool.call({ tool: 'Bash', command: `${ENGINE} session label ${position.name}` })

      expect(textOf(await drawn($, spinnerOf('terminal'))), JSON.stringify(position)).toBe(`${word}…`)
    }
  })

  test('on the Desktop app, a step that names itself keeps its words', async ($, on) => {
    world(on, { positions: { s0: { name: 'pay', phase: 'discussion', topic: 'ledger' } } })

    expect(textOf(await drawn($, spinnerOf('desktop', 'Creating notes.md')))).toBe('Creating notes.md…')
    expect(textOf(await drawn($, spinnerOf('desktop')))).toBe('Discussing…')
  })
})
