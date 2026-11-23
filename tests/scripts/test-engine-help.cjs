'use strict';

// ---------------------------------------------------------------------------
// `help` — one verb's usage, cut from the engine's whole usage (engine.cjs,
// `runHelp`): a verb's forms whole, each line `engine …`, the lines that
// carry a form on kept with it; a sub-verb's forms alone; an unknown verb,
// or none, refused in the shape every family refuses, its usage, naming
// every verb on one line, and a sub-verb the verb lacks naming the verb's
// help, neither echoing the word asked; and it answers in a conversation
// boot has not run in, where a verb that touches work refuses.
//
// Layer: verb. World: the project world, copied once for the file; `help`
// writes nothing, so every test shares it.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { call, refusedPristine, setupGitFixture, cleanupFixture } = require('./engine-harness.cjs');
const { COMMANDS } = require('../../skills/ledger-engine/scripts/engine.cjs');

/** @type {string} */ let dir;
before(() => { dir = setupGitFixture('engine-help-'); });
after(() => cleanupFixture(dir));

/** The answer of `engine help …args`. @param {string[]} args @param {object} [opts] */
const help = (args, opts) => call(dir, ['help', ...args], opts);

/** The verbs a refusal names, sorted. @param {string} error */
const verbsNamed = (error) => error.slice(error.indexOf(' — the verbs: ') + ' — the verbs: '.length).split(', ').sort();

describe('help <verb>', () => {
  it('prints the verb\'s forms as the whole usage says them, each `engine …`, and nothing else', () => {
    const forms = call(dir, ['no-such-verb']).stderr.split('\n').filter((line) => line.startsWith('  raise '));

    assert.ok(forms.some((line) => line.startsWith('  raise draw ')) && forms.some((line) => line.includes('(the call as JSON on stdin)')));
    assert.deepStrictEqual(help(['raise']), { stdout: `${forms.map((line) => `engine ${line.slice(2)}`).join('\n')}\n`, stderr: '', code: 0 });
  });

  it('keeps the line that carries a form on beside it, under the form\'s words', () => {
    assert.strictEqual(help(['workunit', 'create']).stdout,
      'engine workunit create <work-unit> <work-type> --description <text> --session-log-file <path>\n'
      + '                       [--seed <path> …]\n');
  });
});

describe('help <verb> <sub>', () => {
  it('prints the sub-verb\'s forms alone', () => {
    assert.strictEqual(help(['raise', 'draw']).stdout, 'engine raise draw <work-unit> <question>   (by its number, Q{n}, or its park\'s id)\n');
    assert.deepStrictEqual(help(['roadmap', 'horizon']).stdout.trimEnd().split('\n').map((line) => line.split(' ').slice(0, 4).join(' ')), [
      'engine roadmap horizon add', 'engine roadmap horizon rename', 'engine roadmap horizon reorder',
      'engine roadmap horizon merge', 'engine roadmap horizon split', 'engine roadmap horizon remove',
    ]);
  });

  it('refuses a sub-verb the verb lacks, naming the verb\'s help', () => {
    assert.strictEqual(refusedPristine(dir, ['help', 'raise', 'nope']).error, 'Usage: engine help <verb> [<sub>] — raise\'s forms: engine help raise');
  });
});

describe('help refusing', () => {
  it('refuses an unknown verb, no verb, or a word past the sub-verb with its usage, naming every verb the engine dispatches on one line', () => {
    for (const args of [['nope'], [], ['roadmap', 'horizon', 'add']]) {
      const { error } = refusedPristine(dir, ['help', ...args]);
      assert.match(error, /^Usage: engine help <verb> \[<sub>\] — the verbs: [^\n]+$/, args.join(' '));
      assert.deepStrictEqual(verbsNamed(error), Object.keys(COMMANDS).sort(), args.join(' '));
    }
  });
});

describe('help before boot', () => {
  it('answers in a conversation boot has not run in, where a verb that touches work is refused', () => {
    const opts = { env: { CLAUDE_CODE_SESSION_ID: 'never-booted' }, unbooted: true };

    assert.deepStrictEqual(help(['brownfield'], opts), { stdout: 'engine brownfield record <native|skipped|accepted|completed>\n', stderr: '', code: 0 });
    assert.match(call(dir, ['brownfield', 'record', 'native'], opts).stderr, /has not booted Ledger/);
  });
});
