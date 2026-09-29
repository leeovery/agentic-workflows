'use strict';

// The verdict store: where an orchestrator records a case's final verdict,
// so the verdict reaches the collation even when the orchestrator's one
// hand-back was spent on a placeholder. A stale verdict read as this run's,
// a missing one read as anything but missing, or half a verdict read whole
// would each report a result no walk produced.

require('./hermetic-env.cjs');

const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const verdicts = require('../prose/lib/verdicts.cjs');

// Ids no case can carry — `_`-prefixed directories under cases/ are never
// cases — so the store's real entries are never touched. The sweep takes a
// failed run's scraps too, so one red run never reddens the next.
const SCRATCH = '_scratch-verdict-';
const scratch = (name) => `${SCRATCH}${name}`;

afterEach(() => {
  if (!fs.existsSync(verdicts.VERDICTS_DIR)) return;
  for (const f of fs.readdirSync(verdicts.VERDICTS_DIR)) {
    if (f.startsWith(SCRATCH)) fs.rmSync(path.join(verdicts.VERDICTS_DIR, f), { force: true });
  }
});

const PASS = 'CASE: x\nVERDICT: PASS\n';
const FAIL = 'CASE: x\nVERDICT: FAIL\n';

describe('the verdict store', () => {
  it('reads back what was recorded, byte for byte', () => {
    const id = scratch('read-back');
    verdicts.recordVerdict(id, PASS);
    assert.strictEqual(verdicts.readVerdict(id), PASS);
  });

  it('keeps only the latest verdict a case recorded', () => {
    const id = scratch('overwrite');
    verdicts.recordVerdict(id, 'placeholder\n');
    verdicts.recordVerdict(id, FAIL);
    assert.strictEqual(verdicts.readVerdict(id), FAIL);
  });

  it('clears each named case, and clearing a case with none is no error', () => {
    const a = scratch('clear-a');
    const b = scratch('clear-b');
    const kept = scratch('clear-kept');
    verdicts.recordVerdict(a, PASS);
    verdicts.recordVerdict(b, FAIL);
    verdicts.recordVerdict(kept, PASS);
    verdicts.clearVerdicts([a, b, scratch('clear-never')]);
    assert.strictEqual(verdicts.readVerdict(a), null);
    assert.strictEqual(verdicts.readVerdict(b), null);
    assert.strictEqual(verdicts.readVerdict(kept), PASS, 'a case not named keeps its verdict');
  });

  it('reports each case in the order named, under its own marker, and says so where none is recorded', () => {
    const later = scratch('zz-recorded');
    const missing = scratch('aa-missing');
    verdicts.recordVerdict(later, PASS);
    assert.strictEqual(verdicts.reportVerdicts([later, missing]),
      `=== ${later} ===\nCASE: x\nVERDICT: PASS\n\n`
      + `=== ${missing} ===\nNO VERDICT RECORDED — the orchestrator died or never recorded one.\n`);
  });

  it('a write that dies part-way leaves the earlier verdict whole and no scrap beside it', () => {
    const id = scratch('atomic');
    verdicts.recordVerdict(id, PASS);
    const write = fs.writeFileSync;
    fs.writeFileSync = (file, data, ...rest) => {
      write(file, String(data).slice(0, 6), ...rest);
      throw new Error('disk full');
    };
    try {
      assert.throws(() => verdicts.recordVerdict(id, FAIL), /disk full/);
    } finally {
      fs.writeFileSync = write;
    }
    assert.strictEqual(verdicts.readVerdict(id), PASS);
    assert.deepStrictEqual(fs.readdirSync(verdicts.VERDICTS_DIR).filter((f) => f.startsWith(id)), [`${id}.md`]);
  });
});

describe('run.cjs verdict / verdicts', () => {
  // The store's writes are covered above against scratch ids; the runner
  // takes real case ids only, so here it is driven through its refusals and
  // its read. Every refusal names a case that does not exist, so a guard
  // that stops holding meets the case check and writes nothing.
  const CASE = 'start-lists-active-work';
  const NONE = 'no-such-case';
  const RUN = path.join(__dirname, '..', 'prose', 'run.cjs');
  const run = (args) => execFileSync('node', [RUN, ...args], { encoding: 'utf8', stdio: 'pipe' });
  const refusal = (args) => {
    try { run(args); } catch (e) { return String(e.stderr); }
    return null;
  };

  it('refuses a record with no verdict to take — no file, a missing file, an empty file — or for no case', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prose-verdict-'));
    try {
      const empty = path.join(dir, 'empty.md');
      const verdict = path.join(dir, 'verdict.md');
      fs.writeFileSync(empty, ' \n');
      fs.writeFileSync(verdict, PASS);
      assert.match(refusal(['verdict', NONE]), /usage: verdict <case-id> --file <path>/);
      assert.match(refusal(['verdict', NONE, '--file', path.join(dir, 'absent.md')]), /no verdict file at/);
      assert.match(refusal(['verdict', NONE, '--file', empty]), /is empty — there is no verdict to record/);
      assert.match(refusal(['verdict', NONE, '--file', verdict]), /no case "no-such-case"/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses a read or a reset naming no case, or a case that does not exist', () => {
    assert.match(refusal(['verdicts']), /usage: verdicts \[--reset\] <case-id…>/);
    assert.match(refusal(['verdicts', '--reset']), /usage: verdicts \[--reset\] <case-id…>/);
    assert.match(refusal(['verdicts', CASE, NONE]), /no case "no-such-case"/);
    assert.match(refusal(['verdicts', '--reset', NONE]), /no case "no-such-case"/);
  });

  it('reads a real case under its marker', () => {
    assert.ok(run(['verdicts', CASE]).startsWith(`=== ${CASE} ===\n`));
  });
});
