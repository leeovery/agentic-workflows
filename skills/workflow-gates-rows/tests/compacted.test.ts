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

const NOTE = [
  'The conversation was just compacted. This conversation is working in the discussion of "management-window" in the epic "fumi". Follow the workflow-discussion-process skill\'s "Resuming After Context Refresh" steps now, before anything else: re-read /Users/person/fumi/.claude/skills/workflow-discussion-process/SKILL.md and its framework in full, then re-read these in full:',
  '- /Users/person/fumi/.workflows/fumi/discussion/management-window.md',
].join('\n')

const PLACE = 'fumi › discussion › management-window'

/** An earlier note of the same conversation, at another place. */
const EARLIER = 'The conversation was just compacted. This conversation is working in the research of "management-window" in the epic "fumi".'

const EARLIER_PLACE = 'fumi › research › management-window'

/** What Claude Code draws for a row the plugin leaves alone. */
const OWN = 'drawn by Claude Code'

/** The record the gates mod keeps of the notes it handed up. */
const RECORD = JSON.stringify({ [EARLIER]: EARLIER_PLACE, [NOTE]: PLACE })

/**
 * The world beneath the plugin: the session's id, the system config
 * directory the process names (`configDir`, none by default), the files —
 * the folder the engine marked, the record of the notes handed up, in
 * `folder` — and Claude Code's own drawing of a row as `OWN`, or as its text
 * where it `drawsText`. `calls` is what the plugin read and wrote, by path.
 */
function world(
  on: On,
  options: { record?: string; marked?: boolean; drawsText?: boolean; configDir?: string; folder?: string } = {},
) {
  const { record = RECORD, marked = true, drawsText = false, configDir, folder = FOLDER } = options
  const calls: string[] = []
  const files = new Map<string, string>()

  if (marked) {
    files.set(`${folder}/workflow`, '')
    files.set(`${folder}/compacted.json`, record)
  }

  const environment: Record<string, string | undefined> = { HOME, WORKFLOWS_CONFIG_DIR: configDir }

  on('session.id', () => ({ value: 's0' }))
  on('env.get', ($, e) => ({ value: environment[e.name] }))

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
    files.set(e.path, e.text)

    return { value: undefined }
  })

  on('ui.render', { component: 'UserMessage' }, ($, e) => ({
    type: 'Text',
    children: [drawsText ? e.props.text : OWN],
  }))

  return { calls, files }
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
    text: NOTE,
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
      world(on)

      expect(await drawn($, rowOf('m1', surface))).toEqual({
        text: `⟳ Compacted · carrying on in ${PLACE}`,
        props: { dimColor: true, wrap: 'truncate-end' },
      })
    })

    test(`the note is a tree the surface draws — ${surface}`, async ($, on) => {
      world(on)

      const { requestId, props, viewport } = rowOf('m1', surface)
      const row = await $.ui.mount({ plugin: 'workflow-gates-rows', surface, component: 'UserMessage', requestId, props, viewport })

      expect(await row.find({ type: 'Text', text: /^⟳ Compacted · carrying on in / })).toBeDefined()
    })

    test(`each note the record holds draws its own place — ${surface}`, async ($, on) => {
      world(on)

      expect((await drawn($, rowOf('m1', surface, { text: EARLIER }))).text).toBe(`⟳ Compacted · carrying on in ${EARLIER_PLACE}`)
      expect((await drawn($, rowOf('m2', surface))).text).toBe(`⟳ Compacted · carrying on in ${PLACE}`)
    })

    test(`expanded, it draws as Claude Code does — ${surface}`, async ($, on) => {
      world(on)

      expect((await drawn($, rowOf('m1', surface, { isExpanded: true }))).text).toBe(OWN)
    })

    test(`a row the record does not hold draws as Claude Code does — ${surface}`, async ($, on) => {
      const { calls } = world(on)

      expect((await drawn($, rowOf('m1', surface, { text: `${NOTE}\n\nSomething else.` }))).text).toBe(OWN)
      expect((await drawn($, rowOf('m2', surface, { text: 'carry on', origin: { kind: 'composer' } as PromptOrigin }))).text).toBe(OWN)
      expect(calls, 'a row that does not open as the note reads nothing').toEqual([`read ${COMPACTED}`])
    })
  }

  test('a redraw reads nothing, and a fresh load draws the row from the record again', async ($, on) => {
    const { calls } = world(on)

    await drawn($, rowOf('m1', 'terminal'))
    calls.length = 0

    expect((await drawn($, rowOf('m1', 'terminal'))).text).toBe(`⟳ Compacted · carrying on in ${PLACE}`)
    expect(calls).toEqual([])
  })

  test('writes nothing: the gates mod keeps the record', async ($, on) => {
    const { calls } = world(on)

    await drawn($, rowOf('m1', 'terminal'))
    await drawn($, rowOf('m2', 'desktop', { text: EARLIER }))

    expect(calls.filter(call => call.startsWith('write'))).toEqual([])
  })

  test('reads the record in the config directory the process names, never under the home directory', async ($, on) => {
    const config = '/Users/person/state/workflows'
    const { calls } = world(on, { configDir: config, folder: `${config}/conversations/s0` })

    expect((await drawn($, rowOf('m1', 'terminal'))).text).toBe(`⟳ Compacted · carrying on in ${PLACE}`)
    expect(calls).toEqual([`read ${config}/conversations/s0/compacted.json`])
  })

  test('a conversation with no folder reads and writes nothing, and draws the row as Claude Code does', async ($, on) => {
    const { calls } = world(on, { marked: false })

    expect((await drawn($, rowOf('m1', 'terminal'))).text).toBe(OWN)
    expect(calls).toEqual([])
  })

  for (const [name, record] of Object.entries({
    'not JSON': '{"text": ',
    'a list': JSON.stringify([NOTE]),
    'no place for the note': JSON.stringify({ [NOTE]: 4 }),
  })) {
    test(`a record that does not name the note's place draws the row as Claude Code does — ${name}`, async ($, on) => {
      world(on, { record })

      expect((await drawn($, rowOf('m1', 'terminal'))).text).toBe(OWN)
    })
  }

  test('a missing record draws the row as Claude Code does', async ($, on) => {
    const { files } = world(on)

    files.delete(COMPACTED)

    expect((await drawn($, rowOf('m1', 'terminal'))).text).toBe(OWN)
  })
})

