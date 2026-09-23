import type { On, PromptOrigin, RenderInput, RenderPropsOf } from 'claude-code'
import { describe, expect, mock, test, tier, type Engine } from 'claude-code/testing'

tier('user')

const SENT = '.workflows/.cache/.gates/sent.json'

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

type Store = (on: On) => void

/** A store the test reads back: what the plugin keeps lands in `kept`. */
const storeIn =
  (kept: Map<string, unknown>): Store =>
  on => {
    on('store.get', ($, e) => ({ value: kept.get(e.key) }))
    on('store.set', ($, e) => {
      kept.set(e.key, e.value)

      return { value: undefined }
    })
  }

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
 * The world beneath the plugin: the send record's file, the plugin's store,
 * and the transcript drawing each row's text.
 *
 * `calls` is what the plugin asked of the file, in order; `leaves` is the mod
 * writing its next record, or none (`undefined`, the file missing).
 *
 * @param on the test's `on`
 * @param record the file's text at the start, missing when not given
 * @param store the plugin's store, an empty one in memory when not given
 */
function world(on: On, record?: string, store: Store = mock.store) {
  const calls: string[] = []

  let file = record

  store(on)

  on('ui.render', { component: 'UserMessage' }, ($, e) => ({
    type: 'Text',
    children: [e.props.text],
  }))

  on('fs.read', ($, e) => {
    calls.push('read')

    if (!e.path.endsWith(SENT) || file === undefined) {
      throw new Error(`ENOENT: no such file, open '${e.path}'`)
    }

    return { value: file }
  })

  on('fs.write', ($, e) => {
    calls.push('write')
    file = e.text

    return { value: undefined }
  })

  const leaves = (next: string | undefined) => {
    file = next
  }

  return { calls, leaves }
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

  test('a gate that asks nothing draws the answer and its label alone', async ($, on) => {
    const { leaves } = world(on)

    leaves(recordOf('yes', ''))

    expect(await drawn($, rowOf('m1'))).toBe(`yes · ${COMMIT}`)

    leaves(recordOf('yes', '', ''))

    expect(await drawn($, rowOf('m2'))).toBe('yes')
  })

  test('the record is spent once paired: a later row of the same answer draws it alone', async ($, on) => {
    world(on, recordOf())

    expect(await drawn($, rowOf('m1'))).toBe(PAIRED)
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

  test("the line is kept in the store under the row's message id", async ($, on) => {
    const kept = new Map<string, unknown>()

    world(on, recordOf(), storeIn(kept))

    await drawn($, rowOf('m1'))

    expect([...kept]).toEqual([['m1', PAIRED]])
  })

  test('a fresh load draws a row from the store, leaving the record to its own row', async ($, on) => {
    const { calls } = world(on, recordOf(), on => mock.store(on, { m1: PAIRED }))

    expect(await drawn($, rowOf('m1'))).toBe(PAIRED)
    expect(calls, 'the file is not read for a kept row').toEqual([])
    expect(await drawn($, rowOf('m2'))).toBe(PAIRED)
  })

  test('a row drawn alone stays so, once a record of its answer arrives', async ($, on) => {
    const { leaves } = world(on)

    expect(await drawn($, rowOf('m1'))).toBe('yes')

    leaves(recordOf())

    expect(await drawn($, rowOf('m1'))).toBe('yes')
    expect(await drawn($, rowOf('m2'))).toBe(PAIRED)
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

    expect(calls, 'the record is left alone').toEqual([])
    expect(await drawn($, rowOf('m1'))).toBe(PAIRED)
  })

  test('a row of the mod not in the framing passes through', async ($, on) => {
    const { calls } = world(on, recordOf())
    const text = 'The workflow-gates plugin said something else.'

    expect(await drawn($, rowOf('m0', { text }))).toBe(text)
    expect(calls).toEqual([])
    expect(await drawn($, rowOf('m1'))).toBe(PAIRED)
  })

  test('a store that fails draws the row as the engine stored it', async ($, on) => {
    world(on, recordOf(), on =>
      on('store.get', () => {
        throw new Error('the store could not be read')
      }),
    )

    expect(await drawn($, rowOf('m1'))).toBe(framed('yes'))
  })
})
