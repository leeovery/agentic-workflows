/**
 * The row of the note the `workflow-gates` mod appends to a compaction, drawn
 * as one dim line in place of a prompt row the person never typed. Claude
 * Code stores that note as an ordinary user row, so the row is known by its
 * text: the gates mod records every note it hands up in the conversation's
 * folder as `compacted.json`, with the place it carries on in, and this
 * module only reads it — so scrolling and a resume draw the row the same way.
 */
import type { EngineInterface, On } from 'claude-code'

import { folderOf } from './folder.ts'

const COMPACTED = 'compacted.json'

/**
 * Every note the gates mod hands up opens with the engine's words, so a row
 * that does not is never one and costs no read.
 */
const OPENING = 'The conversation was just compacted. '

/** Keyed by each note's text. */
type Notes = Record<string, unknown>

const isNotes = (value: unknown): value is Notes =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const noteOf = (place: string) => `⟳ Compacted · carrying on in ${place}`

/**
 * The line the row of `text` draws: the note for the place its record names;
 * null for any other row, and in a conversation with no folder.
 */
async function noteFor($: EngineInterface, text: string): Promise<string | null> {
  const folder = folderOf(
    await $.env.get('WORKFLOWS_CONFIG_DIR'),
    await $.env.get('HOME'),
    await $.session.id(),
  )

  if (folder === null || !(await $.fs.exists(folder))) {
    return null
  }

  try {
    const notes: unknown = JSON.parse(await $.fs.read(`${folder}/${COMPACTED}`))
    const place = isNotes(notes) ? notes[text] : undefined

    return typeof place === 'string' ? noteOf(place) : null
  } catch {
    return null
  }
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
      note = await noteFor($, text)
      notes.set(e.requestId, note)
    }

    if (note === null) {
      return next(e)
    }

    const { Text } = await $.ui.resolve(e)

    return Text({ dimColor: true, wrap: 'truncate-end', children: note })
  }).catch(($, e, next) => next(e))
}
