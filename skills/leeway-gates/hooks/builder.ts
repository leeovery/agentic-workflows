/**
 * Each task's builder and reviewers, recorded as they are dispatched: in a
 * session that announced, in a conversation the engine has marked, the main
 * loop's dispatch of the builder or a reviewer hands the agent id it answers
 * with, and the brief its pointer names, to the engine's `conversation
 * builder`, which records it on the position against the task the brief was
 * issued for, so the note a compaction ends on names the agents each task's
 * later rounds go back to. The plan's executor carries no brief, and is
 * recorded as the builder of the one task in flight. The result goes back
 * unchanged and at once, the record made after it, so whatever the engine
 * answers costs the dispatch nothing.
 */
import type { EngineInterface, On, ToolCallResult } from 'claude-code'

import { ENGINE, ENGINE_TIMEOUT_MS, MARKER, folderOf } from './folder.ts'

/** The build's agents for a task, each dispatched with its brief's pointer. */
const BUILDER = 'leeway-builder'
const REVIEWER = 'leeway-reviewer'

/** The plan's task executor, dispatched with no brief. */
const EXECUTOR = 'leeway-implementation-task-executor'

/** What a dispatch carries in place of its brief, before the brief's id. */
const POINTER = 'brief:'

/** A dispatch's prompt that is a brief's pointer alone, its id captured. */
const POINTED = new RegExp(`^${POINTER}([0-9A-Za-z]+)$`)

/**
 * Whether the session announced and the engine has marked its conversation
 * as one that runs the workflows.
 */
async function isWorkflow($: EngineInterface): Promise<boolean> {
  if ((await $.env.get('LEEWAY_GATE_SURFACE')) !== '1') {
    return false
  }

  const folder = folderOf(
    await $.env.get('LEEWAY_CONFIG_DIR'),
    await $.env.get('HOME'),
    await $.session.id(),
  )

  return folder !== null && (await $.fs.exists(`${folder}/${MARKER}`))
}

/** Records the agent where the conversation runs the workflows; a record that fails costs nothing. */
async function recordAgent($: EngineInterface, agentId: string, brief: readonly string[]) {
  try {
    if (!(await isWorkflow($))) {
      return
    }

    const root = await $.session.root()

    await $.process.run(
      ['node', `${root}/${ENGINE}`, 'conversation', 'builder', await $.session.id(), agentId, ...brief],
      { cwd: root, timeoutMs: ENGINE_TIMEOUT_MS },
    )
  } catch {}
}

/** The agent id a dispatch answered with; null where it answered none. */
function agentIdOf(dispatched: ToolCallResult<'Agent'>): string | null {
  if (dispatched.isError || dispatched.result === undefined || !('agentId' in dispatched.result)) {
    return null
  }

  return dispatched.result.agentId ?? null
}

/**
 * What a dispatch is recorded with beside its agent id: the brief its
 * pointer names, for the build's agents; nothing, for the plan's executor;
 * null for any other agent, or a build's agent carrying no pointer.
 */
function briefOf(subagentType: string | undefined, prompt: string): string[] | null {
  if (subagentType === EXECUTOR) {
    return []
  }

  const id = POINTED.exec(prompt)?.[1]

  return (subagentType === BUILDER || subagentType === REVIEWER) && id !== undefined ? ['--brief', id] : null
}

export function builder(on: On) {
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const dispatched = await next(e)
    const agentId = agentIdOf(dispatched)
    const brief = briefOf(e.subagent_type, e.prompt)

    if (brief !== null && e.agentId === undefined && agentId !== null) {
      $.clock.after(0, () => {
        void recordAgent($, agentId, brief)
      })
    }

    return dispatched
  }).catch(($, e, next) => next(e))
}
