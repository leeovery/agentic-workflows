'use strict';

// ---------------------------------------------------------------------------
// Where the start goes once boot has run (leeway-engine/scripts/domain/
// boot-route.cjs with domain/boot.cjs and `render work-pick`): one entry, the
// person's bare command and Claude's invocation alike, boot given the
// person's words on stdin. No words go to the start menu; words naming
// nothing go to Start's type call; words naming one piece of work in
// progress, and nothing more, go into it as the start menu's number does;
// words that carry on and name nothing, into the work in progress; words
// naming work among other words, several pieces of it, or a closed unit go
// to the pick. The setup gates come with it (test-engine-boot-gates.cjs
// holds which are due); a few boots hold the wiring. The bare command sends
// no words, its stdin empty, closed, or the start skill's one empty line.
//
// Layer: verb, and process for the bare command's stdin. World: a project
// with work in progress — a feature, a bugfix, an epic with three topics,
// one renamed and one decided, and an epic as a pivot leaves it, its first
// topic of its own name, its others named as the bugfix and the cancelled
// unit are — and a completed feature and a cancelled bugfix, made once per
// process and copied; boot runs from a copy of the engine beside a
// stand-in migration runner.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { fixtureFrom, commitAll, WORKFLOW_HOOKS, hooked } = require('./engine-harness.cjs');
const { createFile, createManifest } = require('./discovery-test-utils.cjs');
const { stubbed, readyKnowledge } = require('./boot-world.cjs');
const { entryOf } = require('../../skills/leeway-engine/scripts/domain/boot-route.cjs');

/** A map row of an epic's. @param {number} order @param {Record<string, unknown>} [marks] */
const row = (order, marks = {}) => ({ order, summary: `Topic ${order}`, source: 'discovery', ...marks });

const routeWorld = fixtureFrom('engine-boot-route-', (project) => {
  createFile(project, '.claude/settings.json', hooked(WORKFLOW_HOOKS));
  createManifest(project, 'billing', {
    work_type: 'epic',
    phases: {
      discovery: { items: { invoices: row(1), 'refund-rules': row(2, { title: 'Refund Policy' }), refunds: row(3) } },
      discussion: { items: { refunds: { status: 'completed' } } },
    },
  });
  createManifest(project, 'ledger', { work_type: 'epic', phases: { discovery: { items: { ledger: row(1), crash: row(2), 'old-reports': row(3) } } } });
  createManifest(project, 'crash', { work_type: 'bugfix' });
  createManifest(project, 'payments', { work_type: 'feature' });
  createManifest(project, 'search', { status: 'completed' });
  createManifest(project, 'old-reports', { work_type: 'bugfix', status: 'cancelled' });
  commitAll(project, 'init');
});

/** Start's type call, as the start menu's s makes it. */
const TO_START = { kind: 'invoke', skill: 'leeway-discovery', args: ['start', 'none'] };
/** The moves into each piece of work, as `handoff unit` and `handoff topic` compose them. */
const INTO = {
  payments: { kind: 'invoke', skill: 'leeway-discussion-process', args: ['feature', 'payments'] },
  crash: { kind: 'invoke', skill: 'leeway-investigation-process', args: ['bugfix', 'crash'] },
  billing: { kind: 'invoke', skill: 'leeway-continue-epic', args: ['billing'] },
  ledger: { kind: 'invoke', skill: 'leeway-continue-epic', args: ['ledger'] },
  invoices: { kind: 'invoke', skill: 'leeway-discussion-process', args: ['epic', 'billing', 'invoices'] },
  'refund-rules': { kind: 'invoke', skill: 'leeway-discussion-process', args: ['epic', 'billing', 'refund-rules'] },
  'ledger/crash': { kind: 'invoke', skill: 'leeway-discussion-process', args: ['epic', 'ledger', 'crash'] },
};
/** Into a unit, as the route gives it. @param {keyof typeof INTO} unit */
const into = (unit) => ({ go: 'route', route: { kind: 'unit', unit, next: INTO[unit] } });
/** The pick over `matches`, as boot gives it. @param {string} matches */
const pickOf = (matches) => ({ go: 'pick', pick: { surface: 'work-pick', args: ['--matches', matches] } });

