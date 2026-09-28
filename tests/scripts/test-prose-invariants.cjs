'use strict';

// Deterministic checks over a walk's recorded actions.
//
// These are the assertions no agent makes, so they are the ones that
// cannot drift between runs. What they mainly buy is skip-detection: a
// walker that ignored the prose and wrote the expected files directly
// produces the right world, and only the order of what it did gives it
// away.

require('./hermetic-env.cjs');

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

  it('does not let a heredoc body that names workflow state count as a write into it', () => {
    const rows = [bash("cd . && cat > /tmp/notes.txt << 'EOF' see .workflows/pay/manifest.json EOF")];
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

  it('says unproven, not never-ran, when the record was clipped', () => {
    // Measured: a two-seed promotion recorded past the detail cap lost its
    // second --seed, and the check reported never-ran on a call whose own
    // response listed both seeds landed. The cut falls on the tail, which
    // is where a command's distinguishing flags live.
    const rows = [bash(`${ENGINE} workunit create saved-filters feature --seed .workflows/.inbox/idea…[truncated]`)];
    const [result] = invariants.check(rows, { calls_include: ['--seed .workflows/.inbox/ideas/b.md'] });
    assert.equal(result.ok, false, 'still not a pass — the record cannot answer');
    assert.match(result.detail, /unproven/, 'named as unanswered');
    assert.ok(!result.detail.includes('never ran'), 'never asserts a walk omission it cannot see');
    assert.match(result.detail, /1 clipped row/, 'points at how much of the record is unreadable');
  });

  it('still says never-ran when the record is whole', () => {
    // The clipped branch must not swallow real omissions: no marker
    // anywhere means absence is absence.
    const rows = [bash(`${ENGINE} boot`)];
    const [result] = invariants.check(rows, { calls_include: ['task init'] });
    assert.match(result.detail, /never ran: task init/);
    assert.ok(!result.detail.includes('unproven'));
  });

  it('does not count a grep argument as the call it names', () => {
    // Measured: a walk grepped the repo to orient — the string appeared
    // only inside the search pattern — and calls_exclude reported it as
    // run. Quotes are stripped on both sides of a match, so the argument
    // and the invocation look identical.
    const rows = [bash('cd . && grep -rl "topic triage" .claude/skills')];
    const [result] = invariants.check(rows, { calls_exclude: ['topic triage'] });
    assert.equal(result.ok, true, 'searching for a call is not running it');
  });

  it('still sees a real call in a statement alongside a search', () => {
    const rows = [bash(`grep -n triage docs.md && ${ENGINE} topic triage pay discussion pay`)];
    const [result] = invariants.check(rows, { calls_exclude: ['topic triage'] });
    assert.equal(result.ok, false, 'the engine call is still there to find');
  });

  it('keeps a command that merely pipes into a search', () => {
    // The head of the pipeline ran; only whole search statements go.
    const rows = [bash(`${ENGINE} task init pay pay | grep ok`)];
    assert.equal(invariants.check(rows, { calls_include: ['task init'] })[0].ok, true);
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

describe('manifest set — a field and its value, either form', () => {
  it('a positional needle matches the batch form a walk ran, and the reverse', () => {
    const rows = [
      bash(`${ENGINE} manifest set pay.planning.pay review_cycle=2`),
      bash(`${ENGINE} manifest set pay.planning.pay finding_gate_mode auto`),
      bash(`${ENGINE} manifest set pay.planning.pay "tracking.review-integrity-tracking-c1"=in-progress`),
    ];
    const declared = {
      calls_include: [
        'manifest set pay.planning.pay review_cycle 2',
        'finding_gate_mode=auto',
        'tracking.review-integrity-tracking-c1 in-progress',
      ],
    };
    assert.equal(invariants.check(rows, declared)[0].ok, true);
  });

  it('neither form hides a forbidden write from exclude', () => {
    const rows = [bash(`${ENGINE} manifest set pay.planning.pay review_cycle=1 review_baseline_words=412`)];
    assert.equal(invariants.check(rows, { calls_exclude: ['manifest set pay.planning.pay review_cycle 1'] })[0].ok, false);
  });

  it('a needle naming a field alone, `field=`, matches whatever value the command computed', () => {
    const rows = [bash(`${ENGINE} manifest set pay.specification.pay review_cycle=1 review_baseline_words=$(wc -w < spec.md)`)];
    assert.equal(invariants.check(rows, { calls_include: ['review_baseline_words='] })[0].ok, true);
  });

  it('still tells one value from another', () => {
    const rows = [bash(`${ENGINE} manifest set pay.planning.pay review_cycle=1`)];
    assert.equal(invariants.check(rows, { calls_include: ['manifest set pay.planning.pay review_cycle 2'] })[0].ok, false);
  });
});

describe('calls_in_order — presence is not sequence', () => {
  it('passes when the declared calls appear in sequence', () => {
    const rows = [
      bash(`${ENGINE} render entry-gate pay.planning.pay`),
      bash(`${ENGINE} manifest list`),
      bash(`${ENGINE} knowledge query x`),
    ];
    const [result] = invariants.check(rows, {
      calls_in_order: ['render entry-gate pay.planning.pay', 'engine.cjs knowledge query'],
    });
    assert.equal(result.ok, true);
  });

  it('fails when they ran in the wrong order — the arm was chosen some other way', () => {
    const rows = [
      bash(`${ENGINE} knowledge query x`),
      bash(`${ENGINE} render entry-gate pay.planning.pay`),
    ];
    const [result] = invariants.check(rows, {
      calls_in_order: ['render entry-gate pay.planning.pay', 'engine.cjs knowledge query'],
    });
    assert.equal(result.ok, false);
    assert.match(result.detail, /"engine.cjs knowledge query" never ran after "render entry-gate/);
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

  it('orders a write: token against the calls around it', () => {
    const rows = [
      bash(`${ENGINE} topic start pay discussion pay`),
      wrote('./.workflows/pay/discussion/pay.md'),
      bash(`${ENGINE} commit pay -m "discussion(pay): initialize pay discussion"`),
    ];
    const [result] = invariants.check(rows, {
      calls_in_order: [
        'topic start pay discussion pay',
        'write:.workflows/pay/discussion/pay.md',
        'discussion(pay): initialize pay discussion',
      ],
    });
    assert.equal(result.ok, true);
  });

  it('fails when the artifact was written before the registration it must follow', () => {
    const rows = [
      wrote('./.workflows/pay/discussion/pay.md'),
      bash(`${ENGINE} topic start pay discussion pay`),
    ];
    const [result] = invariants.check(rows, {
      calls_in_order: ['topic start pay discussion pay', 'write:.workflows/pay/discussion/pay.md'],
    });
    assert.equal(result.ok, false);
    assert.match(result.detail, /first write landed before "topic start pay discussion pay"/);
  });

  it('never lets a later edit rescue a file created out of order — first write decides', () => {
    const rows = [
      wrote('./.workflows/pay/discussion/pay.md'),
      bash(`${ENGINE} topic start pay discussion pay`),
      wrote('./.workflows/pay/discussion/pay.md'),
    ];
    const [result] = invariants.check(rows, {
      calls_in_order: ['topic start pay discussion pay', 'write:.workflows/pay/discussion/pay.md'],
    });
    assert.equal(result.ok, false);
    assert.match(result.detail, /first write landed before/);
  });

  it('fails when the declared write never happened at all', () => {
    const rows = [bash(`${ENGINE} topic start pay discussion pay`)];
    const [result] = invariants.check(rows, {
      calls_in_order: ['topic start pay discussion pay', 'write:.workflows/pay/discussion/pay.md'],
    });
    assert.equal(result.ok, false);
    assert.match(result.detail, /never ran after/);
  });

  it('matches a write: token against a shell write, not only the write tools', () => {
    const rows = [
      bash(`${ENGINE} topic start pay discussion pay`),
      bash('cat template.md > ./.workflows/pay/discussion/pay.md'),
    ];
    const [result] = invariants.check(rows, {
      calls_in_order: ['topic start pay discussion pay', 'write:.workflows/pay/discussion/pay.md'],
    });
    assert.equal(result.ok, true);
  });

  it('never lets a heredoc body that names the path satisfy a write: token — the target decides', () => {
    // Observed live: the standards agent's findings file, written with
    // `cat > … << 'EOF'`, carried a FILES line naming the specification;
    // the recorder flattens the body onto the command's line, and the
    // token for the spec matched that record instead of the real edit.
    const rows = [
      bash(`${ENGINE} topic start pay discussion pay`),
      bash("cd . && cat > .workflows/pay/implementation/pay/analysis-standards-c1.txt << 'EOF' FINDING: x FILES: .workflows/pay/discussion/pay.md EOF mv .workflows/pay/implementation/pay/analysis-standards-c1.txt .workflows/pay/implementation/pay/analysis-standards-c1.md"),
      bash(`${ENGINE} manifest get pay.specification.pay status`),
      wrote('./.workflows/pay/discussion/pay.md'),
    ];
    const [result] = invariants.check(rows, {
      calls_in_order: [
        'topic start pay discussion pay',
        'manifest get pay.specification.pay status',
        'write:.workflows/pay/discussion/pay.md',
      ],
    });
    assert.equal(result.ok, true, result.detail);
  });

  it('counts the rename after a heredoc as the first write of its target', () => {
    // The .txt-then-rename mechanism: the file the case names exists only
    // once the mv lands, and that mv sits after the flattened body.
    const rows = [
      bash(`${ENGINE} topic start pay discussion pay`),
      bash("cd . && cat > .workflows/pay/discussion/pay.txt << 'EOF' body EOF mv .workflows/pay/discussion/pay.txt .workflows/pay/discussion/pay.md"),
    ];
    const [result] = invariants.check(rows, {
      calls_in_order: ['topic start pay discussion pay', 'write:.workflows/pay/discussion/pay.md'],
    });
    assert.equal(result.ok, true, result.detail);
  });

  it('never lets a Bash call that merely names the path satisfy a write: token', () => {
    const rows = [
      bash(`${ENGINE} topic start pay discussion pay`),
      bash('git add .workflows/pay/discussion/pay.md'),
    ];
    const [result] = invariants.check(rows, {
      calls_in_order: ['topic start pay discussion pay', 'write:.workflows/pay/discussion/pay.md'],
    });
    assert.equal(result.ok, false);
  });

  it('lets a compound Bash call satisfy consecutive entries in its own order', () => {
    // Observed live: the approval row and the gate-mode write, two calls
    // in the prose, issued as one `a && b` — they ran in that order.
    const rows = [
      bash(`${ENGINE} render proposed-task pay.implementation.pay --gate gated`),
      bash(`${ENGINE} manifest set pay.implementation.pay staging.c1.tasks.1 approved && ${ENGINE} manifest set pay.implementation.pay analysis_gate_mode auto`),
      bash(`${ENGINE} manifest push pay.implementation.pay consolidated_phases 2`),
    ];
    const [result] = invariants.check(rows, {
      calls_in_order: ['--gate gated', 'staging.c1.tasks.1 approved', 'analysis_gate_mode auto', 'consolidated_phases 2'],
    });
    assert.equal(result.ok, true, result.detail);
  });

  it('never lets a compound Bash call satisfy entries it ran reversed', () => {
    const rows = [
      bash(`${ENGINE} manifest set pay.implementation.pay analysis_gate_mode auto && ${ENGINE} manifest set pay.implementation.pay staging.c1.tasks.1 approved`),
    ];
    const [result] = invariants.check(rows, {
      calls_in_order: ['staging.c1.tasks.1 approved', 'analysis_gate_mode auto'],
    });
    assert.equal(result.ok, false);
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

  it('rejects write: tokens outside calls_in_order, where they could only mislead', () => {
    assert.match(
      invariants.declarationErrors({ calls_include: ['write:.workflows/pay/discussion/pay.md'] })[0],
      /cannot carry write: tokens/,
    );
    assert.match(
      invariants.declarationErrors({ calls_exclude: ['write:.workflows/pay/discussion/pay.md'] })[0],
      /cannot carry write: tokens/,
    );
  });

  it('rejects a calls_in_order entry that spans a statement separator', () => {
    const errors = invariants.declarationErrors({ calls_in_order: ['a && b', 'c'] });
    assert.match(errors[0], /cannot span a statement separator/);
  });

  it('rejects a write: token with no path', () => {
    const errors = invariants.declarationErrors({ calls_in_order: ['topic start', 'write:'] });
    assert.match(errors[0], /write: token needs a path/);
  });

  it('rejects dispatch: tokens outside calls_in_order, and one with no agent', () => {
    for (const key of ['calls_include', 'calls_exclude']) {
      assert.match(invariants.declarationErrors({ [key]: ['dispatch:reviewer'] })[0], /cannot carry dispatch: tokens/);
    }
    assert.match(invariants.declarationErrors({ calls_in_order: ['boot', 'dispatch:'] })[0], /dispatch: token needs an agent/);
    assert.deepEqual(invariants.declarationErrors({ calls_in_order: ['boot', 'dispatch:reviewer'] }), []);
  });

  it('rejects send: tokens outside calls_in_order, and one with no agent', () => {
    for (const key of ['calls_include', 'calls_exclude']) {
      assert.match(invariants.declarationErrors({ [key]: ['send:executor'] })[0], /cannot carry send: tokens — a send is claimed through dispatches/);
    }
    assert.match(invariants.declarationErrors({ calls_in_order: ['boot', 'send:'] })[0], /send: token needs an agent/);
    assert.deepEqual(invariants.declarationErrors({ calls_in_order: ['dispatch:executor', 'send:executor'] }), []);
  });

  it('accepts a well-formed dispatches declaration', () => {
    assert.deepEqual(invariants.declarationErrors({
      dispatches: [
        { agent: 'a' },
        { agent: 'b', nth: 2, count: 2, carries: ['x'], lacks: ['y'] },
        { agent: 'c', count: 0 },
        { agent: 'd', send: true, count: 1, carries: ['Next attempt'] },
      ],
    }), []);
  });

  it('rejects a malformed dispatches declaration, naming the entry', () => {
    const errorsOf = (dispatches) => invariants.declarationErrors({ dispatches });
    assert.match(errorsOf([])[0], /non-empty array/);
    assert.match(errorsOf({ agent: 'a' })[0], /non-empty array/);
    assert.match(errorsOf(['a'])[0], /dispatches\[0\] must be an object/);
    assert.match(errorsOf([{}])[0], /dispatches\[0\] needs an agent/);
    assert.match(errorsOf([{ agent: 'a', agnet: 'b' }])[0], /unknown key "agnet"/);
    assert.match(errorsOf([{ agent: 'a', send: 'yes' }])[0], /dispatches\[0\] send must be true or false/);
    assert.match(errorsOf([{ agent: 'a', nth: 0 }])[0], /nth must be a whole number from 1/);
    assert.match(errorsOf([{ agent: 'a', count: 1.5 }])[0], /count must be a whole number from 0/);
    assert.match(errorsOf([{ agent: 'a', carries: 'x' }])[0], /carries must be a non-empty array/);
    assert.match(errorsOf([{ agent: 'a', lacks: [''] }])[0], /lacks must be a non-empty array/);
    assert.match(errorsOf([{ agent: 'a', count: 0, carries: ['x'] }])[0], /claims no dispatch/);
    assert.match(errorsOf([{ agent: 'a', count: 1, nth: 2 }])[0], /nth 2 is past its own count 1/);
  });
});

describe('dispatches — what a held dispatch carried', () => {
  // Records in the shape worlds.readDispatches returns: the hold's whole
  // record of each Agent call, the prompt uncapped.
  const call = (agent, prompt, id = agent) => ({
    tool_use_id: id, tool_name: 'Agent', tool_input: { subagent_type: agent, description: 'd', prompt },
  });
  const run = (records, dispatches) => invariants.check([], { dispatches }, records)[0];
  const FLOOR = '.claude/skills/workflow-implementation-process/references/finding-floor.md';

  it('passes a dispatch that carried every declared input', () => {
    const result = run([call('input-review', 'Source: .workflows/pay/discussion/pay.md\nCycle: 1')],
      [{ agent: 'input-review', carries: ['.workflows/pay/discussion/pay.md'] }]);
    assert.equal(result.name, 'dispatches');
    assert.equal(result.ok, true);
    assert.ok(!result.vacuous, 'a declared dispatch always has something to examine');
  });

  it('fails a dispatch missing a declared input, naming it', () => {
    const result = run([call('input-review', 'Source: .workflows/pay/specification/pay/specification.md')],
      [{ agent: 'input-review', carries: ['.workflows/pay/discussion/pay.md'] }]);
    assert.equal(result.ok, false);
    assert.match(result.detail, /input-review #1 does not carry: \.workflows\/pay\/discussion\/pay\.md/);
  });

  it('fails a declared dispatch that never happened — never N/A', () => {
    const result = run([call('other', 'x')], [{ agent: 'input-review', carries: ['x'] }]);
    assert.equal(result.ok, false);
    assert.ok(!result.vacuous);
    assert.match(result.detail, /input-review was never dispatched/);
    assert.equal(run([], [{ agent: 'input-review' }]).ok, false, 'no record at all fails the same way');
  });

  it('holds carries for every dispatch of the agent unless nth picks one', () => {
    const records = [call('reviewer', 'cycle 1', 't1'), call('reviewer', 'cycle 2, settled: review-traceability-tracking-c1.md', 't2')];
    const every = run(records, [{ agent: 'reviewer', carries: ['review-traceability-tracking-c1.md'] }]);
    assert.equal(every.ok, false);
    assert.match(every.detail, /reviewer #1 does not carry/);
    assert.equal(run(records, [{ agent: 'reviewer', nth: 2, carries: ['review-traceability-tracking-c1.md'] }]).ok, true);
    assert.equal(run(records, [{ agent: 'reviewer', nth: 1, lacks: ['review-traceability-tracking-c1.md'] }]).ok, true);
  });

  it('fails an nth past the dispatches made', () => {
    const result = run([call('reviewer', 'x')], [{ agent: 'reviewer', nth: 2, carries: ['x'] }]);
    assert.equal(result.ok, false);
    assert.match(result.detail, /dispatched 1 time — there is no dispatch #2/);
  });

  it('pins how many times an agent was dispatched', () => {
    const records = [call('dup', FLOOR, 'a'), call('dup', FLOOR, 'b')];
    const result = run(records, [{ agent: 'dup', count: 1, carries: [FLOOR] }]);
    assert.equal(result.ok, false);
    assert.match(result.detail, /dup was dispatched 2 times, not 1/);
    const pinned = run(records, [{ agent: 'dup', count: 2, carries: [FLOOR] }]);
    assert.equal(pinned.ok, true);
    assert.match(pinned.detail, /dup \(2 dispatches\)/);
    assert.equal(run(records, [{ agent: 'standards', count: 0 }]).ok, true, 'count 0 claims the agent was never dispatched');
    assert.equal(run(records, [{ agent: 'dup', count: 0 }]).ok, false);
  });

  it('fails a dispatch carrying what it must not', () => {
    const result = run([call('analysis', 'prior cycle findings: …')], [{ agent: 'analysis', lacks: ['prior cycle findings'] }]);
    assert.equal(result.ok, false);
    assert.match(result.detail, /analysis #1 carries what it must not: prior cycle findings/);
  });

  it('reports every failing claim, not just the first', () => {
    const result = run([call('a', 'x')], [{ agent: 'a', carries: ['y'] }, { agent: 'b' }]);
    assert.match(result.detail, /a #1 does not carry: y; b was never dispatched/);
  });

  it('matches an agent by its subagent_type exactly', () => {
    assert.equal(run([call('workflow-planning-review-traceability', 'x')], [{ agent: 'workflow-planning-review' }]).ok, false);
  });
});

describe('dispatches — the sends that continued an agent', () => {
  // A held dispatch's id is its tool_use_id; a send continues the agent
  // whose dispatch was given the id it went to.
  const EXECUTOR = 'workflow-implementation-task-executor';
  const dispatched = (id, agent = EXECUTOR) => ({
    tool_use_id: id, tool_name: 'Agent', tool_input: { subagent_type: agent, description: 'd', prompt: 'task content' },
  });
  const sent = (id, to, message) => ({
    tool_use_id: id, tool_name: 'SendMessage', tool_input: { to, summary: 'retry', message },
  });
  const run = (records, dispatches) => invariants.check([], { dispatches }, records)[0];

  it('passes one fresh dispatch continued once, by the id it was given', () => {
    const records = [dispatched('toolu_d1'), sent('toolu_s1', 'toolu_d1', 'Next attempt: key the guard on the intent')];
    const result = run(records, [
      { agent: EXECUTOR, count: 1 },
      { agent: EXECUTOR, send: true, count: 1, carries: ['Next attempt'] },
    ]);
    assert.equal(result.ok, true, result.detail);
    assert.match(result.detail, /sends to workflow-implementation-task-executor \(1 send\)/);
  });

  it('fails a retry made as a second fresh dispatch — it is no send', () => {
    const result = run([dispatched('toolu_d1'), dispatched('toolu_d2')], [
      { agent: EXECUTOR, count: 1 },
      { agent: EXECUTOR, send: true, count: 1 },
    ]);
    assert.equal(result.ok, false);
    assert.match(result.detail, /workflow-implementation-task-executor was dispatched 2 times, not 1; workflow-implementation-task-executor was sent to 0 times, not 1/);
  });

  it('attributes a send to no agent when no dispatch was given the id it went to', () => {
    const records = [dispatched('toolu_d1'), sent('toolu_s1', EXECUTOR, 'Next attempt')];
    const result = run(records, [{ agent: EXECUTOR, send: true }]);
    assert.equal(result.ok, false);
    assert.match(result.detail, /workflow-implementation-task-executor was never sent to/);
  });

  it('attributes a send to the agent its target dispatch named, never another', () => {
    const records = [dispatched('toolu_d1'), dispatched('toolu_r1', 'reviewer'), sent('toolu_s1', 'toolu_r1', 'x')];
    assert.equal(run(records, [{ agent: EXECUTOR, send: true, count: 0 }]).ok, true);
    assert.equal(run(records, [{ agent: 'reviewer', send: true, count: 1 }]).ok, true);
  });

  it('reads carries and lacks against the message a send carried, nth picking one', () => {
    const records = [
      dispatched('toolu_d1'),
      sent('toolu_s1', 'toolu_d1', 'Next attempt: A'),
      sent('toolu_s2', 'toolu_d1', 'review notes'),
    ];
    const every = run(records, [{ agent: EXECUTOR, send: true, carries: ['Next attempt'] }]);
    assert.equal(every.ok, false);
    assert.match(every.detail, /send #2 to workflow-implementation-task-executor does not carry: Next attempt/);
    assert.equal(run(records, [{ agent: EXECUTOR, send: true, nth: 1, carries: ['Next attempt'] }]).ok, true);
    const lacking = run(records, [{ agent: EXECUTOR, send: true, nth: 2, lacks: ['review notes'] }]);
    assert.match(lacking.detail, /send #2 to workflow-implementation-task-executor carries what it must not: review notes/);
    assert.match(run(records, [{ agent: EXECUTOR, send: true, nth: 3 }]).detail, /sent to 2 times — there is no send #3/);
  });

  it('never counts a send as a dispatch of the agent it continues', () => {
    const records = [dispatched('toolu_d1'), sent('toolu_s1', 'toolu_d1', 'task content')];
    assert.equal(run(records, [{ agent: EXECUTOR, count: 1, carries: ['task content'] }]).ok, true);
  });
});

describe('calls_in_order — dispatch: tokens', () => {
  // The hold's ordering row: an Agent row at PreToolUse whose detail is
  // `<subagent_type> — <description>`.
  const heldRow = (agent) => ({ event: 'PreToolUse', tool: 'Agent', detail: `${agent} — review`, outcome: 'held', output: 'toolu_x' });

  it('orders a dispatch against the calls around it', () => {
    const rows = [bash(`${ENGINE} manifest set pay.planning.pay review_cycle 2`), heldRow('traceability'), heldRow('integrity')];
    const [result] = invariants.check(rows, {
      calls_in_order: ['review_cycle 2', 'dispatch:traceability', 'dispatch:integrity'],
    });
    assert.equal(result.ok, true);
  });

  it('fails a dispatch made before the call it must follow', () => {
    const rows = [heldRow('traceability'), bash(`${ENGINE} manifest set pay.planning.pay review_cycle 2`)];
    const [result] = invariants.check(rows, { calls_in_order: ['review_cycle 2', 'dispatch:traceability'] });
    assert.equal(result.ok, false);
    assert.match(result.detail, /"dispatch:traceability" never ran after "review_cycle 2"/);
  });

  it('matches the NEXT dispatch of the agent, so each cycle takes its own token', () => {
    const rows = [heldRow('traceability'), bash(`${ENGINE} manifest set pay.planning.pay review_cycle 2`), heldRow('traceability')];
    assert.equal(invariants.check(rows, {
      calls_in_order: ['dispatch:traceability', 'review_cycle 2', 'dispatch:traceability'],
    })[0].ok, true);
    assert.equal(invariants.check(rows.slice(0, 2), {
      calls_in_order: ['dispatch:traceability', 'review_cycle 2', 'dispatch:traceability'],
    })[0].ok, false, 'one dispatch never satisfies two tokens');
  });

  it('never lets a command naming the agent stand in for its dispatch', () => {
    const rows = [bash('cat .claude/agents/traceability.md'), bash(`${ENGINE} boot`)];
    assert.equal(invariants.check(rows, { calls_in_order: ['dispatch:traceability', 'boot'] })[0].ok, false);
  });
});

describe('calls_in_order — send: tokens', () => {
  // The hold's rows: a dispatch's `<subagent_type> — <description>` and a
  // send's `<to> — <summary>`, each closing on its own tool_use_id; the
  // records say which dispatch was given the id a send went to.
  const dispatchRow = (agent, id) => ({ event: 'PreToolUse', tool: 'Agent', detail: `${agent} — run`, outcome: 'held', output: id });
  const sendRow = (to, id) => ({ event: 'PreToolUse', tool: 'SendMessage', detail: `${to} — retry`, outcome: 'held', output: id });
  const records = [
    { tool_use_id: 'toolu_d1', tool_name: 'Agent', tool_input: { subagent_type: 'executor', prompt: 'p' } },
    { tool_use_id: 'toolu_s1', tool_name: 'SendMessage', tool_input: { to: 'toolu_d1', message: 'm' } },
  ];
  const GATE = `${ENGINE} render executor-block-gate pay.implementation.pay --result failed`;

  it('orders the send continuing an agent against the calls around it', () => {
    const rows = [dispatchRow('executor', 'toolu_d1'), bash(GATE), sendRow('toolu_d1', 'toolu_s1')];
    const [result] = invariants.check(rows, {
      calls_in_order: ['dispatch:executor', 'executor-block-gate', 'send:executor'],
    }, records);
    assert.equal(result.ok, true, result.detail);
  });

  it('never lets a fresh dispatch stand in for the send, nor a send for a dispatch', () => {
    const redispatched = [dispatchRow('executor', 'toolu_d1'), bash(GATE), dispatchRow('executor', 'toolu_d2')];
    const [result] = invariants.check(redispatched, {
      calls_in_order: ['executor-block-gate', 'send:executor'],
    }, records);
    assert.equal(result.ok, false);
    assert.match(result.detail, /"send:executor" never ran after "executor-block-gate"/);
    const sentOnly = [bash(GATE), sendRow('toolu_d1', 'toolu_s1')];
    assert.equal(invariants.check(sentOnly, { calls_in_order: ['executor-block-gate', 'dispatch:executor'] }, records)[0].ok, false);
  });

  it('matches no agent for a send to an id no dispatch was given', () => {
    const rows = [bash(GATE), sendRow('executor', 'toolu_s1')];
    assert.equal(invariants.check(rows, { calls_in_order: ['executor-block-gate', 'send:executor'] }, records)[0].ok, false);
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

  it('accepts the project-level places the start menu opens as their own sessions', () => {
    assert.deepEqual(cases.entryErrors('workflow-roadmap'), []);
    assert.deepEqual(cases.entryErrors('workflow-help'), []);
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
  const rd = (detail) => ({ event: 'PostToolUse', tool: 'Read', detail, outcome: 'ok' });

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

  it('ignores a read that failed — a guessed path is not prose the walk opened', () => {
    const guess = './.claude/skills/shared/references/instructions.md';
    const rows = [
      { event: 'PreToolUse', tool: 'Read', detail: guess },
      { event: 'PostToolUseFailure', tool: 'Read', detail: guess, outcome: 'FAILED' },
      { event: 'PreToolUse', tool: 'Read', detail: './.claude/skills/workflow-shared/references/instructions.md' },
      rd('./.claude/skills/workflow-shared/references/instructions.md'),
    ];
    assert.deepEqual(invariants.undeclaredProse(rows, []),
      ['skills/workflow-shared/references/instructions.md']);
  });
});
