// A plugin of its own: the engine skips the mod's render hooks on rows it sent.
import type { EngineInterface, RenderPropsOf, Register } from 'claude-code'

const SENDER = 'workflow-gates'

const SENT = '.workflows/.cache/.gates/sent.json'
const SPENT = 'null'

const FRAMED = /sent a message:\n([\s\S]+?)\n\nThis is how Claude Code surfaces a prompt/

type Sent = { answer: string; question: string; label: string }

const isSent = (value: unknown): value is Sent => {
  const { answer, question, label } = (value ?? {}) as Record<string, unknown>

  return [answer, question, label].every(field => typeof field === 'string')
}

function lineOf({ answer, question, label }: Sent): string {
  const answered = question === '' ? answer : `${question} → ${answer}`

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

async function lastSent($: EngineInterface): Promise<Sent | null> {
  try {
    const sent: unknown = JSON.parse(await $.fs.read(SENT))

    return isSent(sent) ? sent : null
  } catch {
    return null
  }
}

async function firstLineOf(
  $: EngineInterface,
  requestId: string,
  answer: string,
): Promise<string> {
  const kept = await $.store.get(requestId)

  if (typeof kept === 'string') {
    return kept
  }

  const sent = await lastSent($)

  if (sent?.answer !== answer) {
    return answer
  }

  const line = lineOf(sent)

  await $.fs.write(SENT, SPENT)
  await $.store.set(requestId, line)

  return line
}

export const register: Register = on => {
  const lines = new Map<string, string>()

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

    // The drawing alone changes: the model reads the engine's framing, by design.
    return next({ ...e, props: { ...e.props, text: line } })
  }).catch(($, e, next) => next(e))
}
