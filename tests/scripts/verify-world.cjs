'use strict';

// ---------------------------------------------------------------------------
// The verify suites' world and helpers (test-engine-verify.cjs,
// test-engine-verify-mutants.cjs): a feature, `pay`, its spec cut into two
// phases, its build begun and the first phase started — its start's close
// written onto the manifest, since two of its tasks hold 1.S1, which its
// checklist refuses — the first's three tasks in the tracker, their acceptance
// scenarios holding 1.S1; 1.S1 and 1.S2; and 1.S10 and 11.S1, which hold
// no 1.S1; a verify setup in the
// product's code whose parts each log their call and do what the test steers
// them to from a folder in the repository's git directory — `unrecorded`, and
// `world`, the same with the setup recorded through `verify setup` — each
// built once per process and copied for each test.
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { ok, commitAll, fixtureFrom, layout, createFile, writeState, readManifest, FROZEN_AT } = require('./engine-harness.cjs');
const { createManifest } = require('./discovery-test-utils.cjs');

const UNIT = 'pay';

const SPEC = [
  '# Payments', '',
  '## 1. Cards', '', '### 1.1 The form', '', '1.1.1 Visa is taken. [builder]', '',
  '## 1-S. Scenarios for §1', '',
  '1.S1 Given a form, when a Visa is offered, then it is taken. (1.1.1)', '',
  '1.S2 Given a form, when the brand is unknown, then it is refused. (1.1.1)', '',
  '## 2. Refunds', '', '### 2.1 Whole', '', '2.1.1 A refund goes back to the card. [builder]', '',
  '## 2-S. Scenarios for §2', '',
  '2.S1 Given a charge, when it is refunded, then the card is credited. (2.1.1)', '',
].join('\n');

const CUT = {
  phases: [
    { name: 'Cards', goal: 'Cards are taken.', scenarios: ['1.S1', '1.S2'], sections: ['1'], relies_on: [] },
    { name: 'Refunds', goal: 'Refunds reach the card.', scenarios: ['2.S1'], sections: ['2'], relies_on: [1] },
  ],
};

const TASK = [
  '# Take a card', '', '## Type', 'feat', '', '## Problem', 'A card cannot be taken.', '', '## Solution', 'Add the card form.', '',
  '## Outcome', 'A card is taken.', '', '## Acceptance scenarios', '- 1.S1', '', '## Spec reference', '§1',
].join('\n');

// Each part logs its name, the scenario and the folder it runs in, then does
// what the steering folder says: the drive copies the verdict, whatever it
// is, the evidence
// part the text and the recordings, a part leaves in the checkout the file its
// `leave-{part}` file names, and fails with the exit code its `fail-{part}`
// file holds.
const PART = `#!/bin/sh
steer="$(git rev-parse --path-format=absolute --git-common-dir)/verify"
echo "$1 \${LEEWAY_SCENARIO:-} $(pwd -P)" >> "$steer/parts.log"
case "$1" in
  drive) cp -PR "$steer/verdict" "$LEEWAY_RUN/verdict" 2>/dev/null ;;
  evidence) for kept in evidence recordings; do [ -d "$steer/$kept" ] && cp -PR "$steer/$kept" "$LEEWAY_RUN/$kept"; done ;;
esac
if [ -f "$steer/leave-$1" ]; then left="$(cat "$steer/leave-$1")"; mkdir -p "$(dirname "$left")"; echo left > "$left"; fi
if [ -f "$steer/fail-$1" ]; then echo "$1 broke"; exit "$(cat "$steer/fail-$1")"; fi
exit 0
`;

const MUTATE = `steer="$(git rev-parse --path-format=absolute --git-common-dir)/verify"
cp "$LEEWAY_CHANGED" "$steer/changed.json"
[ -f "$steer/survivors.json" ] && cp "$steer/survivors.json" "$LEEWAY_RUN/survivors.json"
if [ -f "$steer/fail-mutate" ]; then echo "mutants survived"; exit "$(cat "$steer/fail-mutate")"; fi
exit 0
`;

/** The setup the world records, each part a call of the steered script, the drive's running it as the executable it is. */
const SETUP = Object.freeze({
  place: 'verify',
  feature_map: 'verify/features.md',
  ...Object.fromEntries(['launch', 'health', 'drive', 'evidence', 'cleanup'].map((part) => [part, `sh verify/part.sh ${part}`])),
  drive: 'verify/part.sh drive',
  mutation: 'sh verify/mutate.sh',
});

/** The folder the parts are steered from and log to. @param {string} dir */
const steer = (dir) => path.join(dir, '.git', 'verify');

/** A steering file written. @param {string} dir @param {string} name @param {string|Buffer} content */
function steering(dir, name, content) {
  fs.mkdirSync(path.dirname(path.join(steer(dir), name)), { recursive: true });
  fs.writeFileSync(path.join(steer(dir), name), content);
}

/** The parts that ran, each `{part} {scenario} {folder}`. @param {string} dir @returns {string[]} */
function partsRan(dir) {
  const log = path.join(steer(dir), 'parts.log');
  return fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trimEnd().split('\n') : [];
}

/** The five parts' log lines for a scenario run in `folder`. @param {string} scenario @param {string} folder */
const fiveParts = (scenario, folder) => ['launch', 'health', 'drive', 'evidence', 'cleanup'].map((part) => `${part} ${scenario} ${folder}`);

/** The setup file, as given. @param {string} dir @param {Record<string, unknown>} setup */
const setupFile = (dir, setup) => writeState(dir, layout.cache('verify-setup.json'), JSON.stringify(setup));

/** `verify setup`'s call for `setup`, run for 1.S1. @param {string} dir @param {Record<string, unknown>} setup */
const setupArgs = (dir, setup) => ['verify', 'setup', UNIT, '--file', setupFile(dir, setup), '--scenario', '1.S1'];

/** The world before its setup is recorded. @param {string} dir */
function build(dir) {
  createManifest(dir, UNIT, { build: { position: 'auto' } });
  writeState(dir, layout.unit(UNIT, 'spec.md'), SPEC);
  ok(dir, ['cut', UNIT, '--file', writeState(dir, layout.cache('cut.json'), JSON.stringify(CUT))]);
  createManifest(dir, UNIT, { ...readManifest(dir, UNIT), checklists: { 'phase-1-start': { items: {}, closed: FROZEN_AT } } });
  fs.chmodSync(createFile(dir, 'verify/part.sh', PART), 0o755);
  createFile(dir, 'verify/mutate.sh', MUTATE);
  createFile(dir, 'verify/features.md', '# Features\n');
  createFile(dir, 'src/card.js', 'const card = 1;\n');
  commitAll(dir, 'init');
  fs.mkdirSync(steer(dir));
  ok(dir, ['task', 'phase', UNIT, '1', '--title', 'Cards']);
  for (const text of [TASK, TASK.replace('- 1.S1', '- 1.S1\n- 1.S2'), TASK.replace('- 1.S1', '- 1.S10\n- 11.S1')]) ok(dir, ['task', 'create', UNIT, '1', '--file', writeState(dir, layout.cache('task.md'), text)]);
}

const unrecorded = fixtureFrom('verify-unset-', build);
const world = fixtureFrom('verify-', (dir) => {
  build(dir);
  steering(dir, 'verdict', 'pass\n');
  ok(dir, setupArgs(dir, SETUP));
  for (const name of ['parts.log', 'verdict']) fs.rmSync(path.join(steer(dir), name));
});

module.exports = { UNIT, SETUP, steer, steering, partsRan, fiveParts, setupFile, setupArgs, unrecorded, world };
