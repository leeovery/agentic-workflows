import type { On, RenderInput } from 'claude-code'
import { describe, expect, test, tier, type Engine } from 'claude-code/testing'

tier('user')

/** The screens the spinner draws on: the terminal app's and the Desktop app's. */
const SURFACES = ['terminal', 'desktop'] as const

type Surface = (typeof SURFACES)[number]

/**
 * The person's home directory, as the process names it — under `/Users`,
 * since the kit's host check refuses macOS's automounted `/home`.
 */
const HOME = '/Users/person'

/** The workflows' system config directory where the process names none. */
const DEFAULT_CONFIG = `${HOME}/.config/workflows`

const ENGINE = 'node .claude/skills/workflow-engine/scripts/engine.cjs'

type Position = { name: string; phase?: string; topic?: string; task?: string }

/** The announcement a session the mod applies to carries from its start. */
const ANNOUNCED = { WORKFLOWS_GATE_SURFACE: '1' }

/**
 * The world beneath the mod: the process's environment (announced unless
 * told otherwise), the session's id, and the files — the folders the engine
 * `marked` under the config directory `markedIn`, the positions kept in
 * them. A Bash call answers an empty stdout,
 * the engine's `moves` applied to the files first, as the engine marks the
 * conversation and writes or drops the position while it runs. Claude Code
 * draws a spinner as its props' word and suffix; `reads` counts the position
 * reads, `invalidations` the redraws the mod asked for; `handsOffAs` is a
 * handoff's clear, the conversation going on as another whose folder holds
 * only what the handoff sent.
 */
function world(
  on: On,
  options: {
    env?: Readonly<Record<string, string>>
    marked?: readonly string[]
    markedIn?: string
    positions?: Readonly<Record<string, Position>>
  } = {},
) {
  const { env = ANNOUNCED, marked = ['s0'], markedIn = DEFAULT_CONFIG, positions = {} } = options
  const folderOf = (id: string) => `${markedIn}/conversations/${id}`
  const environment: Record<string, string> = { HOME, ...env }
  const files = new Map<string, string>([
    ...marked.map(id => [`${folderOf(id)}/workflow`, ''] as const),
    ...Object.entries(positions).map(
      ([id, position]) => [`${folderOf(id)}/position.json`, JSON.stringify(position)] as const,
    ),
  ])
  const counts = { reads: 0, invalidations: 0 }
  let sessionId = 's0'
  let moves: (() => void) | null = null

  on('env.get', ($, e) => ({ value: environment[e.name] }))
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

  on('ui.render', { component: 'Spinner' }, ($, e) => ({
    type: 'Text',
    children: [`${e.props.word}${e.props.suffix}`],
  }))

  on('ui.invalidate', ($, e, next) => {
    counts.invalidations += 1

    return next(e)
  })

  on('session.end', ($, e) => ({ sessionId: e.sessionId }))

  return {
    counts,
    /** The engine's calls that move the position, each placing the conversation at `position`. */
    places(position: Position) {
      moves = () => {
        files.set(`${folderOf(sessionId)}/workflow`, '')
        files.set(`${folderOf(sessionId)}/position.json`, JSON.stringify(position))
      }
    },
    /** The engine's calls that move the position, each dropping it — the start menu is no position. */
    drops() {
      moves = () => {
        files.delete(`${folderOf(sessionId)}/position.json`)
      }
    },
    resumesAs(id: string) {
      sessionId = id
    },
    async handsOffAs(engine: Engine, id: string) {
      await engine.session.end({ reason: 'clear', sessionId, resume: { id: sessionId } })
      sessionId = id
      files.set(`${folderOf(id)}/sent.json`, JSON.stringify({ answer: 'Invoke `/workflow-roadmap open`.', line: '→ Roadmap' }))
    },
  }
}

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

async function drawn($: Engine, input: RenderInput): Promise<unknown> {
  return $.ui.render(input)
}

