/**
 * The conversation's position as the engine records it in the conversation's
 * folder (domain/position.cjs), and the word the spinner says for it.
 */

/** Where the conversation is working: a work unit, its phase and topic, the task in flight. */
export type Position = {
  name: string
  phase?: string
  topic?: string
  task?: string
}

/** What each phase's work is, as the spinner says it. */
const PHASE_WORDS: ReadonlyMap<string, string> = new Map([
  ['discovery', 'Shaping'],
  ['research', 'Researching'],
  ['experiment', 'Experimenting'],
  ['discussion', 'Discussing'],
  ['investigation', 'Investigating'],
  ['scoping', 'Scoping'],
  ['specification', 'Specifying'],
  ['planning', 'Planning'],
  ['implementation', 'Implementing'],
  ['review', 'Reviewing'],
])

/** What the project-level places' work is, as the spinner says it. */
const PLACE_WORDS: ReadonlyMap<string, string> = new Map([
  ['roadmap', 'Roadmapping'],
  ['baseline', 'Assessing'],
])

const isPosition = (value: unknown): value is Position =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Position).name === 'string'

/** The position a kept file's text states; null where it does not read as one. */
export function positionOf(text: string): Position | null {
  try {
    const kept: unknown = JSON.parse(text)

    return isPosition(kept) ? kept : null
  } catch {
    return null
  }
}

/**
 * The spinner's word for a position: its phase's work, the task in flight
 * with it; a project-level place's own; none at a work unit's menu.
 */
export function wordFor(position: Position | null): string | null {
  if (position === null) {
    return null
  }

  const { name, phase, task } = position

  if (phase === undefined) {
    return PLACE_WORDS.get(name) ?? null
  }

  const word = PHASE_WORDS.get(phase)

  if (word === undefined) {
    return null
  }

  return phase === 'implementation' && typeof task === 'string'
    ? `${word} task ${task}`
    : word
}
