'use strict';

// ---------------------------------------------------------------------------
// Domain ring: promote — move an epic specification assessed as cross-cutting
// to its own cross-cutting work unit, as ONE transaction. The judgment (the
// assessment, the cc unit's name, the one-line description, user
// confirmation) stays in the calling prose — this verb takes decided inputs.
//
// Validation is complete before any mutation: on failure the epic is
// byte-identical to before the call and no cc work unit exists — no crash
// window between the artifact moves and the commit. The manifest writes are
// the source of truth; the knowledge base is a derived index
// (warn-don't-block); one multi-pathspec commit covers the epic, the new cc
// unit, and the project manifest. Each manifest's read-modify-write runs
// under its own lock (epic, then the cc unit's, then the project lock — one
// at a time, never nested, so the multi-manifest transaction cannot
// deadlock).
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const {
  loadWorkUnitManifest,
  saveWorkUnitManifest,
  withWorkUnitLock,
  readProjectManifest,
  writeProjectManifestAtomic,
  withProjectLock,
} = require('../kernel/manifest.cjs');
const { commitScopedWithKb } = require('./commit.cjs');
const { knowledge, INDEXED_ARTIFACTS } = require('./kb.cjs');
const { assertLegalWorkUnitName } = require('./workunit-create.cjs');

/** The work unit's date stamp for today (UTC), matching the manifest `created` field. */
function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * @typedef {object} WorkUnitPromoteResult
 * @property {string} work_unit   the source epic
 * @property {string} topic       the promoted specification topic
 * @property {string} cc_work_unit  the new cross-cutting work unit
 * @property {string} cc_status   always `completed` — the cc pipeline is terminal after spec
 * @property {{name: string, path: string}[]} discussions  moved source discussions (cc-relative paths)
 * @property {{path: string}} specification  the moved spec (cc-relative path)
 * @property {string} status      the epic spec item's status after the transition — always `promoted`
 * @property {string} promoted_to the cc work unit recorded on the epic spec item
 * @property {string|null} committed  short commit sha, or null when nothing was staged
 * @property {string} [note]      set when committed is null
 * @property {string[]} warnings  non-blocking failures (knowledge-base sync)
 */

/**
 * Promote a completed epic specification to its own cross-cutting work unit
 * `to`: create the cc unit log-less and already completed (the cc pipeline is
 * terminal after spec, and the spec is complete) with origin provenance
 * (`source_work_unit`/`source_topic`), move the spec directory to
 * `specification/{to}/`, move each spec source that is a discussion file into
 * the cc unit's `discussion/` (registered `completed` — sources of a
 * completed spec were incorporated), mark the epic's spec item
 * `status: promoted` + `promoted_to`, sync the knowledge base (moved
 * artifacts indexed at their cc identities, the epic's old chunks removed —
 * warn-don't-block), and land ONE commit staging the epic, the cc unit, and
 * the project manifest.
 * @param {string} cwd project root
 * @param {string} workUnit  the source epic
 * @param {string} topic     the specification topic to promote
 * @param {{to: string, description: string}} opts  cc unit name + one-line summary
 * @returns {WorkUnitPromoteResult}
 */
