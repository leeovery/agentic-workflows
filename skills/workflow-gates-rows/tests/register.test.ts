import type { On, PromptOrigin, RenderInput, RenderPropsOf } from 'claude-code'
import { describe, expect, test, tier, type Engine } from 'claude-code/testing'

tier('user')

/**
 * The person's home directory, as the process names it — under `/Users`,
 * since the kit's host check refuses macOS's automounted `/home`.
 */
const HOME = '/Users/person'

/** The workflows' system config directory, in the person's home. */
const CONFIG = `${HOME}/.config/workflows`

/** The folder of the conversation the engine names `name`, in the directory `config`. */
const folderOf = (name: string, config = CONFIG) => `${config}/conversations/${name}`

/** The engine's mark, which gives the conversation `name` its folder. */
const markerOf = (name: string) => `${folderOf(name)}/workflow`

/** Where the conversation `name` keeps its redrawn rows. */
const rowsAt = (name: string) => `${folderOf(name)}/rows.json`

/** Where the band leaves what it sent from the conversation `s0`. */
const SENT = `${folderOf('s0')}/sent.json`

const QUESTION = 'Approve this task?'
const COMMIT = 'Commit and continue to next task'
const PAIRED = `${QUESTION} → yes · ${COMMIT}`

const MOD: PromptOrigin = { kind: 'plugin', name: 'workflow-gates' }

/** The row's text as the engine stores a prompt a plugin submitted. */
const framed = (answer: string, plugin = 'workflow-gates') =>
  [
    `The ${plugin} plugin sent a message:`,
    answer,
    '',
    "This is how Claude Code surfaces a prompt a plugin submits between turns — it starts this turn in the user's place. Address the message above.",
  ].join('\n')

type Row = RenderInput<'UserMessage', 'terminal'>

const rowOf = (
  requestId: string,
  props: Partial<RenderPropsOf['UserMessage']> = {},
): Row => ({
  surface: 'terminal',
  component: 'UserMessage',
  requestId,
  viewport: { columns: 72, rows: 24 },
  props: { text: framed('yes'), origin: MOD, isExpanded: false, ...props },
})

const recordOf = (answer = 'yes', question = QUESTION, label = COMMIT) =>
  JSON.stringify({ answer, question, label })

/**
 * The world beneath the plugin: the process's environment, the files, the
 * session's id, the plugin's store, and the transcript drawing each row's
 * text.
 *
 * `env` is what the process holds over the person's home, a name given
 * `undefined` unset. `files` holds each file by its path: the folders the
 * engine `marked` by name in the system config directory, the rows `kept` in
 * them, and the send record in `s0`'s. `calls` is what the plugin asked of
 * the files and the store, in order, each with its path or key; `leaves` is
 * the mod writing its next record, or none (`undefined`, the file missing); a
 * write to a path in `refusing` rejects.
 *
 * @param on the test's `on`
 * @param record the send record's text at the start, missing when not given
 * @param options the environment, the session's id, the folders marked, and the rows kept
 */
