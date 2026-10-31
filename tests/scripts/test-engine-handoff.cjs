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
const { VALID_WORK_TYPES, WORK_TYPE_PIPELINES, PAUSING_PHASES } = require('../../skills/leeway-engine/scripts/kernel/manifest-schema.cjs');
const { HANDOFF_TARGETS, OPENING_SKILLS } = require('../../skills/leeway-engine/scripts/domain/handoff.cjs');

const ANNOUNCED = { LEEWAY_HANDOFF: '1' };

const DATA_MARKER = '=== DATA (reason from this — never display or parse the sections below) ===';
const DISPLAY_MARKER = '=== DISPLAY: handoff (emit verbatim as a text code block (```text fence) — do not stop; continue as the workflow instructs) ===';
const HANDOFF_MARKER = '=== HANDOFF (json for the gate mod — never display) ===';

// Every phase an epic's conclusion can name: its discovery, then its pipeline.
const EPIC_PHASES = ['discovery', ...WORK_TYPE_PIPELINES.epic];

// The skill each phase runs in — the one a handoff into the phase lands on.
/** @type {Record<string, string>} */
const PHASE_SKILLS = {
  experiment: 'leeway-experiment-process',
  discussion: 'leeway-discussion-process',
  investigation: 'leeway-investigation-process',
  scoping: 'leeway-scoping-process',
  specification: 'leeway-specification-process',
  planning: 'leeway-planning-process',
  implementation: 'leeway-implementation-process',
  review: 'leeway-review-process',
};

