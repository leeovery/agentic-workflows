'use strict';

// ---------------------------------------------------------------------------
// The tools the drivers wrap named only in their drivers (7.1.10, 7.2.13,
// 7.S2), by the scan in tool-names.cjs: run over the skills, the
// references, the agent definitions, the engine's code and every migration
// — the drivers and test fixtures aside, and nothing else — it finds no
// tool, where it finds each driver's tool in that driver's own code; and
// run over help — the walkthrough's content and fixtures, each menu's help
// file and the glossary — it finds no tool by any form or by its name as a
// word (23.1.3). Each driver's forms are pinned beside its fixtures
// (tests/drivers/{name}/test-tool-names.cjs).
//
// Layer: unit. World: the repository's own files, read.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { DRIVER_FORMS, HELP_FORMS, DRIVERS, toolNamesIn, helpNamesIn, shippedFiles, helpFiles, REPO } = require('./tool-names.cjs');

/** Each file under a folder, from the repository's root. @param {string} rel */
const filesUnder = (rel) => fs.readdirSync(path.join(REPO, rel), { recursive: true, encoding: 'utf8' })
  .map((file) => path.join(rel, file))
  .filter((file) => fs.statSync(path.join(REPO, file)).isFile());

describe('the tool-name scan (7.1.10, 7.2.13)', () => {
  it('7.S2: names no tool in the skills, the references, the agent definitions, the engine\'s code or any migration', () => {
    const files = shippedFiles();
    const found = files.flatMap((rel) => toolNamesIn(fs.readFileSync(path.join(REPO, rel), 'utf8')).map(({ line, text }) => `${rel}:${line}: ${text}`));
    const reads = (/** @type {string} */ rel) => files.includes(rel) || files.some((file) => file.startsWith(`${rel}${path.sep}`));

    assert.deepStrictEqual(
      ['agents/leeway-builder.md', 'skills/leeway-engine/scripts/engine.cjs', 'skills/leeway-migrate/scripts/migrations/078-reshape-move.cjs', 'skills/leeway-migrate/scripts/migrations/reshape'].filter((rel) => !reads(rel)),
      [], 'the scan reads the agents, the engine, the migrations and the reshape\'s move');
    assert.deepStrictEqual(found, []);
  });

  it('finds each driver\'s tool in that driver\'s own code, which the rule lets name it', () => {
    const drivers = filesUnder(DRIVERS);
    const named = DRIVER_FORMS.map(({ driver }) => drivers
      .filter((rel) => rel.split(path.sep).at(-2) === driver)
      .some((rel) => toolNamesIn(fs.readFileSync(path.join(REPO, rel), 'utf8')).some((at) => at.driver === driver)));

    assert.ok(DRIVER_FORMS.length > 0, 'a driver declares how its tool is named');
    assert.deepStrictEqual(named, DRIVER_FORMS.map(() => true));
  });
});

describe('help names no tool (23.1.3)', () => {
  it('23.S3: no walkthrough screen, card, fixture, menu\'s help file or glossary entry names a tool, by any form or by its name', () => {
    const files = helpFiles();
    const found = files.flatMap((rel) => helpNamesIn(fs.readFileSync(path.join(REPO, rel), 'utf8')).map(({ line, text }) => `${rel}:${line}: ${text}`));
    const reads = (/** @type {string} */ rel) => files.some((file) => file === rel || file.startsWith(`${rel}${path.sep}`));
    const places = ['screens', 'topics', 'fixtures', 'offer.md'].map((rel) => path.join('skills/leeway-engine/content/walkthrough', rel));

    assert.deepStrictEqual([...places, 'skills/leeway-engine/scripts/domain/projections/start-menu.help.md', 'skills/leeway-shared/references/glossary.md'].filter((rel) => !reads(rel)),
      [], 'the scan reads the walkthrough, its fixtures, the help files and the glossary');
    assert.deepStrictEqual(files.filter((rel) => rel.endsWith('.cjs')), [], 'the scan reads no code');
    assert.deepStrictEqual(found, []);
  });

  it('finds each driver\'s tool by its name in that driver\'s own code', () => {
    const drivers = filesUnder(DRIVERS);
    const named = HELP_FORMS.map(({ driver }) => drivers
      .filter((rel) => rel.split(path.sep).at(-2) === driver)
      .some((rel) => helpNamesIn(fs.readFileSync(path.join(REPO, rel), 'utf8')).some((at) => at.driver === driver && at.form === 'its name')));

    assert.deepStrictEqual(named, HELP_FORMS.map(() => true));
  });
});
