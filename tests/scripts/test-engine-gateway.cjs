'use strict';

// Layer: verb.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const {
  runGateway,
  dataBlock,
  titleBlock,
  displayBlock,
  menuBlock,
  SECTION,
} = require('../../skills/leeway-engine/scripts/gateway.cjs');

const lib = require('../../skills/leeway-engine/scripts/lib.cjs');
const { dataSection, titleSection } = require('../../skills/leeway-engine/scripts/domain/projections/surfaces.cjs');
const { SCHEMA } = require('../../skills/leeway-engine/scripts/domain/trust-events.cjs');

const SKILLS = path.join(__dirname, '../../skills');

// The marker of a gateway's MENU, which names the gate it states.
const MENU_MARKER = '=== MENU: start menu (emit verbatim as markdown (not a code block)) ===';

// Capture stdout writes around a runGateway call.
function captureRun(handlers, argv) {
  const writes = [];
  const original = process.stdout.write;
  // @ts-ignore — test stub
  process.stdout.write = (chunk) => { writes.push(String(chunk)); return true; };
  try {
    runGateway(handlers, argv);
  } finally {
    process.stdout.write = original;
  }
  return writes.join('');
}

describe('gateway: verb dispatch', () => {
  it('no args routes to index', () => {
    const out = captureRun({ index: () => 'INDEX' }, []);
    assert.strictEqual(out, 'INDEX\n');
  });

  it('a registered verb receives the remaining args', () => {
    const out = captureRun({ index: () => '', view: (wu) => `view:${wu}` }, ['view', 'my-epic']);
    assert.strictEqual(out, 'view:my-epic\n');
  });

  it('extra args pass through to the handler', () => {
    const out = captureRun({ index: () => '', map: (wu, topic) => `${wu}/${topic}` }, ['map', 'wu', 'topic']);
    assert.strictEqual(out, 'wu/topic\n');
  });

  it('unmatched argv falls back to the fallback handler with full argv', () => {
    const out = captureRun(
      { index: () => '', fallback: (...argv) => `fb:${argv.join(',')}` },
      ['my-work-unit']
    );
    assert.strictEqual(out, 'fb:my-work-unit\n');
  });

  it('an inherited Object.prototype name is not a verb — it falls through to fallback', () => {
    for (const inherited of ['toString', 'constructor', 'hasOwnProperty', 'valueOf']) {
      const out = captureRun(
        { index: () => '', view: (wu) => `view:${wu}`, fallback: (...argv) => `fb:${argv.join(',')}` },
        [inherited, 'x']
      );
      assert.strictEqual(out, `fb:${inherited},x\n`, `${inherited} must not dispatch to the inherited method`);
    }
  });

  it('with no fallback, an inherited name is an unknown-verb usage error — never [object Object]', () => {
    const { spawnSync } = require('child_process');
    const gw = require.resolve('../../skills/leeway-engine/scripts/gateway.cjs');
    const res = spawnSync(
      'node',
      ['-e', `require(${JSON.stringify(gw)}).runGateway({ view: (w) => 'v:' + w }, ['toString']);`],
      { encoding: 'utf8' }
    );
    assert.strictEqual(res.status, 1);
    assert.strictEqual(res.stdout, '');
    assert.match(res.stderr, /unknown verb "toString"/);
  });

  it('missing index handler on a no-args call throws', () => {
    assert.throws(() => captureRun({ data: () => '' }, []), /no `index` handler/);
  });

  it('output always ends with exactly one newline', () => {
    const out = captureRun({ index: () => 'X\n\n\n' }, []);
    assert.strictEqual(out, 'X\n');
  });
});

describe('gateway: output sections', () => {
  it('dataBlock renders objects as key: value lines, nested values as JSON', () => {
    const block = dataBlock({ count: 2, flags: { a: true }, name: 'wu' });
    assert.strictEqual(
      block,
      SECTION.data + '\ncount: 2\nflags: {"a":true}\nname: wu\n'
    );
  });

  it('dataBlock passes strings through', () => {
    assert.strictEqual(dataBlock('raw'), SECTION.data + '\nraw\n');
  });

  it('dataBlock opens on the same DATA marker a render surface draws', () => {
    assert.strictEqual(dataBlock('raw'), dataSection(['raw']));
  });

  it('titleBlock draws the same TITLE section a render surface draws', () => {
    assert.strictEqual(titleBlock('Workflow Start'), titleSection('Workflow Start'));
    assert.ok(titleBlock('Workflow Start').startsWith(SECTION.title + '\n'));
  });

  it('displayBlock and menuBlock demarcate and trim trailing newlines, the MENU marked with the gate it states', () => {
    assert.strictEqual(displayBlock('TREE\n\n'), SECTION.display + '\nTREE\n');
    assert.strictEqual(menuBlock('start menu', 'MENU\n\n'), `${MENU_MARKER}\nMENU\n`);
  });

  it('an empty menu is no gate — menuBlock renders no section, not an empty marker', () => {
    assert.strictEqual(menuBlock('start menu', ''), '');
    assert.strictEqual(menuBlock('start menu', '\n\n'), '');
  });

  it('sections compose into one demarcated stdout payload', () => {
    const out = [dataBlock({ k: 1 }), displayBlock('D'), menuBlock('start menu', 'M')].join('\n');
    const idx = (s) => out.indexOf(s);
    assert.ok(idx(SECTION.data) < idx(SECTION.display));
    assert.ok(idx(SECTION.display) < idx(MENU_MARKER));
  });
});

// Every menu the engine draws states a gate of its own, a key of the trust
// log forever (16.11.9).
describe('each menu states a gate the trust log keys', () => {
  /** Every name an engine MENU declares, a templated one aside. @param {string} folder @returns {string[]} */
  const declared = (folder) => fs.readdirSync(folder, { withFileTypes: true }).flatMap((e) => {
    const at = path.join(folder, e.name);
    if (e.isDirectory()) return declared(at);
    if (!e.name.endsWith('.cjs')) return [];
    return [...fs.readFileSync(at, 'utf8').matchAll(/['`]MENU: ([^'`$]+?)(?: — [^'`]*)?['`]/g)].map((m) => m[1]);
  });

  it('each name an engine render declares is a name the trust log keys', () => {
    const engine = new Set(declared(path.join(SKILLS, 'leeway-engine/scripts')));
    const gate = SCHEMA.events.gate.fields.find((f) => f.name === 'gate');

    assert.ok(engine.size > 0, 'no engine render declares a menu — the guard would pass vacuously');
    assert.deepStrictEqual([...engine].filter((name) => !gate?.type.test(name)), []);
  });
});

describe('lib: ring aggregation', () => {
  it('exposes kernel render, domain conventions, and the gateway', () => {
    assert.strictEqual(typeof lib.render.renderTree, 'function');
    assert.strictEqual(typeof lib.render.wrapWithPrefix, 'function');
    assert.strictEqual(typeof lib.conventions.title, 'function');
    assert.strictEqual(typeof lib.gateway.runGateway, 'function');
  });
});
