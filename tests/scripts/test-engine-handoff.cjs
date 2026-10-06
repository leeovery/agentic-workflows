'use strict';

require('./hermetic-env.cjs');

// `engine handoff` — every move into work named by one engine call. The
// table holds each skill a handoff lands on and the arguments it takes; the
// engine composes the continuation and the line naming where the work goes,
// and answers which way the work travels: the gate mod carries it where the
// session announced handoff support, the session invokes it in place where it
// did not.

const fs = require('fs');
const path = require('path');
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { output, refuses } = require('./engine-harness.cjs');
const { setupFixture, cleanupFixture, createManifest, createFile } = require('./discovery-test-utils.cjs');
const { auditMarkers } = require('./gate-audit.cjs');
const { VALID_WORK_TYPES, WORK_TYPE_PIPELINES, PAUSING_PHASES } = require('../../skills/workflow-engine/scripts/kernel/manifest-schema.cjs');
const { HANDOFF_TARGETS } = require('../../skills/workflow-engine/scripts/domain/handoff.cjs');

const ANNOUNCED = { WORKFLOWS_HANDOFF: '1' };

const DATA_MARKER = '=== DATA (reason from this — never display or parse the sections below) ===';
const DISPLAY_MARKER = '=== DISPLAY: handoff (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===';
const HANDOFF_MARKER = '=== HANDOFF (json for the gate mod — never display) ===';

// Every phase an epic's conclusion can name: its discovery, then its pipeline.
const EPIC_PHASES = ['discovery', ...WORK_TYPE_PIPELINES.epic];

// The skill each phase runs in — the one a handoff into the phase lands on.
/** @type {Record<string, string>} */
const PHASE_SKILLS = {
  research: 'workflow-research-process',
  experiment: 'workflow-experiment-process',
  discussion: 'workflow-discussion-process',
  investigation: 'workflow-investigation-process',
  scoping: 'workflow-scoping-process',
  specification: 'workflow-specification-process',
  planning: 'workflow-planning-process',
  implementation: 'workflow-implementation-process',
  review: 'workflow-review-process',
};

const IDEA = '.workflows/.inbox/ideas/2026-01-01--dark-mode.md';
const BUG = '.workflows/.inbox/bugs/2026-01-02--flaky-login.md';

/** The answer unannounced, as the session carrying the work itself reads it. @param {string} dir @param {string[]} args */
const inline = (dir, args) => output(dir, ['handoff', ...args]);

/** The answer under the gate mod's announcement. @param {string} dir @param {string[]} args */
const carried = (dir, args) => output(dir, ['handoff', ...args], { env: ANNOUNCED });

/** The refusal's message. @param {string} dir @param {string[]} args @param {RegExp} pattern */
function refused(dir, args, pattern) {
  const { error } = refuses(dir, ['handoff', ...args]);
  assert.match(error, pattern);
}

/** The HANDOFF payload an announced answer carries. @param {string} out */
function payloadOf(out) {
  const lines = out.split('\n');
  const at = lines.indexOf(HANDOFF_MARKER);
  assert.notStrictEqual(at, -1, `no HANDOFF section in:\n${out}`);
  return JSON.parse(lines[at + 1]);
}

/**
 * The answer unannounced, expected whole: the session reads which way the
 * work goes and the skill to invoke, and shows the line.
 * @param {string} skill @param {string} args @param {string} line
 */
function inlineAnswer(skill, args, line) {
  return [
    DATA_MARKER,
    'handoff: inline',
    `skill: ${skill}`,
    ...(args === '' ? [] : [`args: ${args}`]),
    DISPLAY_MARKER,
    line,
    '',
  ].join('\n');
}

/** A project with a feature, an epic, and two live inbox items. */
function seed() {
  const dir = setupFixture();
  createManifest(dir, 'note-window', { work_type: 'feature' });
  createManifest(dir, 'fumi', { work_type: 'epic' });
  createFile(dir, IDEA, '# Dark mode\n');
  createFile(dir, BUG, '# Flaky login\n');
  return dir;
}

