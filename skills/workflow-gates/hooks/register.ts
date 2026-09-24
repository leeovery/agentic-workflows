/**
 * workflow-gates — the agentic-workflows engine's gates drawn above the
 * prompt instead of printed by the model.
 *
 * The engine states each gate as data beside the menu it composed. This
 * module announces itself so the engine collects it, arms the gate off the
 * Bash result that carried it, cuts the menu out of what the model reads, and
 * draws the rows in the band once the model's turn is over. A press picks its
 * row's answer into the prompt box; a second press on that row sends it as the
 * next message, which the workflows' prose reads as the answer. What the band
 * shows is kept across a restart, so a conversation resumed where nothing has
 * happened since shows its gate again.
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
  SessionMessage,
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

/** The prefix of the store key a conversation's band is kept under. */
const KEPT = 'band:'

/**
 * How long Claude Code keeps a transcript to resume unless told otherwise:
 * a band kept longer belongs to a conversation that cannot come back.
 */
const KEPT_FOR_MS = 30 * 24 * 60 * 60 * 1000

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

/**
 * Where a conversation stands, as its transcript reads: the key its band is
 * kept under, named by its first tool call, which no other conversation
 * makes and no change of session id moves (null before its first call); and
 * the stamp of the message it ends on.
 */
type Place = { key: string | null; stamp: string }

/** What the store keeps of a conversation's band: its gate, and when. */
type Kept = { stamp: string; gate: Gate; keptAt: number }

/** A band read back from the store: where the conversation stands, its gate. */
type ReadBack = { place: Place; gate: Gate | null }

/**
 * A read-back the band owes before it is trusted, never taken from `ended`:
 * the conversation that ended in this process, while the transcript still
 * holds it.
 */
type Owed = { ended: Place | null }

/** The tool calls a message makes or answers, by id. */
const callsOf = (message: SessionMessage) => [
  ...message.toolUses.map(use => use.tool_use_id),
  ...(message.toolResults ?? []).map(result => result.tool_use_id),
]

/**
 * Where the conversation stands now; null while its transcript is empty.
 * The stamp is the last message — who wrote it, its text, the calls it makes
 * or answers — and the newest call of all, so a conversation that moved on
 * and came to rest on the same words is told apart.
 */
async function placeOf($: EngineInterface): Promise<Place | null> {
  const messages = await $.session.messages()
  const last = messages.at(-1)

  if (last === undefined) {
    return null
  }

  const calls = messages.flatMap(callsOf)
  const [first] = calls

  return {
    key: first === undefined ? null : `${KEPT}${first}`,
    stamp: JSON.stringify([
      last.role,
      last.text,
      callsOf(last),
      calls.at(-1) ?? null,
    ]),
  }
}

const isSamePlace = (place: Place, other: Place | null) =>
  other !== null && place.key === other.key && place.stamp === other.stamp

/** Whether `place` is the keyed conversation `seen` read, however far on. */
const isSameConversation = (place: Place | null, seen: Place | null) =>
  place !== null && seen !== null && seen.key !== null && place.key === seen.key

const isKept = (value: unknown): value is Kept =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Kept).stamp === 'string' &&
  typeof (value as Kept).keptAt === 'number'

/**
 * Keeps what the band shows for the conversation at `place` — the gate, or
 * nothing — dropping what was kept for it under a key `before` it has since
 * left, as a compaction or a transcript past what `$.session.messages()`
 * answers moves its first call.
 */
async function keep(
  $: EngineInterface,
  place: Place | null,
  gate: Gate | null,
  before: Place | null,
) {
  const key = place?.key ?? null
  const left = before?.key ?? null

  if (left !== null && left !== key) {
    await $.store.delete(left)
  }

  if (place === null || key === null) {
    return
  }

  if (gate === null) {
    await $.store.delete(key)
  } else {
    const kept: Kept = { stamp: place.stamp, gate, keptAt: await $.clock.now() }

    await $.store.set(key, kept)
  }
}

/**
 * Settles the read-back the band owes, if `owing` says it owes one: `take`
 * gets the conversation the transcript holds now, with its kept gate where
 * the transcript still ends where it was kept, or none where it has moved
 * on, the kept band dropped while the read-back is still owed. Nothing
 * settles while the transcript is empty or still holds the conversation
 * that ended in this process.
 */
