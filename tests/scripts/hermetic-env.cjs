'use strict';

//
// The suite's hermetic environment, pinned at require time and inherited by
// every process a test spawns: an empty system-config directory, no provider
// key, no user or system git config, a fixed display width. A test never
// reads the developer's config or credentials, and never reaches an
// embedding provider — every knowledge store a test builds is keyword-only.
//
// Every `tests/scripts/test-*.cjs` requires this before anything else, and a
// caller composing an explicit child environment spreads the exported
// entries into it. `test-hermetic-env.cjs` guards both.
//

const fs = require('fs');
const os = require('os');
const path = require('path');

/** A config directory the knowledge subsystem can read nothing from. */
function isEmptyConfigDir(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  return ['config.json', 'credentials.json'].every((name) => !fs.existsSync(path.join(dir, name)));
}

/** An already-empty directory is reused, so requiring this twice pins once. */
function emptyConfigDir() {
  const inherited = process.env.WORKFLOWS_CONFIG_DIR;
  if (isEmptyConfigDir(inherited)) return inherited;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-config-'));
  process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const HERMETIC_ENV = Object.freeze({
  WORKFLOWS_CONFIG_DIR: emptyConfigDir(),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  // Width is detected from the reader's terminal, and CLAUDE_PID reaches
  // every test env — without a pin, a suite would render against whatever
  // pane happened to be open.
  WORKFLOWS_DISPLAY_WIDTH: '65',
});

Object.assign(process.env, HERMETIC_ENV);
// The env key wins over stored credentials, so isolating the directory is
// only half of it.
delete process.env.OPENAI_API_KEY;

module.exports = HERMETIC_ENV;
