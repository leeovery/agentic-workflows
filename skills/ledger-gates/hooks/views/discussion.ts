/**
 * A discussion on the board (20.7): This session while the session is in a
 * topic's discussion; a topic's own page, opened from the epic's page,
 * which says what the topic is for and how many of the person's questions
 * are decided, lists what is decided and open, bare, each row opening its
 * entry, and the messages waiting (20.8.3); and an entry, a message waiting
 * and a review's report, each read in full (20.7.3).
 *
 * This session's progress line, which ends in what is open or the closing
 * pass running, wraps rather than lose those words at the edge, as each
 * question and message does under its mark, and each one's facts under its
 * indent.
 */
import { BAR_CELLS, COLOUR, INDENT, MARK, blank, counted, cutTo, dayOf, heading, progressBar, prose, spread, type Kit, type Line, type Part } from '../draw.ts'
import type { View } from '../model.ts'
import { pageKey } from '../pane.ts'
import type { ViewDrawing } from './index.ts'
import { READ, factLines, header, section, titled } from './words.ts'

type Open = { id: string; text: string; from: string | null; experiment: { id: string; running: boolean } | null }
type Message = { file: string; title: string; from: string; when: string }
type Call = { id: string; text: string; question: string | null }
type Review = { id: string; round: number; state: 'running' | 'landed' | 'lost' | 'read'; since: string; findings: number; taken: number; waiting: number }
type Decided = { id: string; text: string; who: 'yours' | 'claude' | 'carried' }
type Sent = { title: string; to: string; file: string; at: string; stands: 'waiting' | 'taken' | 'inbox' }

type Discussion = {
  unit: string
  title: string
  type: string
  topic: string
  topic_title: string
  summary: string
  live: boolean
  progress: { decided: number; yours: number; calls: number }
  closing: boolean
  open: Open[]
  messages: Message[]
  since: Call[]
  reviews: Review[]
  decided: Decided[]
  sent: Sent[]
}

/** The bar over `of` rows, a cell a row up to the bar's width. */
const barOf = (done: number, of: number) => progressBar(done, of, Math.min(BAR_CELLS, Math.max(1, of)))

/** What ends This session's progress line: the closing pass running, else nothing of the person's open once nothing is. */
function progressEnd(view: Discussion, kit: Kit): Part[] {
  if (view.closing) {
    return [{ text: ' · ', color: COLOUR.secondary }, kit.spinner(), { text: ' closing pass', color: COLOUR.running }]
  }

  return view.open.length === 0 ? [{ text: ' · ', color: COLOUR.secondary }, { text: 'nothing of yours open', color: COLOUR.done }] : []
}

/** Where the person's questions stand: decided of theirs, Claude's calls, and what ends it. */
function progressLine(view: Discussion, kit: Kit): Line {
  const { decided, yours, calls } = view.progress
  const said: Part = { text: `  ${decided} of ${yours} of yours decided · ${counted(calls, 'call')} by Claude`, color: COLOUR.secondary }

  return { key: 'talk:progress', wraps: true, parts: [...barOf(decided, yours), said, ...progressEnd(view, kit)] }
}

/** An open question's facts: whose it is, the message it came as, and the experiment it waits on. */
const openSaid = ({ from, experiment }: Open) =>
  ['yours', ...(from === null ? [] : [`from ${from}'s message`]), ...(experiment === null ? [] : [`${experiment.id} ${experiment.running ? 'running' : 'concluded'}`])].join(' · ')

/** An open question's row, under its mark. */
const openRow = (open: Open): Line => ({ key: `talk:open:${open.id}`, mark: { text: `${MARK.waiting} `, color: COLOUR.needs }, wraps: true, parts: [{ text: open.text, color: COLOUR.body }] })

const openHeading = (view: Discussion, width: number) => heading('talk:open', { text: 'STILL OPEN', bold: true, color: COLOUR.needs }, [{ text: `${view.open.length}`, color: COLOUR.secondary }], width)

function openLines(view: Discussion, width: number): Line[] {
  return section(
    openHeading(view, width),
    view.open.flatMap(open => [openRow(open), ...factLines(`talk:open:${open.id}:said`, openSaid(open), width, `entry:${open.id}`)]),
  )
}

function messageLines(view: Discussion, width: number): Line[] {
  const summary = `${view.messages.length}${view.live ? ' · raised at the next pause' : ''}`

  return section(
    heading('talk:mail', { text: 'MESSAGES WAITING', bold: true, color: COLOUR.needs }, [{ text: summary, color: COLOUR.secondary }], width),
    messageList('talk:mail', view.topic, view.messages, width),
  )
}

/** The messages waiting in a topic's mailbox, each with its sender and day, and its button to read it. */
export const messageList = (key: string, topic: string, messages: readonly Message[], width: number): Line[] =>
  messages.flatMap(message => [
    { key: `${key}:${message.file}`, mark: { text: `${MARK.message} `, color: COLOUR.needs }, wraps: true, parts: [{ text: message.title, color: COLOUR.body }] },
    ...factLines(`${key}:${message.file}:said`, `from ${message.from} · ${message.when}`, width, `message:${topic}:${message.file}`),
  ])

