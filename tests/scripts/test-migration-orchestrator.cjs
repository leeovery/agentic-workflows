'use strict';

//
// Tests for the Node migration orchestrator (migrate.cjs).
//
// Two layers:
//   - Real fleet: run the actual migrate.cjs against a temp project — the
//     bash-3.2 execution path, idempotency, PROJECT_DIR pinning, and a
//     project with no state in its code tree left untouched.
//   - Synthetic fleet: a copy of migrate.cjs beside a controlled migrations/
//     dir — mixed .sh/.cjs numeric ordering, the migrations record the caller names,
//     failure-aborts-without-recording (both extensions), delete-log-reruns,
//     the code-tree fleet recorded unrun where there is no code-tree state.
//

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REAL_MIGRATE = path.join(
  __dirname,
  '../../skills/leeway-migrate/scripts/migrate.cjs'
);
const { LAST_CODE_TREE_MIGRATION } = require(REAL_MIGRATE);

// Stock /bin/bash is 3.2.57 on macOS — the whole point of the .sh path being
// bash-3.2-safe. Pin it explicitly where the .sh execution path is under test.
const SYSTEM_BASH = fs.existsSync('/bin/bash') ? '/bin/bash' : 'bash';

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Where boot keeps the migrations record: the state's own.
const RECORD = '.leeway/.state/migrations';

