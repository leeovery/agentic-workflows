/**
 * workflow-gates — the agentic-workflows engine's gates drawn above the
 * prompt instead of printed by the model.
 *
 * The engine states each gate as data beside the menu it composed. This
 * module announces itself so the engine collects it, arms the gate off the
 * Bash result that carried it, cuts the menu out of what the model reads, and
 * draws the rows in the band once the model's turn is over. A press picks its
 * row's answer into the prompt box; a second press on that row sends it as the
 * next message, which the workflows' prose reads as the answer, or while
 * Claude works on anything else holds it until Claude finishes. In a session
 * that announced, what the band shows is kept in the conversation's folder
 * across a restart, so a conversation resumed where nothing has happened
 * since shows its gate again.
 *
 * Every path up to the cut fails open: the engine emits the menu regardless,
 * so where the module never loads, or a cut throws or overruns, the model
 * reads the text menu the engine wrote.
 *
 * The module also sets Claude Code's harness for the workflows: every session
 * gets the SendUserMessage tool, kept behind ToolSearch, and a conversation
 * the engine has marked as running the workflows goes without Claude's
 * thinking summarised as output and without the nudge to say what it is
 * doing, the person's own values of both put back as it ends. A conversation
 * the engine has not marked keeps them untouched.
 */
import type {
  AgentLoop,
  EngineInterface,
  PromptOrigin,
  Register,
  SessionMessage,
} from 'claude-code'

import {
  IDLE,
  NO_SENDS,
  answerOf,
  linesOf,
  type Gate,
  type Option,
  type Sends,
} from './layout.ts'

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

/** Where each conversation that runs the workflows keeps what belongs to it. */
const CONVERSATIONS = '.workflows/.cache/.conversations'

/** The file the engine marks a conversation that runs the workflows with. */
const MARKER = 'workflow'

/** The file a conversation's band is kept in for a resume. */
const KEPT = 'gate.json'

const STOP_NOTE =
  "The options are on screen as buttons. The user's answer arrives as their next message — typed by them, or sent for them by the workflow-gates plugin when they press a row."

/**
 * What the band holds of the conversation's gates. A turn the person starts
 * clears all of it but the gate that turn answers; a turn anyone else starts
 * leaves it as it is; the conversation's end clears all.
 */
type Band = {
  /** The gate a render armed, waiting on the end of its turn. */
  armed: Gate | null
  /** The gate on the band, from a turn's end to a turn the person starts. */
  drawn: Gate | null
  /** The answer a press put in the prompt box: a press on its row sends it. */
  picked: string | null
  /** The answer held to send when Claude finishes, and one a gate dropped. */
  sends: Sends
  /**
   * Whether the submission that opens the next turn is the person's; a turn
   * no submission opened counts as theirs.
   */
  isOpenedByPerson: boolean
  /** Whose the running turn is, the person's or anyone else's; null idle. */
  running: 'person' | 'other' | null
  /** The gate on the band when the person's running turn began. */
  answering: Gate | null
  /** Whether the running turn has called a tool. */
  hasCalledTool: boolean
}

const emptyBand = (): Band => ({
  armed: null,
  drawn: null,
  picked: null,
  sends: NO_SENDS,
  isOpenedByPerson: true,
  running: null,
  answering: null,
  hasCalledTool: false,
})

/**
 * What a turn's end leaves for the prompt box: a held answer's row, sent now
 * or handed back as a pick; and the text of a pick whose gate went, which
 * the box may still hold.
 */
type Settled = {
  held: { option: Option; isToSend: boolean } | null
  gone: string | null
}

const NOTHING_SETTLED: Settled = { held: null, gone: null }

/** Whether two gates state the same question over the same rows. */
const isSameGate = (gate: Gate | null, other: Gate | null) =>
  JSON.stringify(gate) === JSON.stringify(other)

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

/**
 * Whether the session announces the gate surface: set at its start, and
 * still set after a reload of the module. The band is kept and read back
 * only where it is, so a process whose session never announced — one this
 * module was loaded into after it started — never gets a kept gate back.
 */
async function isAnnounced($: EngineInterface): Promise<boolean> {
  return (await $.env.get('WORKFLOWS_GATE_SURFACE')) === '1'
}