function sinceLines(view: Discussion, width: number): Line[] {
  return section(
    heading('talk:since', { text: 'SINCE YOU LAST LOOKED', bold: true, color: COLOUR.gold }, [{ text: `${counted(view.since.length, 'call')} by Claude`, color: COLOUR.secondary }], width),
    view.since.flatMap(call => [
      {
        key: `talk:since:${call.id}`,
        parts: spread([{ text: `${MARK.call} `, color: COLOUR.gold }, { text: call.question ?? call.text, color: COLOUR.body }], [], width - READ.length),
        button: { key: pageKey(`entry:${call.id}`), label: READ },
      },
      { key: `talk:since:${call.id}:said`, parts: [{ text: `${INDENT}${call.text}`, color: COLOUR.secondary }] },
    ]),
  )
}

/** A round's line: running with its clock; its report in, or lost; else read, with its findings taken in or still to raise. */
function roundLine(view: Discussion, review: Review, kit: Kit): Line {
  const key = `talk:review:${review.id}`
  const round: Part = { text: ` Round ${review.round}`, color: COLOUR.body }

  if (review.state === 'running') {
    return {
      key,
      parts: spread([kit.spinner(), round, { text: ' · reading the record', color: COLOUR.secondary }], [{ text: `running ${kit.clock(review.since)}`, color: COLOUR.running }], kit.width),
    }
  }

  if (review.state !== 'read') {
    const said = review.state === 'landed' ? ' · its report in, not yet taken' : ' · lost with the conversation that sent it'

    return { key, parts: [{ text: MARK.round, color: COLOUR.violet }, round, { text: said, color: COLOUR.secondary }] }
  }

  const found = counted(review.findings, 'finding')
  const taken: Part = review.waiting > 0 ? { text: `${found}, ${review.waiting} to raise`, color: COLOUR.needs } : { text: `${found}, all taken in`, color: COLOUR.secondary }

  return {
    key,
    parts: spread([{ text: `${MARK.round} `, color: COLOUR.violet }, { text: `Round ${review.round}`, color: COLOUR.body }, { text: ' · ', color: COLOUR.secondary }, taken], [], kit.width - READ.length),
    button: { key: pageKey(`review:${view.topic}:${review.id}`), label: READ },
  }
}

function reviewLines(view: Discussion, kit: Kit): Line[] {
  return section(
    heading('talk:reviews', { text: 'REVIEWS', bold: true, color: COLOUR.violet }, [{ text: counted(view.reviews.length, 'round'), color: COLOUR.secondary }], kit.width),
    view.reviews.map(review => roundLine(view, review, kit)),
  )
}

/** Whose each decision is, as DECIDED marks it. */
const WHOSE: Readonly<Record<Decided['who'], [Part, string]>> = {
  yours: [{ text: MARK.done, color: COLOUR.done }, 'yours'],
  claude: [{ text: MARK.call, color: COLOUR.gold }, "Claude's call"],
  carried: [{ text: MARK.done, color: COLOUR.done }, 'carried over'],
}

/** DECIDED's count: the person's, Claude's calls, and those carried over where any are. */
function decidedCount({ decided }: Discussion): string {
  const of = (who: Decided['who']) => decided.filter(held => held.who === who).length
  const carried = of('carried')

  return `${of('yours')} yours · ${counted(of('claude'), 'call')} by Claude${carried === 0 ? '' : ` · ${carried} carried over`}`
}

const decidedHeading = (count: string, width: number) => heading('talk:decided', { text: 'DECIDED', bold: true, color: COLOUR.done }, [{ text: count, color: COLOUR.secondary }], width)

function decidedLines(view: Discussion, width: number): Line[] {
  return section(
    decidedHeading(decidedCount(view), width),
    view.decided.map(decided => {
      const [mark, whose] = WHOSE[decided.who]

      return {
        key: `talk:decided:${decided.id}`,
        parts: spread([mark, { text: ` ${decided.text}`, color: COLOUR.body }], [{ text: whose, color: COLOUR.secondary }], width),
        press: pageKey(`entry:${decided.id}`),
      }
    }),
  )
}

/** Where a message the topic sent stands, as SENT says it. */
const SENT_STANDS: Readonly<Record<Sent['stands'], string>> = { waiting: 'in its mailbox', taken: 'taken in', inbox: 'moved to the inbox' }

function sentLines(view: Discussion, width: number): Line[] {
  return section(
    heading('talk:sent', { text: 'SENT', bold: true, color: COLOUR.secondary }, [{ text: `${view.sent.length}`, color: COLOUR.secondary }], width),
    view.sent.flatMap(sent => [
      { key: `talk:sent:${sent.file}`, mark: { text: `${MARK.sent} `, color: COLOUR.secondary }, wraps: true, parts: [{ text: sent.title, color: COLOUR.body }] },
      {
        key: `talk:sent:${sent.file}:said`,
        mark: { text: INDENT },
        wraps: true,
        parts: [{ text: `to ${sent.to} · ${dayOf(sent.at)} · ${SENT_STANDS[sent.stands]}`, color: COLOUR.notStarted }],
      },
    ]),
  )
}

