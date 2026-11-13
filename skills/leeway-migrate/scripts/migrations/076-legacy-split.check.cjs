'use strict';

//
// The check of directive 076, the legacy split (21.4, 21.10.7): one piece
// for each source the detection (075) found, `{epic}/{source}`, in its
// order — done once its plan, staged where the split keeps its staging
// (reshape/split.cjs), keeps the source whole or validates:
//   - the plan reads, and lists its themes, one at least;
//   - each theme is named, by a name no other theme of the plan takes and
//     a topic can take, with a summary and a description, and its research
//     staged beside the plan, `{name}.md`, not empty;
//   - no theme takes a name another item of the epic's map holds or a
//     research file of the epic has, but its own source's, which the apply
//     sets aside first.
// These are the rules the split's plans always kept. Two more hold since
// the plans are applied together, after the interview, each epic's
// manifest rebuilt whole: no theme takes the name of a research item of
// the epic's, or of a theme of another of its plans. A name the map
// dismissed is free: the apply takes it off the list.
//
// The plan is written only once the person takes it or keeps the source
// whole, so research staged beside no plan is no plan. A source the apply
// (077) marked applied is done, read before its epic, so the check passes
// after the apply and the move, and once finish takes `.workflows/` away;
// an epic's manifest is read only for a plan with themes. Where the
// detection found nothing, or its answer is gone, it answers no piece, and
// before the apply the runner records the directive unrun (21.4.3).
//
// Each unfinished piece names its source's file and its plan's folder, both
// absolute, for the session to read and stage. `.workflows/` is read where
// the detection read it: the working tree of the project's folder in the
// repository's main checkout, whichever checkout the session runs in. It
// changes nothing, and calls no model.
//

const fs = require('fs');
const path = require('path');
const { OLD_STATE, mainCheckout, projectInMain } = require('./reshape/shared.cjs');
const { PLAN, APPLIED, NAME, isObject, isFile, itemsOf, stagingOf, detection } = require('./reshape/split.cjs');

/** @param {unknown} words */
const filled = (words) => typeof words === 'string' && words.trim() !== '';

/** The project's folder in the repository's main checkout, from the folder a session runs in. @param {string} projectDir */
function projectFolder(projectDir) {
  const main = mainCheckout(projectDir);
  return main === null ? projectDir : projectInMain(projectDir, main);
}

/**
 * A source's plan as it is staged: none yet, a problem reading it, or the plan.
 * @typedef {{state: 'none'}|{state: 'unread', problem: string}|{state: 'read', plan: unknown}} Staged
 */

