'use strict';

// ---------------------------------------------------------------------------
// The test budget check (tests/README.md §12): the report
// (budget-report.cjs) — each suite's layer and own budget read from its
// header, the meter's log read, and the report's parts over a fixture log:
// the run against its guide, the suites over their budget, those within a
// budget of their own, those with no layer, and the growth since the
// previous run; and the meter (cpu-meter.cjs) as `npm test` arms it —
// a suite's CPU logged with the CPU of a child only time(1) sees, the run's
// output and status the runner's own, the previous log kept and the report
// printed after the run; and a metered suite the runner cancels ending its
// inner run.
//
// Layer: unit; the meter's two tests are processes. World: a temp folder
// holding a tiny suite and the npm script's log folder.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const { headerOf, readLog, report, main } = require('./budget-report.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const METER = path.join(__dirname, 'cpu-meter.cjs');

describe('a suite\'s header', () => {
  it('names its layer as `Layer: <name>`, or as `<Name> layer` across its lines', () => {
    assert.deepStrictEqual(headerOf('tests/scripts/test-a.cjs', "'use strict';\n\n// The ledger.\n//\n// Layer: verb. World: the fixture.\n\nrequire('x');\n"),
      { layer: 'verb', own: null });
    assert.deepStrictEqual(headerOf('tests/scripts/test-a.cjs', '// -----\n// The worktree. Git\n// layer: the task worktree world.\n// -----\n'),
      { layer: 'git', own: null });
  });

  it('gives a migration\'s and a simulation\'s suite its layer by its file name, and any other none', () => {
    const none = '// The render.\n';
    assert.strictEqual(headerOf('tests/scripts/test-migration-078.cjs', none).layer, 'migration');
    assert.strictEqual(headerOf('tests/scripts/test-pipeline-simulation-review.cjs', none).layer, 'simulation');
    assert.strictEqual(headerOf('tests/scripts/test-render.cjs', none).layer, null);
    assert.strictEqual(headerOf('tests/scripts/test-render.cjs', '// The render, in its own layer.\n').layer, null);
  });

  it('reads only the leading comment block', () => {
    assert.strictEqual(headerOf('tests/scripts/test-a.cjs', "// The render.\n\nconst a = 1;\n// Layer: verb.\n").layer, null);
  });

  it('names a budget of its own with its reason', () => {
    const source = '// Layer: conformance.\n// Budget: 45 s — every row runs on both drivers, the host\'s\n// among them. World: the matrix.\n';
    assert.deepStrictEqual(headerOf('tests/scripts/test-a.cjs', source),
      { layer: 'conformance', own: { s: 45, why: 'every row runs on both drivers, the host\'s among them' } });
  });
});

describe('the meter\'s log', () => {
  it('keeps each suite\'s last line and passes over a torn one', () => {
    const log = [
      '{"suite":"a.cjs","cpu":1.5,"user":1,"sys":0.5,"status":0}',
      '{"suite":"b.cjs","cpu":2,"user":1,"sys":1,"status":0}',
      '{"suite":"a.cjs","cpu":3.25,"user":2,"sys":1.25,"status":1}',
      '{"suite":"c.cjs","cp',
    ].join('\n');
    assert.deepStrictEqual([...readLog(log)], [['a.cjs', 3.25], ['b.cjs', 2]]);
  });
});

/** @type {Record<string, ReturnType<typeof headerOf>>} */
const HEADERS = {
  'verb-over.cjs': { layer: 'verb', own: null },
  'git-over.cjs': { layer: 'git', own: null },
  'unit-ok.cjs': { layer: 'unit', own: null },
  'own-over.cjs': { layer: 'git', own: { s: 45, why: 'the matrix runs both drivers' } },
  'own-held.cjs': { layer: 'git', own: { s: 45, why: 'two clones a row' } },
};
const header = (/** @type {string} */ suite) => HEADERS[suite] ?? { layer: null, own: null };
const RUN = new Map([
  ['verb-over.cjs', 27.3], ['git-over.cjs', 32.6], ['unit-ok.cjs', 0.4], ['own-over.cjs', 50],
  ['own-held.cjs', 40], ['none-1.cjs', 12], ['none-2.cjs', 3],
]);

