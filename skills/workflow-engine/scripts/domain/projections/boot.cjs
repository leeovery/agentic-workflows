'use strict';

// ---------------------------------------------------------------------------
// Domain ring: workflow-start's boot gates — the menus Step 0 puts to the
// user before any work is on the table: the state lost, the GitHub rule's
// offer, the migration confirm, the label opt-in — and the knowledge gate's
// displays. Pure renderers; none reads state (the calling prose branches on
// the boot response and fetches the gate at its display point, and the
// render surface reads what a display names).
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, CONTINUE_INSTRUCTION, CONTINUE_MARKDOWN_INSTRUCTION, emitAs, MENU_INSTRUCTION } = require('./surfaces.cjs');
const { wrapWithPrefix } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');
const { ENGINE_COMMAND } = require('../../kernel/call.cjs');
const { escapeMarkdown } = require('./worklist.cjs');

const ABOVE_MENU_INSTRUCTION = emitAs('text', ', directly above the menu');

const WIZARD_COMMAND = `${ENGINE_COMMAND} knowledge setup`;

/**
 * What the migrations did, above the confirm gate: the summary the session
 * wrote, each notice a migration handed back for the person, then the run's
 * counts — left out where the run updated no file and only the verification
 * fixed anything.
 * @param {{summary: string, notices: string[], counts: {migrations: number, files: number}|null}} applied
 * @returns {string}
 */
function migrationsApplied({ summary, notices, counts }) {
  return section('DISPLAY: migrations applied', CONTINUE_MARKDOWN_INSTRUCTION, [
    '**Migrations Applied**',
    '',
    summary,
    ...notices.flatMap((notice) => ['', notice]),
    ...(counts ? ['', `${counts.migrations} migration(s), ${counts.files} file(s) updated.`] : []),
  ].join('\n'));
}

/**
 * The migration confirm gate — after the summary of what the migrations did.
 * @returns {string}
 */
function migrationGate() {
  const body = menu(
    '',
    [
      cmdOption('y', 'yes', 'Proceed'),
      promptOption('Ask', 'Ask questions about the changes'),
    ],
    { question: 'Ready to continue?' },
  );
  return section('MENU: migration gate', MENU_INSTRUCTION, body);
}

/**
 * Boot's stop where the state branch is gone here and on the remote, in a
 * project whose code tree holds the workflows' trace (4.4.5): what was lost,
 * the other clone that can put it back, and the fresh start on yes.
 * @param {string} project the project's name
 * @returns {string}
 */
function stateLostGate(project) {
  const name = escapeMarkdown(project);
  const account = [
    `> ${name} keeps its Leeway state on a branch of its own, \`leeway-state\`. Boot found it neither in this clone nor on the remote.`,
    '>',
    `> If another clone of ${name} still has it, on this machine or another, run Leeway there: boot pushes it back to the remote, and this clone restores it when it next starts.`,
    '>',
    `> Otherwise the state is lost: the decisions, the logs and the ledger. ${name}'s code and its history are untouched.`,
  ];
  return [
    section('DISPLAY: state lost stop', emitAs('properties'), "⚑ Boot stopped: Leeway's state branch is gone"),
    section('DISPLAY: state lost account', emitAs('markdown'), account.join('\n')),
    section('MENU: state lost gate', MENU_INSTRUCTION, menu('', [
      cmdOption('y', 'yes', { head: 'Start again', tail: `a fresh state branch, then the product researcher reads ${name}'s code to rebuild what it can` }),
      cmdOption('n', 'no', { head: 'Not now', tail: 'look for another clone first; nothing is written' }),
    ], { question: 'Start again with a fresh state?' })),
  ].join('\n');
}

/**
 * Setup's offer of the rule on GitHub against deleting or force-pushing the
 * state branch (4.4.7), acted on only on yes.
 * @param {string} project the project's name
 * @returns {string}
 */
function githubRuleGate(project) {
  const name = escapeMarkdown(project);
  return section('MENU: github rule gate', MENU_INSTRUCTION, menu(
    `${name}'s remote is on GitHub. A rule there can refuse deleting or force-pushing \`leeway-state\` for anything run outside Claude Code; inside it, Leeway already refuses both.`,
    [
      cmdOption('y', 'yes', `Set it on ${name}'s repository`),
      cmdOption('n', 'no', { head: 'Leave it unset', tail: 'setup carries on without it' }),
    ],
    { question: 'Set that rule on GitHub?' },
  ));
}

/**
 * The one-time tmux session-label opt-in.
 * @returns {string}
 */
function labelGate() {
  const body = menu(
    '',
    [
      cmdOption('y', 'yes', 'Turn session labels on'),
      cmdOption('n', 'no', 'Leave session names alone'),
    ],
    { question: 'Label your tmux session as you work?' },
  );
  return section('MENU: label gate', MENU_INSTRUCTION, body);
}

/**
 * A knowledge configuration by name: provider · model, or keyword-only.
 * @param {{provider?: string|null, model?: string|null}} config
 * @returns {string}
 */
function configurationName({ provider, model }) {
  return provider ? [provider, model].filter(Boolean).join(' · ') : 'keyword-only';
}

// Where a provider's missing key is stored without touching the chat: the
// commands to run in the terminal, each with what it does beneath it.
/** @param {string} command @param {string} note @returns {string[]} */
function keyCommand(command, note) {
  return [`  ${command}`, ...wrapWithPrefix(note, { width: displayWidth(), prefix: '      ' })];
}