describe('engine handoff — the composed answer for every target', () => {
  let dir;
  beforeEach(() => { dir = seed(); });
  afterEach(() => cleanupFixture(dir));

  it('discovery for new work names no work unit — the line reads Discovery alone', () => {
    assert.strictEqual(inline(dir, ['workflow-discovery', 'feature', 'none']),
      inlineAnswer('workflow-discovery', 'feature none', '→ Discovery'));
  });

  it('discovery into an existing epic names the epic', () => {
    assert.strictEqual(inline(dir, ['workflow-discovery', 'epic', 'fumi']),
      inlineAnswer('workflow-discovery', 'epic fumi', '→ Discovery · fumi'));
  });

  it('inbox seeds travel quoted, as discovery reads them — one path, several, or none', () => {
    assert.strictEqual(payloadOf(carried(dir, ['workflow-discovery', 'feature', 'none', IDEA])).args,
      `feature none "${IDEA}"`);
    assert.strictEqual(payloadOf(carried(dir, ['workflow-discovery', 'none', 'none', `${IDEA},${BUG}`])).text,
      `Invoke \`/workflow-discovery none none "${IDEA},${BUG}"\`.`);
    assert.strictEqual(inline(dir, ['workflow-discovery', 'none', 'none', 'none']),
      inlineAnswer('workflow-discovery', 'none none "none"', '→ Discovery'));
  });

  it('a seed path holding a space survives its quotes', () => {
    const spaced = '.workflows/.inbox/ideas/2026-01-03--night mode.md';
    createFile(dir, spaced, '# Night mode\n');
    assert.strictEqual(payloadOf(carried(dir, ['workflow-discovery', 'feature', 'none', spaced])).args,
      `feature none "${spaced}"`);
  });

  it('the roadmap opens on its home', () => {
    assert.strictEqual(inline(dir, ['workflow-roadmap', 'open']),
      inlineAnswer('workflow-roadmap', 'open', '→ Roadmap'));
  });

  it('the baseline takes no arguments — the answer carries no args line and the continuation none', () => {
    assert.strictEqual(inline(dir, ['workflow-baseline']), inlineAnswer('workflow-baseline', '', '→ Baseline'));
    assert.strictEqual(payloadOf(carried(dir, ['workflow-baseline'])).text, 'Invoke `/workflow-baseline`.');
  });

  it('the epic menu names the epic, bare or told what concluded and how', () => {
    assert.strictEqual(inline(dir, ['workflow-continue-epic', 'fumi']),
      inlineAnswer('workflow-continue-epic', 'fumi', '→ Epic · fumi'));
    assert.strictEqual(inline(dir, ['workflow-continue-epic', 'fumi', 'discovery', 'completed']),
      inlineAnswer('workflow-continue-epic', 'fumi discovery completed', '→ Epic · fumi'));
    for (const outcome of ['completed', 'paused', 'cancelled', 'postponed']) {
      assert.strictEqual(payloadOf(carried(dir, ['workflow-continue-epic', 'fumi', 'discussion', outcome])).args,
        `fumi discussion ${outcome}`);
    }
  });

  it('the epic menu takes a pause from every phase its paused banner names', () => {
    for (const phase of PAUSING_PHASES) {
      assert.strictEqual(payloadOf(carried(dir, ['workflow-continue-epic', 'fumi', phase, 'paused'])).args,
        `fumi ${phase} paused`);
    }
  });

  it('discovery into an existing epic takes the work type epic or none, and no seeds', () => {
    assert.strictEqual(inline(dir, ['workflow-discovery', 'none', 'fumi']),
      inlineAnswer('workflow-discovery', 'none fumi', '→ Discovery · fumi'));
    assert.strictEqual(payloadOf(carried(dir, ['workflow-discovery', 'none', 'fumi', 'none'])).args, 'none fumi "none"');
  });

  it('the skill each phase is entered through takes each work type its pipeline holds — the line names the phase and the topic, else the unit', () => {
    for (const type of VALID_WORK_TYPES) {
      const unit = `${type}-unit`;
      createManifest(dir, unit, { work_type: type });
      for (const phase of WORK_TYPE_PIPELINES[type]) {
        const skill = PHASE_SKILLS[phase];
        const name = phase.charAt(0).toUpperCase() + phase.slice(1);
        if (type !== 'epic') {
          assert.strictEqual(inline(dir, [skill, type, unit]),
            inlineAnswer(skill, `${type} ${unit}`, `→ ${name} · ${unit}`), `${skill} ${type}`);
        }
        assert.strictEqual(inline(dir, [skill, type, unit, 'checkout']),
          inlineAnswer(skill, `${type} ${unit} checkout`, `→ ${name} · checkout`), `${skill} ${type} with a topic`);
      }
    }
  });

  it('a topic the work unit does not hold yet is named all the same — the phase starts it', () => {
    assert.strictEqual(payloadOf(carried(dir, ['workflow-research-process', 'epic', 'fumi', 'payments'])).line,
      '→ Research · payments');
  });

  it('the skill named as its slash command — a menu\'s stored route as it stands — answers as the bare name does', () => {
    assert.strictEqual(inline(dir, ['/workflow-roadmap', 'open']), inline(dir, ['workflow-roadmap', 'open']));
    assert.strictEqual(carried(dir, ['/workflow-continue-epic', 'fumi']), carried(dir, ['workflow-continue-epic', 'fumi']));
  });

  it('the table holds the targets a move into work lands on — and the skill each phase is entered through', () => {
    assert.deepStrictEqual(Object.keys(PHASE_SKILLS).sort(), [...new Set(Object.values(WORK_TYPE_PIPELINES).flat())].sort());
    assert.deepStrictEqual([...HANDOFF_TARGETS].sort(),
      ['workflow-baseline', 'workflow-continue-epic', 'workflow-discovery', 'workflow-roadmap', ...Object.values(PHASE_SKILLS)].sort());
  });

  it('every target is a skill on disk — a handoff never names one that is not there', () => {
    for (const skill of HANDOFF_TARGETS) {
      assert.ok(fs.existsSync(path.join(__dirname, '../../skills', skill, 'SKILL.md')), skill);
    }
  });

  it('the display names its form — the line is shown as the session emits it', () => {
    auditMarkers(inline(dir, ['workflow-discussion-process', 'feature', 'note-window']), 'handoff');
    auditMarkers(carried(dir, ['workflow-discussion-process', 'feature', 'note-window']), 'handoff, announced');
  });
});