const IDEA = '.leeway/.inbox/ideas/2026-01-01--dark-mode.md';
const BUG = '.leeway/.inbox/bugs/2026-01-02--flaky-login.md';

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
    assert.strictEqual(inline(dir, ['leeway-discovery', 'feature', 'none']),
      inlineAnswer('leeway-discovery', 'feature none', '→ Discovery'));
  });

  it('discovery into an existing epic names the epic', () => {
    assert.strictEqual(inline(dir, ['leeway-discovery', 'epic', 'fumi']),
      inlineAnswer('leeway-discovery', 'epic fumi', '→ Discovery · fumi'));
  });

  it('inbox seeds travel quoted, as discovery reads them — one path, several, or none', () => {
    assert.strictEqual(payloadOf(carried(dir, ['leeway-discovery', 'feature', 'none', IDEA])).args,
      `feature none "${IDEA}"`);
    assert.strictEqual(payloadOf(carried(dir, ['leeway-discovery', 'none', 'none', `${IDEA},${BUG}`])).text,
      `Invoke \`/leeway-discovery none none "${IDEA},${BUG}"\`.`);
    assert.strictEqual(inline(dir, ['leeway-discovery', 'none', 'none', 'none']),
      inlineAnswer('leeway-discovery', 'none none "none"', '→ Discovery'));
  });

  it('a seed path holding a space survives its quotes', () => {
    const spaced = '.leeway/.inbox/ideas/2026-01-03--night mode.md';
    createFile(dir, spaced, '# Night mode\n');
    assert.strictEqual(payloadOf(carried(dir, ['leeway-discovery', 'feature', 'none', spaced])).args,
      `feature none "${spaced}"`);
  });

  it('the roadmap opens on its home', () => {
    assert.strictEqual(inline(dir, ['leeway-roadmap', 'open']),
      inlineAnswer('leeway-roadmap', 'open', '→ Roadmap'));
  });

  it('the baseline takes no arguments — the answer carries no args line and the continuation none', () => {
    assert.strictEqual(inline(dir, ['leeway-baseline']), inlineAnswer('leeway-baseline', '', '→ Baseline'));
    assert.strictEqual(payloadOf(carried(dir, ['leeway-baseline'])).text, 'Invoke `/leeway-baseline`.');
  });

  it('the epic menu names the epic, bare or told what concluded and how', () => {
    assert.strictEqual(inline(dir, ['leeway-continue-epic', 'fumi']),
      inlineAnswer('leeway-continue-epic', 'fumi', '→ Epic · fumi'));
    assert.strictEqual(inline(dir, ['leeway-continue-epic', 'fumi', 'discovery', 'completed']),
      inlineAnswer('leeway-continue-epic', 'fumi discovery completed', '→ Epic · fumi'));
    for (const outcome of ['completed', 'paused', 'cancelled', 'postponed']) {
      assert.strictEqual(payloadOf(carried(dir, ['leeway-continue-epic', 'fumi', 'discussion', outcome])).args,
        `fumi discussion ${outcome}`);
    }
  });

  it('the epic menu takes a pause from every phase its paused banner names', () => {
    for (const phase of PAUSING_PHASES) {
      assert.strictEqual(payloadOf(carried(dir, ['leeway-continue-epic', 'fumi', phase, 'paused'])).args,
        `fumi ${phase} paused`);
    }
  });

  it('discovery into an existing epic takes the work type epic or none, and no seeds', () => {
    assert.strictEqual(inline(dir, ['leeway-discovery', 'none', 'fumi']),
      inlineAnswer('leeway-discovery', 'none fumi', '→ Discovery · fumi'));
    assert.strictEqual(payloadOf(carried(dir, ['leeway-discovery', 'none', 'fumi', 'none'])).args, 'none fumi "none"');
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
    assert.strictEqual(payloadOf(carried(dir, ['leeway-discussion-process', 'epic', 'fumi', 'payments'])).line,
      '→ Discussion · payments');
  });

  it('the skill named as its slash command — a menu\'s stored route as it stands — answers as the bare name does', () => {
    assert.strictEqual(inline(dir, ['/leeway-roadmap', 'open']), inline(dir, ['leeway-roadmap', 'open']));
    assert.strictEqual(carried(dir, ['/leeway-continue-epic', 'fumi']), carried(dir, ['leeway-continue-epic', 'fumi']));
  });

  it('the table holds the targets a move into work lands on — and the skill each phase is entered through', () => {
    assert.deepStrictEqual(Object.keys(PHASE_SKILLS).sort(), [...new Set(Object.values(WORK_TYPE_PIPELINES).flat())].sort());
    assert.deepStrictEqual([...HANDOFF_TARGETS].sort(),
      ['leeway-baseline', 'leeway-continue-epic', 'leeway-discovery', 'leeway-roadmap', ...Object.values(PHASE_SKILLS)].sort());
  });

  it('a conversation opens on leeway or a skill a handoff lands on — and on nothing else', () => {
    assert.deepStrictEqual([...OPENING_SKILLS].sort(), ['leeway', ...HANDOFF_TARGETS].sort());
  });

  it('every target is a skill on disk — a handoff never names one that is not there', () => {
    for (const skill of HANDOFF_TARGETS) {
      assert.ok(fs.existsSync(path.join(__dirname, '../../skills', skill, 'SKILL.md')), skill);
    }
  });

  it('the display names its form — the line is shown as the session emits it', () => {
    auditMarkers(inline(dir, ['leeway-discussion-process', 'feature', 'note-window']), 'handoff');
    auditMarkers(carried(dir, ['leeway-discussion-process', 'feature', 'note-window']), 'handoff, announced');
  });
});