async function readBack(
  $: EngineInterface,
  owing: () => Owed | null,
  take: (asked: Owed, read: ReadBack) => void,
) {
  const asked = owing()

  if (asked === null) {
    return
  }

  const place = await placeOf($)

  if (place === null || isSamePlace(place, asked.ended)) {
    return
  }

  const kept = place.key === null ? undefined : await $.store.get(place.key)

  if (isKept(kept) && kept.stamp === place.stamp) {
    take(asked, { place, gate: kept.gate })

    return
  }

  if (kept !== undefined && place.key !== null && owing() === asked) {
    await $.store.delete(place.key)
  }

  take(asked, { place, gate: null })
}

/** Drops every band kept longer than a transcript is kept to resume. */
async function forgetExpired($: EngineInterface) {
  const now = await $.clock.now()

  for (const key of await $.store.keys()) {
    if (!key.startsWith(KEPT)) {
      continue
    }

    const kept = await $.store.get(key)

    if (!isKept(kept) || now - kept.keptAt >= KEPT_FOR_MS) {
      await $.store.delete(key)
    }
  }
}

export const register: Register = on => {
  let band = emptyBand()

  /** Whether a send is under way, so a press meanwhile cannot send twice. */
  let isSending = false

  /**
   * The read-back the band owes: from the module's load, which a restart or
   * a reload of its files begins, and from a conversation's end in this
   * process, until the next turn or a read settles it.
   */
  let owed: Owed | null = { ended: null }

  /** Where the conversation stood when the band was last kept or read back. */
  let seen: Place | null = null

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

  const owing = () => owed

  /**
   * Takes a read-back onto the band, unless a turn or a conversation's end
   * overtook it while it read: the conversation it read is the one the band
   * follows from here.
   */
  const takeBack = (asked: Owed, read: ReadBack) => {
    if (owed !== asked) {
      return
    }

    owed = null
    seen = read.place

    if (read.gate !== null) {
      band.drawn = read.gate
    }
  }

  // Announced, never always-on: the engine collects a gate only for a session
  // that asked for one, and every Bash child inherits this. A fresh load
  // comes back to a conversation this module has not followed, so the band
  // is read back from the store, and bands kept past any resume are dropped.
  on('session.start', async ($, e, next) => {
    await $.env.set('WORKFLOWS_GATE_SURFACE', '1')

    owed = { ended: null }
    await readBack($, owing, takeBack)

    if (band.drawn !== null) {
      $.ui.invalidate('ui.render')
    }

    await forgetExpired($)

    return next(e)
  }).catch(($, e, next) => next(e))

  // A /clear or a resume goes on in this process as another conversation,
  // which no gate of this one answers. What the band showed is kept for this
  // one first, stamped where its transcript ends now, which can have moved
  // since its last turn's end.
  on('session.end', async ($, e, next) => {
    try {
      const place = await placeOf($)

      if (isSameConversation(place, seen)) {
        await keep($, place, band.drawn, seen)
        seen = place
      }
    } finally {
      band = emptyBand()
      owed = { ended: seen }
      seen = null
      $.ui.invalidate('ui.render')
    }

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

  // Drawn at the turn's end, once what the rows choose between is on screen,
  // and kept with where the transcript ends, which a resume must still match.
  on('turn.complete', async ($, e, next) => {
    if (inConversation(e)) {
      const gate = gateAtTurnEnd(e.isAborted)

      band.armed = null
      band.answering = null
      owed = null

      if (gate !== null) {
        band.drawn = gate
        $.ui.invalidate('ui.render')
      }

      const { drawn } = band
      const place = await placeOf($)

      await keep($, place, drawn, seen)
      seen = place
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // A drawing while a read-back is owed — a reload's first, the first after
  // a conversation's end, one before the transcript was there to read —
  // settles it first.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    await readBack($, owing, takeBack)

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
  // own render. The band follows the conversation the turn runs in, owing
  // no read-back.
  on('turn.start', ($, e, next) => {
    const { drawn, isOpenedByPerson } = band

    owed = null
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
