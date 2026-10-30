'use strict';

// The oldest git the engine runs on is one value wherever it is written:
// the engine's, which boot's check and its stop both read, and the
// requirements the README and the docs state.

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { GIT_FLOOR, gitShortfall, gitFloorStopSurface } = require('../../skills/leeway-engine/scripts/domain/git-floor.cjs');
const { withEnv } = require('./discovery-test-utils.cjs');

const ROOT = path.join(__dirname, '..', '..');

describe('the git floor', () => {
  const floor = GIT_FLOOR.join('.');

  it("is the one value boot's check and its stop read: raised, a git at the old floor falls short of it, and the stop names the new one wherever it names the floor", () => {
    const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'git-floor-'));
    fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh\necho 'git version ${floor}'\n`, { mode: 0o755 });
    const saved = [...GIT_FLOOR];
    try {
      withEnv({ PATH: bin }, () => {
        GIT_FLOOR[1] += 1;
        assert.deepStrictEqual(gitShortfall(), { found: floor });
        const [raised, old] = [GIT_FLOOR.join('\\.'), floor.replace(/\./g, '\\.')];
        const shown = gitFloorStopSurface();
        assert.match(shown, new RegExp(`Leeway runs on git ${raised} or newer, and the git on this machine is ${old}\\.`));
        assert.match(shown, new RegExp(`Install git ${raised} or newer, then`));
      });
    } finally {
      GIT_FLOOR.splice(0, GIT_FLOOR.length, ...saved);
      fs.rmSync(bin, { recursive: true, force: true });
    }
  });

  for (const [rel, line] of [
    ['README.md', /^\*\*Setup:\*\* .*\bgit (\d+\.\d+\.\d+)\+/m],
    ['docs/configuration.md', /^The workflows need .*\bgit (\d+\.\d+\.\d+) or newer/m],
    ['docs/contributing.md', /The engine needs git (\d+\.\d+\.\d+) or newer/],
  ]) {
    it(`is the version ${rel} requires`, () => {
      const named = line.exec(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
      assert.ok(named, `${rel} names the git it needs`);
      assert.strictEqual(named[1], floor);
    });
  }
});
