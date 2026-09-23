/**
 * workflow-gates — the agentic-workflows engine's gates drawn above the
 * prompt instead of printed by the model.
 *
 * The engine states each gate as data beside the menu it composed. This
 * module announces itself so the engine collects it, arms the gate off the
 * Bash result that carried it, cuts the menu out of what the model reads, and
 * draws the rows in the band once the model's turn is over. A press picks its
 * row's answer into the prompt box; a second press on that row sends it as the
 * next message, which is what the workflows' prose already reads.
 *
 * Every path fails open: the engine emits the menu regardless, so a hook that
 * throws, overruns or never loads leaves the text menu exactly as it was.
 */
import type { EngineInterface, PromptOrigin, Register } from 'claude-code'

import { answerOf, linesOf, type Gate, type Option } from './layout.ts'

/** The payload's marker and the menu it sits directly above. */
const GATE_MARKER = '=== GATE ('
const MENU_MARKER = '=== MENU'
const SECTION_MARKER = '=== '

/** The `Client`'s key: what `ui.message` matches the board's posts on. */
const ELEMENT = 'gate'

/** Where a send leaves what it answered, for a mod that draws the sent row. */
const SENT = '.workflows/.cache/.gates/sent.json'

const STOP_NOTE =
  "The options are on screen. The user's choice, or anything they type, arrives as their next message."

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

  const { gate: name, ...gate } = JSON.parse(payload) as Gate & { gate: string }

  if (gate.options.length === 0) {
    return null
  }

  const after = lines.findIndex(
    (line, n) => n > at + 2 && line.startsWith(SECTION_MARKER),
  )

  return {
    gate,
    stdout: [
      ...lines.slice(0, at),
      `=== MENU: ${name} (drawn above the prompt — do NOT emit it; stop and wait) ===`,
      STOP_NOTE,
      ...(after === -1 ? [''] : lines.slice(after)),
    ].join('\n'),
  }
}

/** Whether an event is the conversation's own, not a subagent's loop. */
const inConversation = (e: { agentId?: string }) => e.agentId === undefined

/**
 * Whether a submission is the person's: their Enter at the prompt, their
 * message through Remote Control, or this plugin sending their press. One
 * with no origin is the person's own, as the engine reads it.
 */
const isPersons = (origin: PromptOrigin | undefined, plugin: string) =>
  origin === undefined ||
  origin.kind === 'composer' ||
  origin.kind === 'bridge' ||
  (origin.kind === 'plugin' && origin.name === plugin)

/** The row a post names, or null when it names none of the gate's. */
function optionIn(gate: Gate, data: unknown): Option | null {
  const said = (data as { answer?: unknown } | null)?.answer

  return typeof said === 'string'
    ? (gate.options.find(option => answerOf(option) === said) ?? null)
    : null
}

/** Puts a row's answer in the prompt box; whether the box took it. */
async function pick($: EngineInterface, answer: string): Promise<boolean> {
  const { isFilled } = await $.prompt.fill({ text: answer, mode: 'replace' })

  return isFilled
}

/**
 * Sends a row as the next message, the box cleared and the send recorded; a
 * send that fails puts the answer back in the box, where the pick says it is.
 */
async function send($: EngineInterface, gate: Gate, option: Option) {
  const answer = answerOf(option)

  await $.prompt.fill({ text: '', mode: 'replace' })

  try {
    await $.fs.write(
      SENT,
      JSON.stringify({ answer, question: gate.question, label: option.head }),
    )
    // Framed for the model and labelled on screen as this plugin's, by design.
    await $.prompt.submit({ text: answer })
  } catch (error) {
    await $.prompt.fill({ text: answer, mode: 'replace' })

    throw error
  }
}

export const register: Register = on => {
  /** The gate a render armed, waiting on the end of its turn. */
  let armed: Gate | null = null

  /** The gate on the band, from a turn's end to the next turn's start. */
  let drawn: Gate | null = null

  /** The answer a press put in the prompt box: a press on its row sends it. */
  let picked: string | null = null

  /** Whether a send is under way, so a press meanwhile cannot send twice. */
  let isSending = false

  /**
   * Whether the submission that opens the next turn is the person's; a turn
   * no submission opened counts as theirs.
   */
  let isOpenedByPerson = true

  /** The gate on the band when the running turn began, and who began it. */
  let answering: { gate: Gate; isPersons: boolean } | null = null

  /**
   * The gate the band shows once the conversation's turn ends. An Esc takes
   * the answer back: whatever the turn rendered is dropped and the gate it
   * began over returns. Otherwise the gate it rendered, or with none, the one
   * it began over where the person never answered it.
   */
  const gateAtTurnEnd = (isInterrupted: boolean): Gate | null => {
    if (isInterrupted) {
      return answering?.gate ?? null
    }

    return armed ?? (answering?.isPersons === false ? answering.gate : null)
  }

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
    if (inConversation(e)) {
      const gate = gateAtTurnEnd(e.isAborted)

      armed = null
      answering = null

      if (gate !== null) {
        drawn = gate
        $.ui.invalidate('ui.render')
      }
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const gate = drawn

    if (gate === null || e.props.hasSurvey || e.surface !== 'terminal') {
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
          // the region must be exactly as tall as the drawing, or the pointer
          // cannot reach the rows past its edge.
          h(Client, {
            key: ELEMENT,
            module: './board.ts',
            width: columns,
            height: linesOf(gate, columns).length,
            props: { gate, picked, columns },
          }),
          beneath,
        ],
      })
    } catch {
      return beneath
    }
  }).catch(($, e, next) => next(e))

  // The board has no `$`: a press posts here, and this picks its row or, on
  // the row already picked, sends it. The turn a send opens takes the gate
  // off the band; a send that fails leaves the row there to press again.
  on('ui.message', { element: ELEMENT }, async ($, e, next) => {
    const gate = drawn
    const option = gate === null || isSending ? null : optionIn(gate, e.data)

    if (gate === null || option === null) {
      return next(e)
    }

    const answer = answerOf(option)

    if (answer === picked) {
      isSending = true

      try {
        await send($, gate, option)
      } finally {
        isSending = false
      }
    } else if (await pick($, answer)) {
      picked = answer
      $.ui.invalidate('ui.render')
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // A submission made while the session idles opens the next turn; one made
  // over a running turn joins it.
  on('prompt.submit', ($, e, next) => {
    if (e.turnId === undefined) {
      isOpenedByPerson = isPersons(e.origin, $.plugin.name)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // A gate lives from its render to the turn that answers it, which keeps it
  // to put back; a gate the conversation re-presents is armed again by its
  // own render.
  on('turn.start', ($, e, next) => {
    answering =
      drawn === null ? null : { gate: drawn, isPersons: isOpenedByPerson }
    isOpenedByPerson = true
    armed = null
    picked = null

    if (drawn !== null) {
      drawn = null
      $.ui.invalidate('ui.render')
    }

    return next(e)
  }).catch(($, e, next) => next(e))
}
