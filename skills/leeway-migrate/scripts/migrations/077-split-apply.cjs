'use strict';

//
// Migration 077: The legacy split applied
//
// Step 2 of the reshape's sequence closes (21.2, 21.4.4): each plan the
// split's directive (076) staged and its check passed (reshape/split.cjs) is
// applied to its epic in `.workflows/`, in the project's folder in the main
// checkout's working tree, as the split's own apply left an epic, written
// against today's shape (072) — so the move (078), and the directives after
// it reading `.workflows/` where the move read it, take the split's topics
// (21.5.8):
//   - the source superseded: its file kept, byte for byte, as
//     `research/{source}-superseded-{at}.md`, `at` the detection's instant;
//     its research item gone for one of that name, `superseded`; its map
//     item gone;
//   - each theme a research file, `research/{name}.md` — its title, its
//     summary, the source it came from, then the research the plan staged —
//     a research item in progress, and a map item routed to research with
//     its summary and description, `source` `legacy-split:{source}`, its name
//     off the map's dismissed list;
//   - a source the person kept whole left as it is.
//
// Idempotent per source, and a run killed anywhere is run again to what a
// whole run leaves. Each of a source's files is written whole or not at
// all: the superseded copy first, read from the source while nothing has
// written over it, then each theme's file, then the source's own gone
// where no theme takes its name; then the epic's manifest, whole, its map's
// and research's items rebuilt from whatever it holds — the source's, the
// copy's and the themes' set aside, then the copy's and the themes' put
// last — so it reads the same whether the run before wrote it or not; then
// a mark beside the plan, `applied.json`. A source with no mark is applied
// again from the start, and one with its mark is passed by. Nothing is
// committed (21.9.3): the migration's commit, made at finish, drops
// `.workflows/` from the default branch.
//
// A project in no repository, with no `.workflows/`, whose `leeway-state`
// has a commit, or where the detection found nothing, has nothing to apply.
//
// Known edges, not built:
//   - a source's research threads go with its research item, as the split's
//     apply always took them, so a thread still open on a source split is
//     carried to no topic's record.
//

const fs = require('fs');
const path = require('path');
const { writeWhole } = require('./reshape/shared.cjs');
const { PLAN, APPLIED, jsonText, stagingOf, splitting, detection } = require('./reshape/split.cjs');

/** @typedef {{kebab_name: string, summary: string, description: string}} Theme */

/** @param {string} file @returns {any} */
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** @param {string} kebab */
const titleOf = (kebab) => kebab.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

/**
 * A theme's research file, as the split always headed it.
 * @param {Theme} theme @param {string} source @param {string} research
 */
function researchText(theme, source, research) {
  return `# Research: ${titleOf(theme.kebab_name)}\n\n${theme.summary}\n\n## Starting Point\n\n`
    + `- Material extracted from legacy research file ${source}.md via legacy-research-split.\n\n---\n\n${research}`;
}

/**
 * Items with the named ones set aside.
 * @param {Record<string, any>} items @param {Set<string>} gone
 */
const without = (items, gone) => Object.fromEntries(Object.entries(items).filter(([name]) => !gone.has(name)));

/**
 * The epic's manifest with the plan applied, from what it holds whether or
 * not the plan was applied to it before.
 * @param {Record<string, any>} manifest @param {string} source @param {string} superseded @param {Theme[]} themes
 * @returns {Record<string, any>}
 */
function appliedTo(manifest, source, superseded, themes) {
  const names = new Set(themes.map((theme) => theme.kebab_name));
  const { discovery, research } = manifest.phases;
  const map = {
    ...without(discovery.items, new Set([source, ...names])),
    ...Object.fromEntries(themes.map(({ kebab_name: name, summary, description }) => [name, { routing: 'research', summary, description, source: `legacy-split:${source}` }])),
  };
  const items = {
    ...without(research.items, new Set([source, superseded, ...names])),
    [superseded]: { status: 'superseded' },
    ...Object.fromEntries(themes.map((theme) => [theme.kebab_name, { status: 'in-progress' }])),
  };
  const dismissed = Array.isArray(discovery.dismissed) ? { dismissed: discovery.dismissed.filter((/** @type {string} */ name) => !names.has(name)) } : {};
  return { ...manifest, phases: { ...manifest.phases, discovery: { ...discovery, items: map, ...dismissed }, research: { ...research, items } } };
}

/**
 * Apply one source's plan to its epic, where it has not been: whether it
 * wrote anything.
 * @param {{from: string, state: string}} where @param {string} at @param {string} epic @param {string} source
 * @returns {boolean}
 */
function applySource({ from, state }, at, epic, source) {
  const staging = stagingOf(state, epic, source);
  const plan = readJson(path.join(staging, PLAN));
  if (plan.whole === true || fs.existsSync(path.join(staging, APPLIED))) return false;
  const scratch = path.join(state, '.cache');
  const researchDir = path.join(from, epic, 'research');
  const sourceFile = path.join(researchDir, `${source}.md`);
  const superseded = `${source}-superseded-${at}`;
  const copy = path.join(researchDir, `${superseded}.md`);
  /** @type {Theme[]} */
  const themes = plan.themes;
  if (!fs.existsSync(copy)) writeWhole(scratch, copy, fs.readFileSync(sourceFile), fs.statSync(sourceFile).mode & 0o7777);
  for (const theme of themes) {
    writeWhole(scratch, path.join(researchDir, `${theme.kebab_name}.md`), researchText(theme, source, fs.readFileSync(path.join(staging, `${theme.kebab_name}.md`), 'utf8')));
  }
  if (!themes.some((theme) => theme.kebab_name === source)) fs.rmSync(sourceFile, { force: true });
  const manifestFile = path.join(from, epic, 'manifest.json');
  writeWhole(scratch, manifestFile, jsonText(appliedTo(readJson(manifestFile), source, superseded, themes)));
  writeWhole(scratch, path.join(staging, APPLIED), jsonText({ superseded }));
  return true;
}

module.exports = {
  id: '077',
  description: 'apply the legacy split: each source\'s plan, as the person agreed it, to its epic in .workflows/ — the source superseded, each theme a research file and a map item of its own',
  /** @param {{projectDir: string, reportUpdate: () => void, reportSkip: () => void}} ctx */
  run({ projectDir, reportUpdate, reportSkip }) {
    const where = splitting(projectDir);
    const found = where === null ? null : detection(where.state);
    if (where === null || found === null) {
      reportSkip();
      return;
    }
    for (const { epic, source } of found.sources) {
      if (applySource(where, found.at, epic, source)) reportUpdate();
      else reportSkip();
    }
  },
};
