/**
 * Ready to discuss (§20.6, 12.13.10–12.13.17): the questions waiting on the
 * person are a mailbox the board shows and never answers. A press on
 * "▸ discuss" queues one in the READY TO DISCUSS box, "▸ discuss all" every
 * one not yet queued, as the board lists them, oldest first; "▸ unqueue",
 * a row's ✕ and "▸ cancel all" take them back out. None of them says
 * anything to Claude, nor fills the prompt box, nor raises anything.
 *
 * "▸ send to Claude" sends the box as one message, in the order it was
 * queued, and the questions become the discussion: the one under discussion
 * and those after it, which a queue sent meanwhile joins at the end. While
 * one is discussed, "▸ skip" sets it back to waiting and moves to the next,
 * "▸ cancel" and "▸ cancel all" set it and every one after it back. Each of
 * those puts exactly one line in the conversation, and nothing else the
 * board holds does.
 *
 * The discussion is kept in the conversation's folder as `discussing.json`,
 * `{"discussing", "queue"}` by number, which the engine's `raise` reads for
 * the next question its receipt names. Claude recording a question answered
 * or set aside takes it out of the discussion, the next after it then
 * under discussion; the receipt's own words say which. What waits is
 * always the engine's (`board.questions`): a question no longer waiting
 * leaves the box and the discussion wherever it stood in them.
 */
import { COLOUR, MARK, blank, heading, spread, type Button, type Line, type Part } from './draw.ts'
import type { Banner, Fact, Question } from './model.ts'

/** The file the discussion is kept in, in the conversation's folder. */
export const DISCUSSING = 'discussing.json'

/** The receipt's words for a question recorded answered, and set aside (20.6.9). */
const ANSWERED = 'answered'
const SET_ASIDE = 'set aside'

/** A receipt's head: the questions it names, and what became of them. */
const RECEIPT = new RegExp(`^(Q\\d+(?:, Q\\d+)*) (${ANSWERED}|${SET_ASIDE}) · `)

/**
 * The questions the person has queued and not yet sent (the box), by number
 * in the order queued; and the discussion sent: the question under
 * discussion and those after it, in order.
 */
export type Discussion = {
  ready: readonly string[]
  discussing: string | null
  queue: readonly string[]
}

/** Nothing queued, nothing under discussion. */
export const QUIET: Discussion = { ready: [], discussing: null, queue: [] }

/** The keys a press on the box, a question or the banner addresses. */
const DISCUSS = 'discuss:'
const ALL = 'all'
const UNQUEUE = 'unqueue:'
const DROP = 'drop:'
const SEND = 'ready:send'
const CLEAR = 'ready:cancel'
const SKIP = 'discussion:skip'
const CANCEL = 'discussion:cancel'

const discussKey = (question: string) => `${DISCUSS}${question}`
const DISCUSS_ALL = discussKey(ALL)
const unqueueKey = (question: string) => `${UNQUEUE}${question}`
const dropKey = (question: string) => `${DROP}${question}`

const SEND_BUTTON: Button = { key: SEND, label: '▸ send to Claude' }
const CLEAR_BUTTON: Button = { key: CLEAR, label: '▸ cancel all' }
const SKIP_BUTTON: Button = { key: SKIP, label: '▸ skip' }
const CANCEL_BUTTON: Button = { key: CANCEL, label: '▸ cancel' }
const CANCEL_ALL_BUTTON: Button = { key: CANCEL, label: '▸ cancel all' }

/** The numbers under discussion, the one discussed first. */
const talkOf = ({ discussing, queue }: Discussion): string[] => (discussing === null ? [...queue] : [discussing, ...queue])

/** A discussion of `talk`, the first under discussion, and the box `ready`. */
const talking = (talk: readonly string[], ready: readonly string[]): Discussion => ({
  ready,
  discussing: talk[0] ?? null,
  queue: talk.slice(1),
})

/**
 * The discussion as it stands against what waits: a question no longer
 * waiting out of the box and the discussion, the next after it then under
 * discussion; a question under discussion out of the box.
 */
export function live(discussion: Discussion, questions: readonly Question[]): Discussion {
  const waits = new Set(questions.map(({ question }) => question))
  const talk = talkOf(discussion).filter(question => waits.has(question))

  return talking(
    talk,
    discussion.ready.filter(question => waits.has(question) && !talk.includes(question)),
  )
}

/** The discussion once Claude recorded each of `names`, the next after them under discussion. */
export const recorded = (discussion: Discussion, names: readonly string[]): Discussion =>
  talking(
    talkOf(discussion).filter(question => !names.includes(question)),
    discussion.ready,
  )

