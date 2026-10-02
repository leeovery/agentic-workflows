/**
 * The workflows' rows as they read: an engine call's transcript row drawn as
 * the call it is, and the spinner saying the phase the conversation works in.
 * Drawing alone — what the model reads is untouched — and only in a
 * conversation the engine has marked, on the terminal app's and the Desktop
 * app's surfaces.
 */
import type { EngineInterface, On } from 'claude-code'

import { engineCallIn, lineOf } from './engine-call.ts'
import { MARKER, POSITION, folderOf } from './folder.ts'
import { positionOf, wordFor } from './position.ts'

/** The engine calls that move the conversation's position. */
const MOVES =
  /\.claude\/skills\/workflow-engine\/scripts\/engine\.cjs"?\s+(?:session\s+(?:label|repair)|task\s+(?:start|complete))\b/

/** The Desktop app's spinner word while its row names no step of its own. */
const DESKTOP_IDLE = 'Working'

/** The width a row draws to where its surface has not measured. */
const UNMEASURED = 80

/** The spinner's word for a conversation, and which conversation it was read for. */
type Said = { id: string; word: string | null }

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

/** The spinner's word for the session's conversation as its position stands now. */
async function sayNow($: EngineInterface): Promise<Said> {
  const id = await $.session.id()
  const folder = await workflowFolder($)
  const text =
    folder === null ? null : await $.fs.read(`${folder}/${POSITION}`).catch(() => null)

  return { id, word: text === null ? null : wordFor(positionOf(text)) }
}

export function redraw(on: On) {
  /** What the spinner says; null until read, a null word leaving Claude Code's. */
  let said: Said | null = null

  /** The conversation found marked, by session id: once marked, always. */
  let marked: string | null = null

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

  // One line, the row's width: the marker dim while the call runs and in the
  // error colour where it errored or was cut, then the verb, then its
  // arguments dimmed.
  on('ui.render', { component: 'ToolUse', props: { tool: 'Bash' } }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      return next(e)
    }

    const { command } = (e.props.input ?? {}) as { command?: unknown }
    const call = typeof command === 'string' ? engineCallIn(command) : null

    if (call === null) {
      return next(e)
    }

    const id = await $.session.id()

    if (marked !== id) {
      if ((await workflowFolder($)) === null) {
        return next(e)
      }

      marked = id
    }

    const { Text } = await $.ui.resolve(e)
    const { isRunning, isErrored, isInterrupted } = e.props
    const line = lineOf(call, e.viewport?.columns ?? UNMEASURED)

    return Text({
      wrap: 'truncate-end',
      children: [
        Text({
          ...(isErrored || isInterrupted ? { color: 'error' } : {}),
          ...(isRunning ? { dimColor: true } : {}),
          children: line.marker,
        }),
        Text({ children: line.verb }),
        ...(line.args === '' ? [] : [Text({ dimColor: true, children: line.args })]),
      ],
    })
  }).catch(($, e, next) => next(e))
}
