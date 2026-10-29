'use strict';

// The suite's hermetic environment, pinned at require time and inherited by
// every process a test spawns: an empty system-config directory, an empty
// Claude Code config directory, an empty gh config directory and no gh token
// or host, no provider key, no gate surface or handoff announcement, no
// Claude Code session, no user or system git config, no ssh command of the
// developer's, a fixed display width, and a stub for the `claude` binary. A
// test never reads the developer's config or credentials, never writes
// their Claude Code settings, never reaches an embedding provider — every
// knowledge store a test builds is keyword-only — never reaches a real
// Claude, never reaches GitHub through the developer's gh login, never
// reaches a remote through the developer's ssh, never renders a gate or
// handoff payload it did not announce itself, and never marks a
// conversation it did not name itself.
//
// Every `tests/scripts/test-*.cjs` requires this before anything else, and a
// caller composing an explicit child environment spreads the exported
// entries into it. `test-hermetic-env.cjs` guards both.
//
// A suite that fakes `$HOME` to reach a system config takes the pinned
// WORKFLOWS_CONFIG_DIR back off the environment it passes down, since that
// answers ahead of `$HOME`. The shell tiers pin their own subset in their npm
// scripts; `test:mod` stands outside the pin altogether — `claude plugin test`
// runs the mod suites against its own stand-in environment and files.

const fs = require('fs');
const os = require('os');
const path = require('path');

/** A config directory the knowledge subsystem can read nothing from. */
function isEmptyConfigDir(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  return ['config.json', 'credentials.json'].every((name) => !fs.existsSync(path.join(dir, name)));
}

/**
 * A Claude Code config directory holding nothing — one Claude Code has run
 * under never is, so a developer's own is never taken for the suite's.
 */
function isEmptyDir(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).length === 0;
}

/** A fresh directory, removed when the process exits. */
function scratchDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * The inherited directory where it already meets the pin, so requiring this
 * twice pins once; a fresh one otherwise.
 */
function pinnedDir(name, meetsPin, prefix) {
  const inherited = process.env[name];
  return meetsPin(inherited) ? inherited : scratchDir(prefix);
}

/** What reaches a gh login besides its config directory. */
const GH_LOGIN = Object.freeze(['GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN', 'GH_HOST']);

const HERMETIC_ENV = Object.freeze({
  WORKFLOWS_CONFIG_DIR: pinnedDir('WORKFLOWS_CONFIG_DIR', isEmptyConfigDir, 'wf-config-'),
  CLAUDE_CONFIG_DIR: pinnedDir('CLAUDE_CONFIG_DIR', isEmptyDir, 'wf-claude-config-'),
  GH_CONFIG_DIR: pinnedDir('GH_CONFIG_DIR', isEmptyDir, 'wf-gh-config-'),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  // Width is detected from the reader's terminal, and CLAUDE_PID reaches
  // every test env — without a pin, a suite would render against whatever
  // pane happened to be open.
  WORKFLOWS_DISPLAY_WIDTH: '65',
  // The separate Claude call runs the binary this names: the stub, which
  // has no login unless a test arms it with answers.
  LEEWAY_CLAUDE: path.join(__dirname, 'claude-stub.sh'),
});

Object.assign(process.env, HERMETIC_ENV);
// The env key wins over stored credentials, so isolating the directory is
// only half of it.
delete process.env.OPENAI_API_KEY;
// A session whose gate surface is loaded announces it to every command it
// runs, the suite included — and every golden pins the unannounced bytes.
// The gate mod announces the handoff the same way.
delete process.env.WORKFLOWS_GATE_SURFACE;
delete process.env.WORKFLOWS_HANDOFF;
// Claude Code hands every command it runs its conversation's id, and every
// engine call marks that conversation's folder.
delete process.env.CLAUDE_CODE_SESSION_ID;
// The developer's own ssh command overrides any a suite stands in for a
// remote with, and would carry their keys to it.
delete process.env.GIT_SSH_COMMAND;
delete process.env.GIT_SSH;
// A token or host for gh wins over its config directory, as the provider
// key does over stored credentials.
for (const name of GH_LOGIN) delete process.env[name];

module.exports = HERMETIC_ENV;
