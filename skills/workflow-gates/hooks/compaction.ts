/**
 * A workflow conversation's compaction, answered by the mod: one message that
 * tells Claude where it was working and what to re-read to carry on there —
 * the engine's own words — and what the conversation said and never wrote
 * down. Claude Code's summary stands in for neither: after one, Claude
 * re-reads nothing.
 *
 * Only the main conversation of a conversation the engine has marked, at a
 * position that names a skill; everything else compacts as Claude Code does.
 * What it hands up is recorded in the conversation's folder as
 * `compacted.json`, which the rows mod draws the message's row from.
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

/** The file in the conversation's folder the compaction's message is recorded in. */
const COMPACTED = 'compacted.json'

const PLACE_SEPARATOR = ' › '

/**
 * What the engine answers for a conversation's position: its message, the
 * skill it names, and the place as words.
 */
type Position = { text: string; skill: string | null; place: string }

/** What a compaction the mod answered leaves for the rows mod to draw its row from. */
export type Compacted = { text: string; place: string; kept: number }

/**
 * The session's own conversation's folder where the engine has marked it as
 * one that runs the workflows; null for any other conversation.
 */
async function workflowFolder($: EngineInterface): Promise<string | null> {
  const folder = folderOf(
    await $.env.get('WORKFLOWS_CONFIG_DIR'),
    await $.env.get('HOME'),
    await $.session.id(),
  )

  return folder !== null && (await $.fs.exists(`${folder}/${MARKER}`)) ? folder : null
}

/**
 * A position as words — the work unit, its phase and its topic, the topic
 * left out where it is the work unit, as the tmux label reads it.
 */
export function placeOf(position: unknown): string {
  const { name, phase, topic } = (position ?? {}) as Record<string, unknown>
  const words = [name, phase, topic === name ? undefined : topic]

  return words.filter((word): word is string => typeof word === 'string').join(PLACE_SEPARATOR)
}

/** The engine's `conversation position` answer, from its POSITION line; null where it gave none. */
export function positionIn(stdout: string): Position | null {
  const lines = stdout.split('\n')
  const at = lines.findIndex(line => line.startsWith(POSITION_MARKER))

  try {
    const { text, skill, position } = JSON.parse(lines[at + 1] ?? '') as {
      text?: unknown
      skill?: unknown
      position?: unknown
    }

    return at !== -1 && typeof text === 'string'
      ? { text, skill: typeof skill === 'string' ? skill : null, place: placeOf(position) }
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

/** Whether the summary found nothing said and not written down. */
const isNothing = (summary: string) => /^(nothing\.?)?$/i.test(summary.trim())

/** The message the compaction hands up: the engine's note, and what was said where there is any. */
export function answerOf(note: string, summary: string): string {
  return isNothing(summary) ? note : `${note}\n\n${SAID}\n${summary.trim()}`
}

/**
 * How many points the summary keeps: its list's items at the top level, or
 * one where it says something in no list; none where it found nothing.
 */
export function pointsIn(summary: string): number {
  if (isNothing(summary)) {
    return 0
  }

  const items = summary.split('\n').filter(line => /^([-*•+]|\d+[.)])\s/.test(line))

  return Math.max(1, items.length)
}

/**
 * Records what the compaction hands up in the conversation's folder. A record
 * that cannot be written costs the drawing alone, never the compaction.
 */
async function record($: EngineInterface, folder: string, compacted: Compacted) {
  try {
    await $.fs.write(`${folder}/${COMPACTED}`, JSON.stringify(compacted))
  } catch {
    // The row draws as Claude Code draws it.
  }
}

/** A message the mod writes into the conversation. */
const message = (text: string): SessionMessage => ({ role: 'user', text, toolUses: [] })

export function compaction(on: On) {
  on('session.compact', async ($, e, next) => {
    const folder = e.agentId === undefined ? await workflowFolder($) : null

    if (folder === null) {
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

      if (compacted.messages === undefined) {
        return compacted
      }

      await record($, folder, { text: position.text, place: position.place, kept: 0 })

      return { ...compacted, messages: [message(position.text), ...compacted.messages] }
    }

    const text = answerOf(position.text, summary.text)

    await record($, folder, { text, place: position.place, kept: pointsIn(summary.text) })

    return { messages: [message(text)] }
  }).catch(($, e, next) => next(e))
}