/** Whether an event is the conversation's own, not a subagent's loop. */
const inConversation = (e: AgentLoop) => e.agentId === undefined

/**
 * Whether the band takes a gate a Bash call stated: the conversation's own
 * call, not a subagent's; and the terminal the session's only screen, since
 * the band is the terminal's and any other screen shows the menu as text
 * alone.
 */
async function isForBand($: EngineInterface, e: AgentLoop): Promise<boolean> {
  if (!inConversation(e)) {
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

/** Puts `text` in the prompt box in place of what is there; whether it took. */
async function fill($: EngineInterface, text: string): Promise<boolean> {
  const { isFilled } = await $.prompt.fill({ text, mode: 'replace' })

  return isFilled
}

/**
 * Sends a row as the next message, the send recorded; whether it entered. A
 * send that fails or is dropped leaves no send recorded.
 */
async function submit(
  $: EngineInterface,
  gate: Gate,
  option: Option,
): Promise<boolean> {
  const answer = answerOf(option)
  let isSent = false

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
      await $.fs.write(SENT, NOTHING_SENT)
    }
  }

  return isSent
}

/**
 * Empties the prompt box while it holds exactly `text`, a pick's answer; a
 * draft the person has edited stays.
 */
async function unpick($: EngineInterface, text: string) {
  const box = await $.prompt.read()

  if (box.text === text) {
    await fill($, '')
  }
}

/**
 * Sends the picked row, the box cleared first; a send that fails or is
 * dropped puts the answer back in the box, where the pick says it is.
 */
async function send($: EngineInterface, gate: Gate, option: Option) {
  let isSent = false

  await fill($, '')

  try {
    isSent = await submit($, gate, option)
  } finally {
    if (!isSent) {
      await fill($, answerOf(option))
    }
  }
}

/**
 * Where a conversation stands: its session id, which names its folder, and
 * the stamp of the step its transcript ends on.
 */
type Place = { id: string; stamp: string }

/** What a conversation's folder keeps of its band: its gate, and where the transcript ended. */
type Kept = { stamp: string; gate: Gate }

/** A band read back from its folder: where the conversation stands, its gate. */
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
 * The lines Claude Code writes around an interrupted turn rather than the
 * conversation taking a step: the interruption itself, which can land after
 * that turn's end has kept the band, and the reply it puts in the model's
 * place when the conversation is resumed after one. No stamp reads them.
 */
const isInterruption = (message: SessionMessage) =>
  (message.role === 'user' &&
    message.text.startsWith('[Request interrupted by user')) ||
  (message.role === 'assistant' &&
    message.text === 'No response requested.' &&
    message.toolUses.length === 0)

/**
 * Where the conversation stands now; null until it takes a step. The stamp
 * is the last step — who wrote it, its text, the calls it makes or answers —
 * and the newest call of all, so a conversation that moved on and came to
 * rest on the same words is told apart.
 */
async function placeOf($: EngineInterface): Promise<Place | null> {
  const id = await $.session.id()
  const steps = (await $.session.messages()).filter(
    message => !isInterruption(message),
  )
  const last = steps.at(-1)

  if (last === undefined) {
    return null
  }

  const calls = steps.flatMap(callsOf)

  return {
    id,
    stamp: JSON.stringify([
      last.role,
      last.text,
      callsOf(last),
      calls.at(-1) ?? null,
    ]),
  }
}

const isSamePlace = (place: Place, other: Place | null) =>
  other !== null && place.id === other.id && place.stamp === other.stamp

/** Whether `place` is the conversation `seen` read, however far on. */
const isSameConversation = (place: Place | null, seen: Place | null) =>
  place !== null && seen !== null && place.id === seen.id

const isKept = (value: unknown): value is Kept =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Kept).stamp === 'string'

/**
 * A file in the folder of the conversation `id`, which the engine names by
 * the id's safe characters alone.
 */
const inFolder = (id: string, file: string) =>
  `${CONVERSATIONS}/${id.replace(/[^A-Za-z0-9_-]/g, '')}/${file}`