describe('the report', () => {
  it('sets the run\'s CPU against the guide, the idle time its CPU over the cores or its longest suite, whichever is more', () => {
    assert.strictEqual(report(RUN, header)[0],
      "test budget (CPU, user + sys): 7 suites, 165 s in all — about 0.8 min on an idle machine against 6 min (3060 s of CPU at 8.5 cores' worth)");
    assert.strictEqual(report(new Map([['a.cjs', 1020], ['b.cjs', 1020]]), header)[0],
      "test budget (CPU, user + sys): 2 suites, 2040 s in all — about 17.0 min on an idle machine against 6 min (3060 s of CPU at 8.5 cores' worth)");
  });

  it('lists the suites over their budget worst first, the ones held within their own budget with its reason, and the ones with no layer', () => {
    assert.deepStrictEqual(report(RUN, header).slice(1), [
      'over their budget: 3',
      '     27.3 s    15 s verb          verb-over.cjs',
      '     50.0 s    45 s own           own-over.cjs — the matrix runs both drivers',
      '     32.6 s    30 s git           git-over.cjs',
      "over their layer's budget, within their own: 1",
      '     40.0 s    45 s own           own-held.cjs — two clones a row',
      'no layer named in the header, so no budget: 2 suites, 15 s',
      '     12.0 s  none-1.cjs',
      '      3.0 s  none-2.cjs',
    ]);
  });

  it('shows ten of a list, and every one with --all', () => {
    const run = new Map(Array.from({ length: 12 }, (_, at) => [`none-${String(at).padStart(2, '0')}.cjs`, 12 - at]));
    const listed = (/** @type {string[]} */ lines) => lines.filter((line) => /none-\d+\.cjs$/.test(line)).length;
    assert.strictEqual(listed(report(run, header)), 10);
    assert.strictEqual(report(run, header).at(-1), '  and 2 more (--all lists them)');
    assert.strictEqual(listed(report(run, header, { all: true })), 12);
  });

  it('names the suites new since the previous run, and those grown by more than a fifth and 2 s, most grown first', () => {
    const prev = new Map([
      ['verb-over.cjs', 20], ['git-over.cjs', 27.2], ['unit-ok.cjs', 0.1], ['own-over.cjs', 50], ['own-held.cjs', 40], ['none-1.cjs', 12],
    ]);
    assert.deepStrictEqual(report(RUN, header, { prev }).slice(-3), [
      'since the previous run: 149 s -> 165 s; new or grown: 2',
      '     27.3 s  was 20.0 s    verb-over.cjs',
      '      3.0 s  new           none-2.cjs',
    ]);
  });

  it('answers, never throws, where the log is missing or cannot be read', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-report-'));
    try {
      assert.deepStrictEqual(main([path.join(dir, 'cpu.jsonl')]), [`test budget: no CPU log at ${path.join(dir, 'cpu.jsonl')}`]);
      assert.match(main([dir])[0], /^test budget: no report — /);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

/** CPU seconds the tiny suite's child spends, which the suite's own process never sees. */
const BURN = 0.25;

/** A temp folder laid out as a checkout: the report linked in, and a suite at `tests/<name>`. @param {string} name @param {string} source */
function checkout(name, source) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'budget-meter-')));
  fs.mkdirSync(path.join(dir, 'tests', 'scripts'), { recursive: true });
  fs.symlinkSync(path.join(__dirname, 'budget-report.cjs'), path.join(dir, 'tests', 'scripts', 'budget-report.cjs'));
  fs.writeFileSync(path.join(dir, 'tests', name), `'use strict';\n\n// Layer: unit.\n\nrequire(${JSON.stringify(METER)});\n${source}`);
  return dir;
}

/** Polls `done` until it holds, at most `tries` times. @param {() => boolean} done @param {number} tries */
async function until(done, tries) {
  for (let n = 0; n < tries && !done(); n += 1) await new Promise((resolve) => { setTimeout(resolve, 50); });
  return done();
}

