'use strict';

// ---------------------------------------------------------------------------
// Domain ring: the thread register — what a research topic set out to learn,
// typed rows under a research item (`phases.research.items.{topic}.threads`).
//
// A lens, not a plan: the conversation makes every call — a thread enters,
// reframes, changes state, parks with its reason, or goes once its substance
// merged into a survivor — and these transitions validate and write it.
// Nothing gates on a thread's state. Two levels max — a thread's `parent`
// names another thread that is itself top-level. Keys are kebab-case slugs;
// storage is insertion-ordered and the projection ranks rows for render.
// All errors throw loud and specific. The CLI transactions (record*) run
// load→apply→save under the work unit's manifest lock (the same lock every
// manifest writer honours) with NO git commit — the calling session's
// commit cadence picks the manifest change up.
// ---------------------------------------------------------------------------

const { loadWorkUnitManifest, saveWorkUnitManifest, withWorkUnitLock } = require('../kernel/manifest.cjs');
const { KEBAB_SLUG_PATTERN, VALID_THREAD_STATUSES, isThreadOrigin } = require('../kernel/manifest-schema.cjs');

/**
 * @typedef {object} Thread
 * @property {string} question     the thread as asked — one line, reframed in place
 * @property {string} status       `open` | `digging` | `learned` | `parked`
 * @property {string} origin       `seed` | `brief` | `user` | `conversation` | a deep-dive id | a topic name
 * @property {string|null} parent  another thread's slug (itself top-level), or null
 * @property {string} [note]       why the thread is parked — `parked` rows alone
 */

/**
 * @typedef {object} ThreadCounts
 * @property {number} open
 * @property {number} digging
 * @property {number} learned
 * @property {number} parked
 */

/**
 * @typedef {object} RegisterState
 * @property {ThreadCounts} counts
 * @property {number} total
 */

/** @typedef {{thread: string} & Thread & RegisterState} ThreadWriteResult */

/**
 * The research item for `topic`, or a loud error.
 * @param {object} manifest @param {string} topic
 * @returns {{status?: string, threads?: Record<string, Thread>}}
 */
function researchItem(manifest, topic) {
  const items = manifest && manifest.phases && manifest.phases.research && manifest.phases.research.items;
  const item = items && typeof items === 'object' ? items[topic] : undefined;
  if (!item || typeof item !== 'object') {
    throw new Error(`no research item "${topic}" in the manifest (phases.research.items)`);
  }
  return item;
}

/**
 * The thread register of a research item ({} when none yet).
 * @param {object} manifest @param {string} topic
 * @returns {Record<string, Thread>}
 */
function threadsOf(manifest, topic) {
  const item = researchItem(manifest, topic);
  return item.threads && typeof item.threads === 'object' ? item.threads : {};
}

/**
 * One thread by slug, or a loud error.
 * @param {Record<string, Thread>} threads @param {string} topic @param {string} slug
 */
function threadOf(threads, topic, slug) {
  const thread = threads[slug];
  if (!thread) throw new Error(`thread "${slug}" not found under "${topic}"`);
  return thread;
}

/**
 * A one-line text field (the question, a parked note), trimmed.
 * @param {unknown} value @param {string} field
 */
function oneLine(value, field) {
  if (typeof value !== 'string' || value.trim() === '' || value.includes('\n')) {
    throw new Error(`thread ${field} must be one non-empty line`);
  }
  return value.trim();
}

/** @param {string[]} slugs */
function quoted(slugs) {
  return slugs.map((s) => `"${s}"`).join(', ');
}

/**
 * Add a thread to a research item's register. New threads start `open`.
 * @param {object} manifest
 * @param {string} topic
 * @param {string} slug            kebab-case slug
 * @param {{question: string, origin: string, parent?: string|null}} fields
 * @returns {Thread} the new thread
 */
