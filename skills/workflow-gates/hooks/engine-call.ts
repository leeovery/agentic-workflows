/**
 * A Bash command read as one call of the workflow engine, and the line its
 * transcript row draws: the verb, then its arguments as written.
 */

/** The engine as the workflows run it, by whatever path leads to the project. */
const ENGINE = /(^|\/)\.claude\/skills\/workflow-engine\/scripts\/engine\.cjs$/

/** The commands whose second word is an argument, not a verb of theirs. */
const SINGLE_WORD = new Set(['boot', 'commit'])

/** The roadmap's verbs whose own subcommand names the verb in full. */
const ROADMAP_NOUNS = new Set(['session', 'horizon'])

const MARKER = '▪'

const SEPARATOR = ' · '

const ELLIPSIS = '…'

/** One word of a command: its value with quotes and escapes taken out, and as written. */
type Word = { value: string; written: string }

/** A call of the engine: its verb, and its arguments as written. */
export type EngineCall = { verb: string; args: string }

/** The line a call draws, cut to its width: the marker, the verb, the arguments. */
export type CallLine = { marker: string; verb: string; args: string }

/**
 * Where the quote opened at `at` closes: the next one of its kind, past
 * escaped ones inside double quotes; -1 where it never does.
 */
function quoteEnd(command: string, at: number): number {
  const quote = command[at]

  for (let n = at + 1; n < command.length; n += 1) {
    if (quote === '"' && command[n] === '\\') {
      n += 1
    } else if (command[n] === quote) {
      return n
    }
  }

  return -1
}

/** Where the parenthesis opened at `at` closes; -1 where it never does. */
function parenEnd(command: string, at: number): number {
  let depth = 0

  for (let n = at; n < command.length; n += 1) {
    if (command[n] === '(') {
      depth += 1
    } else if (command[n] === ')') {
      depth -= 1

      if (depth === 0) {
        return n
      }
    }
  }

  return -1
}

/**
 * The words of a command that runs exactly one thing; null where it pipes,
 * chains, redirects, backgrounds, comments or spans lines, so a row drawn
 * from it would leave out what else ran.
 */
function wordsOf(command: string): Word[] | null {
  const words: Word[] = []
  let word: Word | null = null
  let n = 0

  /** The word under way, `value` and `written` added to it. */
  const grown = (value: string, written: string): Word => ({
    value: (word?.value ?? '') + value,
    written: (word?.written ?? '') + written,
  })

  while (n < command.length) {
    const char = command[n] ?? ''
    let end = n

    if (char === ' ' || char === '\t') {
      if (word !== null) {
        words.push(word)
        word = null
      }
    } else if (char === "'" || char === '"') {
      end = quoteEnd(command, n)

      if (end === -1) {
        return null
      }

      const inner = command.slice(n + 1, end)

      word = grown(char === '"' ? inner.replace(/\\(["\\$`])/g, '$1') : inner, command.slice(n, end + 1))
    } else if (char === '\\') {
      end = n + 1
      word = grown(command[end] ?? '', command.slice(n, end + 1))
    } else if (char === '$' && command[n + 1] === '(') {
      end = parenEnd(command, n + 1)

      if (end === -1) {
        return null
      }

      word = grown(command.slice(n, end + 1), command.slice(n, end + 1))
    } else if (char === '`') {
      end = command.indexOf('`', n + 1)

      if (end === -1) {
        return null
      }

      word = grown(command.slice(n, end + 1), command.slice(n, end + 1))
    } else if (';&|<>()\n\r'.includes(char) || (char === '#' && word === null)) {
      return null
    } else {
      word = grown(char, char)
    }

    n = end + 1
  }

  if (word !== null) {
    words.push(word)
  }

  return words
}

/**
 * The engine call a Bash command makes, read from the command alone: `node`
 * running the workflow engine with its verb and nothing else run beside it.
 * Null for any other command.
 */
export function engineCallIn(command: string): EngineCall | null {
  const words = wordsOf(command.trim())

  if (words === null || words.length < 3) {
    return null
  }

  const [runner, script, group, ...rest] = words

  if (
    runner?.value !== 'node' ||
    !ENGINE.test(script?.value ?? '') ||
    group === undefined ||
    group.value.startsWith('-')
  ) {
    return null
  }

  const verb = [group.written]
  const isVerb = (word: Word | undefined) =>
    word !== undefined && /^[a-z][a-z-]*$/.test(word.value)

  if (!SINGLE_WORD.has(group.value) && isVerb(rest[0])) {
    const sub = rest.shift() as Word

    verb.push(sub.written)

    if (group.value === 'roadmap' && ROADMAP_NOUNS.has(sub.value) && isVerb(rest[0])) {
      verb.push((rest.shift() as Word).written)
    }
  }

  return { verb: verb.join(' '), args: argsOf(rest) }
}

/**
 * The arguments as written, free text last: a flag whose value is words
 * (`-m "…"`, `--summary "…"`) moves behind the rest, so a cut line keeps
 * what the call addresses and loses the prose.
 */
function argsOf(words: readonly Word[]): string {
  const addressed: string[] = []
  const prose: string[] = []

  for (let n = 0; n < words.length; n += 1) {
    const word = words[n] as Word
    const value = words[n + 1]

    if (word.value.startsWith('-') && value !== undefined && /\s/.test(value.value)) {
      prose.push(`${word.written} ${value.written}`)
      n += 1
    } else {
      addressed.push(word.written)
    }
  }

  return [...addressed, ...prose].join(' ')
}

/**
 * The line a call draws within `columns` cells: `▪ verb · args`, the
 * arguments cut first and the verb only when they are gone, with an
 * ellipsis where anything was cut.
 */
export function lineOf(call: EngineCall, columns: number): CallLine {
  const head = `${MARKER} ${call.verb}`
  const room = Math.max(1, columns)

  if (head.length > room) {
    return {
      marker: MARKER,
      verb: ` ${call.verb}`.slice(0, Math.max(0, room - MARKER.length - 1)) + ELLIPSIS,
      args: '',
    }
  }

  if (call.args === '') {
    return { marker: MARKER, verb: ` ${call.verb}`, args: '' }
  }

  const args = `${SEPARATOR}${call.args}`
  const left = room - head.length

  return {
    marker: MARKER,
    verb: ` ${call.verb}`,
    args: args.length <= left ? args : `${args.slice(0, Math.max(0, left - 1))}${ELLIPSIS}`,
  }
}
