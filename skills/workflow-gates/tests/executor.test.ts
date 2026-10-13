import type { On } from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'

tier('user')

/**
 * The person's home directory, as the process names it — under `/Users`,
 * since the kit's host check refuses macOS's automounted `/home`.
 */
const HOME = '/Users/person'

/** The workflows' system config directory where the process names none. */
const DEFAULT_CONFIG = `${HOME}/.config/workflows`

/** The session's project. */
const ROOT = '/Users/person/app'

const ENGINE = `${ROOT}/.claude/skills/workflow-engine/scripts/engine.cjs`

const EXECUTOR = 'workflow-implementation-task-executor'

/** The announcement a session the mod applies to carries from its start. */
const ANNOUNCED = { WORKFLOWS_GATE_SURFACE: '1' }

/** A foreground dispatch's answer: the agent ran to its end. */
const COMPLETED = {
  status: 'completed' as const,
  agentId: 'aa76bd7f82a2ef3e4',
  content: [{ type: 'text' as const, text: 'STATUS: complete' }],
  totalToolUseCount: 12,
  totalDurationMs: 90_000,
  totalTokens: 40_000,
  usage: {
    input_tokens: 30_000,
    output_tokens: 10_000,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: null,
    server_tool_use: null,
    service_tier: null,
    cache_creation: null,
  },
  prompt: 'Implement task 2.3.',
}

/** A background dispatch's answer: the agent launched. */
const LAUNCHED = {
  status: 'async_launched' as const,
  agentId: 'ab12cd34ef56ab78c',
  description: 'Implement task 2.3',
  prompt: 'Implement task 2.3.',
  outputFile: '/tmp/agent-output',
}

/** The engine's run that records an executor, by its agent id. */
const recording = (agentId: string) => ({
  argv: ['node', ENGINE, 'conversation', 'executor', 's0', agentId],
  cwd: ROOT,
  timeoutMs: 15_000,
})

/**
 * The world beneath the mod: its environment (announced unless told
 * otherwise), the session's id and project, the folders the engine `marked`
 * under the config directory `markedIn`, what the Agent tool answers
 * (`answer`), and whether the engine's run fails to start
 * (`engineUnstartable`). `runs` records each run the mod asked for.
 */
function world(
  on: On,
  options: {
    env?: Readonly<Record<string, string>>
    marked?: readonly string[]
    markedIn?: string
    answer?:
      | { result: typeof COMPLETED | typeof LAUNCHED }
      | { deny: string }
      | { isError: true; result: string; text: string }
    engineUnstartable?: boolean
  } = {},
) {
  const {
    env = ANNOUNCED,
    marked = ['s0'],
    markedIn = DEFAULT_CONFIG,
    answer = { result: COMPLETED },
    engineUnstartable = false,
  } = options
  const runs: { argv: readonly string[]; cwd?: string; timeoutMs?: number }[] = []
  const environment: Record<string, string> = { HOME, ...env }

  on('env.get', ($, e) => ({ value: environment[e.name] }))
  on('session.id', () => ({ value: 's0' }))
  on('session.root', () => ({ value: ROOT }))
  on('fs.exists', ($, e) => ({
    value: marked.some(id => e.path === `${markedIn}/conversations/${id}/workflow`),
  }))

  on('process.run', ($, e) => {
    runs.push({ argv: e.argv, cwd: e.init?.cwd, timeoutMs: e.init?.timeoutMs })

    if (engineUnstartable) {
      throw new Error('spawn node ENOENT')
    }

    return {
      value: { exitCode: 0, stdout: '{"ok":true,"recorded":true}\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }
  })

  on('tool.call', { tool: 'Agent' }, () => answer)

  return runs
}

const dispatchOf = (subagent_type: string | undefined, over: { agentId?: string } = {}) => ({
  tool: 'Agent' as const,
  description: 'Implement task 2.3',
  prompt: 'Implement task 2.3.',
  ...(subagent_type === undefined ? {} : { subagent_type }),
  ...over,
})

describe('the task executor, recorded as it is dispatched', () => {
  for (const dispatch of [COMPLETED, LAUNCHED]) {
    test(`hands the engine the agent id the dispatch answered with — ${dispatch.status}`, async ($, on) => {
      const runs = world(on, { answer: { result: dispatch } })

      expect(await $.tool.call(dispatchOf(EXECUTOR))).toEqual({ result: dispatch })
      expect(runs).toEqual([recording(dispatch.agentId)])
    })
  }

  test('finds the conversation in the config directory the process names, never under the home directory', async ($, on) => {
    const config = '/Users/person/state/workflows'
    const runs = world(on, { env: { ...ANNOUNCED, WORKFLOWS_CONFIG_DIR: config }, markedIn: config })

    await $.tool.call(dispatchOf(EXECUTOR))

    expect(runs).toEqual([recording(COMPLETED.agentId)])
  })

  test('an engine that cannot start leaves the dispatch\'s result as Claude Code answered it', async ($, on) => {
    const runs = world(on, { engineUnstartable: true })

    expect(await $.tool.call(dispatchOf(EXECUTOR))).toEqual({ result: COMPLETED })
    expect(runs.length, 'the mod asked once').toBe(1)
  })
})

describe('what records nothing, the dispatch\'s result as Claude Code answered it', () => {
  for (const type of ['workflow-implementation-task-reviewer', 'general-purpose', undefined]) {
    test(`another agent — ${type ?? 'no type named'}`, async ($, on) => {
      const runs = world(on)

      expect(await $.tool.call(dispatchOf(type))).toEqual({ result: COMPLETED })
      expect(runs).toEqual([])
    })
  }

  for (const answer of [{ deny: 'not now' }, { isError: true as const, result: 'Agent failed', text: 'Agent failed' }]) {
    test(`a dispatch that was refused or errored — ${JSON.stringify(answer)}`, async ($, on) => {
      const runs = world(on, { answer })

      expect(await $.tool.call(dispatchOf(EXECUTOR))).toEqual(answer)
      expect(runs).toEqual([])
    })
  }

  test('a dispatch a subagent made', async ($, on) => {
    const runs = world(on)

    expect(await $.tool.call(dispatchOf(EXECUTOR, { agentId: 'a1' }))).toEqual({ result: COMPLETED })
    expect(runs).toEqual([])
  })

  for (const env of [{}, { WORKFLOWS_GATE_SURFACE: '0' }] as Readonly<Record<string, string>>[]) {
    test(`a session that did not announce — ${JSON.stringify(env)}`, async ($, on) => {
      const runs = world(on, { env })

      expect(await $.tool.call(dispatchOf(EXECUTOR))).toEqual({ result: COMPLETED })
      expect(runs).toEqual([])
    })
  }

  test('a conversation the engine has not marked', async ($, on) => {
    const runs = world(on, { marked: [] })

    expect(await $.tool.call(dispatchOf(EXECUTOR))).toEqual({ result: COMPLETED })
    expect(runs).toEqual([])
  })

  test('a process that names no folder', async ($, on) => {
    const runs = world(on, { env: { ...ANNOUNCED, HOME: '' } })

    await $.tool.call(dispatchOf(EXECUTOR))

    expect(runs).toEqual([])
  })
})
