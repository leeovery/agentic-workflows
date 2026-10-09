/**
 * A workflow conversation's compaction: Claude Code compacts as it does, and
 * the mod appends one message, last, the engine's own words — that the
 * conversation was just compacted, where it is working, and the skill's steps
 * for resuming after one with what to re-read. A `/compact` starts no turn of
 * its own, so after one the mod sends a continuation for Claude to follow the
 * note.
 *
 * Only the main conversation of a conversation the engine has marked, in a
 * session that announced, at a position that names a skill; everything else
 * compacts as Claude Code does. Each note handed up is recorded in the
 * conversation's folder as `compacted.json`, which the rows mod draws the
 * note's row from.
 */
import type { EngineInterface, On, SessionMessage } from 'claude-code'

import { MARKER, folderOf } from './folder.ts'

const ENGINE = '.claude/skills/workflow-engine/scripts/engine.cjs'

const POSITION_MARKER = '=== POSITION ('

const ENGINE_TIMEOUT_MS = 15_000

const COMPACTED = 'compacted.json'

export const CONTINUATION =
  'The compaction is done. Please carry on from where the conversation left off.'

type CarryOn = { text: string; skill: string | null; place: string }

/** Keyed by each note's text, as the rows mod finds the row it draws. */
type Notes = Record<string, string>

const isNotes = (value: unknown): value is Notes =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(place => typeof place === 'string')

/**
 * The session's own conversation's folder where the session announced and
 * the engine has marked the conversation as one that runs the workflows;
 * null for any other.
 */
async function workflowFolder($: EngineInterface): Promise<string | null> {
  if ((await $.env.get('WORKFLOWS_GATE_SURFACE')) !== '1') {
    return null
  }

  const folder = folderOf(
    await $.env.get('WORKFLOWS_CONFIG_DIR'),
    await $.env.get('HOME'),
    await $.session.id(),
  )

  return folder !== null && (await $.fs.exists(`${folder}/${MARKER}`)) ? folder : null
}

/** The engine's `conversation position` answer, from its POSITION line; null where it gave none. */
export function positionIn(stdout: string): CarryOn | null {
  const lines = stdout.split('\n')
  const at = lines.findIndex(line => line.startsWith(POSITION_MARKER))

  try {
    const { text, skill, place } = JSON.parse(lines[at + 1] ?? '') as {
      text?: unknown
      skill?: unknown
      place?: unknown
    }

    return at !== -1 && typeof text === 'string' && typeof place === 'string'
      ? { text, skill: typeof skill === 'string' ? skill : null, place }
      : null
  } catch {
    return null
  }
}

async function positionNow($: EngineInterface): Promise<CarryOn | null> {
  const root = await $.session.root()
  const { exitCode, stdout } = await $.process.run(
    ['node', `${root}/${ENGINE}`, 'conversation', 'position', await $.session.id()],
    { cwd: root, timeoutMs: ENGINE_TIMEOUT_MS },
  )

  return exitCode === 0 ? positionIn(stdout) : null
}

/**
 * Adds a note handed up to the conversation's record of them. A record that
 * cannot be read starts afresh; one that cannot be written costs the drawing
 * alone, never the compaction.
 */
async function record($: EngineInterface, folder: string, { text, place }: CarryOn) {
  const file = `${folder}/${COMPACTED}`
  let notes: Notes = {}

  try {
    const kept: unknown = JSON.parse(await $.fs.read(file))

    notes = isNotes(kept) ? kept : {}
  } catch {}

  try {
    await $.fs.write(file, JSON.stringify({ ...notes, [text.trim()]: place }))
  } catch {}
}

/** A continuation that is dropped or fails waits in the prompt box for Enter instead. */
async function sendContinuation($: EngineInterface) {
  const { drop } = await $.prompt.submit({ text: CONTINUATION }).catch(() => ({ drop: 'failed' }))

  if (drop !== undefined) {
    await $.prompt.fill({ text: CONTINUATION, mode: 'replace' }).catch(() => undefined)
  }
}

const message = (text: string): SessionMessage => ({ role: 'user', text, toolUses: [] })

export function compaction(on: On) {
  on('session.compact', async ($, e, next) => {
    if (e.trigger === 'precompute' || e.agentId !== undefined) {
      return next(e)
    }

    const folder = await workflowFolder($)
    const carryOn = folder === null ? null : await positionNow($)

    if (folder === null || carryOn === null || carryOn.skill === null) {
      return next(e)
    }

    const compacted = await next(e)

    if (compacted.messages === undefined) {
      return compacted
    }

    await record($, folder, carryOn)

    if (e.trigger === 'manual') {
      // The session takes a prompt only once the `/compact` is done.
      $.clock.after(0, () => {
        void sendContinuation($)
      })
    }

    return { ...compacted, messages: [...compacted.messages, message(carryOn.text)] }
  }).catch(($, e, next) => next(e))
}
