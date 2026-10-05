'use strict';

// Prose-test corpus: the deterministic perimeter (design/prose-tests.md
// P3). Every case directory is well-formed, every scoped file and anchor
// resolves, every stub is named and triggered, every recipe loads. The
// token-costing walks run on command via /prose-test — never here.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const cases = require('../prose/lib/cases.cjs');

describe('prose-test corpus', () => {
  const all = cases.loadAllCases();

  it('has at least one case', () => {
    assert.ok(all.length > 0, 'corpus is empty');
  });

  it('validates cleanly', () => {
    const errors = cases.validateCorpus(all);
    assert.deepStrictEqual(errors, [],
      `corpus validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  });

  it('is one directory per case, holding only known files', () => {
    const known = new Set([...Object.values(cases.FILES), ...Object.values(cases.SNAPSHOTS)]);
    for (const c of all) {
      for (const entry of fs.readdirSync(c.dir)) {
        assert.ok(known.has(entry),
          `${c.rel}/${entry}: unexpected file — a case holds only ${[...known].join(', ')}`);
      }
    }
  });

  it('keeps the walker and asserter prose in separate files', () => {
    // The P4 boundary is enforced by the filesystem: one file goes to the
    // walker, the other only to the asserter. Never merge them.
    for (const c of all) {
      assert.ok(c.act, `${c.rel}: no ${cases.FILES.act}`);
      assert.ok(c.assert, `${c.rel}: no ${cases.FILES.assert}`);
      assert.notStrictEqual(cases.FILES.act, cases.FILES.assert);
    }
  });

  it('every stub is named, triggered by its case, and readable', () => {
    for (const c of all) {
      for (const s of c.stubs) {
        assert.ok(s.trigger.trim().length > 0,
          `${c.rel}: stub "${s.name}" has no trigger — a stub without a moment is a fixture in disguise`);
        assert.ok(cases.readStub(s.name).content.length > 0,
          `stub "${s.name}" has no content below its --- fence`);
      }
    }
  });

  it('the walker can dispatch and continue, and every dispatch and send it makes is held', () => {
    // A walker with the Agent or SendMessage tool and no hold would start
    // or resume real agents inside a world; a walker without them never
    // composes a dispatch or a continuation for a case to claim. The
    // definition carries both or neither works.
    const walker = fs.readFileSync(path.join(cases.ROOT, '.claude/agents/prose-walker.md'), 'utf8');
    const front = walker.split(/^---$/m)[1] || '';
    const tools = ((front.match(/^tools:\s*(.+)$/m) || [])[1] || '').split(',').map((t) => t.trim());
    assert.ok(tools.includes('Agent'), 'prose-walker declares the Agent tool');
    assert.ok(tools.includes('SendMessage'), 'prose-walker declares the SendMessage tool');
    const pre = front.slice(front.indexOf('  PreToolUse:'), front.indexOf('  PostToolUse:'));
    assert.match(pre,
      /- matcher: "Agent\|Task\|SendMessage"\n\s+hooks:\n\s+- type: command\n\s+command: "node \\"\$CLAUDE_PROJECT_DIR\/tests\/prose\/lib\/hold-dispatch\.cjs\\""/,
      'prose-walker holds every Agent|Task|SendMessage call with lib/hold-dispatch.cjs at PreToolUse');
  });

  it('every command the walker runs carries the handoff stand-in, so a walk ends at its handoff', () => {
    // Without it the engine answers `handoff: inline`, the prose invokes the
    // next skill in place, and every walk runs on past its end.
    const walker = fs.readFileSync(path.join(cases.ROOT, '.claude/agents/prose-walker.md'), 'utf8');
    const front = walker.split(/^---$/m)[1] || '';
    const pre = front.slice(front.indexOf('  PreToolUse:'), front.indexOf('  PostToolUse:'));
    assert.match(pre,
      /- matcher: "Bash"\n\s+hooks:\n\s+- type: command\n\s+command: "node \\"\$CLAUDE_PROJECT_DIR\/tests\/prose\/lib\/announce-handoff\.cjs\\""/,
      'prose-walker runs every Bash call through lib/announce-handoff.cjs at PreToolUse');
  });

  it('every state recipe loads and exports build()', () => {
    for (const c of all) {
      for (const which of ['fixtureState', 'assertionState']) {
        const file = path.join(c.dir, cases.FILES[which]);
        if (!fs.existsSync(file)) continue;
        assert.strictEqual(typeof cases.requireState(c.id, which).build, 'function',
          `${c.rel}/${cases.FILES[which]} must export build(h)`);
      }
    }
  });
});