/** Whether the engine has marked the conversation `id` as one that runs the workflows. */
async function isWorkflow($: EngineInterface, id: string): Promise<boolean> {
  return $.fs.exists(inFolder(id, MARKER))
}

/**
 * Keeps what the band shows for the conversation at `place` — the gate, or
 * nothing — in its folder, in a session that announced and a conversation
 * that runs the workflows: any other conversation gets no folder.
 */
async function keep($: EngineInterface, place: Place | null, gate: Gate | null) {
  if (
    place === null ||
    !(await isAnnounced($)) ||
    !(await isWorkflow($, place.id))
  ) {
    return
  }

  const kept: Kept | null = gate === null ? null : { stamp: place.stamp, gate }

  await $.fs.write(inFolder(place.id, KEPT), JSON.stringify(kept))
}

/** What the folder of the conversation `id` keeps; undefined where it keeps nothing readable. */
async function keptFor($: EngineInterface, id: string): Promise<unknown> {
  try {
    return JSON.parse(await $.fs.read(inFolder(id, KEPT)))
  } catch {
    return undefined
  }
}

/**
 * The person's own values of the settings the harness sets, absent where
 * unset: what the harness replaced, kept while it is on.
 */
type Replaced = {
  CLAUDE_CODE_THINKING_DISPLAY_UPDATES?: string
  CLAUDE_CODE_SILENT_TURN_REMINDER?: string
}

/**
 * Puts Claude Code's harness on for a workflow session, one whose
 * conversation the engine has marked: no summary of Claude's thinking
 * printed as if it were output, and no nudge to say what it is doing. Claude
 * Code reads both per request. What it replaces is kept in the process's
 * environment, which a reload of the module's files keeps, and only where
 * nothing is kept yet: the values are read before that is looked at, so a
 * harness another call has just put on is never kept as the person's.
 */
async function harnessOn($: EngineInterface) {
  const replaced: Replaced = {
    CLAUDE_CODE_THINKING_DISPLAY_UPDATES: await $.env.get(
      'CLAUDE_CODE_THINKING_DISPLAY_UPDATES',
    ),
    CLAUDE_CODE_SILENT_TURN_REMINDER: await $.env.get(
      'CLAUDE_CODE_SILENT_TURN_REMINDER',
    ),
  }

  if ((await $.env.get('WORKFLOWS_HARNESS_REPLACED')) === undefined) {
    await $.env.set('WORKFLOWS_HARNESS_REPLACED', JSON.stringify(replaced))
  }

  await $.env.set('CLAUDE_CODE_THINKING_DISPLAY_UPDATES', 'false')
  await $.env.set('CLAUDE_CODE_SILENT_TURN_REMINDER', 'false')
}

/**
 * Takes the harness off, putting back exactly what it replaced: the person's
 * value, or none. Where the harness is not on, nothing is touched.
 */
async function harnessOff($: EngineInterface) {
  const kept = await $.env.get('WORKFLOWS_HARNESS_REPLACED')

  if (kept === undefined) {
    return
  }

  const replaced = JSON.parse(kept) as Replaced

  await $.env.set(
    'CLAUDE_CODE_THINKING_DISPLAY_UPDATES',
    replaced.CLAUDE_CODE_THINKING_DISPLAY_UPDATES,
  )
  await $.env.set(
    'CLAUDE_CODE_SILENT_TURN_REMINDER',
    replaced.CLAUDE_CODE_SILENT_TURN_REMINDER,
  )
  await $.env.set('WORKFLOWS_HARNESS_REPLACED', undefined)
}

/**
 * Settles the read-back the band owes, if `owing` says it owes one: `take`
 * gets the conversation the transcript holds now, with its kept gate where
 * the transcript still ends where it was kept, or none where it has moved
 * on, the kept gate dropped while the read-back is still owed. A
 * conversation the engine has marked gets the workflow harness back, again
 * while the read-back is still owed. Nothing settles in a session that did
 * not announce, while the transcript is empty, or while it still holds the
 * conversation that ended in this process.
 */
