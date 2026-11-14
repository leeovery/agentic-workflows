'use strict';

// ---------------------------------------------------------------------------
// Where the start goes once boot has run (leeway-engine/scripts/domain/
// boot-route.cjs with domain/boot.cjs and `render work-pick`): one entry, the
// person's bare command and Claude's invocation alike, boot given the
// person's words on stdin. No words go to the start menu; words naming
// nothing in progress go to Start's type call; words naming one piece of
// work in progress, and nothing more, go into it as the start menu's number
// does; words naming it among other words, or several pieces, go to the
// pick. The setup gates come with it: the migration review and the floor's
// stop on every entry, the offers on the bare command alone. The bare
// command sends no words, its stdin empty, closed, or the start skill's one
// empty line.
//
// Layer: verb, and process for the bare command's stdin. World: a project
// with work in progress — a feature, a bugfix, an epic with two topics, one
// renamed — and a completed feature, made once per process and copied; boot
// runs from a copy of the engine beside a stand-in migration runner.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { fixtureFrom, commitAll, WORKFLOW_HOOKS, hooked } = require('./engine-harness.cjs');
const { createFile, createManifest } = require('./discovery-test-utils.cjs');
const { stubbed } = require('./boot-world.cjs');

/** A map row of the epic's. @param {number} order @param {Record<string, unknown>} [marks] */
const row = (order, marks = {}) => ({ order, summary: `Topic ${order}`, source: 'discovery', ...marks });

const routeWorld = fixtureFrom('engine-boot-route-', (project) => {
  createFile(project, '.claude/settings.json', hooked(WORKFLOW_HOOKS));
  createManifest(project, 'payments', { work_type: 'feature' });
  createManifest(project, 'crash', { work_type: 'bugfix' });
  createManifest(project, 'billing', { work_type: 'epic', phases: { discovery: { items: { invoices: row(1), 'refund-rules': row(2, { title: 'Refund Policy' }) } } } });
  createManifest(project, 'search', { status: 'completed' });
  commitAll(project, 'init');
});

/** Start's type call, as the start menu's s makes it. */
const TO_START = { kind: 'invoke', skill: 'leeway-discovery', args: ['start', 'none'] };
/** The moves into each piece of work, as `handoff unit` and `handoff topic` compose them. */
const INTO = {
  payments: { kind: 'invoke', skill: 'leeway-discussion-process', args: ['feature', 'payments'] },
  crash: { kind: 'invoke', skill: 'leeway-investigation-process', args: ['bugfix', 'crash'] },
  billing: { kind: 'invoke', skill: 'leeway-continue-epic', args: ['billing'] },
  invoices: { kind: 'invoke', skill: 'leeway-discussion-process', args: ['epic', 'billing', 'invoices'] },
  'refund-rules': { kind: 'invoke', skill: 'leeway-discussion-process', args: ['epic', 'billing', 'refund-rules'] },
};