/** The project's units given the status, the rest as they stand. @param {string} project @param {Record<string, string>} statuses */
function closing(project, statuses) {
  const types = { billing: 'epic', ledger: 'epic', crash: 'bugfix', payments: 'feature' };
  for (const [unit, status] of Object.entries(statuses)) createManifest(project, unit, { work_type: types[/** @type {keyof typeof types} */ (unit)], status });
}

describe('engine boot: where the person\'s words go (18.2.14, 18.2.15, 22.1.6)', () => {
  /** @type {string} */
  let project;
  before(() => { project = routeWorld(); });
  after(() => { fs.rmSync(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  /** Where `words` send the start. @param {string} words */
  const went = (words) => entryOf(project, words);

  it('18.S72: the bare command — no words, the start skill\'s one empty line, or nothing but blanks — goes to the start menu', () => {
    assert.deepStrictEqual(['', '\n', ' \t\n\n'].map(went), [{ go: 'menu' }, { go: 'menu' }, { go: 'menu' }]);
  });

  it('8.S79: words for new work go to Start\'s type call with them, invoked in this conversation', () => {
    assert.deepStrictEqual(went('Change what the help command prints when it has no topic\n'), { go: 'route', route: { kind: 'start', words: 'Change what the help command prints when it has no topic', next: TO_START } });
  });

  it('18.S72: words naming one unit in progress and nothing more go into it where it stands, as the start menu\'s number does — case, hyphens and punctuation aside, the words said around a name carrying no work', () => {
    const routes = ['carry on with the payments feature', 'Payments!', 'can we get back to the crash bugfix please', 'open billing'].map(went);

    assert.deepStrictEqual(routes, [into('payments'), into('payments'), into('crash'), into('billing')]);
  });

  it('the ordinary ways of asking to carry on with a piece of work name nothing more than it, a phase\'s word among them, which opens the work where it stands', () => {
    const phrases = [
      'I want to work on payments', 'let\'s discuss payments', 'what\'s next on payments', 'start payments', 'finish payments', 'payments: next steps',
      'continue payments', 'resume payments', 'pick up payments', 'get back to payments', 'work on payments', 'look at payments',
      'keep going with payments', 'I\'d like to carry on with payments', 'can we look at payments?', 'Review payments', 'let\'s build payments', 'spec payments',
    ];

    assert.deepStrictEqual(phrases.map((words) => [words, went(words)]), phrases.map((words) => [words, into('payments')]));
  });

  it('an epic\'s topic, named by its key or by the title a rename gave it, the epic beside it or not, goes into the phase its topics are talked through', () => {
    const routes = ['invoices', 'billing invoices', 'the refund policy topic', 'refund-rules on billing'].map((words) => went(words));

    assert.deepStrictEqual(routes, [
      { go: 'route', route: { kind: 'unit', unit: 'billing', topic: 'invoices', next: INTO.invoices } },
      { go: 'route', route: { kind: 'unit', unit: 'billing', topic: 'invoices', next: INTO.invoices } },
      { go: 'route', route: { kind: 'unit', unit: 'billing', topic: 'refund-rules', next: INTO['refund-rules'] } },
      { go: 'route', route: { kind: 'unit', unit: 'billing', topic: 'refund-rules', next: INTO['refund-rules'] } },
    ]);
  });

  it('a topic of an epic in progress that cannot be entered — decided — goes to its epic, as the epic\'s name does, the epic named beside it or not', () => {
    assert.deepStrictEqual(['back to refunds', 'refunds on billing'].map(went), [into('billing'), into('billing')]);
  });

  it('a unit in progress named alone wins over a topic of the same name — an epic\'s own, as a pivot leaves it, or another epic\'s — and naming the topic\'s epic beside it reaches the topic', () => {
    const entries = ['ledger', 'open the ledger epic', 'crash', 'the crash topic on ledger'].map(went);

    assert.deepStrictEqual(entries, [into('ledger'), into('ledger'), into('crash'), { go: 'route', route: { kind: 'unit', unit: 'ledger', topic: 'crash', next: INTO['ledger/crash'] } }]);
  });

  it('a unit completed or cancelled, named, goes to the pick, beside something new and any topic of its name; a name inside a longer word names nothing', () => {
    const entries = ['search', 'search is slow on big projects', 'carry on with old reports', 'add a paymentsystem page'].map(went);

    assert.deepStrictEqual(entries, [
      pickOf('search'), pickOf('search'), pickOf('ledger/old-reports,old-reports'), { go: 'route', route: { kind: 'start', words: 'add a paymentsystem page', next: TO_START } },
    ]);
  });

  it('O2: words naming work in progress among other words, or two pieces of it, go to the pick, each piece as `<unit>` or `<unit>/<topic>`', () => {
    const picks = ['payments breaks when a card expires', 'payments and crash', 'invoices for refund policy'].map(went);

    assert.deepStrictEqual(picks, [pickOf('payments'), pickOf('payments,crash'), pickOf('billing/invoices,billing/refund-rules')]);
  });

  it('words that carry on and name nothing name every unit in progress: the pick between several, in the start menu\'s order', () => {
    const entries = ['carry on', 'continue where I left off', 'pick up where we left off'].map(went);

    assert.deepStrictEqual(entries, entries.map(() => pickOf('payments,crash,billing,ledger')));
  });
});

describe('engine boot: carrying on with one unit in progress, or none', () => {
  /** @type {string} */
  let project;
  beforeEach(() => { project = routeWorld(); });
  afterEach(() => { fs.rmSync(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  it('words that carry on go into the one unit in progress, and to Start\'s type call where none is', () => {
    closing(project, { billing: 'completed', ledger: 'cancelled', crash: 'completed' });
    const one = entryOf(project, 'carry on');
    closing(project, { payments: 'completed' });

    assert.deepStrictEqual([one, entryOf(project, 'carry on')], [into('payments'), { go: 'route', route: { kind: 'start', words: 'carry on', next: TO_START } }]);
  });
});

describe('engine boot: the route and the pick, through boot', () => {
  /** @type {string} */
  let project;
  beforeEach(() => { project = routeWorld(); });
  afterEach(() => { fs.rmSync(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  /** Boot given `words` on stdin, outside tmux, `env` over it. @param {string} words @param {Record<string, string|undefined>} [env] */
  const boot = (words, env = {}) => stubbed.ok(project, ['boot'], { env: { TMUX: undefined, ...env }, stdin: words });

  it('the bare command goes to the start menu after the gates every entry shows and the offers nothing has answered, the effort as Claude Code hands it, and the repository\'s account for the brownfield judgment', () => {
    const res = boot('\n', { CLAUDE_EFFORT: 'Low' });

    assert.deepStrictEqual([res.go, res.effort, res.gates], ['menu', 'low', ['knowledge', 'effort', 'walkthrough', 'brownfield']]);
    assert.notStrictEqual(res.brownfield_signal, undefined);
  });

  it('22.S4: Claude\'s entry goes where the words name, after the migration review, the floor\'s stop and the knowledge gate — none of the offers, and no reading of the repository for a judgment it does not make', () => {
    createFile(project, '.claude/skills/leeway-gates/.claude-plugin/plugin.json', '{"name":"leeway-gates"}\n');
    commitAll(project, 'install the mod');

    const res = boot('carry on with payments', {
      STUB_MIGRATE_NOTICES: JSON.stringify([{ id: '067', description: 'a removal', notice: 'Removed a setting.' }]),
      CLAUDE_CODE_ENTRYPOINT: 'cli', AI_AGENT: 'claude-code_2-1-286_agent', CLAUDE_CODE_REMOTE: undefined, CLAUDE_EFFORT: 'Low',
    });

    assert.deepStrictEqual([res.go, res.route, res.gates], ['route', into('payments').route, ['migration-review', 'claude-code-floor', 'knowledge']]);
    assert.deepStrictEqual([res.brownfield_offer, res.brownfield_signal], ['none', undefined]);
  });

  it('the pick shows none of the offers, as Claude\'s entry does not', () => {
    const res = boot('payments breaks when a card expires');

    assert.deepStrictEqual([res.go, res.pick, res.gates], ['pick', pickOf('payments').pick, ['knowledge']]);
  });

  it('once the project has a knowledge base, neither entry shows the knowledge gate', () => {
    readyKnowledge(project);

    assert.deepStrictEqual(['', 'carry on with payments'].map((words) => boot(words).gates), [['walkthrough', 'brownfield'], []]);
  });

  it('the pick draws a row for each piece and one to start something new with the words, and the answer at its gate is the row\'s move — the route\'s own, or a closed unit\'s screen in manage', () => {
    const conversation = { CLAUDE_CODE_SESSION_ID: 'picking' };
    const { pick } = entryOf(project, 'payments breaks when the refund policy changes, as search did');
    const shown = (/** @type {string[]} */ args) => stubbed.output(project, ['render', 'work-pick', ...args], { env: conversation });
    /** The row `key` picked at the pick over `args`, shown again as the person meets it. @param {string[]} args @param {string} key */
    const answer = (args, key) => {
      shown(args);
      return stubbed.ok(project, ['gate', 'work pick', '--pick', key], { env: conversation }).next;
    };
    const screen = shown(pick.args);

    assert.deepStrictEqual(pick.args, ['--matches', 'payments,billing/refund-rules,search']);
    assert.match(screen, /^\*\*`1`\*\* +→ Continue feature: Payments — \*discussion\*$/m);
    assert.match(screen, /^\*\*`2`\*\* +→ Continue epic: Billing — \*the Refund Policy topic\*$/m);
    assert.match(screen, /^\*\*`3`\*\* +→ Manage feature: Search — \*completed\*$/m);
    assert.match(screen, /^\*\*`s\/start`\*\* → Start something new with these words$/m);
    assert.deepStrictEqual(['1', '2', '3', 's'].map((key) => answer(pick.args, key)), [
      INTO.payments, INTO['refund-rules'], { kind: 'engine', argv: ['render', 'manage-unit', 'search', '--from', 'pick', '--matches', 'payments,billing/refund-rules,search'] }, TO_START,
    ]);
    assert.match(shown(['--matches', 'old-reports']), /^\*\*`1`\*\* +→ Manage bugfix: Old Reports — \*cancelled\*$/m);
  });

  it('the pick refuses with no pieces named, and a piece whose move refuses, as the move refuses it', () => {
    assert.match(stubbed.refuses(project, ['render', 'work-pick']).error, /^render work-pick: --matches names the pieces of work the words named/);
    assert.match(stubbed.refuses(project, ['render', 'work-pick', '--matches', 'billing/refunds']).error, /^the topic "refunds" is decided/);
  });
});

describe('engine boot: the bare command\'s stdin, through the real CLI', () => {
  /** @type {string} */
  let project;
  beforeEach(() => { project = routeWorld(); });
  afterEach(() => { fs.rmSync(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  /** Boot run as a process from `project`, its stdin as `shell` leaves it. @param {string} shell */
  function bootAsProcess(shell) {
    const run = spawnSync('sh', ['-c', `exec "$0" "$1" boot ${shell}`, process.execPath, stubbed.path], { cwd: project, env: { ...process.env, TMUX: undefined }, encoding: 'utf8' });
    assert.strictEqual(run.status, 0, run.stderr);
    return JSON.parse(run.stdout).go;
  }

  it('a closed stdin, an empty one and the start skill\'s heredoc of no words are each the bare command; the heredoc carries the words when there are any', () => {
    const heredoc = (/** @type {string} */ words) => `<<'WORDS'\n${words}\nWORDS`;

    assert.deepStrictEqual(['0<&-', '</dev/null', heredoc(''), heredoc('carry on with payments')].map(bootAsProcess), ['menu', 'menu', 'menu', 'route']);
  });
});
