'use strict';

// Deterministic checks over a walk's recorded actions.
//
// These are the assertions no agent makes, so they are the ones that
// cannot drift between runs. What they mainly buy is skip-detection: a
// walker that ignored the prose and wrote the expected files directly
// produces the right world, and only the order of what it did gives it
// away.

const { describe, it } = require('node:test');
const assert = require('node:assert');

const invariants = require('../prose/lib/invariants.cjs');

const ENGINE = 'cd . && node .claude/skills/workflow-engine/scripts/engine.cjs';

/** Rows in the shape worlds.readActionRows produces. */
const bash = (detail) => ({ event: 'PreToolUse', tool: 'Bash', detail });
const wrote = (detail) => ({ event: 'PreToolUse', tool: 'Write', detail });
const read = (detail) => ({ event: 'PreToolUse', tool: 'Read', detail });

const verdicts = (results) => Object.fromEntries(results.map((r) => [r.name, r.ok]));

describe('engine_before_write — the skip-to-the-end detector', () => {
  const declared = { engine_before_write: true };

  it('passes a walk that consulted the engine before writing state', () => {
    const rows = [
      read('./.claude/skills/workflow-implementation-process/SKILL.md'),
      bash(`${ENGINE} task init pay pay`),
      wrote('./.workflows/.state/environment-setup.md'),
    ];
    assert.equal(invariants.check(rows, declared)[0].ok, true);
  });

  it('fails a walk that wrote workflow state having never called the engine', () => {
    const rows = [
      read('./.claude/skills/workflow-implementation-process/SKILL.md'),
      wrote('./.workflows/pay/discussion/pay.md'),
    ];
    const [result] = invariants.check(rows, declared);
    assert.equal(result.ok, false);
    assert.match(result.detail, /never called the engine/);
  });

  it('fails a walk that wrote first and called the engine afterwards', () => {
    const rows = [
      wrote('./.workflows/pay/discussion/pay.md'),
      bash(`${ENGINE} discussion-map set pay pay x decided`),
    ];
    const [result] = invariants.check(rows, declared);
    assert.equal(result.ok, false);
    assert.match(result.detail, /before any engine call/);
  });

  it('passes a read-only walk, which writes no state to justify', () => {
    const rows = [read('./.claude/skills/workflow-start/SKILL.md'), bash(`${ENGINE} boot`)];
    assert.equal(invariants.check(rows, declared)[0].ok, true);
  });

  it('ignores writes outside .workflows — a walk may touch a scratch file', () => {
    const rows = [wrote('./notes.txt')];
    assert.equal(invariants.check(rows, declared)[0].ok, true);
  });

  it('counts a shell redirect as a write — a walker reaches for it readily', () => {
    // Observed live: an Opus walk created the setup document with printf
    // rather than the Write tool, and a tool-only check reported that
    // nothing had been written at all.
    const rows = [
      bash("cd . && mkdir -p .workflows/.state && printf 'No special setup required.\n' > .workflows/.state/environment-setup.md"),
    ];
    const [result] = invariants.check(rows, declared);
    assert.equal(result.ok, false);
    assert.match(result.detail, /never called the engine/);
  });

  it('counts tee, cp and mv into the workflow directory', () => {
    for (const command of [
      'cd . && echo x | tee .workflows/a.md',
      'cd . && cp /tmp/a.md .workflows/a.md',
      'cd . && mv /tmp/a.md .workflows/a.md',
    ]) {
      assert.equal(invariants.check([bash(command)], declared)[0].ok, false, command);
    }
  });

  it('does not mistake reading workflow state for writing it', () => {
    const rows = [
      bash('cd . && cat .workflows/pay/manifest.json 2>&1'),
      bash('cd . && grep -r pay .workflows/ | head -5'),
    ];
    assert.equal(invariants.check(rows, declared)[0].ok, true);
  });

  it('does not let a redirect elsewhere in a compound command count', () => {
    const rows = [bash('cd . && cat notes.md > /tmp/out.txt && ls .workflows/')];
    assert.equal(invariants.check(rows, declared)[0].ok, true);
  });

  it('counts a gateway call as consulting state, as the prose does', () => {
    const rows = [
      bash('cd . && node .claude/skills/workflow-start/scripts/gateway.cjs view'),
      wrote('./.workflows/pay/manifest.json'),
    ];
    assert.equal(invariants.check(rows, declared)[0].ok, true);
  });
});