describe('engine handoff — announced and unannounced', () => {
  let dir;
  beforeEach(() => { dir = seed(); });
  afterEach(() => cleanupFixture(dir));

  const ARGS = ['workflow-discussion-process', 'feature', 'note-window'];

  it('announced, the mod carries the work: DATA says so, and the payload holds the skill, its arguments, the continuation and the line', () => {
    const out = carried(dir, ARGS);
    assert.match(out, /^handoff: mod$/m);
    assert.deepStrictEqual(payloadOf(out), {
      skill: 'workflow-discussion-process',
      args: 'feature note-window',
      text: 'Invoke `/workflow-discussion-process feature note-window`.',
      line: '→ Discussion · note-window',
    });
  });

  it('announced, the answer is the unannounced one with the mod named and its payload last', () => {
    const plain = inline(dir, ARGS);
    const out = carried(dir, ARGS);
    const [answer, payload] = out.split(HANDOFF_MARKER + '\n');
    assert.strictEqual(answer, plain.replace('handoff: inline', 'handoff: mod'));
    assert.strictEqual(payload.split('\n').filter(Boolean).length, 1, 'the payload is one line of JSON');
  });

  it('unannounced, nothing is for the mod — the session invokes the skill in place', () => {
    const out = inline(dir, ARGS);
    assert.match(out, /^handoff: inline$/m);
    assert.ok(!out.includes(HANDOFF_MARKER), out);
  });

  it('only the value 1 announces', () => {
    const plain = inline(dir, ARGS);
    for (const value of ['0', 'true', '', 'yes']) {
      assert.strictEqual(output(dir, ['handoff', ...ARGS], { env: { WORKFLOWS_HANDOFF: value } }), plain, `WORKFLOWS_HANDOFF=${value}`);
    }
  });

  it('the gate surface announces gates, never the handoff — the two are independent', () => {
    const plain = inline(dir, ARGS);
    assert.strictEqual(output(dir, ['handoff', ...ARGS], { env: { WORKFLOWS_GATE_SURFACE: '1' } }), plain);
    assert.match(output(dir, ['handoff', ...ARGS], { env: { WORKFLOWS_GATE_SURFACE: '1', ...ANNOUNCED } }), /^handoff: mod$/m);
  });
});