describe('engine handoff — announced and unannounced', () => {
  let dir;
  beforeEach(() => { dir = seed(); });
  afterEach(() => cleanupFixture(dir));

  const ARGS = ['leeway-discussion-process', 'feature', 'note-window'];

  it('announced, the mod carries the work: DATA says so, and the payload holds the skill, its arguments, the continuation and the line', () => {
    const out = carried(dir, ARGS);
    assert.match(out, /^handoff: mod$/m);
    assert.deepStrictEqual(payloadOf(out), {
      skill: 'leeway-discussion-process',
      args: 'feature note-window',
      text: 'Invoke `/leeway-discussion-process feature note-window`.',
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
      assert.strictEqual(output(dir, ['handoff', ...ARGS], { env: { LEEWAY_HANDOFF: value } }), plain, `LEEWAY_HANDOFF=${value}`);
    }
  });

  it('the gate surface announces gates, never the handoff — the two are independent', () => {
    const plain = inline(dir, ARGS);
    assert.strictEqual(output(dir, ['handoff', ...ARGS], { env: { LEEWAY_GATE_SURFACE: '1' } }), plain);
    assert.match(output(dir, ['handoff', ...ARGS], { env: { LEEWAY_GATE_SURFACE: '1', ...ANNOUNCED } }), /^handoff: mod$/m);
  });
});

describe('engine handoff topic — a topic opened by its unit and name, as /leeway {unit} {topic} opens it (10.3.1, 10.S2)', () => {
  let dir;
  /** A map row. @param {number} order @param {Record<string, unknown>} [marks] */
  const row = (order, marks = {}) => ({ order, summary: `Topic ${order}`, routing: 'discussion', source: 'discovery', ...marks });
  beforeEach(() => {
    dir = seed();
    createManifest(dir, 'fumi', {
      work_type: 'epic',
      phases: {
        discovery: {
          items: {
            commercialization: row(1), sync: row(2), export: row(3), removal: row(4, { cancelled: true }),
            widgets: row(5, { postponed: true }), 'dead-end': row(6, { handled: true }),
          },
        },
        discussion: { items: { sync: { status: 'completed' }, export: { status: 'promoted', promoted_to: 'portability' }, removal: { status: 'cancelled' }, widgets: { status: 'postponed' } } },
      },
    });
  });
  afterEach(() => cleanupFixture(dir));

  it('hands off into the conversation the topic is talked through, as the menus\' route does, the work type read from the unit — an epic\'s topic or a feature\'s own in discussion, a bugfix\'s in investigation', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix' });
    assert.strictEqual(carried(dir, ['topic', 'fumi', 'commercialization']), carried(dir, ['/leeway-discussion-process', 'epic', 'fumi', 'commercialization']));
    assert.strictEqual(inline(dir, ['topic', 'note-window', 'note-window']), inlineAnswer('leeway-discussion-process', 'feature note-window note-window', '→ Discussion · note-window'));
    assert.strictEqual(inline(dir, ['topic', 'crash', 'crash']), inlineAnswer('leeway-investigation-process', 'bugfix crash crash', '→ Investigation · crash'));
  });

  it('refuses a call of another shape, and a quick-fix, which has no topics to open, in words a person reads', () => {
    createManifest(dir, 'typo', { work_type: 'quick-fix' });
    refused(dir, ['topic', 'fumi'], /^Usage: engine handoff topic <work-unit> <topic>$/);
    refused(dir, ['topic', 'typo', 'typo'], /^typo is a quick-fix, with no topics to open by name — it carries on from the start menu$/);
  });

  it('refuses, before anything travels, what the topic\'s entry refuses, by its rule: a unit the project lacks, one cancelled or completed, one past its spec, a topic the unit lacks, and one cancelled, postponed, promoted, closed as a dead end or decided', () => {
    createManifest(dir, 'retired', { status: 'cancelled' });
    createManifest(dir, 'shipped', { status: 'completed' });
    createManifest(dir, 'specced');
    createFile(dir, '.leeway/specced/spec.md', '# Spec\n');
    const cases = [
      [['nowhere', 'any'], 'there is no work unit "nowhere" — the start menu lists the work in progress'],
      [['retired', 'retired'], 'retired is cancelled — reactivating it comes first'],
      [['shipped', 'shipped'], 'shipped is completed — new work starts from the start menu'],
      [['specced', 'specced'], 'specced has its spec — a topic exists only before it, and a change is settled in the spec from here'],
      [['fumi', 'comercialization'], 'fumi has no topic "comercialization" — the epic\'s map holds its topics, and a new one comes through its discovery'],
      [['fumi', 'removal'], 'the topic "removal" is cancelled — reactivating it goes through the epic menu\'s discovery row'],
      [['fumi', 'widgets'], 'the topic "widgets" is postponed, and its roadmap item has gone to another epic — it stays postponed here, with no way back'],
      [['fumi', 'export'], 'the topic "export" was promoted to "portability" — it carries on there'],
      [['fumi', 'dead-end'], 'the topic "dead-end" is closed as a dead end — reopening it goes through the epic menu\'s discovery row'],
      [['fumi', 'sync'], 'the topic "sync" is decided — it reopens through a message sent to it, or through the epic menu\'s discovery row'],
    ];
    assert.deepStrictEqual(cases.map(([args]) => refuses(dir, ['handoff', 'topic', ...args]).error), cases.map(([, error]) => error));
  });

  it('refuses a bugfix\'s topic once its investigation is concluded, the way its menu goes — or saying its work is done — and hands off into it again once a message reopens it', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'completed' } } } } });
    refused(dir, ['topic', 'crash', 'crash'], /^the topic "crash" is concluded — its work goes on in specification, from the start menu, and a message sent to it reopens it$/);
    const done = { status: 'completed' };
    createManifest(dir, 'crash', {
      work_type: 'bugfix',
      phases: Object.fromEntries(['investigation', 'specification', 'planning', 'implementation', 'review'].map((phase) => [phase, { items: { crash: done } }])),
    });
    refused(dir, ['topic', 'crash', 'crash'], /^the topic "crash" is concluded — its work is done, and a message sent to it reopens it$/);
    createManifest(dir, 'crash', { work_type: 'bugfix', phases: { investigation: { items: { crash: { status: 'in-progress' } } } } });
    assert.strictEqual(inline(dir, ['topic', 'crash', 'crash']), inlineAnswer('leeway-investigation-process', 'bugfix crash crash', '→ Investigation · crash'));
  });

  it('refuses a bugfix\'s topic once its spec is written, the investigation behind it', () => {
    createManifest(dir, 'crash', { work_type: 'bugfix' });
    createFile(dir, '.leeway/crash/spec.md', '# Spec\n');
    refused(dir, ['topic', 'crash', 'crash'], /^crash has its spec — a topic exists only before it/);
  });
});