/** The questions waiting neither queued nor under discussion, as the board lists them: what "▸ discuss all" queues. */
const looseOf = (discussion: Discussion, questions: readonly Question[]): string[] => {
  const held = new Set([...discussion.ready, ...talkOf(discussion)])

  return questions.map(({ question }) => question).filter(question => !held.has(question))
}

/** What a press did: the discussion after it, and the one line it says to Claude, null for one that says nothing. */
export type Pressed = { discussion: Discussion; line: string | null }

const quiet = (discussion: Discussion): Pressed => ({ discussion, line: null })

/** What sending the box says: one question with its wording, several by number in the order queued. */
function readyLine(ready: readonly string[], questions: readonly Question[]): string {
  if (ready.length === 1) {
    const [only] = ready

    return `Ready to discuss ${only}: ${questions.find(({ question }) => question === only)?.asks ?? ''}`
  }

  const all = ready.length === questions.length ? 'all ' : ''

  return `Ready to discuss ${all}${ready.length} waiting questions, in this order: ${ready.join(', ')}.`
}

/** "▸ send to Claude": the box becomes the discussion, or joins the end of the one under way. */
function sent(discussion: Discussion, questions: readonly Question[]): Pressed {
  const { ready } = discussion
  const talk = talkOf(discussion)

  if (ready.length === 0) {
    return quiet(discussion)
  }

  return {
    discussion: talking([...talk, ...ready], []),
    line:
      talk.length === 0
        ? readyLine(ready, questions)
        : `Also ready to discuss ${ready.join(', ')}, after ${talk.at(-1)}.`,
  }
}

/** "▸ skip": the question discussed back to waiting, the next after it raised. */
function skipped(discussion: Discussion): Pressed {
  const { discussing, queue } = discussion
  const [next] = queue

  return discussing === null || next === undefined
    ? quiet(discussion)
    : { discussion: { ...discussion, discussing: next, queue: queue.slice(1) }, line: `Skip ${discussing} for now; it stays waiting. Next: ${next}.` }
}

/** "▸ cancel", "▸ cancel all": the question discussed and every one after it back to waiting. */
function cancelled(discussion: Discussion): Pressed {
  const talk = talkOf(discussion)

  if (talk.length === 0) {
    return quiet(discussion)
  }

  return {
    discussion: talking([], discussion.ready),
    line: talk.length === 1 ? `Set ${talk[0]} aside; it stays waiting.` : `Set ${talk.join(', ')} aside; they stay waiting.`,
  }
}

/** The box with `question` taken back out. */
const unqueued = (discussion: Discussion, question: string): Pressed =>
  quiet({ ...discussion, ready: discussion.ready.filter(each => each !== question) })

/** The box with each of `questions` loose queued after what it holds. */
function queued(discussion: Discussion, questions: readonly Question[], which: string): Pressed {
  const loose = looseOf(discussion, questions)
  const adding = which === ALL ? loose : loose.filter(question => question === which)

  return quiet({ ...discussion, ready: [...discussion.ready, ...adding] })
}

/**
 * What a press on `key` does to the discussion as it stands against the
 * questions waiting; null for a key that is not the discussion's.
 */
export function pressedOn(key: string, discussion: Discussion, questions: readonly Question[]): Pressed | null {
  if (key === SEND) {
    return sent(discussion, questions)
  }

  if (key === CLEAR) {
    return quiet({ ...discussion, ready: [] })
  }

  if (key === SKIP) {
    return skipped(discussion)
  }

  if (key === CANCEL) {
    return cancelled(discussion)
  }

  if (key.startsWith(DISCUSS)) {
    return queued(discussion, questions, key.slice(DISCUSS.length))
  }

  for (const prefix of [UNQUEUE, DROP]) {
    if (key.startsWith(prefix)) {
      return unqueued(discussion, key.slice(prefix.length))
    }
  }

  return null
}

/** The discussion as its file keeps it: the box is the board's alone, never kept. */
export const keptOf = ({ discussing, queue }: Discussion): string => JSON.stringify({ discussing, queue })

const isNumber = (value: unknown): value is string => typeof value === 'string' && /^Q\d+$/.test(value)

/** The discussion a kept file holds, the box empty; none from a file that does not hold one. */
export function discussionIn(text: string | null): Discussion {
  try {
    const kept: unknown = text === null ? null : JSON.parse(text)
    const { discussing, queue } = (kept ?? {}) as { discussing?: unknown; queue?: unknown }

    return Array.isArray(queue) && (discussing === null || isNumber(discussing))
      ? { ready: [], discussing, queue: queue.filter(isNumber) }
      : QUIET
  } catch {
    return QUIET
  }
}

