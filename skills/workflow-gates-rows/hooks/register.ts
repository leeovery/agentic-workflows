// A plugin of its own: Claude Code skips the mod's render hooks on rows it sent.
import type { EngineInterface, RenderPropsOf, Register } from 'claude-code'

import { compacted } from './compacted.ts'
import { folderOf } from './folder.ts'

const SENDER = 'workflow-gates'

const SENT = 'sent.json'
const SPENT = 'null'

const ROWS = 'rows.json'

const FRAMED = /sent a message:\n([\s\S]+?)\n\nThis is how Claude Code surfaces a prompt/

// A gate's answer, or a handoff's continuation with the line it draws as.
type Sent =
  | { answer: string; question: string; label: string }
  | { answer: string; line: string }

type Rows = Record<string, unknown>

const isText = (field: unknown) => typeof field === 'string'

const isSent = (value: unknown): value is Sent => {
  const sent = (value ?? {}) as Record<string, unknown>

  return (
    isText(sent.answer) &&
    (isText(sent.line) || (isText(sent.question) && isText(sent.label)))
  )
}

const isRows = (value: unknown): value is Rows =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

async function conversationFolder($: EngineInterface): Promise<string | null> {
  return folderOf(
    await $.env.get('WORKFLOWS_CONFIG_DIR'),
    await $.env.get('HOME'),
    await $.session.id(),
  )
}

function lineOf(sent: Sent): string {
  if ('line' in sent) {
    return sent.line
  }

  const { answer, question, label } = sent
  const answered = `${question} → ${answer}`

  return label === '' || label === answer ? answered : `${answered} · ${label}`
}

function answerIn({
  origin,
  isExpanded,
  text,
}: RenderPropsOf['UserMessage']): string | null {
  if (isExpanded || origin.kind !== 'plugin' || origin.name !== SENDER) {
    return null
  }

  return FRAMED.exec(text)?.[1] ?? null
}

async function lastSent($: EngineInterface, folder: string): Promise<Sent | null> {
  try {
    const sent: unknown = JSON.parse(await $.fs.read(`${folder}/${SENT}`))

    return isSent(sent) ? sent : null
  } catch {
    return null
  }
}

async function keptIn($: EngineInterface, folder: string): Promise<Rows> {
  try {
    const rows: unknown = JSON.parse(await $.fs.read(`${folder}/${ROWS}`))

    return isRows(rows) ? rows : {}
  } catch {
    return {}
  }
}

async function firstLineOf(
  $: EngineInterface,
  requestId: string,
  answer: string,
): Promise<string | null> {
  const folder = await conversationFolder($)

  if (folder === null || !(await $.fs.exists(folder))) {
    return null
  }

  const rows = await keptIn($, folder)
  const kept = rows[requestId]

  if (typeof kept === 'string') {
    return kept
  }

  const sent = await lastSent($, folder)
  const paired = sent?.answer === answer
  const line = paired ? lineOf(sent) : answer

  await $.fs.write(
    `${folder}/${ROWS}`,
    JSON.stringify({ ...rows, [requestId]: line }),
  )

  if (paired) {
    await $.fs.write(`${folder}/${SENT}`, SPENT)
  }

  return line
}

export const register: Register = on => {
  const lines = new Map<string, string | null>()

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const answer = answerIn(e.props)

    if (answer === null) {
      return next(e)
    }

    let line = lines.get(e.requestId)

    if (line === undefined) {
      line = await firstLineOf($, e.requestId, answer)
      lines.set(e.requestId, line)
    }

    if (line === null) {
      return next(e)
    }

    // The drawing alone changes: the model reads Claude Code's framing, by design.
    return next({ ...e, props: { ...e.props, text: line } })
  }).catch(($, e, next) => next(e))

  compacted(on)
}
