'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  runGateway,
  dataBlock,
  displayBlock,
  menuBlock,
  SECTION,
} = require('../../skills/workflow-engine/scripts/gateway.cjs');

const lib = require('../../skills/workflow-engine/scripts/lib.cjs');

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

  it('displayBlock and menuBlock demarcate and trim trailing newlines', () => {
    assert.strictEqual(displayBlock('TREE\n\n'), SECTION.display + '\nTREE\n');
    assert.strictEqual(menuBlock('MENU'), SECTION.menu + '\nMENU\n');
  });

  it('sections compose into one demarcated stdout payload', () => {
    const out = [dataBlock({ k: 1 }), displayBlock('D'), menuBlock('M')].join('\n');
    const idx = (s) => out.indexOf(s);
    assert.ok(idx(SECTION.data) < idx(SECTION.display));
    assert.ok(idx(SECTION.display) < idx(SECTION.menu));
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