describe('engine handoff — refusals', () => {
  let dir;
  beforeEach(() => { dir = seed(); });
  afterEach(() => cleanupFixture(dir));

  it('a call naming no skill refuses with the usage', () => {
    refused(dir, [], /^Usage: engine handoff <skill\|\/skill> \[args …\], or engine handoff topic <work-unit> <topic>$/);
  });

  it('a skill no move into work lands on refuses, naming the targets', () => {
    for (const skill of ['leeway-help', 'leeway', 'leeway-bridge', 'leeway-continue-linear', 'leeway-research-process', 'leeway-log-idea', 'leeway-nonsense']) {
      refused(dir, [skill], new RegExp(`^"${skill}" is not a handoff target — a handoff moves into work: leeway-discovery, `));
    }
  });

  it('the wrong number of arguments refuses with that target\'s usage', () => {
    const cases = [
      [['leeway-discovery', 'feature'], /^Usage: engine handoff leeway-discovery <work-type\|none> <none\|epic> \[<inbox-paths\|none>\]$/],
      [['leeway-discovery', 'feature', 'none', 'none', 'extra'], /^Usage: engine handoff leeway-discovery /],
      [['leeway-roadmap'], /^Usage: engine handoff leeway-roadmap open$/],
      [['leeway-roadmap', 'open', 'extra'], /^Usage: engine handoff leeway-roadmap open$/],
      [['leeway-baseline', 'extra'], /^Usage: engine handoff leeway-baseline$/],
      [['leeway-continue-epic'], /^Usage: engine handoff leeway-continue-epic <epic> \[<completed-phase> <outcome>\]$/],
      [['leeway-continue-epic', 'fumi', 'discussion'], /^Usage: engine handoff leeway-continue-epic /],
      [['leeway-continue-epic', 'fumi', 'discussion', 'paused', 'extra'], /^Usage: engine handoff leeway-continue-epic /],
      [['leeway-discussion-process', 'feature'], /^Usage: engine handoff leeway-discussion-process <epic\|feature\|cross-cutting> <work-unit> \[<topic>\]$/],
      [['leeway-scoping-process', 'quick-fix', 'a', 'b', 'c'], /^Usage: engine handoff leeway-scoping-process <quick-fix> <work-unit> \[<topic>\]$/],
    ];
    for (const [args, pattern] of cases) refused(dir, args, pattern);
  });

  it('discovery refuses a pre-seed outside the work types, and a work unit that is no epic the project holds', () => {
    refused(dir, ['leeway-discovery', 'saga', 'none'], /^the work type must be one of epic\|feature\|bugfix\|cross-cutting\|quick-fix\|none — got "saga"$/);
    refused(dir, ['leeway-discovery', 'epic', 'note-window'], /^work unit "note-window" is of type feature, not epic$/);
    refused(dir, ['leeway-discovery', 'epic', 'ghost'], /^work unit "ghost" not found$/);
  });

  it('discovery into an existing epic refuses a work type that would start new work, and any seeds', () => {
    for (const type of VALID_WORK_TYPES.filter((t) => t !== 'epic')) {
      refused(dir, ['leeway-discovery', type, 'fumi'], new RegExp(`^the work type into an existing epic must be one of epic\\|none — got "${type}"$`));
    }
    refused(dir, ['leeway-discovery', 'epic', 'fumi', IDEA], /^inbox seeds start new work, never an existing epic's discovery — got "\.leeway\/\.inbox\/ideas\/2026-01-01--dark-mode\.md"$/);
    refused(dir, ['leeway-discovery', 'none', 'fumi', IDEA], /^inbox seeds start new work, never an existing epic's discovery/);
  });

  it('discovery refuses seeds that are not live inbox items on disk, named once each', () => {
    refused(dir, ['leeway-discovery', 'feature', 'none', '.leeway/.inbox/ideas/2026-01-09--ghost.md'], /inbox file not found/);
    refused(dir, ['leeway-discovery', 'feature', 'none', '.leeway/.inbox/.archived/ideas/x.md'], /not a live inbox path/);
    refused(dir, ['leeway-discovery', 'feature', 'none', 'README.md'], /not a live inbox path/);
    refused(dir, ['leeway-discovery', 'feature', 'none', `${IDEA},${IDEA}`], /duplicate inbox path/);
    refused(dir, ['leeway-discovery', 'feature', 'none', `${IDEA},`], /not a live inbox path/);
  });

  it('a seed path holding a double quote refuses — it would end the quotes discovery reads it inside', () => {
    const quoted = '.leeway/.inbox/ideas/2026-01-04--a "b".md';
    createFile(dir, quoted, '# Quoted\n');
    refused(dir, ['leeway-discovery', 'feature', 'none', quoted], /^inbox seeds travel quoted — a path cannot hold a double quote/);
  });

  it('the roadmap takes open alone — its genesis and pull carry the live conversation and never hand off', () => {
    refused(dir, ['leeway-roadmap', 'genesis'], /^the mode must be open — got "genesis"$/);
    refused(dir, ['leeway-roadmap', 'pull'], /^the mode must be open — got "pull"$/);
  });

  it('the epic menu refuses a unit that is no epic, a phase outside the epic\'s, and an unknown outcome', () => {
    refused(dir, ['leeway-continue-epic', 'note-window'], /^work unit "note-window" is of type feature, not epic$/);
    refused(dir, ['leeway-continue-epic', 'none'], /^work unit "none" not found$/);
    refused(dir, ['leeway-continue-epic', 'fumi', 'investigation', 'completed'], /^the phase must be one of discovery\|experiment\|discussion\|specification\|planning\|implementation\|review — got "investigation"$/);
    refused(dir, ['leeway-continue-epic', 'fumi', 'discussion', 'abandoned'], /^the outcome must be one of completed\|paused\|cancelled\|postponed — got "abandoned"$/);
  });

  it('the epic menu refuses a pause from a phase its paused banner cannot name', () => {
    for (const phase of EPIC_PHASES.filter((p) => !PAUSING_PHASES.includes(p))) {
      refused(dir, ['leeway-continue-epic', 'fumi', phase, 'paused'],
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
    refused(dir, ['leeway-planning-process', 'saga', 'note-window'], /^the work type must be one of epic\|feature\|bugfix — got "saga"$/);
  });

  it('a phase\'s skill refuses a work unit the project does not hold, or holds as another type', () => {
    refused(dir, ['leeway-planning-process', 'feature', 'ghost'], /^work unit "ghost" not found$/);
    refused(dir, ['leeway-planning-process', 'epic', 'note-window', 'auth'], /^work unit "note-window" is of type feature, not epic$/);
    refused(dir, ['leeway-planning-process', 'feature', 'none'], /^work unit "none" not found$/);
  });

  it('a work unit whose manifest does not parse refuses as corrupt, never as a unit not found', () => {
    createFile(dir, '.leeway/broken/manifest.json', '{not json');
    refused(dir, ['leeway-planning-process', 'feature', 'broken'], /^invalid JSON in .*\/\.leeway\/broken\/manifest\.json: /);
    refused(dir, ['leeway-continue-epic', 'broken'], /^invalid JSON in /);
  });

  it('a work unit no longer in progress refuses — a handoff moves into work in progress', () => {
    createManifest(dir, 'shipped', { work_type: 'feature', status: 'completed' });
    createManifest(dir, 'dropped', { work_type: 'epic', status: 'cancelled' });
    refused(dir, ['leeway-review-process', 'feature', 'shipped'], /^work unit "shipped" is completed — a handoff moves into work in progress$/);
    refused(dir, ['leeway-continue-epic', 'dropped'], /^work unit "dropped" is cancelled — a handoff moves into work in progress$/);
  });

  it('a name that would break addressing refuses before anything is read', () => {
    refused(dir, ['leeway-planning-process', 'feature', '../note-window'], /^"\.\.\/note-window" is not a legal work unit name/);
    refused(dir, ['leeway-discussion-process', 'epic', 'fumi', 'pay.ments'], /^"pay\.ments" is not a legal topic name/);
    refused(dir, ['leeway-discussion-process', 'epic', 'fumi', 'pay/ments'], /^"pay\/ments" is not a legal topic name/);
    refused(dir, ['leeway-discussion-process', 'epic', 'fumi', ''], /^"" is not a legal topic name/);
  });

  it('an argument that whitespace or a quote would split refuses — the invocation could not carry it', () => {
    for (const arg of ['note window', 'note\twindow', 'it\'s', 'say"so']) {
      refused(dir, ['leeway-discussion-process', 'epic', 'fumi', arg], /cannot travel as one argument — whitespace and quotes split it$/);
    }
  });

  it('an argument holding a backtick refuses, the quoted seeds included — it would end the continuation\'s code span', () => {
    refused(dir, ['leeway-discussion-process', 'epic', 'fumi', '`x`'], /^"`x`" cannot travel in the continuation — a backtick ends its code span$/);
    const ticked = '.leeway/.inbox/ideas/2026-01-05--a`b.md';
    createFile(dir, ticked, '# Ticked\n');
    refused(dir, ['leeway-discovery', 'feature', 'none', ticked], /cannot travel in the continuation — a backtick ends its code span$/);
  });
});
