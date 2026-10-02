import type { ModelCompleteResult, On, SessionCompactInput, SessionMessage } from 'claude-code'
import { describe, expect, test, tier } from 'claude-code/testing'

import { TRANSCRIPT_CAP, answerOf, positionIn, transcriptOf } from '../hooks/compaction.ts'

tier('user')

/**
 * The person's home directory, as the process names it — under `/Users`,
 * since the kit's host check refuses macOS's automounted `/home`.
 */
const HOME = '/Users/person'

/** The session's project. */
const ROOT = '/Users/person/app'

const ENGINE = `${ROOT}/.claude/skills/workflow-engine/scripts/engine.cjs`

const NOTE = [
  `This conversation is working in the discussion of "ledger" in "payments". To carry on there, re-read \`${ROOT}/.claude/skills/workflow-discussion-process/SKILL.md\` in full and follow its load directives, then re-read these in full:`,
  `- ${ROOT}/.workflows/payments/discussion/ledger.md`,
].join('\n')

const SAID = '- Rounding is banker\'s rounding: "round half to even, everywhere".\n- Refunds stay out of the ledger for now.'

/** The engine's answer for a conversation at a discussion. */
const AT_DISCUSSION = {
  session_id: 's0',
  position: { name: 'payments', phase: 'discussion', topic: 'ledger' },
  skill: `${ROOT}/.claude/skills/workflow-discussion-process/SKILL.md`,
  files: [`${ROOT}/.workflows/payments/discussion/ledger.md`],
  text: NOTE,
}

/** The engine's answer for a conversation at a work unit's menu. */
const AT_MENU = {
  session_id: 's0',
  position: { name: 'payments' },
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

const said = (role: SessionMessage['role'], text: string, toolUses: SessionMessage['toolUses'] = []): SessionMessage => ({
  role,
  text,
  toolUses,
})

/** A discussion: the skill and the document read, two decisions stated and never written down. */
const TRANSCRIPT: SessionMessage[] = [
  said('user', 'Let us settle rounding.'),
  said('assistant', 'Reading the discussion.', [
    {
      tool_use_id: 'toolu_1',
      tool: 'Read',
      input: { file_path: `${ROOT}/.workflows/payments/discussion/ledger.md` },
      text: 'THE DOCUMENT AS READ',
    },
  ]),
  { role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 'toolu_1', text: 'THE DOCUMENT AS READ', isError: false, result: null }] },
  said('user', 'Banker\'s rounding, everywhere. Don\'t write it down yet.'),
  said('assistant', 'Recorded the map.', [
    {
      tool_use_id: 'toolu_2',
      tool: 'Edit',
      input: { file_path: `${ROOT}/.workflows/payments/discussion/ledger.md`, old_string: 'a', new_string: 'Currency is per account.' },
    },
  ]),
]

/** What Claude Code's own compaction hands up. */
const CORE: SessionMessage[] = [said('user', 'Summary: the conversation settled rounding.')]

const CORE_RESULT = { messages: CORE, tokensBefore: 90_000, tokensAfter: 4_000 }