/** Run a migrate.cjs at `migrate` with cwd `project`, recording into the state's migrations record. */
function run(migrate, project, env = {}, args = ['--record', path.join(project, RECORD)]) {
  const res = spawnSync('node', [migrate, ...args], {
    cwd: project,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

/** Copy migrate.cjs into a fresh scripts/ dir and write the given migration
 *  files into its sibling migrations/. Returns the copied migrate path. */
function synthFleet(migrations) {
  const root = tmp('mig-orch-synth-');
  const scripts = path.join(root, 'scripts');
  const migDir = path.join(scripts, 'migrations');
  fs.mkdirSync(migDir, { recursive: true });
  fs.copyFileSync(REAL_MIGRATE, path.join(scripts, 'migrate.cjs'));
  for (const [name, content] of Object.entries(migrations)) {
    fs.writeFileSync(path.join(migDir, name), content);
  }
  return { migrate: path.join(scripts, 'migrate.cjs'), root };
}

// A project whose code tree still holds the state the fleet up to 072 was
// written for — the synthetic fleet's ids fall in that range, so they run.
function freshProject() {
  const project = tmp('mig-orch-proj-');
  fs.mkdirSync(path.join(project, '.workflows'), { recursive: true });
  return project;
}

function trackingLog(project) {
  const p = path.join(project, RECORD);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

/** The one-line JSON payload under `marker`, or undefined where the run emitted none. */
function markerPayload(stdout, marker) {
  const lines = stdout.split('\n');
  const idx = lines.findIndex((l) => l.trim() === marker);
  return idx === -1 ? undefined : JSON.parse(lines[idx + 1]);
}

/** The run report the orchestrator ends a completed run with, or null. */
function runReport(stdout) {
  const lines = stdout.split('\n');
  const idx = lines.findIndex((l) => l.trim() === '---MIGRATIONS_RUN---');
  return idx === -1 ? null : JSON.parse(lines[idx + 1]);
}

// A .sh migration that appends its id to order.log and reports an update.
const shMig = (id) =>
  `#!/bin/bash\necho "${id}" >> "\${PROJECT_DIR:-.}/order.log"\nreport_update\nreturn 0\n`;

// A .cjs migration that appends its id to order.log and reports an update.
const cjsMig = (id) =>
  `'use strict';\nconst fs = require('fs');\nconst path = require('path');\n` +
  `module.exports = {\n  id: '${id}',\n  description: 'synthetic ${id}',\n` +
  `  run({ projectDir, reportUpdate }) {\n` +
  `    fs.appendFileSync(path.join(projectDir, 'order.log'), '${id}\\n');\n` +
  `    reportUpdate();\n  },\n};\n`;

describe('migrate.cjs — real fleet', () => {
  it('runs the whole fleet under stock /bin/bash 3.2 and writes the migrations record', () => {
    const project = freshProject();
    const res = run(REAL_MIGRATE, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });

    assert.strictEqual(res.status, 0, `stderr: ${res.stderr}`);
    assert.ok(!/mapfile|command not found/i.test(res.stdout + res.stderr), 'no bash-3.2 failure');
    assert.ok(fs.existsSync(path.join(project, RECORD)), 'record written');
    assert.ok(runReport(res.stdout).ran > 0, 'the fleet ran against the code tree\'s state');
  });

  it('leaves a project with no state in its code tree untouched, recording the code-tree fleet unrun', () => {
    const project = tmp('mig-orch-none-');
    const res = run(REAL_MIGRATE, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });

    assert.strictEqual(res.status, 0, `stderr: ${res.stderr}`);
    assert.deepStrictEqual(fs.readdirSync(project), ['.leeway'], 'nothing written but the record');
    assert.deepStrictEqual(fs.readdirSync(path.join(project, '.leeway/.state')), ['migrations']);
    const ids = fs.readdirSync(path.join(path.dirname(REAL_MIGRATE), 'migrations'))
      .map((name) => (name.match(/^[0-9]+/) || [''])[0]).filter(Boolean).sort();
    assert.deepStrictEqual(trackingLog(project).trim().split('\n').sort(), ids, 'every migration recorded');
    // The code-tree fleet is recorded unrun; the migrations past it run and find nothing to do.
    assert.deepStrictEqual(runReport(res.stdout), { ran: ids.filter((id) => Number(id) > LAST_CODE_TREE_MIGRATION).length });
  });

  it('is idempotent — a second run reports no changes', () => {
    const project = freshProject();
    run(REAL_MIGRATE, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    const second = run(REAL_MIGRATE, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });

    assert.strictEqual(second.status, 0);
    assert.ok(second.stdout.includes('[SKIP] No changes needed'), second.stdout);
  });

  it('pins PROJECT_DIR to "." — a hostile export cannot redirect the fleet', () => {
    // Real project (cwd): status active -> migration 019 renames to in-progress.
    const base = tmp('mig-orch-pin-');
    const proj = path.join(base, 'proj');
    const decoy = path.join(base, 'decoy');
    fs.mkdirSync(path.join(proj, '.workflows/wu'), { recursive: true });
    fs.writeFileSync(
      path.join(proj, '.workflows/wu/manifest.json'),
      '{"name":"wu","work_type":"feature","status":"active","phases":{}}\n'
    );
    fs.mkdirSync(path.join(decoy, '.workflows/wu2'), { recursive: true });
    fs.writeFileSync(
      path.join(decoy, '.workflows/wu2/manifest.json'),
      '{"name":"wu2","work_type":"feature","status":"active","phases":{}}\n'
    );

    run(REAL_MIGRATE, proj, { PROJECT_DIR: decoy, LEEWAY_MIGRATE_BASH: SYSTEM_BASH });

    const status = (p) => JSON.parse(fs.readFileSync(p, 'utf8')).status;
    assert.strictEqual(
      status(path.join(proj, '.workflows/wu/manifest.json')),
      'in-progress',
      'real project migrated'
    );
    assert.strictEqual(
      status(path.join(decoy, '.workflows/wu2/manifest.json')),
      'active',
      'decoy tree untouched'
    );
  });
});

describe('migrate.cjs — synthetic fleet', () => {
  it('runs .sh and .cjs migrations in one strict numeric-prefix ordering', () => {
    const { migrate } = synthFleet({
      '003-c.sh': shMig('003'),
      '001-a.sh': shMig('001'),
      '010-d.cjs': cjsMig('010'),
      '002-b.cjs': cjsMig('002'),
    });
    const project = freshProject();

    const res = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });

    assert.strictEqual(res.status, 0, res.stderr);
    assert.strictEqual(
      fs.readFileSync(path.join(project, 'order.log'), 'utf8'),
      '001\n002\n003\n010\n',
      'executed strictly by numeric prefix, across both extensions'
    );
    assert.deepStrictEqual(
      trackingLog(project).trim().split('\n'),
      ['001', '002', '003', '010'],
      'all four IDs recorded'
    );
  });

  it('reports the migrations it ran — a run that changed no file included', () => {
    // 002 runs and reports nothing changed: it still recorded, and the report
    // counts runs, not files — the case the stop gate cannot speak for.
    const { migrate } = synthFleet({
      '001-a.cjs': cjsMig('001'),
      '002-b.cjs':
        `'use strict';\nmodule.exports = { id: '002', description: 'synthetic 002', run({ reportSkip }) { reportSkip(); } };\n`,
    });
    const project = freshProject();

    const first = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.strictEqual(first.status, 0, first.stderr);
    assert.deepStrictEqual(runReport(first.stdout), { ran: 2 });

    // Fully recorded: nothing ran, and the report says so.
    const second = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.strictEqual(second.status, 0, second.stderr);
    assert.ok(second.stdout.includes('[SKIP] No changes needed'), second.stdout);
    assert.deepStrictEqual(runReport(second.stdout), { ran: 0 });
  });

  it('records into the migrations record the caller names, its folder made where missing', () => {
    const { migrate } = synthFleet({ '001-a.cjs': cjsMig('001') });
    const project = freshProject();
    const record = path.join(tmp('mig-orch-record-'), 'deep/record');

    const res = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH }, ['--record', record]);

    assert.strictEqual(res.status, 0, res.stderr);
    assert.strictEqual(fs.readFileSync(record, 'utf8'), '001\n');
    assert.strictEqual(fs.existsSync(path.join(project, RECORD)), false);
  });

  it('refuses to run without a migrations record, running nothing', () => {
    const { migrate } = synthFleet({ '001-a.cjs': cjsMig('001') });
    const project = freshProject();

    const res = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH }, []);

    assert.notStrictEqual(res.status, 0);
    assert.match(res.stderr, /usage: migrate\.cjs --record <path>/);
    assert.strictEqual(fs.existsSync(path.join(project, 'order.log')), false);
  });

  it('records the code-tree fleet (to 072) unrun where the code tree holds no state, and runs what follows', () => {
    const { migrate } = synthFleet({
      '001-a.sh': shMig('001'),
      '072-b.cjs': cjsMig('072'),
      '073-c.cjs': cjsMig('073'),
    });
    const project = tmp('mig-orch-none-');

    const res = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });

    assert.strictEqual(res.status, 0, res.stderr);
    assert.strictEqual(fs.readFileSync(path.join(project, 'order.log'), 'utf8'), '073\n', 'only 073 ran');
    assert.deepStrictEqual(trackingLog(project).trim().split('\n'), ['001', '072', '073']);
    assert.deepStrictEqual(runReport(res.stdout), { ran: 1 });
  });

  it('an aborted run reports nothing — there is no completed run to account for', () => {
    const { migrate } = synthFleet({
      '001-a.cjs': cjsMig('001'),
      '002-boom.cjs':
        `'use strict';\nmodule.exports = { id: '002', description: 'boom', run() { throw new Error('boom'); } };\n`,
    });
    const project = freshProject();

    const res = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });

    assert.notStrictEqual(res.status, 0);
    assert.strictEqual(runReport(res.stdout), null);
  });

  it('collects verify addenda from executed .cjs migrations — skip paths included, never on re-run', () => {
    const verifying =
      `'use strict';\nmodule.exports = {\n  id: '002',\n  description: 'synthetic 002',\n` +
      `  info: 'What this migration does, anywhere.',\n` +
      `  run({ reportSkip }) {\n    reportSkip();\n    return { verify: 'Check the things code cannot see.' };\n  },\n};\n`;
    const { migrate } = synthFleet({
      '001-a.cjs': cjsMig('001'),
      '002-b.cjs': verifying,
      '003-c.sh': shMig('003'),
    });
    const project = freshProject();

    const first = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.strictEqual(first.status, 0, first.stderr);
    const lines = first.stdout.split('\n');
    const mi = lines.findIndex((l) => l.trim() === '---VERIFY_ADDENDA---');
    assert.notStrictEqual(mi, -1, 'marker emitted');
    const addenda = JSON.parse(lines[mi + 1]);
    assert.deepStrictEqual(addenda, [{
      id: '002',
      description: 'synthetic 002',
      info: 'What this migration does, anywhere.',
      verify: 'Check the things code cannot see.',
    }], 'the skip-path migration still hands over its checks');

    const second = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.strictEqual(second.status, 0, second.stderr);
    assert.ok(!second.stdout.includes('---VERIFY_ADDENDA---'), 'recorded migrations never re-emit');
  });

  it('an aborted run journals earlier addenda — the next successful run emits them', () => {
    const throwing =
      `'use strict';\nmodule.exports = { id: '002', description: 'boom', run() { throw new Error('boom'); } };\n`;
    const { migrate, root } = synthFleet({
      '001-a.cjs':
        `'use strict';\nmodule.exports = { id: '001', description: 'synthetic 001', info: 'What 001 does.',\n` +
        `  run({ reportUpdate }) { reportUpdate(); return { verify: 'Check 001 by hand.' }; } };\n`,
      '002-b.cjs': throwing,
    });
    const project = freshProject();

    const first = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.notStrictEqual(first.status, 0, 'the fleet aborts on 002');
    assert.ok(!first.stdout.includes('---VERIFY_ADDENDA---'), 'an aborted run emits nothing');
    assert.deepStrictEqual(trackingLog(project).trim().split('\n'), ['001'], '001 recorded, 002 not');

    // Fix 002 and re-run: 001 never re-runs, but its journaled addendum rides.
    fs.writeFileSync(path.join(root, 'scripts/migrations/002-b.cjs'),
      `'use strict';\nmodule.exports = { id: '002', description: 'fixed', run({ reportSkip }) { reportSkip(); } };\n`);
    const second = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.strictEqual(second.status, 0, second.stderr);
    const lines = second.stdout.split('\n');
    const mi = lines.findIndex((l) => l.trim() === '---VERIFY_ADDENDA---');
    assert.notStrictEqual(mi, -1, 'the recovered run emits the journal');
    const addenda = JSON.parse(lines[mi + 1]);
    assert.deepStrictEqual(addenda.map((a) => a.id), ['001'], "001's addendum survived the abort");
    assert.ok(!fs.existsSync(path.join(project, '.leeway/.state/pending-verify.json')), 'journal cleared after emission');

    const third = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.ok(!third.stdout.includes('---VERIFY_ADDENDA---'), 'emitted once, never again');
  });

  it('emits no addenda when no executed migration declares verify', () => {
    const { migrate } = synthFleet({ '001-a.cjs': cjsMig('001'), '002-b.sh': shMig('002') });
    const project = freshProject();

    const res = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });

    assert.strictEqual(res.status, 0, res.stderr);
    assert.ok(!res.stdout.includes('---VERIFY_ADDENDA---'));
    assert.ok(!res.stdout.includes('---MIGRATION_NOTICES---'));
  });

  it('collects notices from executed .cjs migrations apart from their checks — never on re-run', () => {
    const telling =
      `'use strict';\nmodule.exports = {\n  id: '002',\n  description: 'synthetic 002',\n` +
      `  info: 'What this migration does, anywhere.',\n` +
      `  run({ reportUpdate }) {\n    reportUpdate();\n` +
      `    return { verify: 'Check the things code cannot see.', notice: '  Tell the person what changed.  ' };\n  },\n};\n`;
    const { migrate } = synthFleet({
      '001-a.cjs': cjsMig('001'),
      '002-b.cjs': telling,
      '003-c.cjs': `'use strict';\nmodule.exports = { id: '003', description: 'quiet', run({ reportSkip }) { reportSkip(); return { notice: '   ' }; } };\n`,
    });
    const project = freshProject();

    const first = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.strictEqual(first.status, 0, first.stderr);
    assert.deepStrictEqual(markerPayload(first.stdout, '---MIGRATION_NOTICES---'), [{
      id: '002',
      description: 'synthetic 002',
      notice: 'Tell the person what changed.',
    }], 'trimmed, and a blank notice is no notice');
    assert.deepStrictEqual(markerPayload(first.stdout, '---VERIFY_ADDENDA---').map((a) => a.verify),
      ['Check the things code cannot see.'], 'the checks travel on their own');
    assert.ok(!fs.existsSync(path.join(project, '.leeway/.state/pending-notices.json')), 'journal cleared after emission');

    const second = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.strictEqual(second.status, 0, second.stderr);
    assert.ok(!second.stdout.includes('---MIGRATION_NOTICES---'), 'recorded migrations never re-emit');
  });

  it('an aborted run journals earlier notices — the next successful run emits them', () => {
    const { migrate, root } = synthFleet({
      '001-a.cjs':
        `'use strict';\nmodule.exports = { id: '001', description: 'synthetic 001',\n` +
        `  run({ reportUpdate }) { reportUpdate(); return { notice: 'Something was removed.' }; } };\n`,
      '002-b.cjs': `'use strict';\nmodule.exports = { id: '002', description: 'boom', run() { throw new Error('boom'); } };\n`,
    });
    const project = freshProject();

    const first = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.notStrictEqual(first.status, 0, 'the fleet aborts on 002');
    assert.ok(!first.stdout.includes('---MIGRATION_NOTICES---'), 'an aborted run emits nothing');

    fs.writeFileSync(path.join(root, 'scripts/migrations/002-b.cjs'),
      `'use strict';\nmodule.exports = { id: '002', description: 'fixed', run({ reportSkip }) { reportSkip(); } };\n`);
    const second = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.strictEqual(second.status, 0, second.stderr);
    assert.deepStrictEqual(markerPayload(second.stdout, '---MIGRATION_NOTICES---').map((n) => n.notice),
      ['Something was removed.'], "001's notice survived the abort");
  });

  it('runs only what the record does not hold, appending after what it does', () => {
    const { migrate } = synthFleet({
      '001-a.sh': shMig('001'),
      '002-b.cjs': cjsMig('002'),
      '003-c.sh': shMig('003'),
      '004-d.cjs': cjsMig('004'),
    });
    const project = freshProject();
    fs.mkdirSync(path.dirname(path.join(project, RECORD)), { recursive: true });
    fs.writeFileSync(path.join(project, RECORD), '001\n003\n');

    const res = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });

    assert.strictEqual(res.status, 0, res.stderr);
    assert.strictEqual(
      fs.readFileSync(path.join(project, 'order.log'), 'utf8'),
      '002\n004\n',
      'only unrecorded migrations ran'
    );
    assert.deepStrictEqual(
      trackingLog(project).trim().split('\n'),
      ['001', '003', '002', '004'],
      'newly-run IDs appended after the pre-existing ones'
    );
  });

  it('a failing .sh migration aborts the run without recording it', () => {
    const { migrate } = synthFleet({
      '001-a.sh': shMig('001'),
      // 002 fails mid-migration under set -e (unknown command).
      '002-boom.sh': `#!/bin/bash\nreport_update\ndefinitely_not_a_command_xyz\nreturn 0\n`,
      '003-c.sh': shMig('003'),
    });
    const project = freshProject();

    const res = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });

    assert.notStrictEqual(res.status, 0, 'non-zero exit');
    assert.match(res.stderr, /002-boom\.sh failed/);
    assert.deepStrictEqual(trackingLog(project).trim().split('\n'), ['001'], 'only 001 recorded');
    assert.ok(!fs.existsSync(path.join(project, 'order.log'))
      || !fs.readFileSync(path.join(project, 'order.log'), 'utf8').includes('003'),
      '003 never ran');
  });

  it('a throwing .cjs migration aborts the run without recording it', () => {
    const { migrate } = synthFleet({
      '001-a.sh': shMig('001'),
      '002-boom.cjs':
        `'use strict';\nmodule.exports = { id: '002', description: 'boom',\n` +
        `  run() { throw new Error('kaboom-002'); } };\n`,
      '003-c.cjs': cjsMig('003'),
    });
    const project = freshProject();

    const res = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });

    assert.notStrictEqual(res.status, 0, 'non-zero exit');
    assert.match(res.stderr, /kaboom-002/);
    assert.deepStrictEqual(trackingLog(project).trim().split('\n'), ['001'], 'only 001 recorded');
    assert.ok(!fs.existsSync(path.join(project, 'order.log'))
      || !fs.readFileSync(path.join(project, 'order.log'), 'utf8').includes('003'),
      '003 never ran');
  });

  it('deleting the tracking log re-runs the whole fleet', () => {
    const { migrate } = synthFleet({
      '001-a.sh': shMig('001'),
      '002-b.cjs': cjsMig('002'),
    });
    const project = freshProject();

    run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.strictEqual(fs.readFileSync(path.join(project, 'order.log'), 'utf8'), '001\n002\n');

    // Second run: nothing to do.
    const noop = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.ok(noop.stdout.includes('[SKIP] No changes needed'));
    assert.strictEqual(fs.readFileSync(path.join(project, 'order.log'), 'utf8'), '001\n002\n');

    // Delete the log — every migration re-runs.
    fs.rmSync(path.join(project, RECORD));
    run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });
    assert.strictEqual(
      fs.readFileSync(path.join(project, 'order.log'), 'utf8'),
      '001\n002\n001\n002\n',
      'both migrations ran a second time'
    );
  });

  it('runs a .sh migration under stock /bin/bash 3.2 with the report helpers', () => {
    const { migrate } = synthFleet({ '001-a.sh': shMig('001') });
    const project = freshProject();

    const res = run(migrate, project, { LEEWAY_MIGRATE_BASH: SYSTEM_BASH });

    assert.strictEqual(res.status, 0, res.stderr);
    assert.strictEqual(fs.readFileSync(path.join(project, 'order.log'), 'utf8'), '001\n');
    // report_update fired under 3.2 → the summary reflects one updated file.
    assert.match(res.stdout, /1 migration\(s\) applied, 1 file\(s\) updated\./);
    assert.ok(res.stdout.includes('---STOP_GATE: FILES_UPDATED---'));
  });
});
