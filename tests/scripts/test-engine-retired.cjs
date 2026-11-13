'use strict';

// ---------------------------------------------------------------------------
// What the reshape retired (1.S9, 3.S1, 6.S3): the release ships no research,
// planning, scoping or baseline skill, no plan format, and no cross-cutting
// type a unit can be made as; the engine's phase tables hold discovery,
// discussion, experiment and investigation in Discovery, specification in
// Definition, implementation and review in Delivery, with the item names
// older units carry in a list outside the tables; and the command catalogue
// has the new families with their verbs and the kept ones, and no verb for
// what the release removes; each verb it says one the engine dispatches, and
// each a family's own refusal names said, its surfaces SURFACES's own.
//
// Layer: verb. World: the project, copied once, where each verb the usage
// names is called; the rest reads the shipped skills folder, the schema
// module and the engine's usage.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const schema = require('../../skills/leeway-engine/scripts/kernel/manifest-schema.cjs');
const { HANDOFF_TARGETS } = require('../../skills/leeway-engine/scripts/domain/handoff.cjs');
const { run, runAsync, COMMANDS } = require('../../skills/leeway-engine/scripts/engine.cjs');
const { SURFACES } = require('../../skills/leeway-engine/scripts/domain/render.cjs');
const { setupFixture, cleanupFixture } = require('./discovery-test-utils.cjs');

const SKILLS = path.join(__dirname, '../../skills');

/** Every path under `dir`. @param {string} dir @returns {string[]} */
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => [path.join(dir, entry.name), ...(entry.isDirectory() ? walk(path.join(dir, entry.name)) : [])]);
}

describe('the release ships none of the retired skills, formats or types (1.S9)', () => {
  const RETIRED = /research|planning|scoping|baseline/;

  it('lists no research, planning, scoping or baseline skill, and no handoff lands on one', () => {
    const skills = fs.readdirSync(SKILLS);
    assert.ok(skills.includes('leeway-discussion-process'), 'the listing reads the shipped skills');
    assert.deepStrictEqual(skills.filter((name) => RETIRED.test(name)), []);
    assert.deepStrictEqual(HANDOFF_TARGETS.filter((skill) => RETIRED.test(skill)), []);
  });

  it('lists no plan format — no output formats anywhere in the product', () => {
    assert.deepStrictEqual(walk(SKILLS).filter((file) => path.basename(file).startsWith('output-formats')), []);
  });

  it('lists no cross-cutting type: a unit is made only as one of the four, a migrated one read under the legacy name', () => {
    assert.deepStrictEqual(schema.VALID_WORK_TYPES, ['epic', 'feature', 'bugfix', 'quick-fix']);
    assert.deepStrictEqual(Object.keys(schema.WORK_TYPE_PIPELINES), schema.VALID_WORK_TYPES);
    assert.deepStrictEqual(Object.keys(schema.LEGACY_WORK_TYPES), ['cross-cutting']);
  });
});

describe('the engine\'s phase tables (3.S1)', () => {
  /** Every phase name each of the engine's phase tables holds. */
  const TABLES = {
    'the phase table': Object.keys(schema.PHASE_STAGES),
    'the status vocabularies': Object.keys(schema.VALID_PHASE_STATUSES),
    'the pipelines': Object.values(schema.WORK_TYPE_PIPELINES).flat(),
    'the epic\'s phases': schema.EPIC_PHASES,
    'the topic\'s phases': schema.TOPIC_PHASES,
    'the build\'s phases': schema.BUILD_PHASES,
    'the derived phases': schema.DERIVED_PHASES,
  };

  it('sits discovery, discussion, experiment and investigation in Discovery, specification in Definition, and implementation and review in Delivery', () => {
    /** @type {Record<string, string[]>} */
    const byStage = {};
    for (const [phase, stage] of Object.entries(schema.PHASE_STAGES)) (byStage[stage] ??= []).push(phase);
    assert.deepStrictEqual(Object.fromEntries(Object.entries(byStage).map(([stage, phases]) => [stage, phases.sort()])), {
      Discovery: ['discovery', 'discussion', 'experiment', 'investigation'],
      Definition: ['specification'],
      Delivery: ['implementation', 'review'],
    });
  });

  it('every table holds the phase table\'s phases alone — no research, planning or scoping phase', () => {
    const phases = Object.keys(schema.PHASE_STAGES);
    assert.deepStrictEqual(schema.VALID_PHASES, phases);
    for (const [table, names] of Object.entries(TABLES)) {
      assert.deepStrictEqual(names.filter((name) => !phases.includes(name)), [], table);
    }
    assert.deepStrictEqual(Object.keys(schema.VALID_PHASE_STATUSES), phases, 'a status vocabulary for every phase, and for nothing else');
  });

  it('keeps the item names older units carry in a list outside the tables', () => {
    assert.deepStrictEqual(schema.LEGACY_PHASES, ['planning']);
    for (const [table, names] of Object.entries(TABLES)) {
      assert.deepStrictEqual(names.filter((name) => schema.LEGACY_PHASES.includes(name)), [], table);
    }
  });
});

