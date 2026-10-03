/**
 * The row of the message the `workflow-gates` mod hands up for a compaction,
 * drawn as one dim note — `⟳ Compacted · carrying on in fumi › discussion ›
 * management-window · 4 unwritten points kept` — in place of a prompt row the
 * person never typed. Claude Code stores that message as an ordinary user
 * row, so the row is known by its text: the mod records the message in the
 * conversation's folder as `compacted.json` as it hands it up. Each line
 * drawn is kept in the folder's `rows.json` under the row's message id, as
 * the answer rows are, so scrolling and a resume draw it the same way.
 */
import type { EngineInterface, On } from 'claude-code'

const CONVERSATIONS = 'conversations'
const COMPACTED = 'compacted.json'
const ROWS = 'rows.json'

/**
 * Every message the mod hands up opens with the engine's note, so a row
 * that does not is never one and costs no read.
 */
const OPENING = 'This conversation is working in '

type Compacted = { text: string; place: string; kept: number }

type Rows = Record<string, unknown>

const isCompacted = (value: unknown): value is Compacted => {
  const { text, place, kept } = (value ?? {}) as Record<string, unknown>

  return typeof text === 'string' && typeof place === 'string' && Number.isInteger(kept)
}

const isRows = (value: unknown): value is Rows =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The line a compaction's row draws. */
export function noteOf({ place, kept }: Compacted): string {
  const points = kept === 0 ? [] : [`${kept} unwritten ${kept === 1 ? 'point' : 'points'} kept`]

  return ['⟳ Compacted', `carrying on in ${place}`, ...points].join(' · ')
}

// The engine names the folder so (domain/conversation.cjs): in the system
// config directory, `WORKFLOWS_CONFIG_DIR` or else `.config/workflows` in the
// home directory; none where neither is named.
async function conversationFolder($: EngineInterface): Promise<string | null> {
  const home = await $.env.get('HOME')
  const config =
    (await $.env.get('WORKFLOWS_CONFIG_DIR')) ||
    (home ? `${home}/.config/workflows` : null)
  const id = await $.session.id()

  return config === null
    ? null
    : `${config}/${CONVERSATIONS}/${id.replace(/[^A-Za-z0-9_-]/g, '')}`
}

/** A JSON file of the folder, or undefined where it cannot be read as one. */
async function jsonIn($: EngineInterface, file: string): Promise<unknown> {
  try {
    return JSON.parse(await $.fs.read(file))
  } catch {
    return undefined
  }
}

/**
 * The note a row of `text` draws: the one kept for it, or the record's where
 * the row is the message it records, kept from then on; null for any other
 * row, and in a conversation with no folder.
 */
async function noteFor(
  $: EngineInterface,
  requestId: string,
  text: string,
): Promise<string | null> {
  const folder = await conversationFolder($)

  if (folder === null || !(await $.fs.exists(folder))) {
    return null
  }

  const kept = await jsonIn($, `${folder}/${ROWS}`)
  const rows = isRows(kept) ? kept : {}
  const line = rows[requestId]

  if (typeof line === 'string') {
    return line
  }

  const record = await jsonIn($, `${folder}/${COMPACTED}`)

  if (!isCompacted(record) || record.text.trim() !== text) {
    return null
  }

  const note = noteOf(record)

  await $.fs.write(`${folder}/${ROWS}`, JSON.stringify({ ...rows, [requestId]: note }))

  return note
}

export function compacted(on: On) {
  const notes = new Map<string, string | null>()

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const text = e.props.text.trim()

    if (e.props.isExpanded || !text.startsWith(OPENING)) {
      return next(e)
    }

    let note = notes.get(e.requestId)

    if (note === undefined) {
      note = await noteFor($, e.requestId, text)
      notes.set(e.requestId, note)
    }

    if (note === null) {
      return next(e)
    }

    const { Text } = await $.ui.resolve(e)

    return Text({ dimColor: true, wrap: 'truncate-end', children: note })
  }).catch(($, e, next) => next(e))
}