function addThread(manifest, topic, slug, { question, origin, parent = null }) {
  const item = researchItem(manifest, topic);
  if (!slug || !KEBAB_SLUG_PATTERN.test(slug)) {
    throw new Error(`thread slug must be a kebab-case slug (got "${slug}")`);
  }
  if (!isThreadOrigin(origin)) {
    throw new Error(`thread origin must be seed, brief, user, conversation, a deep-dive id (deep-dive-NNN), or a topic name (got "${origin}")`);
  }
  const asked = oneLine(question, 'question');
  if (!item.threads || typeof item.threads !== 'object') item.threads = {};
  const threads = item.threads;
  if (threads[slug]) {
    throw new Error(`thread "${slug}" already exists under "${topic}"`);
  }
  if (parent !== null) {
    const parentThread = threads[parent];
    if (!parentThread) {
      throw new Error(`parent thread "${parent}" not found under "${topic}"`);
    }
    if (parentThread.parent !== null) {
      throw new Error(`"${parent}" is itself a child of "${parentThread.parent}" — the register is two levels max`);
    }
  }
  threads[slug] = { question: asked, status: 'open', origin, parent };
  return threads[slug];
}

/**
 * Record a thread state. Any state → any state is legal (a lens, not a
 * plan); the enum is the only constraint. A note is the reason a thread is
 * parked: legal with `parked` alone, replaced when given, kept when a parked
 * thread stays parked, and cleared the moment the state leaves `parked`.
 * @param {object} manifest
 * @param {string} topic
 * @param {string} slug
 * @param {string} state  one of VALID_THREAD_STATUSES
 * @param {{note?: string}} [opts]
 * @returns {Thread} the updated thread
 */
function setThreadState(manifest, topic, slug, state, { note } = {}) {
  if (!VALID_THREAD_STATUSES.includes(state)) {
    throw new Error(`unknown thread state "${state}" (${VALID_THREAD_STATUSES.join('|')})`);
  }
  if (note !== undefined && state !== 'parked') {
    throw new Error(`a note is legal on a parked thread alone (got "${state}")`);
  }
  const thread = threadOf(threadsOf(manifest, topic), topic, slug);
  thread.status = state;
  if (state !== 'parked') delete thread.note;
  else if (note !== undefined) thread.note = oneLine(note, 'note');
  return thread;
}

/**
 * Rewrite a thread's question in place — the file carries the history, the
 * register carries the question as it now stands. Origin is never touched.
 * @param {object} manifest @param {string} topic @param {string} slug @param {string} question
 * @returns {Thread} the updated thread
 */
function reframeThread(manifest, topic, slug, question) {
  const thread = threadOf(threadsOf(manifest, topic), topic, slug);
  thread.question = oneLine(question, 'question');
  return thread;
}

/**
 * Remove a thread — the merge's mechanical half, the survivor's file section
 * carrying the folded substance. Refused while children nest under it.
 * @param {object} manifest @param {string} topic @param {string} slug
 */
function removeThread(manifest, topic, slug) {
  const threads = threadsOf(manifest, topic);
  threadOf(threads, topic, slug);
  const children = Object.keys(threads).filter((name) => threads[name].parent === slug);
  if (children.length) {
    throw new Error(`thread "${slug}" can't be removed — ${quoted(children)} nest${children.length === 1 ? 's' : ''} under it; remove ${children.length === 1 ? 'it' : 'them'} first`);
  }
  delete threads[slug];
}

/**
 * One stored row against the register's shape — status in vocabulary, a
 * parent that exists and is itself top-level, a note on a parked row alone.
 * @param {string} topic @param {string} slug @param {Thread} thread @param {Record<string, Thread>} threads
 */
function assertThread(topic, slug, thread, threads) {
  const where = `thread "${slug}" under "${topic}"`;
  if (!thread || typeof thread !== 'object') throw new Error(`${where} is not an object`);
  if (typeof thread.question !== 'string' || typeof thread.origin !== 'string') {
    throw new Error(`${where} lacks its question or origin`);
  }
  if (!VALID_THREAD_STATUSES.includes(thread.status)) {
    throw new Error(`${where} has unknown state "${thread.status}"`);
  }
  if (thread.parent !== null) {
    const parent = threads[thread.parent];
    if (!parent) throw new Error(`${where} references missing parent "${thread.parent}"`);
    if (parent.parent !== null) throw new Error(`${where} nests under "${thread.parent}", itself a child — the register is two levels max`);
  }
  if (thread.note !== undefined && thread.status !== 'parked') {
    throw new Error(`${where} carries a note while ${thread.status} — a note is legal on a parked thread alone`);
  }
}