const answered = (text: string): ModelCompleteResult => ({
  isAnswered: true,
  text,
  usage: { input_tokens: 818, output_tokens: 249, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
})

const NOT_ANSWERED: ModelCompleteResult = {
  isAnswered: false,
  reason: 'aborted',
  usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
} as ModelCompleteResult

/**
 * The world beneath the mod: the session's id and project, the folders the
 * engine `marked`, what the engine's `conversation position` answers
 * (`engine`: its standard output and exit code, or a start that fails), what
 * the summary's model answers, and Claude Code's own compaction. `calls`
 * records each run, completion and compaction the mod asked for.
 */
function world(
  on: On,
  options: {
    marked?: readonly string[]
    engine?: { stdout: string; exitCode?: number } | 'unstartable'
    summary?: ModelCompleteResult
  } = {},
) {
  const { marked = ['s0'], engine = { stdout: engineSays(AT_DISCUSSION) }, summary = answered(SAID) } = options
  const calls = {
    runs: [] as { argv: readonly string[]; cwd?: string }[],
    completions: [] as { model: string; prompt: string; maxTokens?: number; timeoutMs?: number }[],
    compactions: 0,
  }

  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? HOME : undefined }))
  on('session.id', () => ({ value: 's0' }))
  on('session.root', () => ({ value: ROOT }))
  on('fs.exists', ($, e) => ({
    value: marked.some(id => e.path === `${HOME}/.config/workflows/conversations/${id}/workflow`),
  }))

  on('process.run', ($, e) => {
    calls.runs.push({ argv: e.argv, cwd: e.init?.cwd })

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

  on('model.complete', ($, e) => {
    calls.completions.push({ model: e.model, prompt: e.prompt, maxTokens: e.maxTokens, timeoutMs: e.timeoutMs })

    return { value: summary }
  })

  on('session.compact', () => {
    calls.compactions += 1

    return CORE_RESULT
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
    test(`answers with one message: the engine's note, then what was said and never written down — ${trigger}`, async ($, on) => {
      const calls = world(on)

      expect(await $.session.compact(compactionOf({ trigger }))).toEqual({
        messages: [
          {
            role: 'user',
            text: `${NOTE}\n\nSaid in the conversation and not yet written down:\n${SAID}`,
            toolUses: [],
          },
        ],
      })
      expect(calls.compactions, 'Claude Code compacts nothing').toBe(0)
      expect(calls.runs).toEqual([
        { argv: ['node', ENGINE, 'conversation', 'position', 's0'], cwd: ROOT },
      ])
    })
  }

  test('the summary is one completion over the transcript, bounded, the person\'s own words for the compaction among it', async ($, on) => {
    const calls = world(on)

    await $.session.compact(compactionOf({ instructions: 'keep the rounding debate' }))

    const [completion] = calls.completions

    expect(calls.completions.length).toBe(1)
    expect(completion?.model).toBe('sonnet')
    expect(completion?.maxTokens).toBe(2_000)
    expect(completion?.timeoutMs).toBe(60_000)
    expect(completion?.prompt).toContain("Keep only what the conversation said and never wrote into a file")
    expect(completion?.prompt).toContain("Answer as a short list, or 'Nothing.'")
    expect(completion?.prompt).toContain('The person asked this compaction to keep: keep the rounding debate')
    expect(completion?.prompt).toContain(`<conversation>\n${transcriptOf(TRANSCRIPT)}\n</conversation>`)
  })

  for (const nothing of ['Nothing.', 'nothing', '  Nothing.\n', '']) {
    test(`a summary of nothing leaves the note alone — ${JSON.stringify(nothing)}`, async ($, on) => {
      const calls = world(on, { summary: answered(nothing) })

      expect(await $.session.compact(compactionOf())).toEqual({
        messages: [{ role: 'user', text: NOTE, toolUses: [] }],
      })
      expect(calls.compactions).toBe(0)
    })
  }

  test('a summary that does not answer leaves the compaction to Claude Code, the note ahead of what it hands up', async ($, on) => {
    const calls = world(on, { summary: NOT_ANSWERED })

    expect(await $.session.compact(compactionOf())).toEqual({
      ...CORE_RESULT,
      messages: [{ role: 'user', text: NOTE, toolUses: [] }, ...CORE],
    })
    expect(calls.compactions).toBe(1)
  })
})

describe('what compacts as Claude Code does', () => {
  test('a subagent\'s transcript, asking the engine nothing', async ($, on) => {
    const calls = world(on)

    expect(await $.session.compact(compactionOf({ agentId: 'a1' }))).toEqual(CORE_RESULT)
    expect([calls.runs.length, calls.completions.length]).toEqual([0, 0])
  })

  test('a conversation the engine has not marked, asking the engine nothing', async ($, on) => {
    const calls = world(on, { marked: [] })

    expect(await $.session.compact(compactionOf())).toEqual(CORE_RESULT)
    expect([calls.runs.length, calls.completions.length]).toEqual([0, 0])
  })

  test('a position that names no skill — a work unit\'s menu, or none', async ($, on) => {
    const calls = world(on, { engine: { stdout: engineSays(AT_MENU) } })

    expect(await $.session.compact(compactionOf())).toEqual(CORE_RESULT)
    expect(calls.completions.length).toBe(0)
  })

  const failures = [
    { why: 'an engine that fails', engine: { stdout: '', exitCode: 1 } },
    { why: 'an engine that answers no position', engine: { stdout: 'not the engine\n' } },
    { why: 'an engine that cannot start', engine: 'unstartable' as const },
  ]

  for (const { why, engine } of failures) {
    test(why, async ($, on) => {
      const calls = world(on, { engine })

      expect(await $.session.compact(compactionOf())).toEqual(CORE_RESULT)
      expect(calls.completions.length).toBe(0)
    })
  }
})

describe('a compaction computed ahead of time', () => {
  test('is skipped where the mod will answer the compaction that comes', async ($, on) => {
    const calls = world(on)

    expect(await $.session.compact(compactionOf({ trigger: 'precompute' }))).toEqual({
      skip: 'the workflow mod compacts this conversation itself',
    })
    expect([calls.compactions, calls.completions.length]).toEqual([0, 0])
  })

  test('is Claude Code\'s anywhere else', async ($, on) => {
    world(on, { marked: [] })

    expect(await $.session.compact(compactionOf({ trigger: 'precompute' }))).toEqual(CORE_RESULT)
  })
})

describe('transcriptOf', () => {
  test('who said what, and each tool call by name with the start of its input — never what a tool answered', () => {
    const transcript = transcriptOf(TRANSCRIPT)

    expect(transcript).toContain("USER: Banker's rounding, everywhere. Don't write it down yet.")
    expect(transcript).toContain(`[tools: Edit {"file_path":"${ROOT}/.workflows/payments/discussion/ledger.md","old_string":"a","new_string":"Currency is per account."}]`)
    expect(transcript).not.toContain('THE DOCUMENT AS READ')
  })

  test('a tool call\'s input is cut to its start', () => {
    const transcript = transcriptOf([
      said('assistant', '', [{ tool_use_id: 'toolu_3', tool: 'Write', input: { file_path: '/a.md', content: 'x'.repeat(5_000) } }]),
    ])

    expect(transcript.length).toBeLessThan(500)
    expect(transcript).toStartWith('ASSISTANT: \n[tools: Write {"file_path":"/a.md","content":"xxx')
  })

  test('a transcript past the cap keeps its most recent part, and says the rest is left out', () => {
    const early = said('user', `EARLY ${'e'.repeat(TRANSCRIPT_CAP)}`)
    const late = said('user', 'LATE: refunds stay out of the ledger.')
    const transcript = transcriptOf([early, late])

    expect(transcript).toStartWith('[the conversation before this point is left out]\n\n')
    expect(transcript.length).toBe('[the conversation before this point is left out]\n\n'.length + TRANSCRIPT_CAP)
    expect(transcript).toEndWith('USER: LATE: refunds stay out of the ledger.')
    expect(transcript).not.toContain('EARLY')
    expect(transcriptOf([late])).toBe('USER: LATE: refunds stay out of the ledger.')
  })
})

describe('positionIn and answerOf', () => {
  test('the engine\'s POSITION line read whole; anything else reads as none', () => {
    expect(positionIn(engineSays(AT_DISCUSSION))).toEqual({ text: NOTE, skill: AT_DISCUSSION.skill })
    expect(positionIn(engineSays(AT_MENU))).toEqual({ text: AT_MENU.text, skill: null })
    expect(positionIn('{"text":"no marker"}')).toBe(null)
    expect(positionIn('=== POSITION (json for the gate mod — never display) ===\nnot json')).toBe(null)
  })

  test('the note alone where nothing was said', () => {
    expect(answerOf(NOTE, 'Nothing.')).toBe(NOTE)
    expect(answerOf(NOTE, ` ${SAID}\n`)).toBe(`${NOTE}\n\nSaid in the conversation and not yet written down:\n${SAID}`)
  })
})
