import type { On, SessionCompactInput, SessionCompactResult, SessionMessage } from 'claude-code'
import { describe, expect, mock, test, tier, type Engine } from 'claude-code/testing'

import { CONTINUATION, positionIn } from '../hooks/compaction.ts'

tier('user')

/**
 * The person's home directory, as the process names it — under `/Users`,
 * since the kit's host check refuses macOS's automounted `/home`.
 */
const HOME = '/Users/person'

/** The session's project. */
const ROOT = '/Users/person/app'

const ENGINE = `${ROOT}/.claude/skills/workflow-engine/scripts/engine.cjs`

/** The workflows' system config directory where the process names none. */
const DEFAULT_CONFIG = `${HOME}/.config/workflows`

/** Where the conversation `s0` records the notes the mod handed up. */
const COMPACTED = `${DEFAULT_CONFIG}/conversations/s0/compacted.json`

const NOTE = [
  `The conversation was just compacted. This conversation is working in the discussion of "ledger" in the epic "payments". Follow the workflow-discussion-process skill's "Resuming After Context Refresh" steps now, before anything else: re-read ${ROOT}/.claude/skills/workflow-discussion-process/SKILL.md and its framework in full, then re-read these in full:`,
  `- ${ROOT}/.workflows/payments/discussion/ledger.md`,
].join('\n')

const PLACE = 'payments › discussion › ledger'

/** The engine's answer for a conversation at a discussion. */
const AT_DISCUSSION = {
  session_id: 's0',
  position: { name: 'payments', phase: 'discussion', topic: 'ledger' },
  place: PLACE,
  skill: `${ROOT}/.claude/skills/workflow-discussion-process/SKILL.md`,
  files: [`${ROOT}/.workflows/payments/discussion/ledger.md`],
  text: NOTE,
}

/** The engine's answer for a conversation at a work unit's menu. */
const AT_MENU = {
  session_id: 's0',
  position: { name: 'payments' },
  place: 'payments',
  skill: null,
  files: [],
  text: 'This conversation is at the epic "payments", outside any phase, so there is nothing to carry on from.',
}

/** What `conversation position` writes to its standard output. */
const engineSays = (answer: object) =>
  [
    '=== DATA (reason from this — never display or parse the sections below) ===',
    (answer as { text: string }).text,
    '=== POSITION (json for the gate mod — never display) ===',
    JSON.stringify(answer),
    '',
  ].join('\n')

const said = (role: SessionMessage['role'], text: string): SessionMessage => ({ role, text, toolUses: [] })

/** The conversation as it stands, the person's message waiting at its end. */
const TRANSCRIPT: SessionMessage[] = [
  said('user', 'Let us settle rounding.'),
  said('assistant', 'Banker\'s rounding is the usual choice.'),
  said('user', 'And what did we decide about refunds?'),
]

/** What Claude Code's own compaction hands up: its summary, and the message it keeps. */
const CORE: SessionMessage[] = [
  said('user', 'Summary: the conversation settled rounding.'),
  said('user', 'And what did we decide about refunds?'),
]

const CORE_RESULT = { messages: CORE, tokensBefore: 90_000, tokensAfter: 4_000 }

/** What the mod hands up where it answers: Claude Code's compaction, the note last. */
const WITH_NOTE = { ...CORE_RESULT, messages: [...CORE, { role: 'user', text: NOTE, toolUses: [] }] }

/** The announcement a session the mod applies to carries from its start. */
const ANNOUNCED = { WORKFLOWS_GATE_SURFACE: '1' }

/**
 * The world beneath the mod: its environment (announced unless told
 * otherwise), the session's id and project, the folders the engine `marked`
 * under the config directory `markedIn`, what the engine's `conversation
 * position` answers (`engine`: its standard output and exit code, or a start
 * that fails), the record of notes already there, Claude Code's own
 * compaction (`core`), and what becomes of a prompt the mod submits
 * (`submits`: entered, dropped, or a send that fails). `calls` records each
 * run and compaction the mod asked for, each prompt it submitted, each text
 * it put in the prompt box, and `written` each file it wrote, by path;
 * `refusesWrites` fails every write.
 */