/** This session in a discussion: a section with nothing in it is left out. */
const liveLines = (view: Discussion, kit: Kit): Line[] => [
  progressLine(view, kit),
  blank('talk:head'),
  ...openLines(view, kit.width),
  ...messageLines(view, kit.width),
  ...sinceLines(view, kit.width),
  ...reviewLines(view, kit),
  ...decidedLines(view, kit.width),
  ...sentLines(view, kit.width),
]

/** A topic's own page: what it is for, its rows decided of all, then what is decided and open and the messages waiting, each bare, opening its page. */
function pageLines(view: Discussion, kit: Kit): Line[] {
  const { decided, yours } = view.progress

  return [
    ...prose('talk:about', view.summary, COLOUR.secondary),
    { key: 'talk:progress', parts: [...barOf(decided, yours), { text: `  ${decided} of ${yours} decided`, color: COLOUR.secondary }] },
    blank('talk:head'),
    ...section(
      decidedHeading(`${view.decided.length}`, kit.width),
      view.decided.map(({ id, text, who }) => bareRow(`talk:decided:${id}`, WHOSE[who][0], text, `entry:${id}`, kit.width)),
    ),
    ...section(
      openHeading(view, kit.width),
      view.open.map(({ id, text }) => bareRow(`talk:open:${id}`, { text: MARK.waiting, color: COLOUR.needs }, text, `entry:${id}`, kit.width)),
    ),
    ...section(
      heading('talk:mail', { text: 'MESSAGES WAITING', bold: true, color: COLOUR.needs }, [{ text: `${view.messages.length}`, color: COLOUR.secondary }], kit.width),
      messageList('talk:mail', view.topic, view.messages, kit.width),
    ),
  ]
}

/** A row on a topic's page: its mark and words, cut at the edge, opening its entry. */
const bareRow = (key: string, mark: Part, text: string, ref: string, width: number): Line => ({
  key,
  parts: cutTo([mark, { text: ` ${text}`, color: COLOUR.body }], width),
  press: pageKey(ref),
})

const discussionLines = (view: Discussion, kit: Kit): Line[] => [
  ...header('talk', view.topic_title, [{ text: ' · discussion', color: COLOUR.secondary }], `${view.title} · ${view.type}`, kit.width),
  ...(view.live ? liveLines(view, kit) : pageLines(view, kit)),
]

type Entry = { id: string; entry: string; by: string; text: string; why: string | null; question: string | null }

/** Where an entry stands, as its page says it. */
function entryStanding({ entry, by }: Entry): Part {
  if (entry === 'question') {
    return { text: `${MARK.waiting} still open${by === 'person' ? ' · yours' : ''}`, color: COLOUR.needs }
  }

  if (entry === 'decision') {
    return by === 'claude' ? { text: `${MARK.call} Claude's call`, color: COLOUR.gold } : { text: `${MARK.done} decided · yours`, color: COLOUR.done }
  }

  return { text: `${MARK.call} ${entry}`, color: COLOUR.secondary }
}

/** An entry read in full: what it answers, where it stands, its words and why. */
const entryLines = (entry: Entry, kit: Kit): Line[] => [
  ...titled('entry', [{ text: entry.question ?? entry.text, bold: true }], [entryStanding(entry)], kit.width),
  ...prose('entry:text', entry.question === null ? '' : entry.text),
  ...prose('entry:why', entry.why ?? ''),
]

type MessagePage = { topic: string; file: string; title: string; from: string; when: string; text: string }

/** A message waiting read in full: who sent it and when, that it waits to be raised, and its words. */
const messagePageLines = (message: MessagePage, kit: Kit): Line[] => [
  ...titled('message', [{ text: message.title, bold: true }], [{ text: `${MARK.message} from ${message.from} · ${message.when} · waiting to be raised`, color: COLOUR.needs }], kit.width),
  ...prose('message:text', message.text),
]

type ReportPage = { topic: string; topic_title: string; id: string; round: number; text: string }

/** A round of the topic's review read in full, with the topic it read. */
const reportLines = (report: ReportPage, kit: Kit): Line[] => [
  ...titled('report', [{ text: `Review round ${report.round}`, bold: true, color: COLOUR.violet }, { text: ` · ${report.topic_title}`, color: COLOUR.secondary }], [], kit.width),
  ...prose('report:text', report.text),
]

export const DISCUSSION: ViewDrawing = {
  lines: (view, kit) => discussionLines(view as View & Discussion, kit),
  name: view => (view as View & Discussion).topic_title,
}

export const ENTRY: ViewDrawing = {
  lines: (view, kit) => entryLines(view as View & Entry, kit),
  name: view => {
    const entry = view as View & Entry

    return entry.question ?? entry.text
  },
}

export const MESSAGE: ViewDrawing = {
  lines: (view, kit) => messagePageLines(view as View & MessagePage, kit),
  name: view => (view as View & MessagePage).title,
}

export const REVIEW_REPORT: ViewDrawing = {
  lines: (view, kit) => reportLines(view as View & ReportPage, kit),
  name: view => `review round ${(view as View & ReportPage).round}`,
}