describe('the spinner', () => {
  for (const surface of SURFACES) {
    test(`says the phase the conversation works in, the ellipsis Claude Code's — ${surface}`, async ($, on) => {
      world(on, { positions: { s0: { name: 'pay', phase: 'discussion', topic: 'ledger' } } })

      expect(textOf(await drawn($, spinnerOf(surface)))).toBe('Discussing…')
    })

    test(`finds the conversation in the config directory the process names, never under the home directory — ${surface}`, async ($, on) => {
      const config = '/Users/person/state/workflows'

      world(on, {
        env: { ...ANNOUNCED, WORKFLOWS_CONFIG_DIR: config },
        markedIn: config,
        positions: { s0: { name: 'pay', phase: 'discussion', topic: 'ledger' } },
      })

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

  for (const command of ['boot', 'session repair']) {
    test(`arriving at the start menu through \`${command}\` gives the word back to Claude Code`, async ($, on) => {
      const { counts, drops } = world(on, { positions: { s0: { name: 'pay', phase: 'discussion', topic: 'ledger' } } })

      expect(textOf(await drawn($, spinnerOf('terminal')))).toBe('Discussing…')

      drops()
      await $.tool.call({ tool: 'Bash', command: `${ENGINE} ${command}` })

      expect(textOf(await drawn($, spinnerOf('terminal')))).toBe('Sauteing…')
      expect([counts.reads, counts.invalidations]).toEqual([2, 1])
    })
  }

  test('a task\'s completion takes it off the word, its implementation kept', async ($, on) => {
    const { places } = world(on, { positions: { s0: { name: 'pay', phase: 'implementation', topic: 'ledger', task: '2.3' } } })

    expect(textOf(await drawn($, spinnerOf('terminal')))).toBe('Implementing task 2.3…')

    places({ name: 'pay', phase: 'implementation', topic: 'ledger' })
    await $.tool.call({ tool: 'Bash', command: `${ENGINE} task complete pay ledger ledger-2-3 --next-task ~` })

    expect(textOf(await drawn($, spinnerOf('terminal')))).toBe('Implementing…')

    places({ name: 'pay', phase: 'implementation', topic: 'ledger', task: '2.4' })
    await $.tool.call({ tool: 'Bash', command: `${ENGINE} task start pay ledger ledger-2-4` })

    expect(textOf(await drawn($, spinnerOf('terminal')))).toBe('Implementing task 2.4…')
  })

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

  for (const surface of SURFACES) {
    test(`across a handoff's clear, Claude Code's word until the new conversation records its place, then its work — ${surface}`, async ($, on) => {
      const { places, handsOffAs } = world(on, { positions: { s0: { name: 'pay', phase: 'discussion', topic: 'ledger' } } })
      const word = spinnerOf(surface).props.word

      expect(textOf(await drawn($, spinnerOf(surface)))).toBe('Discussing…')

      await handsOffAs($, 's1')

      expect(textOf(await drawn($, spinnerOf(surface))), 'the new conversation, before its first call').toBe(`${word}…`)

      places({ name: 'roadmap' })
      await $.tool.call({ tool: 'Bash', command: `${ENGINE} session label roadmap` })

      expect(textOf(await drawn($, spinnerOf(surface))), 'its first call, the label').toBe('Roadmapping…')
    })
  }

  for (const env of [{}, { WORKFLOWS_GATE_SURFACE: '0' }] as Readonly<Record<string, string>>[]) {
    test(`keeps Claude Code's word in a session that did not announce, reading nothing — ${JSON.stringify(env)}`, async ($, on) => {
      const { counts, places } = world(on, { env, positions: { s0: { name: 'pay', phase: 'discussion', topic: 'ledger' } } })

      expect(textOf(await drawn($, spinnerOf('terminal')))).toBe('Sauteing…')

      places({ name: 'pay', phase: 'specification', topic: 'ledger' })
      await $.tool.call({ tool: 'Bash', command: `${ENGINE} session label pay specification ledger` })

      expect(textOf(await drawn($, spinnerOf('terminal')))).toBe('Sauteing…')
      expect([counts.reads, counts.invalidations]).toEqual([0, 0])
    })
  }

  test('on the Desktop app, a step that names itself keeps its words', async ($, on) => {
    world(on, { positions: { s0: { name: 'pay', phase: 'discussion', topic: 'ledger' } } })

    expect(textOf(await drawn($, spinnerOf('desktop', 'Creating notes.md')))).toBe('Creating notes.md…')
    expect(textOf(await drawn($, spinnerOf('desktop')))).toBe('Discussing…')
  })
})
