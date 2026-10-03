import type { On, PromptOrigin, RenderInput, RenderPropsOf } from 'claude-code'
import { describe, expect, test, tier, type Engine } from 'claude-code/testing'

import { noteOf } from '../hooks/compacted.ts'

tier('user')

/** The screens a row draws on: the terminal app's and the Desktop app's. */
const SURFACES = ['terminal', 'desktop'] as const

type Surface = (typeof SURFACES)[number]

/**
 * The person's home directory, as the process names it — under `/Users`,
 * since the kit's host check refuses macOS's automounted `/home`.
 */
const HOME = '/Users/person'

/** The conversation's folder, in the workflows' system config directory. */
const FOLDER = `${HOME}/.config/workflows/conversations/s0`

const COMPACTED = `${FOLDER}/compacted.json`
const ROWS = `${FOLDER}/rows.json`

const NOTE = [
  'This conversation is working in the discussion of "management-window" in "fumi". To carry on there, re-read `/Users/person/fumi/.claude/skills/workflow-discussion-process/SKILL.md` in full and follow its load directives, then re-read these in full:',
  '- /Users/person/fumi/.workflows/fumi/discussion/management-window.md',
].join('\n')

const SAID = [
  'Said in the conversation and not yet written down:',
  '- Windows close at midnight, local time.',
  '- Managers see every window.',
  '- Overrides need a reason.',
  '- Nothing is archived yet.',
].join('\n')

const HANDED_UP = `${NOTE}\n\n${SAID}`

const PLACE = 'fumi › discussion › management-window'

/** What Claude Code draws for a row the mod leaves alone. */
const OWN = 'drawn by Claude Code'

/** The record the gates mod leaves as it hands a compaction's message up. */
const recordOf = (text: string, kept: number) => JSON.stringify({ text, place: PLACE, kept })

/**
 * The world beneath the plugin: the session's id, the files — the folder the
 * engine marked, the compaction's record and the rows kept — and Claude
 * Code's own drawing of a row as `OWN`. `calls` is what the plugin read and
 * wrote, by path; a write to a path in `refusing` rejects.
 */
function world(
  on: On,
  options: { record?: string; kept?: Readonly<Record<string, string>>; marked?: boolean } = {},
) {
  const { record, kept, marked = true } = options
  const calls: string[] = []
  const refusing = new Set<string>()
  const files = new Map<string, string>()

  if (marked) {
    files.set(`${FOLDER}/workflow`, '')
  }

  if (record !== undefined) {
    files.set(COMPACTED, record)
  }

  if (kept !== undefined) {
    files.set(ROWS, JSON.stringify(kept))
  }

  on('session.id', () => ({ value: 's0' }))
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? HOME : undefined }))

  on('fs.exists', ($, e) => ({
    value: [...files.keys()].some(file => file === e.path || file.startsWith(`${e.path}/`)),
  }))

  on('fs.read', ($, e) => {
    calls.push(`read ${e.path}`)

    const text = files.get(e.path)

    if (text === undefined) {
      throw new Error(`ENOENT: no such file, open '${e.path}'`)
    }

    return { value: text }
  })

  on('fs.write', ($, e) => {
    calls.push(`write ${e.path}`)

    if (refusing.has(e.path)) {
      throw new Error(`EACCES: permission denied, open '${e.path}'`)
    }

    files.set(e.path, e.text)

    return { value: undefined }
  })

  on('ui.render', { component: 'UserMessage' }, () => ({ type: 'Text', children: [OWN] }))

  return {
    calls,
    files,
    refusing,
    /** The rows the conversation keeps, as the plugin wrote them. */
    rows: (): unknown => JSON.parse(files.get(ROWS) ?? 'null'),
  }
}

const rowOf = (
  requestId: string,
  surface: Surface,
  props: Partial<RenderPropsOf['UserMessage']> = {},
): RenderInput<'UserMessage', Surface> => ({
  surface,
  component: 'UserMessage',
  requestId,
  viewport: { columns: 72, rows: 24 },
  props: {
    text: HANDED_UP,
    origin: { kind: 'unclassified' } as PromptOrigin,
    isExpanded: false,
    ...props,
  },
})

/** What the row draws: its text, and its style. */
async function drawn($: Engine, row: RenderInput): Promise<{ text: string; props: unknown }> {
  const element = (await $.ui.render(row)) as { children: unknown; props?: unknown }
  const { children } = element

  return { text: Array.isArray(children) ? children.join('') : String(children), props: element.props }
}

