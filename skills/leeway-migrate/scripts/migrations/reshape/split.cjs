'use strict';

//
// What the legacy split's three steps share (21.4) — its detection (075),
// its directive's check (076) and its apply (077): where the split works,
// where it is staged and how its staging reads. Released with them, it is
// frozen with them.
//
// The staging is `.cache/migrate/split/` in the state, which no commit
// takes and the move (078) leaves where it is:
//   - `sources.json`, the detection's answer, `{at, epics}`: `at` the
//     instant it was made, `YYYY-MM-DDTHH-MM-SS` in UTC, which names each
//     source's superseded copy; `epics` each epic's qualifying sources by
//     name, sorted, an epic with none left out. Where nothing qualifies
//     there is none;
//   - `{epic}/{source}/`, a source's plan: `plan.json`, either `{themes:
//     [{kebab_name, summary, description}]}` with each theme's research
//     beside it as `{kebab_name}.md`, or `{whole: true}` where the person
//     keeps the source as it is; and once the apply has written it, its
//     mark, `applied.json`.
//

const fs = require('fs');
const path = require('path');
const { OLD_STATE, STATE_DIR, mainCheckout, projectInMain, stateBorn } = require('./shared.cjs');

const SPLIT = path.join('.cache', 'migrate', 'split');
const SOURCES = 'sources.json';
const PLAN = 'plan.json';
const APPLIED = 'applied.json';

// A theme's name becomes a topic's, and its research file's.
const NAME = /^[a-z0-9][a-z0-9-]*$/;

/** @param {unknown} v @returns {v is Record<string, any>} */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A manifest phase's items, none where it holds none. @param {unknown} phase @returns {Record<string, any>} */
const itemsOf = (phase) => (isObject(phase) && isObject(phase.items) ? phase.items : {});

/** @param {string} file */
const isFile = (file) => fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;

/** @param {unknown} data */
const jsonText = (data) => JSON.stringify(data, null, 2) + '\n';

/** The detection's answer, in the state at `state`. @param {string} state */
const sourcesFile = (state) => path.join(state, SPLIT, SOURCES);

/** A source's staging, in the state at `state`. @param {string} state @param {string} epic @param {string} source */
const stagingOf = (state, epic, source) => path.join(state, SPLIT, epic, source);

/** The instant `at` as the detection names it. @param {Date} at */
const stampOf = (at) => at.toISOString().slice(0, 19).replace(/:/g, '-');

/**
 * Where the split works for the project at `projectDir`: its `.workflows/`
 * in the project's folder in the main checkout, and the state; null where
 * there is nothing to split — no repository, no `.workflows/`, or a
 * `leeway-state` with a commit.
 * @param {string} projectDir @returns {{from: string, state: string}|null}
 */
function splitting(projectDir) {
  const here = path.resolve(projectDir);
  const main = mainCheckout(here);
  if (main === null || stateBorn(main)) return null;
  const from = path.join(projectInMain(here, main), OLD_STATE);
  return fs.existsSync(from) ? { from, state: path.join(main, STATE_DIR) } : null;
}

/**
 * The detection's answer in the state at `state`: its instant, and each
 * source it found, epic by epic, in its order; null where it found nothing.
 * @param {string} state @returns {{at: string, sources: {epic: string, source: string}[]}|null}
 */
function detection(state) {
  const file = sourcesFile(state);
  if (!fs.existsSync(file)) return null;
  const { at, epics } = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { at, sources: Object.entries(epics).flatMap(([epic, sources]) => sources.map((/** @type {string} */ source) => ({ epic, source }))) };
}

module.exports = { PLAN, APPLIED, NAME, isObject, itemsOf, isFile, jsonText, sourcesFile, stagingOf, stampOf, splitting, detection };
