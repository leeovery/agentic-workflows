'use strict';

// ---------------------------------------------------------------------------
// The engine's runtime (22.1.4, 22.S32): every module the workflows ship
// requires Node's built-ins or a file of the workflows' own, never a
// package — a scan of each `require` naming its module in a literal, quoted
// or a template with nothing in it computed; the few that compute their
// path load a driver, a directive's check or a
// migration from the workflows' own folders. Nothing is installed or built
// to run it: the repository declares no dependencies and no step at
// install. A ledger entry's id is drawn from Node's own crypto.
//
// Layer: unit. World: the repository's own files, read; the ledger's ids
// drawn in process.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');

const REPO = path.join(__dirname, '..', '..');
const SKILLS = path.join(REPO, 'skills');
const { newId } = require(path.join(SKILLS, 'ledger-engine/scripts/domain/ledger-ids.cjs'));

/** Every module the workflows ship, by its path. */
const modules = () => fs.readdirSync(SKILLS, { recursive: true, encoding: 'utf8' })
  .filter((rel) => rel.endsWith('.cjs') && !rel.split(path.sep).includes('tests'))
  .map((rel) => path.join(SKILLS, rel));

/** What a text requires in a literal, each by the name it gives. @param {string} text */
const requiredIn = (text) => [...text.matchAll(/\brequire\(\s*(['"`])([^'"`$]+)\1\s*\)/g)].map((m) => m[2]);

/** What a module requires in a literal. @param {string} file */
const required = (file) => requiredIn(fs.readFileSync(file, 'utf8'));

/** Whether a required name is a module of Node's own. @param {string} name */
const builtIn = (name) => builtinModules.includes(name.replace(/^node:/, ''));

describe('the engine\'s runtime (22.1.4, 22.S32)', () => {
  it('requires Node\'s built-ins and the workflows\' own files alone, every file it names there', () => {
    const shipped = modules();
    const strays = shipped.flatMap((file) => required(file)
      .filter((name) => !builtIn(name) && !(name.startsWith('.') && fs.existsSync(path.resolve(path.dirname(file), name)) && path.resolve(path.dirname(file), name).startsWith(SKILLS)))
      .map((name) => `${path.relative(REPO, file)}: ${name}`));

    assert.ok(shipped.some((file) => required(file).includes('fs')) && shipped.some((file) => required(file).some((name) => name.startsWith('./'))), 'the scan reads requires of both kinds');
    assert.deepStrictEqual(strays, []);
  });

  it('reads a require in a template literal as one quoted, and leaves one whose name is computed', () => {
    assert.deepStrictEqual(requiredIn("require('fs'); require(\"./a.cjs\"); require(`left-pad`); require(`./${name}.cjs`); require(path)"), ['fs', './a.cjs', 'left-pad']);
  });

  it('installs and builds nothing: the repository declares no dependencies and no step at install', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));

    assert.deepStrictEqual(['dependencies', 'optionalDependencies', 'peerDependencies', 'bundleDependencies', 'bundledDependencies'].filter((field) => field in pkg), []);
    assert.deepStrictEqual(['preinstall', 'install', 'postinstall', 'prepare'].filter((hook) => hook in pkg.scripts), []);
  });

  it('draws an entry\'s id from Node\'s own crypto', (t) => {
    t.mock.method(crypto, 'randomBytes', (/** @type {number} */ size) => Buffer.alloc(size, 61));

    assert.strictEqual(newId(), 'z'.repeat(21));
  });
});
