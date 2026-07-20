'use strict';

//
// Tests for the Node migration orchestrator (migrate.cjs).
//
// Two layers:
//   - Real fleet: run the actual migrate.cjs against a temp project — the
//     bash-3.2 execution path, idempotency, PROJECT_DIR pinning.
//   - Synthetic fleet: a copy of migrate.cjs beside a controlled migrations/
//     dir — mixed .sh/.cjs numeric ordering, legacy tracking-log honouring,
//     failure-aborts-without-recording (both extensions), delete-log-reruns.
//

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REAL_MIGRATE = path.join(
  __dirname,
  '../../skills/workflow-migrate/scripts/migrate.cjs'
);

// Stock /bin/bash is 3.2.57 on macOS — the whole point of the .sh path being
// bash-3.2-safe. Pin it explicitly where the .sh execution path is under test.
const SYSTEM_BASH = fs.existsSync('/bin/bash') ? '/bin/bash' : 'bash';

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Run a migrate.cjs at `migrate` with cwd `project`. */
function run(migrate, project, env = {}) {
  const res = spawnSync('node', [migrate], {
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

function freshProject() {
  const project = tmp('mig-orch-proj-');
  fs.mkdirSync(path.join(project, '.workflows', '.state'), { recursive: true });
  return project;
}

function trackingLog(project) {
  const p = path.join(project, '.workflows', '.state', 'migrations');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
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
  it('runs the whole fleet under stock /bin/bash 3.2 and writes the tracking file', () => {
    const project = freshProject();
    const res = run(REAL_MIGRATE, project, { WORKFLOWS_MIGRATE_BASH: SYSTEM_BASH });

    assert.strictEqual(res.status, 0, `stderr: ${res.stderr}`);
    assert.ok(!/mapfile|command not found/i.test(res.stdout + res.stderr), 'no bash-3.2 failure');
    assert.ok(
      fs.existsSync(path.join(project, '.workflows/.state/migrations')),
      'tracking file written'
    );
  });

  it('is idempotent — a second run reports no changes', () => {
    const project = freshProject();
    run(REAL_MIGRATE, project, { WORKFLOWS_MIGRATE_BASH: SYSTEM_BASH });
    const second = run(REAL_MIGRATE, project, { WORKFLOWS_MIGRATE_BASH: SYSTEM_BASH });

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

    run(REAL_MIGRATE, proj, { PROJECT_DIR: decoy, WORKFLOWS_MIGRATE_BASH: SYSTEM_BASH });

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

    const res = run(migrate, project, { WORKFLOWS_MIGRATE_BASH: SYSTEM_BASH });

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

  it('honours a legacy tracking log written by the old migrate.sh', () => {
    const { migrate } = synthFleet({
      '001-a.sh': shMig('001'),
      '002-b.cjs': cjsMig('002'),
      '003-c.sh': shMig('003'),
      '004-d.cjs': cjsMig('004'),
    });
    const project = freshProject();
    // A log the bash orchestrator would have left: numeric IDs, one per line.
    fs.writeFileSync(path.join(project, '.workflows/.state/migrations'), '001\n003\n');

    const res = run(migrate, project, { WORKFLOWS_MIGRATE_BASH: SYSTEM_BASH });

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

    const res = run(migrate, project, { WORKFLOWS_MIGRATE_BASH: SYSTEM_BASH });

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

    const res = run(migrate, project, { WORKFLOWS_MIGRATE_BASH: SYSTEM_BASH });

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

    run(migrate, project, { WORKFLOWS_MIGRATE_BASH: SYSTEM_BASH });
    assert.strictEqual(fs.readFileSync(path.join(project, 'order.log'), 'utf8'), '001\n002\n');

    // Second run: nothing to do.
    const noop = run(migrate, project, { WORKFLOWS_MIGRATE_BASH: SYSTEM_BASH });
    assert.ok(noop.stdout.includes('[SKIP] No changes needed'));
    assert.strictEqual(fs.readFileSync(path.join(project, 'order.log'), 'utf8'), '001\n002\n');

    // Delete the log — every migration re-runs.
    fs.rmSync(path.join(project, '.workflows/.state/migrations'));
    run(migrate, project, { WORKFLOWS_MIGRATE_BASH: SYSTEM_BASH });
    assert.strictEqual(
      fs.readFileSync(path.join(project, 'order.log'), 'utf8'),
      '001\n002\n001\n002\n',
      'both migrations ran a second time'
    );
  });

  it('runs a .sh migration under stock /bin/bash 3.2 with the report helpers', () => {
    const { migrate } = synthFleet({ '001-a.sh': shMig('001') });
    const project = freshProject();

    const res = run(migrate, project, { WORKFLOWS_MIGRATE_BASH: SYSTEM_BASH });

    assert.strictEqual(res.status, 0, res.stderr);
    assert.strictEqual(fs.readFileSync(path.join(project, 'order.log'), 'utf8'), '001\n');
    // report_update fired under 3.2 → the summary reflects one updated file.
    assert.match(res.stdout, /1 migration\(s\) applied, 1 file\(s\) updated\./);
    assert.ok(res.stdout.includes('---STOP_GATE: FILES_UPDATED---'));
  });
});