/** The receipt an engine call answered with, where it answered one. */
function receiptIn(stdout: string): string | null {
  for (const text of [stdout.trim(), stdout.split('\n')[0] ?? '']) {
    try {
      const said: unknown = JSON.parse(text)
      const receipt = (said as { receipt?: unknown } | null)?.receipt

      return typeof receipt === 'string' ? receipt : null
    } catch {}
  }

  return null
}

/** The questions a `raise` answer's receipt says were recorded answered or set aside; none for any other answer. */
export function recordedIn(stdout: string): string[] {
  const head = RECEIPT.exec(receiptIn(stdout) ?? '')

  return head === null ? [] : (head[1] ?? '').split(', ')
}

/** The question by its number. */
const questionOf = (questions: readonly Question[], number: string) => questions.find(({ question }) => question === number)

/** The build banner's word for its phase (domain/projections/board-build.cjs). */
const PHASE = 'build'

/**
 * The banner's facts in a build that say where the session is: "stopped"
 * where nothing can proceed, then its type and phase, as the build's banner
 * leads with them. A queue or a discussion takes the place of everything
 * after them, as the locked board draws it.
 */
function whereOf(facts: readonly Fact[]): Fact[] {
  return facts.slice(0, facts.findIndex(({ text }) => text === PHASE) + 1)
}

const fact = (text: string, needs = false): Fact => ({ text, needs })

/** The task a question parks first, as the banner names it: `task 6.7 "{its title}"`; none for one parking none. */
function parkedFact(question: Question | undefined): Fact[] {
  const first = question?.parks[0]

  return first === undefined ? [] : [fact(`task ${first.task} "${first.title}"`)]
}

/** The banner as the discussion draws it (20.2.4), and the buttons it carries before the board's own. */
export type Discussed = { banner: Banner; buttons: Button[] }

/**
 * The banner with the discussion's facts and buttons: while a question is
 * discussed, which and the task it parks, how many more are to discuss and
 * how many queued, with "▸ skip" and "▸ cancel all" while more follow it,
 * else "▸ cancel", and "▸ send to Claude" while questions are queued
 * meanwhile; while questions are queued, how many, with "▸ send to Claude"
 * and "▸ cancel all"; while any wait, "▸ discuss" for one and "▸ discuss
 * all" for several.
 */
export function discussedBanner(banner: Banner, discussion: Discussion, questions: readonly Question[]): Discussed {
  const { ready, discussing, queue } = discussion

  if (discussing !== null) {
    return {
      banner: {
        ...banner,
        facts: [
          ...whereOf(banner.facts),
          fact(`Discussing ${discussing}`, true),
          ...parkedFact(questionOf(questions, discussing)),
          ...(queue.length === 0 ? [] : [fact(`${queue.length} more to discuss`)]),
          ...(ready.length === 0 ? [] : [fact(`${ready.length} queued`)]),
        ],
      },
      buttons: [
        ...(ready.length === 0 ? [] : [SEND_BUTTON]),
        ...(queue.length === 0 ? [CANCEL_BUTTON] : [SKIP_BUTTON, CANCEL_ALL_BUTTON]),
      ],
    }
  }

  if (ready.length > 0) {
    return {
      banner: { ...banner, facts: [...whereOf(banner.facts), fact(`${ready.length} queued to discuss`, true)] },
      buttons: [SEND_BUTTON, CLEAR_BUTTON],
    }
  }

  const loose = looseOf(discussion, questions)
  const [only] = loose

  return {
    banner,
    buttons:
      only === undefined ? [] : loose.length === 1 ? [{ key: discussKey(only), label: '▸ discuss' }] : [{ key: DISCUSS_ALL, label: '▸ discuss all' }],
  }
}

/** How long a question has waited, from when it parked to `now`. */
function waitedOf(since: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - Date.parse(since)) / 60_000))

  if (minutes < 1) {
    return 'waiting under a minute'
  }

  return minutes < 60 ? `waiting ${minutes}m` : `waiting ${Math.floor(minutes / 60)}h`
}

/** What a question parks: its tasks, and those waiting after them ("parks 6.8, and 2 after it"). */
function parksOf({ parks, after }: Question): string {
  const held = parks.length === 0 ? 'parks no task' : `parks ${parks.map(({ task }) => task).join(', ')}`
  const [one] = after

  if (one === undefined) {
    return held
  }

  return after.length === 1 ? `${held}, and ${one} after it` : `${held}, and ${after.length} after it`
}