describe('the command catalogue (6.S3)', () => {
  // The catalogue as the engine says it to a call it does not know: each
  // usage line's family and its verb, a render's surface among them.
  const said = String(run(['nope'], { cwd: os.tmpdir() }).stderr).split('\n');
  const usage = said.filter((line) => /^ {2}[a-z]/.test(line));
  /** @type {Record<string, string[]>} */
  const verbs = {};
  for (const line of usage) {
    const [family, verb] = line.trim().split(/\s+/);
    (verbs[family] ??= []).push(verb);
  }

  /** The verbs 6.1.4 to 6.1.13, 6.1.15 and 6.1.20 name, by family; a family with none named is its one door. */
  const NEW = {
    ledger: ['ask', 'find', 'decide', 'replace', 'hold', 'move', 'merge', 'record', 'map', 'product', 'since', 'affected'],
    raise: ['answer'],
    verdict: ['queue', 'give'],
    task: ['note'],
    land: ['open', 'chain', 'phase', 'finish'],
    brief: [],
    checklist: ['show', 'done', 'skip', 'close'],
    asset: ['add', 'status', 'lift'],
    verify: ['run', 'setup', 'mutants'],
    gate: [],
    inbox: ['archive', 'restore', 'delete', 'close', 'file'],
    cut: [],
  };
  /** The families 6.1.16 keeps. */
  const KEPT = ['topic', 'workunit', 'roadmap', 'discovery-session', 'experiment', 'agent', 'knowledge', 'commit', 'render', 'handoff', 'conversation', 'presence', 'session', 'boot'];
  /** What the release removes (6.1.17): research threads, the discussion map, routing, build order, analysis cycles, plan formats, grouping, staleness, promotion to cross-cutting. */
  const RETIRED = /research(?!er)|thread|discussion-map|rout(e|ing)|build-order|analys|cache|cycle|format|group|stale|reconcile|promot|cross-cutting/;

  it('has the new families with the verbs they name, and the kept families, each a command the engine dispatches', () => {
    for (const family of [...Object.keys(NEW), ...KEPT]) {
      assert.ok(Object.hasOwn(COMMANDS, family) && Object.hasOwn(verbs, family), `${family} is in the catalogue`);
    }
    assert.deepStrictEqual(Object.entries(NEW).flatMap(([family, named]) => named.filter((verb) => !verbs[family].includes(verb)).map((verb) => `${family} ${verb}`)), []);
  });

  it('has no verb serving what the release removes — no family, verb or surface named for it', () => {
    assert.deepStrictEqual(Object.entries(verbs).flatMap(([family, said]) => [family, ...said.map((verb) => `${family} ${verb}`)]).filter((name) => RETIRED.test(name)), []);
    assert.deepStrictEqual(Object.keys(COMMANDS).filter((family) => RETIRED.test(family)), []);
    assert.deepStrictEqual(Object.keys(SURFACES).filter((surface) => RETIRED.test(surface)), []);
  });

  it('says every family the engine dispatches, and no other', () => {
    assert.deepStrictEqual(Object.keys(verbs).sort(), Object.keys(COMMANDS).sort());
  });

  it('says every surface a render draws, and no other, beside its three dev aids', () => {
    assert.deepStrictEqual([...new Set(verbs.render)].sort(), [...Object.keys(SURFACES), 'signpost', 'tree', 'wrap'].sort());
  });

  describe('each verb it says is one the engine dispatches', () => {
    /** @type {string} */
    let world;
    before(() => { world = setupFixture('retired-'); });
    after(() => cleanupFixture(world));

    /** A placeholder the usage defines on a line of its own, as the first form it names. */
    const defined = Object.fromEntries(said.map((line) => /^ {4}<([\w-]+)>: (.*)$/.exec(line)).filter((m) => m !== null)
      .map(([, name, forms]) => [name, forms.split(' | ')[0]]));
    /** Each form a usage line says that names a verb: a line's later forms of its own family, and each of a verb's alternatives, apart. */
    const forms = usage.map((line) => line.trim())
      .flatMap((line) => line.split(' | ').filter((form, i, all) => i === 0 || form.split(' ')[0] === all[0].split(' ')[0]))
      .map((form) => Object.entries(defined).reduce((filled, [name, first]) => filled.replace(`<${name}>`, first), form))
      .flatMap((form) => {
        const [family, verb, ...rest] = form.split(' ');
        return family !== 'render' && /^[a-z][a-z-]*(\|[a-z][a-z-]*)*$/.test(verb ?? '') ? verb.split('|').map((one) => [family, one, ...rest].join(' ')) : [];
      });

    /** A form's argv: its note, its optional parts and every alternative but the first left out, each placeholder an `x`. @param {string} form */
    function argvOf(form) {
      let bare = form.replace(/\s{2,}\(.*$/, '').replace(/…/g, '');
      while (/\[[^[\]]*\]/.test(bare)) bare = bare.replace(/\[[^[\]]*\]/g, ' ');
      return bare.replace(/\(([^|)]*)\|[^)]*\)/g, '$1').split(/\s+/).filter(Boolean)
        .map((word) => word.replace(/<[^>]*>/g, 'x').split('|')[0].replace(/^"|"$/g, ''));
    }

    it('answers each as itself, never as the verb its family does not know', async () => {
      assert.ok(forms.length > 150, `the forms are read from the usage: ${forms.length}`);
      const undispatched = [];
      for (const form of forms) {
        const [family, verb, ...args] = argvOf(form);
        const answer = String((await runAsync([family, verb, ...args], { cwd: world })).stderr);
        const unknown = String((await runAsync([family, '__unknown__', ...args], { cwd: world })).stderr);
        if (answer === unknown) undispatched.push(`${family} ${verb}`);
      }
      assert.deepStrictEqual(undispatched, []);
    });

    it('says each verb a family\'s own refusal names, so none the engine dispatches goes unsaid', async () => {
      /** @param {string} family */
      const saidOf = (family) => forms.filter((form) => form.split(' ')[0] === family).map((form) => form.split(' ')[1]);
      /** @param {string} stderr */
      const refusal = (stderr) => { try { return String(JSON.parse(stderr).error); } catch { return stderr; } };
      const unsaid = [];
      for (const family of Object.keys(COMMANDS).filter((name) => saidOf(name).length > 0)) {
        const text = refusal(String((await runAsync([family, '__unknown__'], { cwd: world })).stderr));
        const named = [
          ...[...text.matchAll(new RegExp(`(?:^|[\\s|])(?:engine )?${family} <([a-z][a-z-]*(?:\\|[a-z][a-z-]*)+)>`, 'g'))].flatMap(([, listed]) => listed.split('|')),
          ...[...text.matchAll(new RegExp(`(?:^|\\n|engine |\\| )${family} ([a-z][a-z-]*)\\b`, 'g'))].map(([, verb]) => verb),
        ];
        unsaid.push(...named.filter((verb) => !saidOf(family).includes(verb)).map((verb) => `${family} ${verb}`));
      }
      assert.deepStrictEqual([...new Set(unsaid)], []);
    });
  });
});
