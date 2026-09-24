/**
 * workflow-gates — the agentic-workflows engine's gates drawn above the
 * prompt instead of printed by the model.
 *
 * The engine states each gate as data beside the menu it composed. This
 * module announces itself so the engine collects it, arms the gate off the
 * Bash result that carried it, cuts the menu out of what the model reads, and
 * draws the rows in the band once the model's turn is over. A press picks its
 * row's answer into the prompt box; a second press on that row sends it as the
 * next message, which the workflows' prose reads as the answer.
 *
 * Every path up to the cut fails open: the engine emits the menu regardless,
 * so where the module never loads, or a cut throws or overruns, the model
 * reads the text menu the engine wrote.
 */
import type {
  AgentLoop,
  EngineInterface,
  PromptOrigin,
  Register,
} from 'claude-code'

import { answerOf, linesOf, type Gate, type Option } from './layout.ts'

/** The payload's marker and the menu it sits directly above. */
const GATE_MARKER = '=== GATE ('
const MENU_MARKER = '=== MENU'
const SECTION_MARKER = '=== '

/** The `Client`'s key: what `ui.message` matches the board's posts on. */
const ELEMENT = 'gate'

/** Where a send leaves what it answered, for a mod that draws the sent row. */
const SENT = '.workflows/.cache/.gates/sent.json'

/** The record that claims no send, which that mod draws nothing from. */
const NOTHING_SENT = 'null'

const STOP_NOTE =
  "The options are on screen as buttons. The user's answer arrives as their next message — typed by them, or sent for them by the workflow-gates plugin when they press a row."

/**
 * What the band holds of the conversation's gates. A turn's start clears
 * all of it but the gate that turn answers; the conversation's end, all.
 */
type Band = {
  /** The gate a render armed, waiting on the end of its turn. */
  armed: Gate | null
  /** The gate on the band, from a turn's end to the next turn's start. */
  drawn: Gate | null
  /** The answer a press put in the prompt box: a press on its row sends it. */
  picked: string | null
  /**
   * Whether the submission that opens the next turn is the person's; a turn
   * no submission opened counts as theirs.
   */
  isOpenedByPerson: boolean
  /**
   * The gate on the band when the running turn began, and whether the person
   * has answered it: they began the turn, or replied while it ran.
   */
  answering: { gate: Gate; isPersons: boolean } | null
  /** Whether the running turn has called a tool. */
  hasCalledTool: boolean
}

const emptyBand = (): Band => ({
  armed: null,
  drawn: null,
  picked: null,
  isOpenedByPerson: true,
  answering: null,
  hasCalledTool: false,
})

/**
 * The gate a Bash result's stdout states directly above its menu, and that
 * stdout with the payload taken out, which is this module's input alone:
 * `text` keeps the menu as the engine wrote it, `cut` puts the instruction to
 * stop in its place. Null where the stdout states no gate.
 */
function gateIn(
  stdout: string,
): { gate: Gate; text: string; cut: string } | null {
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
  const before = lines.slice(0, at)
  const after = lines.findIndex(
    (line, n) => n > at + 2 && line.startsWith(SECTION_MARKER),
  )

  return {
    gate,
    text: [...before, ...lines.slice(at + 2)].join('\n'),
    cut: [
      ...before,
      `=== MENU: ${name} (drawn above the prompt — do NOT emit it; stop and wait) ===`,
      STOP_NOTE,
      ...(after === -1 ? [''] : lines.slice(after)),
    ].join('\n'),
  }
}

/** Whether an event is the conversation's own, not a subagent's loop. */
const inConversation = (e: AgentLoop) => e.agentId === undefined

/**
 * Whether the band takes a gate a Bash call stated: the conversation's own
 * call, not a subagent's; a row to press (an archived inbox view is a menu of
 * prose alone, and stays text); and the terminal the session's only screen,
 * since the band is the terminal's and any other screen shows the menu as
 * text alone.
 */
async function isForBand(
  $: EngineInterface,
  e: AgentLoop,
  gate: Gate,
): Promise<boolean> {
  if (!inConversation(e) || gate.options.length === 0) {
    return false
  }

  const surfaces = await $.session.surfaces()

  return surfaces.length === 1 && surfaces[0] === 'terminal'
}

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
 * send that fails or is dropped puts the answer back in the box, where the
 * pick says it is, and leaves no send recorded.
 */