const KEY_ONLY_NOTE = 'Private prompt, input hidden. Stored at ~/.config/workflows/credentials.json (mode 0600).';

/** @type {Record<string, () => string[]>} */
const KEY_INSTRUCTIONS = {
  openai: () => [
    ...wrapWithPrefix('No OpenAI API key was found. Store one without it touching this chat — run ONE of these in your terminal, then come back:', { width: displayWidth() }),
    '',
    ...keyCommand(`${WIZARD_COMMAND} --key-only`, KEY_ONLY_NOTE),
    '',
    ...keyCommand('export OPENAI_API_KEY=<your key>   # note: inline export lands in shell history — --key-only avoids that',
      'Shell environment — takes precedence over the stored key.'),
  ],
  'openai-compatible': () => [
    ...wrapWithPrefix('The endpoint requires an API key. Store one without it touching this chat — run this in your terminal, then come back:', { width: displayWidth() }),
    '',
    ...keyCommand(`${WIZARD_COMMAND} --key-only --provider openai-compatible`, KEY_ONLY_NOTE),
  ],
};

const KEY_PROVIDERS = Object.keys(KEY_INSTRUCTIONS);

// The knowledge gate's menus, keyed by what each asks: reuse = adopt the
// system configuration (its yes row names it — provider · model, or
// keyword-only), deviate = the per-project alternatives to it, mode = the
// search-mode pick with no system configuration to lean on, retry = the
// re-run once the provider's missing key is stored (its display says how,
// with the guidance against pasting the key between it and the menu),
// wizard = the wait while the terminal wizard runs (its display names the
// command).
/** @type {Record<string, (config: {provider?: string, model?: string}) => {question: string, options: string[], display?: string[], displayInstruction?: string}>} */
const KNOWLEDGE_GATES = {
  reuse: ({ provider, model }) => ({
    question: 'Use the existing configuration for this project?',
    options: [
      cmdOption('y', 'yes', `Use the existing configuration (${configurationName({ provider, model })})`),
      cmdOption('d', 'different', 'Choose a different mode for this project'),
      cmdOption('t', 'terminal', 'Run the interactive wizard in your terminal instead'),
    ],
  }),
  deviate: () => ({
    question: 'How should this project deviate?',
    options: [
      cmdOption('k', 'keyword', 'Keyword-only for this project (the system configuration stays untouched for every other project)'),
      cmdOption('t', 'terminal', 'Run the interactive wizard to change the system-wide configuration'),
    ],
  }),
  mode: () => ({
    question: "How should this project's knowledge base work?",
    options: [
      cmdOption('o', 'openai', 'OpenAI embeddings — full semantic search (recommended; needs an API key)'),
      cmdOption('c', 'compatible', 'A local or self-hosted OpenAI-compatible endpoint (LM Studio, Ollama, vLLM)'),
      cmdOption('k', 'keyword', 'Keyword-only search — the no-key backstop; upgrade anytime later'),
      cmdOption('t', 'terminal', 'Run the interactive wizard in your terminal instead'),
    ],
  }),
  retry: ({ provider }) => ({
    display: KEY_INSTRUCTIONS[/** @type {string} */ (provider)](),
    displayInstruction: emitAs('text'),
    question: 'Ready to retry?',
    options: [
      cmdOption('y', 'yes', 'The key is stored — re-run the setup'),
      cmdOption('k', 'keyword', 'Skip the key for now — use keyword-only search instead'),
    ],
  }),
  wizard: () => ({
    display: [
      'Run the wizard in your terminal:',
      '',
      `  ${WIZARD_COMMAND}`,
      '',
      ...wrapWithPrefix('It configures system defaults, initialises the project store, and runs the initial indexing pass.', { width: displayWidth() }),
    ],
    question: 'Has the wizard completed?',
    options: [
      cmdOption('y', 'yes', 'It completed — check the knowledge base again'),
    ],
  }),
};

const KNOWLEDGE_GATE_VARIANTS = Object.keys(KNOWLEDGE_GATES);

/**
 * One of the knowledge gate's menus, beneath the display a variant carries.
 * `config` is the system configuration the reuse variant offers — the
 * provider, with its model when the configuration names one; neither for
 * keyword-only — or the provider whose key the retry variant asks for.
 * @param {string} variant @param {{provider?: string, model?: string}} [config]
 * @returns {string}
 */
function knowledgeGate(variant, config = {}) {
  const gate = KNOWLEDGE_GATES[variant](config);
  const gateMenu = section(`MENU: knowledge ${variant} gate`, MENU_INSTRUCTION, menu('', gate.options, { question: gate.question }));
  if (!gate.display) return gateMenu;
  return [section(`DISPLAY: knowledge ${variant}`, gate.displayInstruction ?? ABOVE_MENU_INSTRUCTION, gate.display.join('\n')), gateMenu].join('\n');
}

/**
 * The knowledge gate's closing line: the configuration this checkout's store
 * was built with.
 * @param {{provider?: string|null, model?: string|null}} store
 * @returns {string}
 */
function knowledgeReady(store) {
  return section('DISPLAY: knowledge ready', CONTINUE_INSTRUCTION, `Knowledge base ready — ${configurationName(store)}.`);
}

module.exports = { migrationsApplied, migrationGate, stateLostGate, githubRuleGate, labelGate, knowledgeGate, knowledgeReady, KNOWLEDGE_GATE_VARIANTS, KEY_PROVIDERS };