describe('beside the rows of what the gates mod sends', () => {
  const CONTINUATION = 'Invoke `/workflow-discussion-process feature note-window`.'
  const WHERE = '→ Discussion · note-window'
  const SENT = `${FOLDER}/sent.json`
  const ROWS = `${FOLDER}/rows.json`

  /** A prompt the gates mod submitted, as Claude Code frames it on its row. */
  const framed = (answer: string) =>
    [
      'The workflow-gates plugin sent a message:',
      answer,
      '',
      "This is how Claude Code surfaces a prompt a plugin submits between turns — it starts this turn in the user's place. Address the message above.",
    ].join('\n')

  for (const surface of SURFACES) {
    test(`a handoff's continuation, a compaction's note and the person's prompt each draw as their own — ${surface}`, async ($, on) => {
      const { files } = world(on, { drawsText: true })

      files.set(SENT, JSON.stringify({ answer: CONTINUATION, line: WHERE }))

      const handoff = await drawn($, rowOf('m1', surface, {
        text: framed(CONTINUATION),
        origin: { kind: 'plugin', name: 'workflow-gates' },
      }))
      const compaction = await drawn($, rowOf('m2', surface))
      const prompt = await drawn($, rowOf('m3', surface, { text: 'carry on', origin: { kind: 'composer' } as PromptOrigin }))

      expect(handoff.text).toBe(WHERE)
      expect(compaction).toEqual({ text: `⟳ Compacted · carrying on in ${PLACE}`, props: { dimColor: true, wrap: 'truncate-end' } })
      expect(prompt.text).toBe('carry on')
      expect(JSON.parse(files.get(ROWS) ?? 'null'), 'the answer row alone is kept in rows.json').toEqual({ m1: WHERE })
      expect(files.get(SENT), 'the continuation spent').toBe('null')
    })
  }
})

describe('noteOf', () => {
  test('the place it carries on in', () => {
    expect(noteOf('fix › scoping')).toBe('⟳ Compacted · carrying on in fix › scoping')
  })
})