const INDENT = '     '

/**
 * A question's second line: what it parks and how long it has waited, then
 * where it stands in the discussion — "being discussed" with "▸ skip" while
 * more follow it, else "▸ cancel"; "after Q1" behind it; "queued" with
 * "▸ unqueue" in the box; else "▸ discuss".
 */
function standingOf(question: Question, discussion: Discussion, width: number, now: number): Line {
  const key = `qt:${question.question}`
  const said: Part = { text: `${INDENT}${parksOf(question)} · ${waitedOf(question.since, now)}`, color: COLOUR.notStarted }
  const talk = talkOf(discussion)
  const place = talk.indexOf(question.question)
  const at = (right: Part[], button?: Button): Line => ({
    key,
    parts: spread([said], right, width - (button === undefined ? 0 : [...button.label].length)),
    ...(button === undefined ? {} : { button }),
  })

  if (place === 0) {
    return at(
      [{ text: 'being discussed ', color: COLOUR.needs }],
      discussion.queue.length > 0 ? SKIP_BUTTON : CANCEL_BUTTON,
    )
  }

  if (place > 0) {
    return at([{ text: `after ${talk[place - 1]}`, color: COLOUR.notStarted }])
  }

  if (discussion.ready.includes(question.question)) {
    return at([{ text: 'queued ', color: COLOUR.needs }], { key: unqueueKey(question.question), label: '▸ unqueue' })
  }

  return at([], { key: discussKey(question.question), label: '▸ discuss' })
}

/**
 * WAITING ON YOU (20.5.3, 20.6.4, 20.6.11): its heading with the count,
 * "▸ cancel all" while more follow the one discussed, else "▸ discuss all"
 * while more than one waits and any is neither queued nor discussed; each
 * question by its number and full wording, then what it parks, how long it
 * has waited and where it stands. Nothing while none waits.
 */
export function waitingLines(questions: readonly Question[], discussion: Discussion, width: number, now: number): Line[] {
  if (questions.length === 0) {
    return []
  }

  const button: Button | undefined =
    discussion.discussing !== null && discussion.queue.length > 0
      ? CANCEL_ALL_BUTTON
      : questions.length > 1 && looseOf(discussion, questions).length > 0
        ? { key: DISCUSS_ALL, label: '▸ discuss all' }
        : undefined

  return [
    heading(
      'waiting',
      { text: 'WAITING ON YOU', bold: true, color: COLOUR.needs },
      [{ text: `${questions.length}${button === undefined ? '' : ' ·'}`, color: COLOUR.secondary }],
      width,
      button,
    ),
    ...questions.flatMap(question => [
      {
        key: `q:${question.question}`,
        mark: { text: `${MARK.needs} `, color: COLOUR.needs },
        wraps: true,
        parts: [{ text: `${question.question} ${question.asks}`, color: COLOUR.body }],
      },
      standingOf(question, discussion, width, now),
    ]),
    blank('waiting'),
  ]
}

/**
 * READY TO DISCUSS (20.6.4, 20.6.5): its heading with the count, each
 * question queued by its number and the task it parks, with its ✕, then
 * "▸ send to Claude" and "▸ cancel all". Nothing while none is queued.
 */
export function readyLines(questions: readonly Question[], discussion: Discussion, width: number): Line[] {
  const { ready } = discussion

  if (ready.length === 0) {
    return []
  }

  return [
    heading('ready', { text: 'READY TO DISCUSS', bold: true, color: COLOUR.needs }, [{ text: `${ready.length}`, color: COLOUR.secondary }], width),
    ...ready.map(number => {
      const question = questionOf(questions, number)
      const drop: Button = { key: dropKey(number), label: '✕' }
      const named = question?.parks[0]?.title ?? question?.asks ?? ''

      return {
        key: `ready:${number}`,
        parts: spread(
          [{ text: '└ ', color: COLOUR.rule }, { text: number, color: COLOUR.needs }, { text: `  ${named}`, color: COLOUR.body }],
          [],
          width - [...drop.label].length,
        ),
        button: drop,
      }
    }),
    {
      key: 'ready:actions',
      lead: SEND_BUTTON,
      parts: [{ text: ' '.repeat(Math.max(1, width - [...SEND_BUTTON.label].length - [...CLEAR_BUTTON.label].length)) }],
      button: CLEAR_BUTTON,
    },
  ]
}