describe('engine handoff — refusals', () => {
  let dir;
  beforeEach(() => { dir = seed(); });
  afterEach(() => cleanupFixture(dir));

  it('a call naming no skill refuses with the usage', () => {
    refused(dir, [], /^Usage: engine handoff <skill\|\/skill> \[args …\]$/);
  });

  it('a skill no move into work lands on refuses, naming the targets', () => {
    for (const skill of ['workflow-help', 'workflow-start', 'workflow-bridge', 'workflow-continue-feature', 'workflow-legacy-research-split', 'workflow-log-idea', 'workflow-nonsense']) {
      refused(dir, [skill], new RegExp(`^"${skill}" is not a handoff target — a handoff moves into work: workflow-discovery, `));
    }
  });

  it('the wrong number of arguments refuses with that target\'s usage', () => {
    const cases = [
      [['workflow-discovery', 'feature'], /^Usage: engine handoff workflow-discovery <work-type\|none> <none\|epic> \[<inbox-paths\|none>\]$/],
      [['workflow-discovery', 'feature', 'none', 'none', 'extra'], /^Usage: engine handoff workflow-discovery /],
      [['workflow-roadmap'], /^Usage: engine handoff workflow-roadmap open$/],
      [['workflow-roadmap', 'open', 'extra'], /^Usage: engine handoff workflow-roadmap open$/],
      [['workflow-baseline', 'extra'], /^Usage: engine handoff workflow-baseline$/],
      [['workflow-continue-epic'], /^Usage: engine handoff workflow-continue-epic <epic> \[<completed-phase> <outcome>\]$/],
      [['workflow-continue-epic', 'fumi', 'discussion'], /^Usage: engine handoff workflow-continue-epic /],
      [['workflow-continue-epic', 'fumi', 'discussion', 'paused', 'extra'], /^Usage: engine handoff workflow-continue-epic /],
      [['workflow-discussion-process', 'feature'], /^Usage: engine handoff workflow-discussion-process <epic\|feature\|cross-cutting> <work-unit> \[<topic>\]$/],
      [['workflow-scoping-process', 'quick-fix', 'a', 'b', 'c'], /^Usage: engine handoff workflow-scoping-process <quick-fix> <work-unit> \[<topic>\]$/],
    ];
    for (const [args, pattern] of cases) refused(dir, args, pattern);
  });

  it('discovery refuses a pre-seed outside the work types, and a work unit that is no epic the project holds', () => {
    refused(dir, ['workflow-discovery', 'saga', 'none'], /^the work type must be one of epic\|feature\|bugfix\|cross-cutting\|quick-fix\|none — got "saga"$/);
    refused(dir, ['workflow-discovery', 'epic', 'note-window'], /^work unit "note-window" is of type feature, not epic$/);
    refused(dir, ['workflow-discovery', 'epic', 'ghost'], /^work unit "ghost" not found$/);
  });

  it('discovery into an existing epic refuses a work type that would start new work, and any seeds', () => {
    for (const type of VALID_WORK_TYPES.filter((t) => t !== 'epic')) {
      refused(dir, ['workflow-discovery', type, 'fumi'], new RegExp(`^the work type into an existing epic must be one of epic\\|none — got "${type}"$`));
    }
    refused(dir, ['workflow-discovery', 'epic', 'fumi', IDEA], /^inbox seeds start new work, never an existing epic's discovery — got "\.workflows\/\.inbox\/ideas\/2026-01-01--dark-mode\.md"$/);
    refused(dir, ['workflow-discovery', 'none', 'fumi', IDEA], /^inbox seeds start new work, never an existing epic's discovery/);
  });

  it('discovery refuses seeds that are not live inbox items on disk, named once each', () => {
    refused(dir, ['workflow-discovery', 'feature', 'none', '.workflows/.inbox/ideas/2026-01-09--ghost.md'], /inbox file not found/);
    refused(dir, ['workflow-discovery', 'feature', 'none', '.workflows/.inbox/.archived/ideas/x.md'], /not a live inbox path/);
    refused(dir, ['workflow-discovery', 'feature', 'none', 'README.md'], /not a live inbox path/);
    refused(dir, ['workflow-discovery', 'feature', 'none', `${IDEA},${IDEA}`], /duplicate inbox path/);
    refused(dir, ['workflow-discovery', 'feature', 'none', `${IDEA},`], /not a live inbox path/);
  });

  it('a seed path holding a double quote refuses — it would end the quotes discovery reads it inside', () => {
    const quoted = '.workflows/.inbox/ideas/2026-01-04--a "b".md';
    createFile(dir, quoted, '# Quoted\n');
    refused(dir, ['workflow-discovery', 'feature', 'none', quoted], /^inbox seeds travel quoted — a path cannot hold a double quote/);
  });

  it('the roadmap takes open alone — its genesis and pull carry the live conversation and never hand off', () => {
    refused(dir, ['workflow-roadmap', 'genesis'], /^the mode must be open — got "genesis"$/);
    refused(dir, ['workflow-roadmap', 'pull'], /^the mode must be open — got "pull"$/);
  });

  it('the epic menu refuses a unit that is no epic, a phase outside the epic\'s, and an unknown outcome', () => {
    refused(dir, ['workflow-continue-epic', 'note-window'], /^work unit "note-window" is of type feature, not epic$/);
    refused(dir, ['workflow-continue-epic', 'none'], /^work unit "none" not found$/);
    refused(dir, ['workflow-continue-epic', 'fumi', 'investigation', 'completed'], /^the phase must be one of discovery\|research\|experiment\|discussion\|specification\|planning\|implementation\|review — got "investigation"$/);
    refused(dir, ['workflow-continue-epic', 'fumi', 'discussion', 'abandoned'], /^the outcome must be one of completed\|paused\|cancelled\|postponed — got "abandoned"$/);
  });

  it('the epic menu refuses a pause from a phase its paused banner cannot name', () => {
    for (const phase of EPIC_PHASES.filter((p) => !PAUSING_PHASES.includes(p))) {
      refused(dir, ['workflow-continue-epic', 'fumi', phase, 'paused'],
        new RegExp(`^the phase that paused must be one of ${PAUSING_PHASES.join('\\|')} — got "${phase}"$`));
    }
  });

  it('every epic phase refuses the epic alone — the epic menu names the topic before it hands off', () => {
    for (const phase of WORK_TYPE_PIPELINES.epic) {
      refused(dir, [PHASE_SKILLS[phase], 'epic', 'fumi'], new RegExp(`^an epic enters ${phase} at a topic$`));
    }
  });

  it('a phase\'s skill refuses a work type its pipeline does not hold', () => {
    for (const type of VALID_WORK_TYPES) {
      createManifest(dir, `${type}-unit`, { work_type: type });
      for (const [phase, skill] of Object.entries(PHASE_SKILLS)) {
        if (WORK_TYPE_PIPELINES[type].includes(phase)) continue;
        refused(dir, [skill, type, `${type}-unit`], new RegExp(`^the work type must be .* — got "${type}"$`));
      }
    }
    refused(dir, ['workflow-planning-process', 'saga', 'note-window'], /^the work type must be one of epic\|feature\|bugfix — got "saga"$/);
  });

  it('a phase\'s skill refuses a work unit the project does not hold, or holds as another type', () => {
    refused(dir, ['workflow-planning-process', 'feature', 'ghost'], /^work unit "ghost" not found$/);
    refused(dir, ['workflow-planning-process', 'epic', 'note-window', 'auth'], /^work unit "note-window" is of type feature, not epic$/);
    refused(dir, ['workflow-planning-process', 'feature', 'none'], /^work unit "none" not found$/);
  });

  it('a work unit whose manifest does not parse refuses as corrupt, never as a unit not found', () => {
    createFile(dir, '.workflows/broken/manifest.json', '{not json');
    refused(dir, ['workflow-planning-process', 'feature', 'broken'], /^invalid JSON in .*\/\.workflows\/broken\/manifest\.json: /);
    refused(dir, ['workflow-continue-epic', 'broken'], /^invalid JSON in /);
  });

  it('a work unit no longer in progress refuses — a handoff moves into work in progress', () => {
    createManifest(dir, 'shipped', { work_type: 'feature', status: 'completed' });
    createManifest(dir, 'dropped', { work_type: 'epic', status: 'cancelled' });
    refused(dir, ['workflow-review-process', 'feature', 'shipped'], /^work unit "shipped" is completed — a handoff moves into work in progress$/);
    refused(dir, ['workflow-continue-epic', 'dropped'], /^work unit "dropped" is cancelled — a handoff moves into work in progress$/);
  });

  it('a name that would break addressing refuses before anything is read', () => {
    refused(dir, ['workflow-planning-process', 'feature', '../note-window'], /^"\.\.\/note-window" is not a legal work unit name/);
    refused(dir, ['workflow-discussion-process', 'epic', 'fumi', 'pay.ments'], /^"pay\.ments" is not a legal topic name/);
    refused(dir, ['workflow-discussion-process', 'epic', 'fumi', 'pay/ments'], /^"pay\/ments" is not a legal topic name/);
    refused(dir, ['workflow-discussion-process', 'epic', 'fumi', ''], /^"" is not a legal topic name/);
  });

  it('an argument that whitespace or a quote would split refuses — the invocation could not carry it', () => {
    for (const arg of ['note window', 'note\twindow', 'it\'s', 'say"so']) {
      refused(dir, ['workflow-discussion-process', 'epic', 'fumi', arg], /cannot travel as one argument — whitespace and quotes split it$/);
    }
  });

  it('an argument holding a backtick refuses, the quoted seeds included — it would end the continuation\'s code span', () => {
    refused(dir, ['workflow-discussion-process', 'epic', 'fumi', '`x`'], /^"`x`" cannot travel in the continuation — a backtick ends its code span$/);
    const ticked = '.workflows/.inbox/ideas/2026-01-05--a`b.md';
    createFile(dir, ticked, '# Ticked\n');
    refused(dir, ['workflow-discovery', 'feature', 'none', ticked], /cannot travel in the continuation — a backtick ends its code span$/);
  });
});