async function readBack(
  $: EngineInterface,
  owing: () => Owed | null,
  take: (asked: Owed, read: ReadBack) => void,
) {
  const asked = owing()

  if (asked === null || !(await isAnnounced($))) {
    return
  }

  const place = await placeOf($)

  if (place === null || isSamePlace(place, asked.ended)) {
    return
  }

  if ((await isWorkflow($, place.id)) && owing() === asked) {
    await harnessOn($)
  }

  const kept = await keptFor($, place.id)

  if (isKept(kept) && kept.stamp === place.stamp) {
    take(asked, { place, gate: kept.gate })

    return
  }

  if (isKept(kept) && owing() === asked) {
    await $.fs.write(inFolder(place.id, KEPT), JSON.stringify(null))
  }

  take(asked, { place, gate: null })
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
   * The person takes the turn: the band comes down, keeping the gate their
   * turn answers. Whether a gate came down.
   */
  const takeDown = (): boolean => {
    const { drawn } = band

    band = { ...emptyBand(), running: 'person', answering: drawn }

    return drawn !== null
  }

  /**
   * Settles the band as the conversation's turn ends. The person's turn
   * draws the gate it rendered; an Esc drops that and takes the answer back,
   * its gate returning, until the turn calls a tool, which may already have
   * acted on the answer: a read and a write look alike from here. Anyone
   * else's turn leaves the band as it is unless it rendered another gate: at
   * its end that gate takes the band and drops a held answer unsent; after an
   * Esc, which leaves the model at that gate's stop, the band empties. A held
   * answer on the gate still there sends now, or after an Esc goes back to
   * the prompt as a pick; a pick whose gate went goes with it.
   */
  const endTurn = (isInterrupted: boolean): Settled => {
    const { running, armed, drawn, picked, answering, hasCalledTool, sends } =
      band

    band = { ...band, armed: null, running: null, answering: null }

    if (running !== 'other') {
      band.drawn = isInterrupted ? (hasCalledTool ? null : answering) : armed

      return NOTHING_SETTLED
    }

    const gate = armed ?? drawn

    if (!isSameGate(gate, drawn)) {
      band = isInterrupted
        ? { ...band, drawn: null, picked: null, sends: NO_SENDS }
        : {
            ...band,
            drawn: gate,
            picked: null,
            sends: { held: null, dropped: sends.held },
          }

      return { held: null, gone: picked }
    }

    band.sends = { ...sends, held: null }

    const option =
      drawn === null || sends.held === null
        ? null
        : optionIn(drawn, { answer: sends.held })

    return {
      held: option === null ? null : { option, isToSend: !isInterrupted },
      gone: null,
    }
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
  // is read back from the conversation's folder.
  on('session.start', async ($, e, next) => {
    await $.env.set('WORKFLOWS_GATE_SURFACE', '1')

    // Claude Code builds its tool catalogue just after this hook, so only
    // here does the switch that gives the session SendUserMessage count.
    await $.env.set('CLAUDE_CODE_PEWTER_OWL_TOOL', 'true')

    owed = { ended: null }
    await readBack($, owing, takeBack)

    if (band.drawn !== null) {
      $.ui.invalidate('ui.render')
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // A /clear or a resume goes on in this process as another conversation,
  // which no gate of this one answers and which is no workflow session until
  // the engine marks it or it is read back as one it has marked. What the
  // band showed is kept for this one first, stamped where its transcript
  // ends now, which can have moved since its last turn's end.
  on('session.end', async ($, e, next) => {
    try {
      const place = await placeOf($)

      if (isSameConversation(place, seen)) {
        await keep($, place, band.drawn)
        seen = place
      }
    } finally {
      band = emptyBand()
      owed = { ended: seen }
      seen = null
      $.ui.invalidate('ui.render')
      await harnessOff($)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', ($, e, next) => {
    if (inConversation(e)) {
      band.hasCalledTool = true
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // Every engine call marks the conversation that made it, whatever its exit,
  // so after each of the conversation's own commands the mark says whether it
  // runs the workflows; a command that only mentions the engine marks nothing.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const result = await next(e)

    if (inConversation(e) && (await isWorkflow($, await $.session.id()))) {
      await harnessOn($)
    }

    if (result.deny !== undefined || result.isError === true) {
      return result
    }

    const record = result.result
    const stated = gateIn(record.stdout)

    if (stated === null) {
      return result
    }

    const isArmed = await isForBand($, e)

    if (isArmed) {
      band.armed = stated.gate
    }

    return {
      result: { ...record, stdout: isArmed ? stated.cut : stated.text },
    }
  }).catch(($, e, next) => next(e))

  // The tool waits behind ToolSearch in every session, workflow or not: one
  // answer, since a changed answer sends the tool list again and spends the
  // prompt cache.
  on('tool.describe', { tool: 'SendUserMessage' }, async ($, e, next) => ({
    ...(await next(e)),
    isDeferred: true,
  })).catch(($, e, next) => next(e))

  // Drawn at the turn's end, once what the rows choose between is on screen,
  // and kept with where the transcript ends, which a resume must still match.
  // A held answer is not kept: it waits on a turn no resume brings back. It
  // sends once the turn is over, and one not sent is put back as a pick; the
  // answer of a pick whose gate went leaves the prompt box.
  on('turn.complete', async ($, e, next) => {
    if (!inConversation(e)) {
      return next(e)
    }

    const settled = endTurn(e.isAborted)
    const { drawn } = band

    owed = null

    if (drawn !== null) {
      $.ui.invalidate('ui.render')
    }

    const place = await placeOf($)

    await keep($, place, drawn)
    seen = place

    const answered = await next(e)
    const { held, gone } = settled

    if (gone !== null) {
      await unpick($, gone)
    }

    if (held !== null && drawn !== null) {
      const answer = answerOf(held.option)
      let isSent = false

      isSending = true

      try {
        isSent = held.isToSend && (await submit($, drawn, held.option))
      } finally {
        isSending = false

        if (!isSent && (await fill($, answer))) {
          band.picked = answer
          $.ui.invalidate('ui.render')
        }
      }
    }

    return answered
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
      const { bodyColumns: columns, maxRows } = e.props

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
            height: linesOf(gate, columns, IDLE, band.sends, maxRows).length,
            props: {
              gate,
              picked: band.picked,
              ...band.sends,
              columns,
              maxRows,
            },
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
  // press again. While anyone else's turn runs, the send is held, its answer
  // out of the prompt box, until that turn ends; a press on the held row
  // takes it back to a pick, and a press on another row picks that instead.
  on('ui.message', { element: ELEMENT }, async ($, e, next) => {
    const gate = band.drawn
    const option = gate === null || isSending ? null : optionIn(gate, e.data)

    if (gate === null || option === null) {
      return next(e)
    }

    const answer = answerOf(option)

    if (answer !== band.picked) {
      if (await fill($, answer)) {
        band.picked = answer
        band.sends = { ...band.sends, held: null }
        $.ui.invalidate('ui.render')
      }
    } else if (band.running === 'other') {
      if (await fill($, '')) {
        band.picked = null
        band.sends = { ...band.sends, held: answer }
        $.ui.invalidate('ui.render')
      }
    } else {
      isSending = true

      try {
        await send($, gate, option)
      } finally {
        isSending = false
      }
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // A submission made while the session idles opens the next turn; one made
  // over a running turn joins it, and the person's makes anyone else's turn
  // theirs, which takes the band down.
  on('prompt.submit', ($, e, next) => {
    const isTheirs = isPersons(e.origin, $.plugin.name)

    if (e.turnId === undefined) {
      band.isOpenedByPerson = isTheirs
    } else if (isTheirs && band.running === 'other') {
      if (takeDown()) {
        $.ui.invalidate('ui.render')
      }
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // A gate lives from its render to the turn the person starts to answer it,
  // which keeps it to put back; a gate the conversation re-presents is armed
  // again by its own render. Anyone else's turn — an agent's report, a
  // notification, a schedule — leaves the band live, its rows still to
  // press. The band follows the conversation the turn runs in, owing no
  // read-back.
  on('turn.start', ($, e, next) => {
    owed = null

    if (!band.isOpenedByPerson) {
      band = {
        ...band,
        armed: null,
        isOpenedByPerson: true,
        running: 'other',
        hasCalledTool: false,
      }
    } else if (takeDown()) {
      $.ui.invalidate('ui.render')
    }

    return next(e)
  }).catch(($, e, next) => next(e))
}