function world(
  on: On,
  record?: string,
  options: {
    env?: Readonly<Record<string, string | undefined>>
    id?: string
    marked?: readonly string[]
    kept?: Readonly<Record<string, Readonly<Record<string, string>>>>
  } = {},
) {
  const { env = {}, id = 's0', marked = ['s0'], kept = {} } = options
  const environment: Readonly<Record<string, string | undefined>> = { HOME, ...env }

  const calls: string[] = []
  const refusing = new Set<string>()
  const files = new Map<string, string>([
    ...marked.map(name => [markerOf(name), ''] as const),
    ...Object.entries(kept).map(
      ([name, rows]) => [rowsAt(name), JSON.stringify(rows)] as const,
    ),
  ])

  if (record !== undefined) {
    files.set(SENT, record)
  }

  on('session.id', () => ({ value: id }))

  on('env.get', ($, e) => ({ value: environment[e.name] }))

  on('ui.render', { component: 'UserMessage' }, ($, e) => ({
    type: 'Text',
    children: [e.props.text],
  }))

  on('fs.exists', ($, e) => {
    const { path } = e

    calls.push(`exists ${path}`)

    return {
      value: [...files.keys()].some(
        file => file === path || file.startsWith(`${path}/`),
      ),
    }
  })

  on('fs.read', ($, e) => {
    const { path } = e
    const text = files.get(path)

    calls.push(`read ${path}`)

    if (text === undefined) {
      throw new Error(`ENOENT: no such file, open '${path}'`)
    }

    return { value: text }
  })

  on('fs.write', ($, e) => {
    const { path } = e

    calls.push(`write ${path}`)

    if (refusing.has(path)) {
      throw new Error(`EACCES: permission denied, open '${path}'`)
    }

    files.set(path, e.text)

    return { value: undefined }
  })

  on('store.get', ($, e) => {
    calls.push(`store.get ${e.key}`)

    return { value: undefined }
  })

  on('store.set', ($, e) => {
    calls.push(`store.set ${e.key}`)

    return { value: undefined }
  })

  on('store.delete', ($, e) => {
    calls.push(`store.delete ${e.key}`)

    return { value: undefined }
  })

  on('store.keys', () => {
    calls.push('store.keys')

    return { value: [] }
  })

  const leaves = (next: string | undefined) => {
    if (next === undefined) {
      files.delete(SENT)
    } else {
      files.set(SENT, next)
    }
  }

  /** The rows the conversation `name` keeps, as the plugin wrote them. */
  const rowsIn = (name: string): unknown => {
    const text = files.get(rowsAt(name))

    return text === undefined ? undefined : JSON.parse(text)
  }

  return { calls, files, refusing, leaves, rowsIn }
}

async function drawn($: Engine, row: Row): Promise<string> {
  const element = (await $.ui.render(row)) as { children: string[] }

  return element.children.join('')
}

