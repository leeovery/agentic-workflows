/**
 * The spinner saying the phase the conversation works in, the drawing alone,
 * in a session that announced and a conversation the engine has marked, on
 * the terminal app's and the Desktop app's surfaces.
 */
import type { EngineInterface, On } from 'claude-code'

import { MARKER, POSITION, folderOf } from './folder.ts'
import { positionOf, wordFor } from './position.ts'

/** The engine calls that move the conversation's position. */
const MOVES =
  /\.claude\/skills\/workflow-engine\/scripts\/engine\.cjs"?\s+(?:boot|session\s+(?:label|repair)|task\s+(?:start|complete))\b/

/** The Desktop app's spinner word while its row names no step of its own. */
const DESKTOP_IDLE = 'Working'

/** The spinner's word for a conversation, and which conversation it was read for. */
type Said = { id: string; word: string | null }

/**
 * The spinner's word for the session's conversation as its position stands
 * now; none in a session that did not announce.
 */
async function sayNow($: EngineInterface): Promise<Said> {
  const id = await $.session.id()

  if ((await $.env.get('WORKFLOWS_GATE_SURFACE')) !== '1') {
    return { id, word: null }
  }

  const folder = folderOf(
    await $.env.get('WORKFLOWS_CONFIG_DIR'),
    await $.env.get('HOME'),
    id,
  )
  const isMarked = folder !== null && (await $.fs.exists(`${folder}/${MARKER}`))
  const text = isMarked ? await $.fs.read(`${folder}/${POSITION}`).catch(() => null) : null

  return { id, word: text === null ? null : wordFor(positionOf(text)) }
}

export function spinner(on: On) {
  /** What the spinner says; null until read, a null word leaving Claude Code's. */
  let said: Said | null = null

  // The position is read when an engine call moves it, and once for each
  // conversation the spinner draws in — never per frame.
  on('tool.call', { tool: 'Bash', command: MOVES }, async ($, e, next) => {
    const result = await next(e)

    if (e.agentId === undefined) {
      const before = said?.word ?? null

      said = await sayNow($)

      if (said.word !== before) {
        $.ui.invalidate('ui.render')
      }
    }

    return result
  }).catch(($, e, next) => next(e))

  // Claude Code's spinner and its ellipsis, the word the phase. On the
  // Desktop app a step that names itself keeps its words.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    if (said === null || said.id !== (await $.session.id())) {
      said = await sayNow($)
    }

    const { word } = said

    if (word === null || (e.surface === 'desktop' && e.props.word !== DESKTOP_IDLE)) {
      return next(e)
    }

    return next({ ...e, props: { ...e.props, word } })
  }).catch(($, e, next) => next(e))
}