describe('the meter', () => {
  it('logs a suite\'s CPU with its child\'s, keeps the previous log, and ends the npm script with the run\'s status after the report', () => {
    const burn = `const t = process.cpuUsage(); while (process.cpuUsage(t).user + process.cpuUsage(t).system < ${BURN * 1e6});`;
    const dir = checkout('test-burn.cjs', [
      "const fs = require('fs');",
      "const { it } = require('node:test');",
      "const { spawnSync } = require('child_process');",
      `it('burns', () => { spawnSync(process.execPath, ['-e', ${JSON.stringify(burn)}]); });`,
      "it('fails', () => { throw new Error('the suite fails'); });",
      "process.on('exit', () => { const own = process.cpuUsage(); fs.writeFileSync('own.json', JSON.stringify((own.user + own.system) / 1e6)); });",
      '',
    ].join('\n'));
    const before = '{"suite":"tests/test-old.cjs","cpu":1,"user":1,"sys":0,"status":0}\n';
    try {
      fs.mkdirSync(path.join(dir, 'tests', '.cache'));
      fs.writeFileSync(path.join(dir, 'tests', '.cache', 'cpu.jsonl'), before);
      const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts.test
        .replace(/(^|[\s;&|])node --test [^;&|]+/, '$1node --test tests/test-burn.cjs');
      // The runner this suite runs under marks its children; the script's own runner must not read as one.
      const env = { ...process.env };
      delete env.NODE_TEST_CONTEXT;
      const run = spawnSync('sh', ['-c', script], { cwd: dir, env, encoding: 'utf8', timeout: 60_000 });

      assert.strictEqual(run.status, 1);
      assert.match(run.stdout, /the suite fails/);
      assert.match(run.stdout, /\ntest budget \(CPU, user \+ sys\): 1 suites, .*\nover their budget: 0\nsince the previous run: 1 s -> .* s; new or grown: 1\n/);
      assert.strictEqual(fs.readFileSync(path.join(dir, 'tests', '.cache', 'cpu.prev.jsonl'), 'utf8'), before);
      const lines = fs.readFileSync(path.join(dir, 'tests', '.cache', 'cpu.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
      assert.strictEqual(lines.length, 1);
      const [line] = lines;
      assert.deepStrictEqual(Object.keys(line), ['suite', 'cpu', 'user', 'sys', 'status']);
      assert.deepStrictEqual([line.suite, line.status], [path.relative(ROOT, path.join(dir, 'tests', 'test-burn.cjs')), 1]);
      assert.strictEqual(line.cpu, Number((line.user + line.sys).toFixed(2)));
      const own = JSON.parse(fs.readFileSync(path.join(dir, 'own.json'), 'utf8'));
      assert.ok(own < BURN && line.cpu >= own + BURN, `the suite's own ${own} s and its run's ${line.cpu} s`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ends the inner run when the runner cancels the metered suite', async () => {
    const dir = checkout('test-wait.cjs', "require('fs').writeFileSync('inner.pid', String(process.pid));\nsetInterval(() => {}, 1000);\n");
    const pidFile = path.join(dir, 'inner.pid');
    const outer = spawn(process.execPath, [path.join(dir, 'tests', 'test-wait.cjs')], {
      cwd: dir, stdio: 'ignore', env: { ...process.env, LEEWAY_TEST_CPU_LOG: path.join(dir, 'cpu.jsonl') },
    });
    const exited = new Promise((resolve) => { outer.on('exit', (_, signal) => resolve(signal)); });
    let inner = 0;
    const running = (/** @type {number} */ pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    try {
      assert.ok(await until(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8') !== '', 200), 'the inner run started');
      inner = Number(fs.readFileSync(pidFile, 'utf8'));
      assert.notStrictEqual(inner, outer.pid);
      outer.kill('SIGTERM');
      assert.strictEqual(await exited, 'SIGTERM');
      assert.ok(await until(() => !running(inner), 100), 'the inner run ended');
    } finally {
      outer.kill('SIGKILL');
      if (inner && running(inner)) process.kill(inner, 'SIGKILL');
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
