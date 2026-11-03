/**
 * The conversation's position as the engine records it in the conversation's
 * folder (domain/position.cjs), and the word the spinner says for it.
 */

/** A task in flight: its `{phase}.{n}`, and the agent ids of its builder and its reviewers. */
export type InFlight = {
  task: string
  builder: string | null
  reviewers: string[]
}

/** Where the conversation is working: a work unit, its phase and topic, every task in flight there. */
export type Position = {
  name: string
  phase?: string
  topic?: string
  tasks?: InFlight[]
}

/** What each phase's work is, as the spinner says it. */
const PHASE_WORDS: ReadonlyMap<string, string> = new Map([
  ['discovery', 'Shaping'],
  ['experiment', 'Experimenting'],
  ['discussion', 'Discussing'],
  ['investigation', 'Investigating'],
  ['scoping', 'Scoping'],
  ['specification', 'Specifying'],
  ['planning', 'Planning'],
  ['implementation', 'Implementing'],
  ['review', 'Reviewing'],
])

/** The phases a unit's tasks are in flight at: its build, and its review phase's fixes. */
const BUILD_PLACES: ReadonlySet<string> = new Set(['implementation', 'review'])

/** What the project-level places' work is, as the spinner says it. */
const PLACE_WORDS: ReadonlyMap<string, string> = new Map([
  ['roadmap', 'Roadmapping'],
  ['product', 'Shaping'],
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
 * What a build's word says of its tasks in flight: the one by its number,
 * several by their count; nothing where none is.
 */
function inFlightWords(tasks: unknown): string | null {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return null
  }

  const [{ task }] = tasks as InFlight[]

  return tasks.length === 1 ? `task ${task}` : `${tasks.length} tasks`
}

/**
 * The spinner's word for a position: its phase's work, a build's tasks in
 * flight with it; a project-level place's own; none at a work unit's menu.
 */
export function wordFor(position: Position | null): string | null {
  if (position === null) {
    return null
  }

  const { name, phase, tasks } = position

  if (phase === undefined) {
    return PLACE_WORDS.get(name) ?? null
  }

  const word = PHASE_WORDS.get(phase)

  if (word === undefined) {
    return null
  }

  const inFlight = BUILD_PLACES.has(phase) ? inFlightWords(tasks) : null

  return inFlight === null ? word : `${word} ${inFlight}`
}