describe('calls_include / calls_exclude', () => {
  it('fails when a command the case requires never ran', () => {
    const rows = [bash(`${ENGINE} boot`)];
    const [result] = invariants.check(rows, { calls_include: ['task init', 'boot'] });
    assert.equal(result.ok, false);
    assert.match(result.detail, /never ran: task init/);
    assert.ok(!result.detail.includes('boot,'), 'and names only what is missing');
  });

  it('passes when every required command ran', () => {
    const rows = [bash(`${ENGINE} task init pay pay`), bash(`${ENGINE} boot`)];
    assert.equal(invariants.check(rows, { calls_include: ['task init', 'boot'] })[0].ok, true);
  });

  it('fails when a forbidden command ran — the walk went too far', () => {
    const rows = [bash(`${ENGINE} task init pay pay`), bash(`${ENGINE} task start pay pay`)];
    const [result] = invariants.check(rows, { calls_exclude: ['task start'] });
    assert.equal(result.ok, false);
    assert.match(result.detail, /task start/);
  });

  it('passes when no forbidden command ran', () => {
    const rows = [bash(`${ENGINE} task init pay pay`)];
    assert.equal(invariants.check(rows, { calls_exclude: ['task start'] })[0].ok, true);
  });

  it('reads commands only — a file whose name matches is not a call', () => {
    const rows = [read('./.claude/skills/workflow-engine/task-start-notes.md')];
    assert.equal(invariants.check(rows, { calls_exclude: ['task start'] })[0].ok, true);
    assert.equal(invariants.check(rows, { calls_include: ['task start'] })[0].ok, false);
  });

  it('matches through quotes — quoting a dotpath is style, not a different call', () => {
    const rows = [
      bash(`${ENGINE} manifest get 'wu.discovery.topic' brief_path`),
      bash(`${ENGINE} manifest set "wu.discovery.topic" brief_incorporated true`),
    ];
    const declared = {
      calls_include: [
        'manifest get wu.discovery.topic brief_path',
        'manifest set wu.discovery.topic brief_incorporated true',
      ],
    };
    assert.equal(invariants.check(rows, declared)[0].ok, true);
  });

  it('a quoted needle matches an unquoted command the same way', () => {
    const rows = [bash(`${ENGINE} manifest get wu.research.* status`)];
    assert.equal(invariants.check(rows, { calls_include: ["manifest get 'wu.research.*' status"] })[0].ok, true);
  });

  it('quoting cannot hide a forbidden command from exclude', () => {
    const rows = [bash(`${ENGINE} topic start 'wu' research 'topic'`)];
    const [result] = invariants.check(rows, { calls_exclude: ['topic start wu research topic'] });
    assert.equal(result.ok, false);
  });
});