function world(
  on: On,
  options: {
    env?: Readonly<Record<string, string>>
    marked?: readonly string[]
    markedIn?: string
    engine?: { stdout: string; exitCode?: number } | 'unstartable'
    recorded?: string
    core?: SessionCompactResult
    submits?: 'enters' | 'dropped' | 'fails'
    refusesWrites?: boolean
  } = {},
) {
  const {
    env = ANNOUNCED,
    marked = ['s0'],
    markedIn = DEFAULT_CONFIG,
    engine = { stdout: engineSays(AT_DISCUSSION) },
    recorded,
    core = CORE_RESULT,
    submits = 'enters',
    refusesWrites = false,
  } = options
  const clock = mock.clock(on)
  const calls = {
    runs: [] as { argv: readonly string[]; cwd?: string; timeoutMs?: number }[],
    compactions: [] as SessionCompactInput[],
    submitted: [] as string[],
    filled: [] as string[],
    written: new Map<string, string>(),
    clock,
  }
  const environment: Record<string, string> = { HOME, ...env }

  on('env.get', ($, e) => ({ value: environment[e.name] }))
  on('session.id', () => ({ value: 's0' }))
  on('session.root', () => ({ value: ROOT }))
  on('fs.exists', ($, e) => ({
    value: marked.some(id => e.path === `${markedIn}/conversations/${id}/workflow`),
  }))

  on('fs.read', ($, e) => {
    const text = e.path === COMPACTED ? (calls.written.get(COMPACTED) ?? recorded) : undefined

    if (text === undefined) {
      throw new Error(`ENOENT: no such file, open '${e.path}'`)
    }

    return { value: text }
  })

  on('fs.write', ($, e) => {
    if (refusesWrites) {
      throw new Error(`EACCES: ${e.path}`)
    }

    calls.written.set(e.path, e.text)

    return { value: undefined }
  })

  on('process.run', ($, e) => {
    calls.runs.push({ argv: e.argv, cwd: e.init?.cwd, timeoutMs: e.init?.timeoutMs })

    if (engine === 'unstartable') {
      throw new Error('spawn node ENOENT')
    }

    return {
      value: {
        exitCode: engine.exitCode ?? 0,
        stdout: engine.stdout,
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })

  on('prompt.submit', ($, e) => {
    calls.submitted.push(e.text)

    if (submits === 'fails') {
      throw new Error('the session refused the prompt')
    }

    return submits === 'dropped' ? { drop: 'a hook dropped it' } : { text: e.text }
  })

  on('prompt.fill', ($, e) => {
    calls.filled.push(e.text)

    return { isFilled: true }
  })

  on('session.compact', ($, e) => {
    calls.compactions.push(e)

    return core
  })

  return calls
}

const compactionOf = (over: Partial<SessionCompactInput> = {}): SessionCompactInput => ({
  trigger: 'manual',
  messages: TRANSCRIPT,
  ...over,
})

describe('a workflow conversation\'s compaction', () => {
  for (const trigger of ['manual', 'auto', 'plugin'] as const) {
    test(`is Claude Code's own, the engine's note appended last — ${trigger}`, async ($, on) => {
      const calls = world(on)

      expect(await $.session.compact(compactionOf({ trigger }))).toEqual(WITH_NOTE)
      expect(calls.compactions.map(c => c.trigger), 'Claude Code compacts once, as asked').toEqual([trigger])
      expect(calls.compactions[0]?.messages).toEqual(TRANSCRIPT)
      expect(calls.runs).toEqual([{ argv: ['node', ENGINE, 'conversation', 'position', 's0'], cwd: ROOT, timeoutMs: 15_000 }])
    })
  }

  test('finds the conversation in the config directory the process names, never under the home directory', async ($, on) => {
    const config = '/Users/person/state/workflows'
    const calls = world(on, { env: { ...ANNOUNCED, WORKFLOWS_CONFIG_DIR: config }, markedIn: config })

    expect(await $.session.compact(compactionOf())).toEqual(WITH_NOTE)
    expect([...calls.written.keys()]).toEqual([`${config}/conversations/s0/compacted.json`])
  })

  test('passes the person\'s own words for the compaction down to Claude Code\'s', async ($, on) => {
    const calls = world(on)

    await $.session.compact(compactionOf({ instructions: 'keep the rounding debate' }))

    expect(calls.compactions[0]?.instructions).toBe('keep the rounding debate')
  })

  test('a `/compact` is followed by a continuation, sent once the command is done', async ($, on) => {
    const calls = world(on)

    await $.session.compact(compactionOf({ trigger: 'manual' }))

    expect(calls.submitted, 'nothing is sent inside the hook').toEqual([])

    await calls.clock.settle()

    expect(calls.submitted).toEqual(['The compaction is done. Please carry on from where the conversation left off.'])
    expect(CONTINUATION).toBe(calls.submitted[0])
    expect(calls.filled).toEqual([])
  })

  for (const submits of ['dropped', 'fails'] as const) {
    test(`a continuation that is not sent waits in the prompt box — ${submits}`, async ($, on) => {
      const calls = world(on, { submits })

      await $.session.compact(compactionOf({ trigger: 'manual' }))
      await calls.clock.settle()

      expect(calls.submitted).toEqual([CONTINUATION])
      expect(calls.filled).toEqual([CONTINUATION])
    })
  }

  for (const trigger of ['auto', 'plugin'] as const) {
    test(`a compaction other than the person's \`/compact\` sends nothing — ${trigger}`, async ($, on) => {
      const calls = world(on)

      await $.session.compact(compactionOf({ trigger }))
      await calls.clock.settle()

      expect(calls.submitted).toEqual([])
    })
  }

  test('a compaction Claude Code skips is skipped, the note left off and nothing sent', async ($, on) => {
    const calls = world(on, { core: { skip: 'a PreCompact hook blocked it' } })

    expect(await $.session.compact(compactionOf())).toEqual({ skip: 'a PreCompact hook blocked it' })

    await calls.clock.settle()

    expect([...calls.written.keys(), ...calls.submitted]).toEqual([])
  })
})

describe('the record of the notes the mod handed up', () => {
  /** The record the mod left in the conversation's folder. */
  const recorded = (calls: { written: Map<string, string> }): unknown =>
    JSON.parse(calls.written.get(COMPACTED) ?? 'null')

  test('holds the note handed up, with the place it carries on in', async ($, on) => {
    const calls = world(on)

    await $.session.compact(compactionOf())

    expect(recorded(calls)).toEqual({ [NOTE]: PLACE })
  })

  test('keeps every note handed up before', async ($, on) => {
    const earlier = { 'The conversation was just compacted. An earlier note.': 'payments › research › ledger' }
    const calls = world(on, { recorded: JSON.stringify(earlier) })

    await $.session.compact(compactionOf())

    expect(recorded(calls)).toEqual({ ...earlier, [NOTE]: PLACE })
  })

  for (const before of ['{"text": ', '["a list"]', JSON.stringify({ note: 7 })]) {
    test(`starts afresh where the record cannot be read as one — ${before}`, async ($, on) => {
      const calls = world(on, { recorded: before })

      await $.session.compact(compactionOf())

      expect(recorded(calls)).toEqual({ [NOTE]: PLACE })
    })
  }

  test('is never written where the mod leaves the compaction to Claude Code', async ($, on) => {
    const unmarked = world(on, { marked: [] })

    await $.session.compact(compactionOf())
    await $.session.compact(compactionOf({ agentId: 'a1' }))
    await $.session.compact(compactionOf({ trigger: 'precompute' }))

    expect([...unmarked.written.keys()]).toEqual([])
  })

  test('that cannot be written costs the compaction nothing', async ($, on) => {
    const calls = world(on, { refusesWrites: true })

    expect(await $.session.compact(compactionOf())).toEqual(WITH_NOTE)

    await calls.clock.settle()

    expect(calls.submitted).toEqual([CONTINUATION])
  })
})

describe('what compacts as Claude Code does', () => {
  /** Claude Code's compaction, and nothing of the mod's: no note, no record, nothing sent. */
  async function leftAlone(
    $: Engine,
    calls: ReturnType<typeof world>,
    over: Partial<SessionCompactInput> = {},
  ) {
    expect(await $.session.compact(compactionOf(over))).toEqual(CORE_RESULT)

    await calls.clock.settle()

    expect([...calls.written.keys(), ...calls.submitted]).toEqual([])
  }

  test('a subagent\'s transcript, asking the engine nothing', async ($, on) => {
    const calls = world(on)

    await leftAlone($, calls, { agentId: 'a1' })
    expect(calls.runs).toEqual([])
  })

  for (const env of [{}, { WORKFLOWS_GATE_SURFACE: '0' }] as Readonly<Record<string, string>>[]) {
    test(`a session that did not announce, asking the engine nothing — ${JSON.stringify(env)}`, async ($, on) => {
      const calls = world(on, { env })

      await leftAlone($, calls)
      expect(calls.runs).toEqual([])
    })
  }

  test('a conversation the engine has not marked, asking the engine nothing', async ($, on) => {
    const calls = world(on, { marked: [] })

    await leftAlone($, calls)
    expect(calls.runs).toEqual([])
  })

  test('a process that names no folder, asking the engine nothing', async ($, on) => {
    const calls = world(on, { env: { ...ANNOUNCED, HOME: '' } })

    await leftAlone($, calls)
    expect(calls.runs).toEqual([])
  })

  test('a position that names no skill — a work unit\'s menu, or none', async ($, on) => {
    const calls = world(on, { engine: { stdout: engineSays(AT_MENU) } })

    await leftAlone($, calls)
  })

  const failures = [
    { why: 'an engine that fails', engine: { stdout: '', exitCode: 1 } },
    { why: 'an engine that answers no position', engine: { stdout: 'not the engine\n' } },
    { why: 'an engine that cannot start', engine: 'unstartable' as const },
  ]

  for (const { why, engine } of failures) {
    test(why, async ($, on) => {
      const calls = world(on, { engine })

      await leftAlone($, calls)
      expect(calls.compactions.length, 'Claude Code compacts once').toBe(1)
    })
  }
})

describe('a compaction computed ahead of time', () => {
  test('passes through untouched, asking the engine nothing — the compaction that comes reuses it', async ($, on) => {
    const calls = world(on)

    expect(await $.session.compact(compactionOf({ trigger: 'precompute' }))).toEqual(CORE_RESULT)
    expect(calls.compactions.map(c => c.trigger)).toEqual(['precompute'])
    expect(calls.runs).toEqual([])
  })
})

describe('positionIn', () => {
  test('the engine\'s POSITION line read whole, its place as the engine composed it; anything else reads as none', () => {
    expect(positionIn(engineSays(AT_DISCUSSION))).toEqual({ text: NOTE, skill: AT_DISCUSSION.skill, place: PLACE })
    expect(positionIn(engineSays(AT_MENU))).toEqual({ text: AT_MENU.text, skill: null, place: 'payments' })
    expect(positionIn(engineSays({ ...AT_DISCUSSION, place: null }))).toBe(null)
    expect(positionIn('{"text":"no marker"}')).toBe(null)
    expect(positionIn('=== POSITION (json for the gate mod — never display) ===\nnot json')).toBe(null)
  })
})