describe('a compaction\'s row', () => {
  for (const surface of SURFACES) {
    test(`draws as one dim note, cut to the row's width — ${surface}`, async ($, on) => {
      world(on, { record: recordOf(HANDED_UP, 4) })

      expect(await drawn($, rowOf('m1', surface))).toEqual({
        text: `⟳ Compacted · carrying on in ${PLACE} · 4 unwritten points kept`,
        props: { dimColor: true, wrap: 'truncate-end' },
      })
    })

    test(`the note is a tree the surface draws — ${surface}`, async ($, on) => {
      world(on, { record: recordOf(HANDED_UP, 4) })

      const { requestId, props, viewport } = rowOf('m1', surface)
      const row = await $.ui.mount({ plugin: 'workflow-gates-rows', surface, component: 'UserMessage', requestId, props, viewport })

      expect(await row.find({ type: 'Text', text: /^⟳ Compacted · carrying on in / })).toBeDefined()
    })

    test(`names one point kept, and none where nothing was kept — ${surface}`, async ($, on) => {
      const { files } = world(on, { record: recordOf(HANDED_UP, 1) })

      expect((await drawn($, rowOf('m1', surface))).text).toBe(
        `⟳ Compacted · carrying on in ${PLACE} · 1 unwritten point kept`,
      )

      files.set(COMPACTED, recordOf(NOTE, 0))

      expect((await drawn($, rowOf('m2', surface, { text: NOTE }))).text).toBe(
        `⟳ Compacted · carrying on in ${PLACE}`,
      )
    })

    test(`expanded, it draws as Claude Code does — ${surface}`, async ($, on) => {
      world(on, { record: recordOf(HANDED_UP, 4) })

      expect((await drawn($, rowOf('m1', surface, { isExpanded: true }))).text).toBe(OWN)
    })

    test(`a row that is not the recorded message draws as Claude Code does — ${surface}`, async ($, on) => {
      const { calls } = world(on, { record: recordOf(HANDED_UP, 4) })

      expect((await drawn($, rowOf('m1', surface, { text: `${NOTE}\n\nSomething else.` }))).text).toBe(OWN)
      expect((await drawn($, rowOf('m2', surface, { text: 'carry on', origin: { kind: 'composer' } as PromptOrigin }))).text).toBe(OWN)
      expect(calls, 'a row that does not open as the note reads nothing').toEqual([`read ${ROWS}`, `read ${COMPACTED}`])
    })

    test(`the note is kept in rows.json under the row's message id, and a fresh load draws it from there — ${surface}`, async ($, on) => {
      const { calls, files, rows } = world(on, { record: recordOf(HANDED_UP, 4), kept: { m0: 'Pick a topic → back' } })
      const note = `⟳ Compacted · carrying on in ${PLACE} · 4 unwritten points kept`

      await drawn($, rowOf('m1', surface))

      expect(rows()).toEqual({ m0: 'Pick a topic → back', m1: note })

      calls.length = 0
      await drawn($, rowOf('m1', surface))

      expect(calls, 'a redraw reads nothing').toEqual([])

      files.set(COMPACTED, recordOf('a later compaction', 0))

      expect((await drawn($, rowOf('m1', surface))).text).toBe(note)
    })
  }

  test('a row kept from an earlier load draws its note though the record has moved on', async ($, on) => {
    const note = `⟳ Compacted · carrying on in ${PLACE} · 2 unwritten points kept`
    const { calls } = world(on, { record: recordOf('a later compaction', 0), kept: { m1: note } })

    expect((await drawn($, rowOf('m1', 'terminal'))).text).toBe(note)
    expect(calls).not.toContain(`read ${COMPACTED}`)
  })

  test('a conversation with no folder reads and writes nothing, and draws the row as Claude Code does', async ($, on) => {
    const { calls } = world(on, { marked: false })

    expect((await drawn($, rowOf('m1', 'terminal'))).text).toBe(OWN)
    expect(calls).toEqual([])
  })

  test('a missing or unreadable record draws the row as Claude Code does', async ($, on) => {
    const { files } = world(on)
    const records: Record<string, string | undefined> = {
      missing: undefined,
      'not JSON': '{"text": ',
      'a field missing': JSON.stringify({ text: HANDED_UP, place: PLACE }),
      'kept not a count': JSON.stringify({ text: HANDED_UP, place: PLACE, kept: 'four' }),
    }

    for (const [name, record] of Object.entries(records)) {
      if (record === undefined) {
        files.delete(COMPACTED)
      } else {
        files.set(COMPACTED, record)
      }

      expect((await drawn($, rowOf(name, 'terminal'))).text, name).toBe(OWN)
    }
  })

  test('a write that fails draws the row as Claude Code does, and the redraw tries again', async ($, on) => {
    const { refusing, rows } = world(on, { record: recordOf(HANDED_UP, 4) })

    refusing.add(ROWS)

    expect((await drawn($, rowOf('m1', 'terminal'))).text).toBe(OWN)

    refusing.clear()

    expect((await drawn($, rowOf('m1', 'terminal'))).text).toMatch(/^⟳ Compacted/)
    expect(rows()).toEqual({ m1: `⟳ Compacted · carrying on in ${PLACE} · 4 unwritten points kept` })
  })
})

describe('noteOf', () => {
  test('the place, and the points kept: none, one, several', () => {
    expect(noteOf({ text: '', place: 'fix › scoping', kept: 0 })).toBe('⟳ Compacted · carrying on in fix › scoping')
    expect(noteOf({ text: '', place: 'fix › scoping', kept: 1 })).toBe('⟳ Compacted · carrying on in fix › scoping · 1 unwritten point kept')
    expect(noteOf({ text: '', place: 'fix › scoping', kept: 12 })).toBe('⟳ Compacted · carrying on in fix › scoping · 12 unwritten points kept')
  })
})