describe('register', () => {
  test('a sent answer draws as the question it answered, the answer and its label', async ($, on) => {
    world(on, recordOf())

    expect(await drawn($, rowOf('m1'))).toBe(PAIRED)
  })

  test('the label is left out where it is the answer itself, or empty', async ($, on) => {
    const { leaves } = world(on)

    leaves(recordOf('back', 'Pick a topic', 'back'))

    expect(await drawn($, rowOf('m1', { text: framed('back') }))).toBe(
      'Pick a topic → back',
    )

    leaves(recordOf('yes', QUESTION, ''))

    expect(await drawn($, rowOf('m2'))).toBe(`${QUESTION} → yes`)
  })

  test('the record is spent once paired: a later row of the same answer draws it alone', async ($, on) => {
    const { files } = world(on, recordOf())

    expect(await drawn($, rowOf('m1'))).toBe(PAIRED)
    expect(files.get(SENT)).toBe('null')
    expect(await drawn($, rowOf('m2'))).toBe('yes')
  })

  test('a redraw keeps the line and reads nothing, leaving the next record to its row', async ($, on) => {
    const { calls, leaves } = world(on, recordOf())

    await drawn($, rowOf('m1'))

    calls.length = 0
    leaves(recordOf('yes', 'Continue?', 'Carry on'))

    expect(await drawn($, rowOf('m1', { onScreen: null }))).toBe(PAIRED)
    expect(calls).toEqual([])
    expect(await drawn($, rowOf('m2'))).toBe('Continue? → yes · Carry on')
  })

  test("the line is kept in the conversation's rows.json under the row's message id", async ($, on) => {
    const { rowsIn } = world(on, recordOf())

    await drawn($, rowOf('m1'))

    expect(rowsIn('s0')).toEqual({ m1: PAIRED })
  })

  test('each pairing adds its row to the file, keeping those before it', async ($, on) => {
    const { leaves, rowsIn } = world(on, recordOf())

    await drawn($, rowOf('m1'))

    leaves(recordOf('yes', 'Continue?', 'Carry on'))

    await drawn($, rowOf('m2'))

    expect(rowsIn('s0')).toEqual({
      m1: PAIRED,
      m2: 'Continue? → yes · Carry on',
    })
  })

  test("a fresh load draws a row from the conversation's rows.json, leaving the record to its own row", async ($, on) => {
    const { calls, rowsIn } = world(on, recordOf(), {
      kept: { s0: { m1: PAIRED } },
    })

    expect(await drawn($, rowOf('m1'))).toBe(PAIRED)
    expect(calls, 'the record is not read for a kept row').not.toContain(
      `read ${SENT}`,
    )
    expect(await drawn($, rowOf('m2'))).toBe(PAIRED)
    expect(rowsIn('s0')).toEqual({ m1: PAIRED, m2: PAIRED })
  })

  test('the folder is the one the engine names, in the system config directory by the session id’s safe characters alone', async ($, on) => {
    const { files, rowsIn } = world(on, undefined, {
      id: 'a1/../b2',
      marked: ['a1b2'],
      kept: { a1b2: { m1: 'Pick a topic → back' } },
    })

    files.set(`${CONFIG}/conversations/a1b2/sent.json`, recordOf())

    expect(await drawn($, rowOf('m1', { text: framed('back') }))).toBe(
      'Pick a topic → back',
    )
    expect(await drawn($, rowOf('m2'))).toBe(PAIRED)
    expect(rowsIn('a1b2')).toEqual({ m1: 'Pick a topic → back', m2: PAIRED })
    expect(files.get(`${CONFIG}/conversations/a1b2/sent.json`)).toBe('null')
  })

  const configs = [
    {
      where: 'the directory WORKFLOWS_CONFIG_DIR names',
      env: { WORKFLOWS_CONFIG_DIR: `${HOME}/elsewhere` },
      config: `${HOME}/elsewhere`,
    },
    {
      where: 'the home’s .config/workflows while WORKFLOWS_CONFIG_DIR is empty',
      env: { WORKFLOWS_CONFIG_DIR: '' },
      config: CONFIG,
    },
  ]

  for (const { where, env, config } of configs) {
    test(`the folder is in ${where}: the record read and spent there, the row kept there`, async ($, on) => {
      const { files } = world(on, undefined, { env, marked: [] })
      const folder = folderOf('s0', config)

      files.set(`${folder}/workflow`, '')
      files.set(`${folder}/sent.json`, recordOf())

      expect(await drawn($, rowOf('m1'))).toBe(PAIRED)
      expect(files.get(`${folder}/sent.json`)).toBe('null')
      expect(JSON.parse(files.get(`${folder}/rows.json`) ?? '0')).toEqual({ m1: PAIRED })
    })
  }

  test('a conversation with no folder writes nothing and draws the row as Claude Code does', async ($, on) => {
    const { calls, rowsIn } = world(on, undefined, { marked: [] })

    expect(await drawn($, rowOf('m1'))).toBe(framed('yes'))
    expect(await drawn($, rowOf('m1'))).toBe(framed('yes'))
    expect(calls.filter(call => call.startsWith('write'))).toEqual([])
    expect(rowsIn('s0')).toBeUndefined()
  })

  for (const [how, home] of [['unset', undefined], ['empty', '']] as const) {
    test(`a process whose home is ${how}, with no WORKFLOWS_CONFIG_DIR, gives the conversation no folder: nothing read or written, the row drawn as Claude Code does`, async ($, on) => {
      const { calls, files } = world(on, recordOf(), { env: { HOME: home } })

      expect(await drawn($, rowOf('m1'))).toBe(framed('yes'))
      expect(calls).toEqual([])
      expect(files.get(SENT)).toBe(recordOf())
    })
  }

  test('a row drawn alone stays so, once a record of its answer arrives', async ($, on) => {
    const { leaves } = world(on)

    expect(await drawn($, rowOf('m1'))).toBe('yes')

    leaves(recordOf())

    expect(await drawn($, rowOf('m1'))).toBe('yes')
    expect(await drawn($, rowOf('m2'))).toBe(PAIRED)
  })

  test('a row it cannot pair is kept as the answer alone, the record left to its own row', async ($, on) => {
    const { calls, files, rowsIn } = world(on, recordOf('no'))

    expect(await drawn($, rowOf('m1'))).toBe('yes')
    expect(rowsIn('s0')).toEqual({ m1: 'yes' })
    expect(files.get(SENT)).toBe(recordOf('no'))
    expect(calls.filter(call => call.startsWith('write'))).toEqual([
      `write ${rowsAt('s0')}`,
    ])
  })

  test('a fresh load draws a row kept alone as it was, leaving a later record of its answer to its own row', async ($, on) => {
    const { calls, rowsIn } = world(on, recordOf(), {
      kept: { s0: { m1: 'yes' } },
    })

    expect(await drawn($, rowOf('m1'))).toBe('yes')
    expect(calls, 'the record is not read for a kept row').not.toContain(
      `read ${SENT}`,
    )
    expect(await drawn($, rowOf('m2'))).toBe(PAIRED)
    expect(rowsIn('s0')).toEqual({ m1: 'yes', m2: PAIRED })
  })

  test('a missing, unreadable or mismatched record draws the answer alone', async ($, on) => {
    const { leaves } = world(on)

    const records: Record<string, string | undefined> = {
      missing: undefined,
      'not JSON': '{"answer": "yes",',
      spent: 'null',
      'another answer': recordOf('no'),
      'a field missing': JSON.stringify({ answer: 'yes', question: QUESTION }),
      'a field not text': JSON.stringify({ answer: 'yes', question: QUESTION, label: 7 }),
    }

    for (const [name, record] of Object.entries(records)) {
      leaves(record)

      expect(await drawn($, rowOf(name)), name).toBe('yes')
    }
  })

  test('rows that cannot be read keep nothing: the row pairs, and the file is written afresh', async ($, on) => {
    const unreadable: Record<string, string> = {
      'not JSON': '{"m0": ',
      'not a map': JSON.stringify(['m0']),
      'nothing kept': 'null',
    }

    const { files, leaves, rowsIn } = world(on)

    for (const [name, text] of Object.entries(unreadable)) {
      files.set(rowsAt('s0'), text)
      leaves(recordOf())

      expect(await drawn($, rowOf(name)), name).toBe(PAIRED)
      expect(rowsIn('s0'), name).toEqual({ [name]: PAIRED })
    }
  })

  test('a write that fails draws the row as Claude Code does, leaving the record to its redraw', async ($, on) => {
    const { refusing, rowsIn } = world(on, recordOf())

    refusing.add(rowsAt('s0'))

    expect(await drawn($, rowOf('m1'))).toBe(framed('yes'))

    refusing.clear()

    expect(await drawn($, rowOf('m1'))).toBe(PAIRED)
    expect(rowsIn('s0')).toEqual({ m1: PAIRED })
  })

  test('a row it cannot pair whose write fails draws as Claude Code does, and is kept alone on its redraw', async ($, on) => {
    const { refusing, rowsIn } = world(on)

    refusing.add(rowsAt('s0'))

    expect(await drawn($, rowOf('m1'))).toBe(framed('yes'))

    refusing.clear()

    expect(await drawn($, rowOf('m1'))).toBe('yes')
    expect(rowsIn('s0')).toEqual({ m1: 'yes' })
  })

  test("expanded rows, the person's prompts, other plugins' and notifications pass through", async ($, on) => {
    const { calls } = world(on, recordOf())

    const others: Record<string, Partial<RenderPropsOf['UserMessage']>> = {
      'the mod, expanded': { isExpanded: true },
      'the person': { text: 'yes', origin: { kind: 'composer' } },
      'another plugin': {
        text: framed('yes', 'another-plugin'),
        origin: { kind: 'plugin', name: 'another-plugin' },
      },
      'a notification': {
        text: 'Agent "Explore auth" completed',
        origin: { kind: 'task-notification' },
        task: { id: 'a1', status: 'completed' },
      },
      'a peer': { text: 'yes', origin: { kind: 'peer' }, from: { name: 'auth' } },
    }

    for (const [name, props] of Object.entries(others)) {
      const row = rowOf(name, props)

      expect(await drawn($, row), name).toBe(row.props.text)
    }

    expect(calls, 'the files are left alone').toEqual([])
    expect(await drawn($, rowOf('m1'))).toBe(PAIRED)
  })

  test('a row of the mod not in the framing passes through', async ($, on) => {
    const { calls } = world(on, recordOf())
    const text = 'The workflow-gates plugin said something else.'

    expect(await drawn($, rowOf('m0', { text }))).toBe(text)
    expect(calls).toEqual([])
    expect(await drawn($, rowOf('m1'))).toBe(PAIRED)
  })

  test("the plugin keeps nothing in its store: the conversation's folder holds it all", async ($, on) => {
    const { calls, leaves } = world(on, recordOf(), {
      kept: { s0: { m0: PAIRED } },
    })

    await drawn($, rowOf('m0'))
    await drawn($, rowOf('m1'))
    await drawn($, rowOf('m1'))

    leaves(recordOf('no'))

    await drawn($, rowOf('m2'))

    expect(calls.filter(call => call.startsWith('store'))).toEqual([])
  })
})