function promoteWorkUnit(cwd, workUnit, topic, { to, description }) {
  // -- validate everything before any mutation --------------------------------
  assertLegalWorkUnitName(to);

  const discussionMoves = withWorkUnitLock(cwd, workUnit, () => {
    const manifest = loadWorkUnitManifest(cwd, workUnit);
    if (manifest.work_type !== 'epic') {
      throw new Error(`work unit "${workUnit}" is not an epic (work_type: ${manifest.work_type ?? 'none'}) — only epic specifications promote to cross-cutting`);
    }
    if (manifest.status !== 'in-progress') {
      throw new Error(`epic "${workUnit}" is not in-progress (status: ${manifest.status ?? 'none'})`);
    }

    // The topic must carry a completed specification with its artifact on
    // disk.
    const phases = manifest.phases && typeof manifest.phases === 'object' ? manifest.phases : {};
    const spec = phases.specification && typeof phases.specification === 'object' ? phases.specification : {};
    const items = spec.items && typeof spec.items === 'object' ? spec.items : {};
    const item = items[topic];
    if (!item || typeof item !== 'object' || typeof item.status !== 'string') {
      throw new Error(`no specification item "${topic}" in "${workUnit}" — promotion moves a completed specification`);
    }
    if (item.status === 'promoted') {
      const already = typeof item.promoted_to === 'string' ? ` (to "${item.promoted_to}")` : '';
      throw new Error(`specification "${topic}" is already promoted${already}`);
    }
    if (item.status !== 'completed') {
      throw new Error(`specification "${topic}" is not completed (status: ${item.status}) — only a completed specification promotes`);
    }
    const specSrc = `.workflows/${workUnit}/specification/${topic}`;
    if (!fs.existsSync(path.join(cwd, specSrc, 'specification.md'))) {
      throw new Error(`specification file missing on disk: ${specSrc}/specification.md`);
    }

    // The cc name must be free: no directory, no project-manifest
    // registration. Read (and refuse corrupt JSON) before anything mutates;
    // the registration itself re-reads under the project lock after the cc
    // unit lands.
    if (fs.existsSync(path.join(cwd, '.workflows', to))) {
      throw new Error(`work unit "${to}" already exists (.workflows/${to}) — pick a different name`);
    }
    const projectManifest = readProjectManifest(cwd);
    if (projectManifest.work_units && typeof projectManifest.work_units === 'object' && projectManifest.work_units[to]) {
      throw new Error(`work unit "${to}" is already registered in the project manifest — pick a different name`);
    }

    // Discussion moves: each spec source whose discussion file exists on disk
    // moves with the spec. Source names are manifest dict keys — a name that
    // breaks path addressing signals a tampered manifest, refused before
    // anything renames.
    if (Array.isArray(item.sources)) {
      throw new Error(`specification "${topic}" has array-shaped sources — the manifest's canonical shape is a name-keyed map; fix the manifest before promoting`);
    }
    const sourceNames = item.sources && typeof item.sources === 'object' ? Object.keys(item.sources) : [];
    /** @type {string[]} */
    const plan = [];
    for (const name of sourceNames) {
      if (/[./]/.test(name)) {
        throw new Error(`specification "${topic}" has a malformed source name (${JSON.stringify(name)}) — fix the manifest before promoting`);
      }
      if (fs.existsSync(path.join(cwd, '.workflows', workUnit, 'discussion', `${name}.md`))) {
        plan.push(name);
      }
    }

    // -- mutate: files out of the epic, then the epic manifest -----------------
    fs.mkdirSync(path.join(cwd, '.workflows', to, 'specification'), { recursive: true });
    fs.renameSync(path.join(cwd, specSrc), path.join(cwd, '.workflows', to, 'specification', to));
    if (plan.length > 0) fs.mkdirSync(path.join(cwd, '.workflows', to, 'discussion'), { recursive: true });
    for (const name of plan) {
      fs.renameSync(
        path.join(cwd, '.workflows', workUnit, 'discussion', `${name}.md`),
        path.join(cwd, '.workflows', to, 'discussion', `${name}.md`));
    }

    item.status = 'promoted';
    item.promoted_to = to;
    saveWorkUnitManifest(cwd, workUnit, manifest);
    return plan;
  });

  // The cc manifest — the canonical work-unit document, already completed
  // (cross-cutting is terminal after spec) with origin provenance. Its own
  // locked write; the directory exists from the moves above.
  const stamped = todayStamp();
  withWorkUnitLock(cwd, to, () => {
    /** @type {Record<string, any>} */
    const ccManifest = {
      name: to,
      work_type: 'cross-cutting',
      status: 'completed',
      created: stamped,
      description,
      completed_at: stamped,
      source_work_unit: workUnit,
      source_topic: topic,
      phases: {},
    };
    if (discussionMoves.length > 0) {
      ccManifest.phases.discussion = { items: {} };
      for (const name of discussionMoves) {
        ccManifest.phases.discussion.items[name] = { status: 'completed' };
      }
    }
    // Topic = work unit name for a cross-cutting unit.
    ccManifest.phases.specification = { items: { [to]: { status: 'completed', date: stamped } } };
    saveWorkUnitManifest(cwd, to, ccManifest);
  });

  // Registration — a fresh read under the project lock.
  withProjectLock(cwd, () => {
    const projectManifest = readProjectManifest(cwd);
    if (!projectManifest.work_units || typeof projectManifest.work_units !== 'object') projectManifest.work_units = {};
    projectManifest.work_units[to] = { work_type: 'cross-cutting' };
    writeProjectManifestAtomic(cwd, projectManifest);
  });

  // KB: index the moved artifacts at their cc identities, drop the epic's old
  // chunks.
  /** @type {string[]} */
  const warnings = [];
  for (const name of discussionMoves) {
    knowledge(cwd, ['index', INDEXED_ARTIFACTS.discussion(to, name)], `knowledge index (discussion/${name})`, warnings);
    knowledge(cwd, ['remove', '--work-unit', workUnit, '--phase', 'discussion', '--topic', name], `knowledge remove (discussion/${name})`, warnings);
  }
  knowledge(cwd, ['index', INDEXED_ARTIFACTS.specification(to, to)], `knowledge index (specification/${to})`, warnings);
  knowledge(cwd, ['remove', '--work-unit', workUnit, '--phase', 'specification', '--topic', topic], `knowledge remove (specification/${topic})`, warnings);

  const committed = commitScopedWithKb(
    cwd,
    [`.workflows/${workUnit}`, `.workflows/${to}`, '.workflows/manifest.json'],
    `spec(${workUnit}): promote ${topic} to cross-cutting work unit`);

  /** @type {WorkUnitPromoteResult} */
  const result = {
    work_unit: workUnit,
    topic,
    cc_work_unit: to,
    cc_status: 'completed',
    discussions: discussionMoves.map((name) => ({ name, path: `discussion/${name}.md` })),
    specification: { path: `specification/${to}/specification.md` },
    status: 'promoted',
    promoted_to: to,
    committed,
    warnings,
  };
  if (committed === null) result.note = 'nothing to commit';
  return result;
}

module.exports = { promoteWorkUnit };