describe('engine boot: where the start goes, from the person\'s words (18.2.14, 18.2.15, 22.1.6)', () => {
  /** @type {string} */
  let project;
  beforeEach(() => { project = routeWorld(); });
  afterEach(() => { fs.rmSync(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

  /** Boot given `words` on stdin, outside tmux, `env` over it. @param {string} words @param {Record<string, string|undefined>} [env] */
  const boot = (words, env = {}) => stubbed.ok(project, ['boot'], { env: { TMUX: undefined, ...env }, stdin: words });
  /** Where boot sent the start: `go`, and its route or pick. @param {Record<string, any>} res */
  const went = ({ go, route, pick }) => ({ go, route, pick });

  it('18.S72: the bare command — no words, the start skill\'s one empty line, or nothing but blanks — goes to the start menu, after each one-time offer nothing has answered', () => {
    const answers = ['', '\n', ' \t\n\n'].map((words) => boot(words));

    assert.deepStrictEqual(answers.map(went), answers.map(() => ({ go: 'menu', route: undefined, pick: undefined })));
    assert.deepStrictEqual(answers[0].gates, ['walkthrough', 'knowledge', 'brownfield']);
  });

  it('8.S79: words for new work go to Start\'s type call with them, invoked in this conversation — no menu, and none of the offers', () => {
    const res = boot('Change what the help command prints when it has no topic\n');

    assert.deepStrictEqual(went(res), { go: 'route', route: { kind: 'start', words: 'Change what the help command prints when it has no topic', next: TO_START }, pick: undefined });
    assert.deepStrictEqual(res.gates, []);
  });

  it('18.S72: words naming one unit in progress and nothing more go into it where it stands, as the start menu\'s number does — case, hyphens and punctuation aside, the words said around a name carrying no work', () => {
    const routes = ['carry on with the payments feature', 'Payments!', 'can we get back to the crash bugfix please', 'open billing'].map((words) => boot(words).route);

    assert.deepStrictEqual(routes, [
      { kind: 'unit', unit: 'payments', next: INTO.payments },
      { kind: 'unit', unit: 'payments', next: INTO.payments },
      { kind: 'unit', unit: 'crash', next: INTO.crash },
      { kind: 'unit', unit: 'billing', next: INTO.billing },
    ]);
  });

  it('an epic\'s topic, named by its key or by the title a rename gave it, the epic beside it or not, goes into the phase its topics are talked through', () => {
    const routes = ['invoices', 'billing invoices', 'the refund policy topic', 'refund-rules on billing'].map((words) => boot(words).route);

    assert.deepStrictEqual(routes, [
      { kind: 'unit', unit: 'billing', topic: 'invoices', next: INTO.invoices },
      { kind: 'unit', unit: 'billing', topic: 'invoices', next: INTO.invoices },
      { kind: 'unit', unit: 'billing', topic: 'refund-rules', next: INTO['refund-rules'] },
      { kind: 'unit', unit: 'billing', topic: 'refund-rules', next: INTO['refund-rules'] },
    ]);
  });

  it('a name the words hold that is no work in progress — a completed unit, or a name inside a longer word — names nothing: the words go to Start', () => {
    const routes = ['search is slow on big projects', 'add a paymentsystem page'].map((words) => boot(words).route);

    assert.deepStrictEqual(routes.map((route) => [route.kind, route.next]), [['start', TO_START], ['start', TO_START]]);
  });

  it('O2: words naming work in progress among other words, or two pieces of it, go to the pick, each piece as `<unit>` or `<unit>/<topic>`', () => {
    const picks = ['payments breaks when a card expires', 'payments and crash', 'invoices for refund policy'].map((words) => went(boot(words)));

    assert.deepStrictEqual(picks, [
      { go: 'pick', route: undefined, pick: { surface: 'work-pick', args: ['--matches', 'payments'] } },
      { go: 'pick', route: undefined, pick: { surface: 'work-pick', args: ['--matches', 'payments,crash'] } },
      { go: 'pick', route: undefined, pick: { surface: 'work-pick', args: ['--matches', 'billing/invoices,billing/refund-rules'] } },
    ]);
  });

  it('the pick draws a row for each piece and one to start something new with the words, and the answer at its gate is the row\'s move — the route\'s own', () => {
    const conversation = { CLAUDE_CODE_SESSION_ID: 'picking' };
    const { pick } = boot('payments breaks when the refund policy changes', conversation);
    const shown = () => stubbed.output(project, ['render', pick.surface, ...pick.args], { env: conversation });
    const screen = shown();
    /** The row `key` picked at the pick shown again, as the person meets it. @param {string} key */
    const answer = (key) => {
      shown();
      return stubbed.ok(project, ['gate', 'work pick', '--pick', key], { env: conversation }).next;
    };

    assert.deepStrictEqual(pick.args, ['--matches', 'payments,billing/refund-rules']);
    assert.match(screen, /^\*\*`1`\*\* +→ Continue feature: Payments — \*discussion\*$/m);
    assert.match(screen, /^\*\*`2`\*\* +→ Continue epic: Billing — \*the Refund Policy topic\*$/m);
    assert.match(screen, /^\*\*`s\/start`\*\* → Start something new with these words$/m);
    assert.deepStrictEqual(['1', '2', 's'].map(answer), [INTO.payments, INTO['refund-rules'], TO_START]);
  });

  it('the pick refuses with no pieces named, and a piece whose move refuses, as the move refuses it', () => {
    assert.match(stubbed.refuses(project, ['render', 'work-pick']).error, /^render work-pick: --matches names the pieces of work the words named/);
    assert.match(stubbed.refuses(project, ['render', 'work-pick', '--matches', 'search']).error, /^search is completed/);
  });

  it('22.S4, O3: the migration review and the floor\'s stop show on every entry, ahead of all else; the bare command adds the offers after them, the effort notice first', () => {
    createFile(project, '.claude/skills/leeway-gates/.claude-plugin/plugin.json', '{"name":"leeway-gates"}\n');
    commitAll(project, 'install the mod');
    const entry = {
      STUB_MIGRATE_NOTICES: JSON.stringify([{ id: '067', description: 'a removal', notice: 'Removed a setting.' }]),
      CLAUDE_CODE_ENTRYPOINT: 'cli', AI_AGENT: 'claude-code_2-1-286_agent', CLAUDE_CODE_REMOTE: undefined, CLAUDE_EFFORT: 'Low',
    };

    const claude = boot('carry on with payments', entry);
    const bare = boot('', { ...entry, TMUX: '/fake/sock,123,7' });

    assert.deepStrictEqual([claude.go, claude.gates], ['route', ['migration-review', 'claude-code-floor']]);
    assert.deepStrictEqual([bare.go, bare.effort, bare.gates], ['menu', 'low', ['migration-review', 'claude-code-floor', 'effort', 'walkthrough', 'session-labels', 'knowledge', 'brownfield']]);
  });

  it('26.S4, 26.S5: the session\'s effort is reported as Claude Code hands it, and none where it hands none — whether it is below medium is the start\'s to say', () => {
    const efforts = ['high', 'medium', 'low', undefined].map((level) => boot('', { CLAUDE_EFFORT: level }));

    assert.deepStrictEqual(efforts.map(({ effort, gates }) => [effort, gates.includes('effort')]), [['high', true], ['medium', true], ['low', true], [null, false]]);
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