/** @param {string} staging @returns {Staged} */
function stagedIn(staging) {
  const file = path.join(staging, PLAN);
  if (!isFile(file)) return { state: 'none' };
  try {
    return { state: 'read', plan: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (err) {
    return { state: 'unread', problem: `its plan does not read as JSON: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** The names a plan gives its themes. @param {Staged} staged @returns {string[]} */
function themeNames(staged) {
  if (staged.state !== 'read' || !isObject(staged.plan) || !Array.isArray(staged.plan.themes)) return [];
  return staged.plan.themes.filter(isObject).map((theme) => theme.kebab_name).filter(filled);
}

/**
 * A source as the check reads it: its epic, its staging, whether the apply
 * marked it applied, and its plan as staged.
 * @typedef {{epic: string, source: string, staging: string, applied: boolean, staged: Staged}} Piece
 */

/**
 * An epic as its plans are checked against it: its map's items, its
 * research items and research folder, and each of its plans as staged.
 * @typedef {{name: string, map: Set<string>, research: Set<string>, researchDir: string, plans: Map<string, Staged>}} Epic
 */

/**
 * What one theme of a source's plan lacks.
 * @param {Epic} epic @param {string} source @param {string} staging @param {unknown} theme @param {number} n
 * @returns {string[]}
 */
function themeProblems(epic, source, staging, theme, n) {
  if (!isObject(theme)) return [`its theme ${n} is no object`];
  const name = filled(theme.kebab_name) ? theme.kebab_name : null;
  const label = name ?? String(n);
  const named = [
    ...(name === null ? [`its theme ${n} has no kebab_name`] : []),
    ...(filled(theme.summary) ? [] : [`its theme ${label} has no summary`]),
    ...(filled(theme.description) ? [] : [`its theme ${label} has no description`]),
  ];
  if (name === null) return named;
  if (!NAME.test(name)) return [...named, `its theme ${name} is no name a topic can take, which is lowercase letters, digits and hyphens, from a letter or digit`];
  const research = path.join(staging, `${name}.md`);
  const staged = !isFile(research) ? [`its theme ${name} has no research beside its plan, ${name}.md`]
    : fs.readFileSync(research, 'utf8').trim() === '' ? [`its theme ${name}'s research, ${name}.md, is empty`] : [];
  const others = [...epic.plans].filter(([other, plan]) => other !== source && themeNames(plan).includes(name)).map(([other]) => other);
  const taken = name === source ? [] : [
    ...(epic.map.has(name) ? [`its theme ${name} is the name of another item on ${epic.name}'s map`] : []),
    ...(isFile(path.join(epic.researchDir, `${name}.md`)) ? [`its theme ${name} would overwrite ${epic.name}'s research file ${name}.md`] : []),
    ...(epic.research.has(name) ? [`its theme ${name} is the name of a research item ${epic.name} holds already`] : []),
  ];
  return [...named, ...staged, ...taken, ...others.map((other) => `its theme ${name} is a theme of ${other}'s plan too`)];
}

/**
 * What a plan that reads lacks: none once it keeps the source whole or
 * validates, its epic read only for its themes.
 * @param {unknown} plan @param {() => Epic} readEpic @param {string} source @param {string} staging
 * @returns {string[]}
 */
function planProblems(plan, readEpic, source, staging) {
  if (isObject(plan) && plan.whole === true) return plan.themes === undefined ? [] : ['its plan keeps its source whole and splits it into themes too'];
  if (!isObject(plan) || !Array.isArray(plan.themes)) return ['its plan holds neither its themes nor "whole": true'];
  if (plan.themes.length === 0) return ['its plan has no themes'];
  const names = themeNames({ state: 'read', plan });
  const twice = [...new Set(names.filter((name, at) => names.indexOf(name) !== at))].map((name) => `two of its themes are named ${name}`);
  const epic = readEpic();
  return [...twice, ...plan.themes.flatMap((theme, at) => themeProblems(epic, source, staging, theme, at + 1))];
}

/**
 * What a source lacks: none once the apply marked it, or once its plan
 * keeps it whole or validates; else where it and its plan are, and what is
 * wrong.
 * @param {Piece} piece @param {string} sourceFile @param {() => Epic} readEpic
 * @returns {string[]}
 */
function sourceProblems({ source, staging, applied, staged }, sourceFile, readEpic) {
  if (applied) return [];
  const where = `its source is ${sourceFile}, and its plan goes in ${staging}`;
  if (staged.state === 'none') return [`has no plan yet: ${where}`];
  const problems = staged.state === 'unread' ? [staged.problem] : planProblems(staged.plan, readEpic, source, staging);
  return problems.length === 0 ? [] : [where, ...problems];
}

/**
 * An epic as `.workflows/` holds it in the project's folder, with the plans
 * staged for its sources.
 * @param {string} project @param {string} name @param {Piece[]} pieces
 * @returns {Epic}
 */
function epicOf(project, name, pieces) {
  const dir = path.join(project, OLD_STATE, name);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  return {
    name,
    map: new Set(Object.keys(itemsOf(manifest.phases?.discovery))),
    research: new Set(Object.keys(itemsOf(manifest.phases?.research))),
    researchDir: path.join(dir, 'research'),
    plans: new Map(pieces.filter((piece) => piece.epic === name).map((piece) => [piece.source, piece.staged])),
  };
}

module.exports = {
  counts: { one: 'source', many: 'sources' },
  done: 'have their plans',
  /** @param {{projectDir: string, stateDir: string}} dirs */
  check({ projectDir, stateDir }) {
    const found = detection(stateDir);
    if (found === null) return [];
    const project = projectFolder(projectDir);
    /** @type {Piece[]} */
    const pieces = found.sources.map(({ epic, source }) => {
      const staging = stagingOf(stateDir, epic, source);
      return { epic, source, staging, applied: isFile(path.join(staging, APPLIED)), staged: stagedIn(staging) };
    });
    /** @type {Map<string, Epic>} */
    const epics = new Map();
    /** @param {string} name @returns {Epic} */
    const epicFor = (name) => {
      const known = epics.get(name);
      if (known !== undefined) return known;
      const read = epicOf(project, name, pieces);
      epics.set(name, read);
      return read;
    };
    return pieces.map((piece) => ({
      name: `${piece.epic}/${piece.source}`,
      problems: sourceProblems(piece, path.join(project, OLD_STATE, piece.epic, 'research', `${piece.source}.md`), () => epicFor(piece.epic)),
    }));
  },
};