/**
 * Derived state of one research item's register: counts by status and the
 * total. Throws on a corrupt row, so every reader (the projection, the
 * simulation's audit) meets a register it can trust.
 * @param {object} manifest @param {string} topic
 * @returns {RegisterState}
 */
function registerState(manifest, topic) {
  const threads = threadsOf(manifest, topic);
  /** @type {ThreadCounts} */
  const counts = { open: 0, digging: 0, learned: 0, parked: 0 };
  let total = 0;
  for (const [slug, thread] of Object.entries(threads)) {
    assertThread(topic, slug, thread, threads);
    counts[/** @type {keyof ThreadCounts} */ (thread.status)] += 1;
    total += 1;
  }
  return { counts, total };
}

/**
 * Decision-ready body of a thread write: the row as it now stands plus the
 * register's derived state.
 * @param {object} manifest @param {string} topic @param {string} slug
 * @returns {ThreadWriteResult}
 */
function threadWriteResult(manifest, topic, slug) {
  return { thread: slug, ...threadsOf(manifest, topic)[slug], ...registerState(manifest, topic) };
}

/**
 * One register transaction: load → apply → save under the work unit's
 * manifest lock. A throw inside `apply` aborts before save. No git commit.
 * @template T
 * @param {string} cwd @param {string} workUnit
 * @param {(manifest: object) => T} apply
 * @returns {T}
 */
function transaction(cwd, workUnit, apply) {
  return withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    const result = apply(manifest);
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return result;
  });
}

/**
 * The `research-threads add` transaction.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {string} slug
 * @param {{question: string, origin: string, parent?: string|null}} fields
 * @returns {ThreadWriteResult}
 */
function recordThreadAdd(cwd, workUnit, topic, slug, fields) {
  return transaction(cwd, workUnit, (manifest) => {
    addThread(manifest, topic, slug, fields);
    return threadWriteResult(manifest, topic, slug);
  });
}

/**
 * The positional form of `research-threads set`.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {string} slug
 * @param {string} state  one of VALID_THREAD_STATUSES
 * @param {{note?: string}} [opts]
 * @returns {ThreadWriteResult}
 */
function recordThreadState(cwd, workUnit, topic, slug, state, opts = {}) {
  return transaction(cwd, workUnit, (manifest) => {
    setThreadState(manifest, topic, slug, state, opts);
    return threadWriteResult(manifest, topic, slug);
  });
}

/**
 * The batch form of `research-threads set`: several thread states in one
 * load → apply → save. Every entry validates as it applies and a throw
 * aborts before save — a failing entry means nothing was written.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {Array<[string, string]>} entries  [slug, state] pairs
 * @returns {{set: Record<string, string>} & RegisterState}
 */
function recordThreadStates(cwd, workUnit, topic, entries) {
  return transaction(cwd, workUnit, (manifest) => {
    for (const [slug, state] of entries) setThreadState(manifest, topic, slug, state);
    return { set: Object.fromEntries(entries), ...registerState(manifest, topic) };
  });
}

/**
 * The `research-threads reframe` transaction.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {string} slug
 * @param {string} question
 * @returns {ThreadWriteResult}
 */
function recordThreadReframe(cwd, workUnit, topic, slug, question) {
  return transaction(cwd, workUnit, (manifest) => {
    reframeThread(manifest, topic, slug, question);
    return threadWriteResult(manifest, topic, slug);
  });
}

/**
 * The `research-threads remove` transaction.
 * @param {string} cwd project root
 * @param {string} workUnit
 * @param {string} topic
 * @param {string} slug
 * @returns {{thread: string, removed: true} & RegisterState}
 */
function recordThreadRemove(cwd, workUnit, topic, slug) {
  return transaction(cwd, workUnit, (manifest) => {
    removeThread(manifest, topic, slug);
    return { thread: slug, removed: /** @type {true} */ (true), ...registerState(manifest, topic) };
  });
}

module.exports = {
  addThread, setThreadState, reframeThread, removeThread, registerState, threadsOf,
  recordThreadAdd, recordThreadState, recordThreadStates, recordThreadReframe, recordThreadRemove,
};
