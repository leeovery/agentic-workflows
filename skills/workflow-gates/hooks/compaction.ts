/**
 * A workflow conversation's compaction, answered by the mod: one message that
 * tells Claude where it was working and what to re-read to carry on there —
 * the engine's own words — and what the conversation said and never wrote
 * down. Claude Code's summary stands in for neither: after one, Claude
 * re-reads nothing.
 *
 * Only the main conversation of a conversation the engine has marked, at a
 * position that names a skill; everything else compacts as Claude Code does.
 */
import type { EngineInterface, On, SessionMessage } from 'claude-code'

import { MARKER, folderOf } from './folder.ts'

const ENGINE = '.claude/skills/workflow-engine/scripts/engine.cjs'

const POSITION_MARKER = '=== POSITION ('

/** How long the engine may take to answer where the conversation is. */
const ENGINE_TIMEOUT_MS = 15_000

const SUMMARY_MODEL = 'sonnet'

const SUMMARY_TOKENS = 2_000

/** How long the summary may take before the compaction goes on without it. */
const SUMMARY_TIMEOUT_MS = 60_000

/**
 * The most of the transcript the summary reads, in characters — about 50,000
 * tokens. A longer one keeps its most recent part: what was said long ago has
 * had the session's natural breaks to be written into the document Claude
 * re-reads, and what was said lately has not.
 */
export const TRANSCRIPT_CAP = 200_000

/** The most of a tool call's input the transcript shows, in characters. */
const INPUT_CAP = 400

const LEFT_OUT = '[the conversation before this point is left out]'

const SUMMARY_ASK = [
  'Keep only what the conversation said and never wrote into a file: decisions, positions, leanings and open questions the person voiced or agreed. Leave out anything a Write or Edit put into a file, anything read from a file, and the workflow mechanics. Be specific; quote decisions.',
  "Answer as a short list, or 'Nothing.'",
].join('\n\n')

const SAID = 'Said in the conversation and not yet written down:'

/** What the engine answers for a conversation's position: its message, and the skill it names. */
type Position = { text: string; skill: string | null }

/** Whether the engine has marked the session's conversation as one that runs the workflows. */
async function isWorkflow($: EngineInterface): Promise<boolean> {
  const folder = folderOf(
    await $.env.get('WORKFLOWS_CONFIG_DIR'),
    await $.env.get('HOME'),
    await $.session.id(),
  )

  return folder !== null && (await $.fs.exists(`${folder}/${MARKER}`))
}

/** The engine's `conversation position` answer, from its POSITION line; null where it gave none. */
export function positionIn(stdout: string): Position | null {
  const lines = stdout.split('\n')
  const at = lines.findIndex(line => line.startsWith(POSITION_MARKER))

  try {
    const { text, skill } = JSON.parse(lines[at + 1] ?? '') as Partial<Position>

    return at !== -1 && typeof text === 'string'
      ? { text, skill: typeof skill === 'string' ? skill : null }
      : null
  } catch {
    return null
  }
}

/** Where the conversation is working and what to re-read there, as the engine says it; null where it cannot. */
async function positionNow($: EngineInterface): Promise<Position | null> {
  const root = await $.session.root()
  const { exitCode, stdout } = await $.process.run(
    ['node', `${root}/${ENGINE}`, 'conversation', 'position', await $.session.id()],
    { cwd: root, timeoutMs: ENGINE_TIMEOUT_MS },
  )

  return exitCode === 0 ? positionIn(stdout) : null
}

/**
 * The transcript as the summary reads it: who said what, and each tool call
 * by name with the start of its input, so what a Write or Edit recorded
 * shows. What a tool answered is left out — it was read from somewhere.
 */
export function transcriptOf(messages: readonly SessionMessage[]): string {
  const said = messages.flatMap(({ role, text, toolUses }) => {
    const calls = toolUses.map(use => `${use.tool} ${JSON.stringify(use.input).slice(0, INPUT_CAP)}`)

    if (text === '' && calls.length === 0) {
      return []
    }

    return [
      [`${role.toUpperCase()}: ${text}`, ...(calls.length === 0 ? [] : [`[tools: ${calls.join('; ')}]`])].join('\n'),
    ]
  })
  const whole = said.join('\n\n')

  return whole.length <= TRANSCRIPT_CAP
    ? whole
    : `${LEFT_OUT}\n\n${whole.slice(whole.length - TRANSCRIPT_CAP)}`
}

/** The summary's prompt, the person's own words for the compaction among it. */
export function summaryPrompt(transcript: string, instructions: string | undefined): string {
  const asked = instructions ? `\n\nThe person asked this compaction to keep: ${instructions}` : ''

  return `${SUMMARY_ASK}${asked}\n\n<conversation>\n${transcript}\n</conversation>`
}

/** The message the compaction hands up: the engine's note, and what was said where there is any. */
export function answerOf(note: string, summary: string): string {
  return /^(nothing\.?)?$/i.test(summary.trim()) ? note : `${note}\n\n${SAID}\n${summary.trim()}`
}

/** A message the mod writes into the conversation. */
const message = (text: string): SessionMessage => ({ role: 'user', text, toolUses: [] })

export function compaction(on: On) {
  on('session.compact', async ($, e, next) => {
    if (e.agentId !== undefined || !(await isWorkflow($))) {
      return next(e)
    }

    const position = await positionNow($)

    if (position === null || position.skill === null) {
      return next(e)
    }

    // A summary computed ahead of time would be core's, which this hook sets
    // aside when the compaction comes; nothing is computed instead.
    if (e.trigger === 'precompute') {
      return { skip: 'the workflow mod compacts this conversation itself' }
    }

    const summary = await $.model.complete(
      {
        model: SUMMARY_MODEL,
        prompt: summaryPrompt(transcriptOf(e.messages), e.instructions),
        maxTokens: SUMMARY_TOKENS,
        timeoutMs: SUMMARY_TIMEOUT_MS,
      },
      { signal: next.signal },
    )

    if (!summary.isAnswered) {
      const compacted = await next(e)

      return compacted.messages === undefined
        ? compacted
        : { ...compacted, messages: [message(position.text), ...compacted.messages] }
    }

    return { messages: [message(answerOf(position.text, summary.text))] }
  }).catch(($, e, next) => next(e))
}
