'use strict';

//
// Migration 070: Record promoted discussions
//
// Promoting an epic specification to a cross-cutting unit moves each source
// discussion's file into that unit. The promotion earlier releases ran marked
// only the specification `promoted`: each moved discussion's epic item kept
// reading `completed` with no file behind it, the unit registered the
// discussion as a bare `{status: 'completed'}` — its Discussion Map and every
// other field left behind — and the unit's specification item carried no
// `sources`. For every epic specification item reading `promoted` with
// `promoted_to`, each source discussion whose file is gone from the epic and
// present in the promoted unit's `discussion/`:
//   - its epic item is marked `promoted` + `promoted_to`;
//   - the unit's discussion item, where it is still that bare item, is filled
//     from the epic's: every field but `status` and `promoted_to`, never one
//     the unit already holds;
//   - the unit's specification item (`{promoted_to}`) gains the source as
//     `sources.{name}.status` — the epic specification's status for it —
//     where absent.
// A source whose file still sits in the epic was never moved, and is left
// alone; so is a unit that does not exist or whose manifest does not parse.
//
// A directory whose manifest is absent or does not parse is not a work unit,
// and is left alone.
//
// Idempotent: a recorded discussion reads `promoted`, a filled item is no
// longer bare (or had nothing to take), a recorded source is present.
//

const fs = require('fs');
const path = require('path');

/** @param {unknown} v @returns {v is Record<string, any>} */
function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** A phase's items container, or undefined. @param {Record<string, any>} manifest @param {string} phase */
function itemsOf(manifest, phase) {
  const container = isObject(manifest.phases) ? manifest.phases[phase] : undefined;
  return isObject(container) && isObject(container.items) ? container.items : undefined;
}

/**
 * Mark the epic's discussion item as having left for `to`.
 * @param {unknown} item @param {string} to @returns {boolean} whether it changed
 */
function markPromoted(item, to) {
  if (!isObject(item) || (item.status === 'promoted' && item.promoted_to === to)) return false;
  item.status = 'promoted';
  item.promoted_to = to;
  return true;
}

/**
 * Fill the unit's discussion item from the epic's, where it is still the
 * bare `{status: 'completed'}` the promotion wrote: every field but
 * `promoted_to` the unit does not hold — its own `status` among those it does.
 * @param {unknown} unitItem @param {unknown} epicItem @returns {boolean} whether it changed
 */
function fillBare(unitItem, epicItem) {
  if (!isObject(unitItem) || !isObject(epicItem)) return false;
  if (Object.keys(unitItem).length !== 1 || unitItem.status !== 'completed') return false;
  let filled = false;
  for (const [field, value] of Object.entries(epicItem)) {
    if (field === 'promoted_to' || Object.hasOwn(unitItem, field)) continue;
    unitItem[field] = value;
    filled = true;
  }
  return filled;
}

/**
 * Give the unit's specification item the moved discussion as a source, at
 * the epic row's status, where absent.
 * @param {unknown} unitSpec @param {string} name @param {Record<string, any>} row @returns {boolean} whether it changed
 */
function addSource(unitSpec, name, row) {
  if (!isObject(unitSpec) || typeof row.status !== 'string') return false;
  if (unitSpec.sources !== undefined && (!isObject(unitSpec.sources) || unitSpec.sources[name] !== undefined)) return false;
  unitSpec.sources = { ...unitSpec.sources, [name]: { status: row.status } };
  return true;
}

module.exports = {
  id: '070',
  description: 'record promoted discussions — a discussion that moved with its specification reads promoted, and is its unit\'s source',
  run({ projectDir, reportUpdate, reportSkip }) {
    const workflowsDir = path.join(projectDir, '.workflows');
    let entries;
    try {
      entries = fs.readdirSync(workflowsDir, { withFileTypes: true });
    } catch {
      reportSkip();
      return;
    }

    /** @type {Map<string, Record<string, any>|null>} */
    const manifests = new Map();
    /** @param {string} name */
    const load = (name) => {
      if (!manifests.has(name)) {
        let manifest = null;
        try {
          manifest = JSON.parse(fs.readFileSync(path.join(workflowsDir, name, 'manifest.json'), 'utf8'));
        } catch {
          // not a work unit
        }
        manifests.set(name, isObject(manifest) ? manifest : null);
      }
      return manifests.get(name) ?? null;
    };
    /** @type {Set<string>} */
    const changed = new Set();

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const epic = load(entry.name);
      if (!epic || epic.work_type !== 'epic') continue;
      for (const spec of Object.values(itemsOf(epic, 'specification') ?? {})) {
        if (!isObject(spec) || spec.status !== 'promoted' || !isObject(spec.sources)) continue;
        const to = spec.promoted_to;
        if (typeof to !== 'string' || to === '' || /[./]/.test(to)) continue;
        const unit = load(to);
        for (const [name, row] of Object.entries(spec.sources)) {
          if (!isObject(row) || /[./]/.test(name)) continue;
          if (fs.existsSync(path.join(workflowsDir, entry.name, 'discussion', `${name}.md`))) continue;
          if (!fs.existsSync(path.join(workflowsDir, to, 'discussion', `${name}.md`))) continue;

          const epicItem = (itemsOf(epic, 'discussion') ?? {})[name];
          if (unit) {
            if (fillBare((itemsOf(unit, 'discussion') ?? {})[name], epicItem)) changed.add(to);
            if (addSource((itemsOf(unit, 'specification') ?? {})[to], name, row)) changed.add(to);
          }
          if (markPromoted(epicItem, to)) changed.add(entry.name);
        }
      }
    }

    for (const name of changed) {
      fs.writeFileSync(path.join(workflowsDir, name, 'manifest.json'), JSON.stringify(manifests.get(name), null, 2) + '\n');
      reportUpdate();
    }
    if (changed.size === 0) reportSkip();
  },
};
