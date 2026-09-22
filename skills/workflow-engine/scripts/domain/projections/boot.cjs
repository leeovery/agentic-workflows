'use strict';

// ---------------------------------------------------------------------------
// Domain ring: workflow-start's boot gates — the static menus Step 0 puts to
// the user before any work is on the table, and the knowledge gate's
// displays. Pure renderers; none reads state (the calling prose branches on
// the boot response and fetches the gate at its display point, and the
// render surface reads what a display names).
// ---------------------------------------------------------------------------

const { section, menu, cmdOption, promptOption, CONTINUE_INSTRUCTION } = require('./surfaces.cjs');
const { wrapWithPrefix } = require('../../kernel/render.cjs');
const { displayWidth } = require('../../kernel/terminal.cjs');

const MENU_INSTRUCTION = "emit verbatim as markdown, then STOP for the user's response";
const ABOVE_MENU_INSTRUCTION = 'emit verbatim as a code block, directly above the menu';

const WIZARD_COMMAND = 'node .claude/skills/workflow-knowledge/scripts/knowledge.cjs setup';

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
 * The one-time gate-surface opt-in.
 * @returns {string}
 */
function gateSurfaceGate() {
  const body = menu(
    '',
    [
      cmdOption('y', 'yes', 'Draw the gates above the prompt'),
      cmdOption('n', 'no', 'Keep the gates as text menus'),
    ],
    { question: 'Turn the gate surface on for this project?' },
  );
  return section('MENU: gate surface gate', MENU_INSTRUCTION, body);
}

/**
 * A knowledge configuration by name: provider · model, or keyword-only.
 * @param {{provider?: string|null, model?: string|null}} config
 * @returns {string}
 */
function configurationName({ provider, model }) {
  return provider ? [provider, model].filter(Boolean).join(' · ') : 'keyword-only';
}

// The knowledge gate's menus, keyed by what each asks: reuse = adopt the
// system configuration (its yes row names it — provider · model, or
// keyword-only), deviate = the per-project alternatives to it, mode = the
// search-mode pick with no system configuration to lean on, retry = the
// re-run after the key is stored, wizard = the wait while the terminal
// wizard runs (its display names the command).
/** @type {Record<string, (config: {provider?: string, model?: string}) => {question: string, options: string[], display?: string[]}>} */
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
  retry: () => ({
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
 * keyword-only.
 * @param {string} variant @param {{provider?: string, model?: string}} [config]
 * @returns {string}
 */
function knowledgeGate(variant, config = {}) {
  const gate = KNOWLEDGE_GATES[variant](config);
  const gateMenu = section(`MENU: knowledge ${variant} gate`, MENU_INSTRUCTION, menu('', gate.options, { question: gate.question }));
  if (!gate.display) return gateMenu;
  return [section(`DISPLAY: knowledge ${variant}`, ABOVE_MENU_INSTRUCTION, gate.display.join('\n')), gateMenu].join('\n');
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

module.exports = { migrationGate, labelGate, gateSurfaceGate, knowledgeGate, knowledgeReady, KNOWLEDGE_GATE_VARIANTS };
