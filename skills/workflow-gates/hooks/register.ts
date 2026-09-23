/**
 * workflow-gates — the agentic-workflows engine's gates drawn above the
 * prompt instead of printed by the model.
 *
 * The engine states each gate as data beside the menu it composed. This
 * module announces itself so the engine collects it, arms the gate off the
 * Bash result that carried it, cuts the menu out of what the model reads, and
 * draws the rows in the band once the model's turn is over; the press comes
 * back as the person's own next message, which is what the workflows' prose
 * already reads.
 *
 * Every path fails open: the engine emits the menu regardless, so a hook that
 * throws, overruns or never loads leaves the text menu exactly as it was.
 */
import type { Register } from 'claude-code'

import {
  answerOf,
  chromeRows,
  lineCount,
  type Option,
  type Typed,
} from './layout.ts'

/** The payload's marker and the menu it sits directly above. */
const GATE_MARKER = '=== GATE ('
const MENU_MARKER = '=== MENU'
const SECTION_MARKER = '=== '

/** The `Client`'s key: what `ui.message` matches the board's posts on. */
const ELEMENT = 'gate'

/** This plugin's name, as the engine stamps it on the prompts it submits. */
const PLUGIN = 'workflow-gates'

const STOP_NOTE =
  "The options are on screen. The user's choice, or anything they type, arrives as their next message."

type Gate = {
  question: string
  options: Option[]
  typed: Typed[]
}

/** The gate a render armed, waiting on the end of the turn that rendered it. */
let armed: Gate | null = null

/** The gate on the band, from that turn's end to the next turn or a press. */
let drawn: Gate | null = null

/**
 * The gate a Bash result carried, and that result's stdout with the payload
 * cut and the menu replaced by the instruction to stop; null where the output
 * states no gate, or states one with no pressable row (an archived inbox view
 * is a menu of prose alone, and stays text).
 */
function gateIn(stdout: string): { gate: Gate; stdout: string } | null {
  if (!stdout.includes(GATE_MARKER)) {
    return null
  }

  const lines = stdout.split('\n')
  const at = lines.findIndex(line => line.startsWith(GATE_MARKER))

  if (at === -1) {
    return null
  }

  const payload = lines[at + 1]
  const menu = lines[at + 2]

  if (payload === undefined || !(menu ?? '').startsWith(MENU_MARKER)) {
    return null
  }

  const stated = JSON.parse(payload) as Gate & { gate: string }

  if (stated.options.length === 0) {
    return null
  }

  const after = lines.findIndex(
    (line, n) => n > at + 2 && line.startsWith(SECTION_MARKER),
  )

  return {
    gate: {
      question: stated.question,
      options: stated.options,
      typed: stated.typed,
    },
    stdout: [
      ...lines.slice(0, at),
      `=== MENU: ${stated.gate} (drawn above the prompt — do NOT emit it; stop and wait) ===`,
      STOP_NOTE,
      ...(after === -1 ? [''] : lines.slice(after)),
    ].join('\n'),
  }
}

/** Whether an event is the conversation's own, not a subagent's loop. */
const inConversation = (e: { agentId?: string }) => e.agentId === undefined

/** The answer a post names, or null when it names no row of the gate. */
function answerIn(open: Gate | null, data: unknown): string | null {
  const said = (data as { answer?: unknown } | null)?.answer

  if (open === null || typeof said !== 'string') {
    return null
  }

  return open.options.some(option => answerOf(option) === said) ? said : null
}

export const register: Register = on => {
  // Announced, never always-on: the engine collects a gate only for a session
  // that asked for one, and every Bash child inherits this.
  on('session.start', async ($, e, next) => {
    await $.env.set('WORKFLOWS_GATE_SURFACE', '1')

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    // A press answers the conversation: a subagent reads its menu as text.
    if (!inConversation(e)) {
      return next(e)
    }

    const result = await next(e)

    if (result.deny !== undefined || result.isError === true) {
      return result
    }

    const record = result.result
    const cut = gateIn(record.stdout)

    if (cut === null) {
      return result
    }

    // The band is the terminal's: elsewhere the model prints the menu.
    if (!(await $.session.surfaces()).includes('terminal')) {
      return result
    }

    armed = cut.gate

    return { result: { ...record, stdout: cut.stdout } }
  }).catch(($, e, next) => next(e))

  // Drawn at the turn's end, once what the rows choose between is on screen.
  on('turn.complete', ($, e, next) => {
    if (armed !== null && inConversation(e)) {
      drawn = armed
      armed = null
      $.ui.invalidate('ui.render')
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const open = drawn

    if (open === null || e.props.hasSurvey || e.surface !== 'terminal') {
      return next(e)
    }

    const beneath = await next(e)

    try {
      const { Box, Client } = await $.ui.resolve(e)
      const columns = e.props.bodyColumns

      return Box({
        flexDirection: 'column',
        children: [
          // The module's path is read off this source, so it is a literal;
          // the region must be exactly as tall as the rows, or the pointer
          // cannot reach the ones past its edge.
          h(Client, {
            key: ELEMENT,
            module: './board.ts',
            width: columns,
            height:
              chromeRows(open.question, columns) +
              lineCount(open.options, open.typed, columns),
            props: {
              question: open.question,
              options: open.options,
              typed: open.typed,
              columns,
            },
          }),
          beneath,
        ],
      })
    } catch {
      return beneath
    }
  }).catch(($, e, next) => next(e))

  // The board has no `$`: a press posts here, and this submits it. The gate
  // comes off the band only once the answer is in — a submit that fails
  // reaches this hook's `.catch`, and the row is still there to press again.
  on('ui.message', { element: ELEMENT }, async ($, e, next) => {
    const answer = answerIn(drawn, e.data)

    if (answer === null) {
      return next(e)
    }

    await $.prompt.submit({ text: answer })

    if (drawn !== null) {
      drawn = null
      $.ui.invalidate('ui.render')
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // A press is the person's own choice: no origin, so it enters as theirs.
  on(
    'prompt.submit',
    { origin: { kind: 'plugin', name: PLUGIN } },
    async ($, e, next) => {
      const { origin: _, ...entered } = await next(e)

      return entered
    },
  ).catch(($, e, next) => next(e))

  // A gate lives from its render to the turn that answers it; a gate the
  // conversation re-presents is armed again by its own render.
  on('turn.start', ($, e, next) => {
    armed = null

    if (drawn !== null) {
      drawn = null
      $.ui.invalidate('ui.render')
    }

    return next(e)
  }).catch(($, e, next) => next(e))
}