describe('calls_in_order — presence is not sequence', () => {
  it('passes when the declared calls appear in sequence', () => {
    const rows = [
      bash(`${ENGINE} render entry-gate pay.planning.pay`),
      bash(`${ENGINE} manifest list`),
      bash('cd . && node .claude/skills/workflow-knowledge/scripts/knowledge.cjs query x'),
    ];
    const [result] = invariants.check(rows, {
      calls_in_order: ['render entry-gate pay.planning.pay', 'knowledge.cjs query'],
    });
    assert.equal(result.ok, true);
  });

  it('fails when they ran in the wrong order — the arm was chosen some other way', () => {
    const rows = [
      bash('cd . && node .claude/skills/workflow-knowledge/scripts/knowledge.cjs query x'),
      bash(`${ENGINE} render entry-gate pay.planning.pay`),
    ];
    const [result] = invariants.check(rows, {
      calls_in_order: ['render entry-gate pay.planning.pay', 'knowledge.cjs query'],
    });
    assert.equal(result.ok, false);
    assert.match(result.detail, /"knowledge.cjs query" never ran after "render entry-gate/);
  });

  it('matches the sequence through quoting differences', () => {
    const rows = [
      bash(`${ENGINE} manifest get 'wu.research.topic' status`),
      bash(`${ENGINE} topic start wu research topic`),
    ];
    const declared = { calls_in_order: ['manifest get wu.research.topic status', 'topic start wu research topic'] };
    assert.equal(invariants.check(rows, declared)[0].ok, true);
  });

  it('tolerates other calls falling between them', () => {
    const rows = [bash(`${ENGINE} a`), bash(`${ENGINE} unrelated`), bash(`${ENGINE} b`)];
    assert.equal(invariants.check(rows, { calls_in_order: ['a', 'b'] })[0].ok, true);
  });

  it('fails when a declared call never ran at all', () => {
    const rows = [bash(`${ENGINE} a`)];
    const [result] = invariants.check(rows, { calls_in_order: ['a', 'b'] });
    assert.equal(result.ok, false);
    assert.match(result.detail, /"b" never ran after "a"/);
  });

  it('needs two commands to mean anything', () => {
    assert.match(invariants.declarationErrors({ calls_in_order: ['a'] })[0], /at least two/);
  });
});

describe('a check that could not fail says so', () => {
  it('reports N/A, not PASS, when nothing was written to examine', () => {
    const out = invariants.format(
      invariants.check([bash(`${ENGINE} boot`)], { engine_before_write: true }),
    );
    assert.match(out, /^N\/A {3}engine_before_write/);  // padded to align with PASS/FAIL
    assert.ok(!out.includes('PASS'), 'absence of coverage must not read as coverage');
  });

  it('still reports PASS when it genuinely had something to check', () => {
    const rows = [bash(`${ENGINE} task init pay pay`), wrote('./.workflows/a.md')];
    const out = invariants.format(invariants.check(rows, { engine_before_write: true }));
    assert.match(out, /^PASS {2}engine_before_write/);
  });
});

describe('declaration', () => {
  it('runs every declared check, and only those', () => {
    const rows = [bash(`${ENGINE} boot`)];
    const results = invariants.check(rows, { engine_before_write: true, calls_include: ['boot'] });
    assert.deepEqual(verdicts(results), { engine_before_write: true, calls_include: true });
  });

  it('runs nothing when a case declares nothing', () => {
    assert.deepEqual(invariants.check([bash('x')], null), []);
    assert.deepEqual(invariants.check([bash('x')], {}), []);
  });

  it('skips a check switched off rather than treating it as declared', () => {
    assert.deepEqual(invariants.check([bash('x')], { engine_before_write: false }), []);
  });

  it('formats verdicts computed-first, so they read as facts', () => {
    const out = invariants.format(invariants.check([wrote('./.workflows/a.md')], { engine_before_write: true }));
    assert.match(out, /^FAIL {2}engine_before_write — /);
  });

  it('formats nothing when there is nothing to report', () => {
    assert.equal(invariants.format([]), null);
  });
});

describe('declaration validation', () => {
  it('accepts an absent declaration', () => {
    assert.deepEqual(invariants.declarationErrors(undefined), []);
    assert.deepEqual(invariants.declarationErrors(null), []);
  });

  it('rejects an unknown check, which would otherwise pass silently', () => {
    const errors = invariants.declarationErrors({ calls_includes: ['x'] });
    assert.equal(errors.length, 1);
    assert.match(errors[0], /unknown invariant "calls_includes"/);
  });

  it('rejects the wrong type for each known check', () => {
    assert.match(invariants.declarationErrors({ engine_before_write: 'yes' })[0], /true or false/);
    assert.match(invariants.declarationErrors({ calls_include: 'task init' })[0], /array of non-empty strings/);
    assert.match(invariants.declarationErrors({ calls_exclude: [''] })[0], /array of non-empty strings/);
  });

  it('rejects a declaration that is not an object', () => {
    assert.match(invariants.declarationErrors(['engine_before_write'])[0], /must be an object/);
  });
});

describe('entry points — where a walk may begin', () => {
  const cases = require('../prose/lib/cases.cjs');

  it('accepts the user entry point', () => {
    assert.deepEqual(cases.entryErrors('workflow-start'), []);
  });

  it('accepts an entry skill, which a bridge plan invokes after a context clear', () => {
    assert.deepEqual(cases.entryErrors('workflow-implementation-entry'), []);
    assert.deepEqual(cases.entryErrors('workflow-specification-entry'), []);
  });

  it('accepts discovery, the one continuation that is not an entry skill', () => {
    assert.deepEqual(cases.entryErrors('workflow-discovery'), []);
  });

  it('rejects a navigation skill — always invoked by workflow-start, never cold', () => {
    const [error] = cases.entryErrors('workflow-continue-feature');
    assert.match(error, /not somewhere a session starts/);
  });

  it('rejects a processing skill — always invoked by its entry skill', () => {
    assert.match(cases.entryErrors('workflow-discussion-process')[0], /not somewhere a session starts/);
  });

  it('rejects a reference, which is never entered directly', () => {
    assert.match(cases.entryErrors('root-cause-validation.md')[0], /not somewhere a session starts/);
  });

  it('rejects a plausible name that is not a skill on disk', () => {
    assert.match(cases.entryErrors('workflow-imaginary-entry')[0], /not a skill in skills\//);
  });

  it('requires one at all', () => {
    assert.match(cases.entryErrors(null)[0], /has no entry/);
  });

  it('holds for the live corpus', () => {
    assert.deepEqual(cases.validateCorpus(cases.loadAllCases()), []);
  });
});

describe('undeclared prose — the case list against what the walk opened', () => {
  const rd = (detail) => ({ event: 'PreToolUse', tool: 'Read', detail });

  it('names prose the walk opened that the case never declared', () => {
    const rows = [
      rd('./.claude/skills/workflow-specification-entry/SKILL.md'),
      rd('./.claude/skills/workflow-specification-entry/references/validate-phase.md'),
    ];
    assert.deepEqual(
      invariants.undeclaredProse(rows, ['skills/workflow-specification-entry/SKILL.md']),
      ['skills/workflow-specification-entry/references/validate-phase.md'],
    );
  });

  it('is quiet when the list already covers the walk', () => {
    const rows = [rd('./.claude/skills/workflow-review-entry/SKILL.md')];
    assert.deepEqual(invariants.undeclaredProse(rows, ['skills/workflow-review-entry/SKILL.md']), []);
  });

  it('ignores files that are not prose — a walk reads world state too', () => {
    const rows = [rd('./.workflows/pay/manifest.json'), rd('./.workflows/pay/discussion/pay.md')];
    assert.deepEqual(invariants.undeclaredProse(rows, []), []);
  });

  it('ignores commands — only what was opened counts', () => {
    const rows = [bash('cd . && cat .claude/skills/workflow-start/SKILL.md')];
    assert.deepEqual(invariants.undeclaredProse(rows, []), []);
  });

  it('reports each file once however often it was reopened', () => {
    const f = './.claude/skills/workflow-start/references/active-work.md';
    assert.deepEqual(invariants.undeclaredProse([rd(f), rd(f)], []),
      ['skills/workflow-start/references/active-work.md']);
  });
});