async function send($: EngineInterface, gate: Gate, option: Option) {
  const answer = answerOf(option)
  let isSent = false

  await $.prompt.fill({ text: '', mode: 'replace' })

  try {
    await $.fs.write(
      SENT,
      JSON.stringify({ answer, question: gate.question, label: option.head }),
    )
    // Framed for the model and labelled on screen as this plugin's, by design.
    const { drop } = await $.prompt.submit({ text: answer })

    isSent = drop === undefined
  } finally {
    if (!isSent) {
      await $.prompt.fill({ text: answer, mode: 'replace' })
      await $.fs.write(SENT, NOTHING_SENT)
    }
  }
}

export const register: Register = on => {
  let band = emptyBand()

  /** Whether a send is under way, so a press meanwhile cannot send twice. */
  let isSending = false

  /**
   * The gate the band shows once the conversation's turn ends: the gate it
   * rendered, or with none, the one it began over where the person never
   * answered it. An Esc drops what the turn rendered and takes the answer
   * back, its gate returning, until the turn calls a tool, which may already
   * have acted on the answer: a read and a write look alike from here. Past
   * that, an Esc'd turn that rendered a gate leaves nothing, since the last
   * the model read is that gate's instruction to stop.
   */
  const gateAtTurnEnd = (isInterrupted: boolean): Gate | null => {
    const { armed, answering, hasCalledTool } = band
    const unanswered = answering?.isPersons === false ? answering.gate : null

    if (!isInterrupted) {
      return armed ?? unanswered
    }

    if (!hasCalledTool) {
      return answering?.gate ?? null
    }

    return armed === null ? unanswered : null
  }

  // Announced, never always-on: the engine collects a gate only for a session
  // that asked for one, and every Bash child inherits this.
  on('session.start', async ($, e, next) => {
    await $.env.set('WORKFLOWS_GATE_SURFACE', '1')

    return next(e)
  }).catch(($, e, next) => next(e))

  // A /clear or a resume goes on in this process as another conversation,
  // which no gate of this one answers.
  on('session.end', ($, e, next) => {
    band = emptyBand()
    $.ui.invalidate('ui.render')

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', ($, e, next) => {
    if (inConversation(e)) {
      band.hasCalledTool = true
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)

    if (result.deny !== undefined || result.isError === true) {
      return result
    }

    const record = result.result
    const stated = gateIn(record.stdout)

    if (stated === null) {
      return result
    }

    const isArmed = await isForBand($, e, stated.gate)

    if (isArmed) {
      band.armed = stated.gate
    }

    return {
      result: { ...record, stdout: isArmed ? stated.cut : stated.text },
    }
  }).catch(($, e, next) => next(e))

  // Drawn at the turn's end, once what the rows choose between is on screen.
  on('turn.complete', ($, e, next) => {
    if (inConversation(e)) {
      const gate = gateAtTurnEnd(e.isAborted)

      band.armed = null
      band.answering = null

      if (gate !== null) {
        band.drawn = gate
        $.ui.invalidate('ui.render')
      }
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const gate = band.drawn

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
            props: { gate, picked: band.picked, columns },
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
  // off the band; a send that fails or is dropped leaves the row there to
  // press again.
  on('ui.message', { element: ELEMENT }, async ($, e, next) => {
    const gate = band.drawn
    const option = gate === null || isSending ? null : optionIn(gate, e.data)

    if (gate === null || option === null) {
      return next(e)
    }

    const answer = answerOf(option)

    if (answer === band.picked) {
      isSending = true

      try {
        await send($, gate, option)
      } finally {
        isSending = false
      }
    } else if (await pick($, answer)) {
      band.picked = answer
      $.ui.invalidate('ui.render')
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // A submission made while the session idles opens the next turn; one made
  // over a running turn joins it, and the person's answers the gate that
  // turn began over.
  on('prompt.submit', ($, e, next) => {
    const isTheirs = isPersons(e.origin, $.plugin.name)

    if (e.turnId === undefined) {
      band.isOpenedByPerson = isTheirs
    } else if (isTheirs && band.answering !== null) {
      band.answering = { ...band.answering, isPersons: true }
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // A gate lives from its render to the turn that answers it, which keeps it
  // to put back; a gate the conversation re-presents is armed again by its
  // own render.
  on('turn.start', ($, e, next) => {
    const { drawn, isOpenedByPerson } = band

    band = {
      ...emptyBand(),
      answering:
        drawn === null ? null : { gate: drawn, isPersons: isOpenedByPerson },
    }

    if (drawn !== null) {
      $.ui.invalidate('ui.render')
    }

    return next(e)
  }).catch(($, e, next) => next(e))
}
