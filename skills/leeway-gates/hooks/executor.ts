/**
 * The implementation task's executor, recorded as it is dispatched: in a
 * session that announced, in a conversation the engine has marked, the main
 * loop's dispatch of the task executor hands the agent id it answers with to
 * the engine's `conversation executor`, which puts it on the position beside
 * the task in flight, so the note a compaction ends on names the executor the
 * task's later rounds continue. The result goes back unchanged and at once,
 * the record made after it, so whatever the engine answers costs the dispatch
 * nothing.
 */
import type { EngineInterface, On, ToolCallResult } from 'claude-code'

import { ENGINE, ENGINE_TIMEOUT_MS, MARKER, folderOf } from './folder.ts'

const EXECUTOR = 'leeway-implementation-task-executor'

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

/** Records the executor where the conversation runs the workflows; a record that fails costs nothing. */
async function recordExecutor($: EngineInterface, agentId: string) {
  try {
    if (!(await isWorkflow($))) {
      return
    }

    const root = await $.session.root()

    await $.process.run(
      ['node', `${root}/${ENGINE}`, 'conversation', 'executor', await $.session.id(), agentId],
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

export function executor(on: On) {
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const dispatched = await next(e)
    const agentId = agentIdOf(dispatched)

    if (e.subagent_type === EXECUTOR && e.agentId === undefined && agentId !== null) {
      $.clock.after(0, () => {
        void recordExecutor($, agentId)
      })
    }

    return dispatched
  }).catch(($, e, next) => next(e))
}
