'use strict';

// Prompt assembly: every word an agent reads comes from prose, never
// from a string in code.
//
// Standing instructions — how a walker or asserter behaves — live in
// .claude/agents/prose-*.md and are loaded by the harness when the agent
// is dispatched. What varies per case lives in tests/prose/prompts/*.md,
// assembled here.
//
// A template file is sections delimited by `=== name ===` lines, with
// `{{placeholder}}` slots. This module only splits and substitutes — it
// holds no wording of its own, so changing what an agent is told is a
// prose edit, reviewable as a diff, and identical on every run.
//
// An unfilled placeholder is a hard error rather than something an agent
// silently receives.

const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, '../prompts');

function loadTemplate(name) {
  const raw = fs.readFileSync(path.join(PROMPTS_DIR, `${name}.md`), 'utf8');
  const sections = {};
  let current = null;
  for (const line of raw.split('\n')) {
    const header = line.match(/^=== ([a-z-]+) ===$/);
    if (header) {
      current = header[1];
      sections[current] = [];
      continue;
    }
    if (current) sections[current].push(line);
  }
  for (const key of Object.keys(sections)) {
    sections[key] = sections[key].join('\n').replace(/^\n+|\n+$/g, '');
  }
  return sections;
}

function fill(text, values) {
  const filled = text.replace(/\{\{([a-z_]+)\}\}/g, (match, key) => {
    if (!(key in values)) return match;
    return values[key];
  });
  const leftover = filled.match(/\{\{[a-z_]+\}\}/);
  if (leftover) throw new Error(`prompt placeholder ${leftover[0]} was never filled`);
  return filled;
}

/** Indent a block so it reads as a nested unit inside the prompt. */
function indent(text, by = '    ') {
  return text.split('\n').map((l) => (l.length ? by + l : l)).join('\n');
}

function walkerPrompt({ worldDir, root, situation, task, scope, stubs, answers }) {
  const t = loadTemplate('walker');
  const parts = [
    worldDir ? fill(t.world, { world_dir: worldDir }) : fill(t.structural, { root }),
  ];
  if (situation) parts.push(fill(t.situation, { situation }));
  parts.push(fill(t.task, { task, scope }));
  if (answers) parts.push(fill(t.answers, { answers }));
  if (stubs.length) {
    const entries = stubs.map((s) => fill(t['stub-entry'], {
      name: s.name,
      trigger: s.trigger,
      description: s.description,
      content: indent(s.content),
    })).join('\n');
    parts.push(fill(t.stubs, { entries }));
  }
  return `${parts.join('\n\n')}\n`;
}

function asserterPrompt({ expected, world, actions, checks, walk, substitutions }) {
  const t = loadTemplate('asserter');
  const parts = [fill(t.main, { expected })];
  if (world) parts.push(fill(t.world, { expecting: world.expecting, delta: world.delta }));
  if (actions) parts.push(fill(t.actions, { actions }));
  if (checks) parts.push(fill(t.checks, { checks }));
  if (substitutions) parts.push(fill(t.substitutions, { substitutions }));
  if (walk) parts.push(fill(t.walk, { walk }));
  return `${parts.join('\n\n')}\n`;
}

module.exports = { PROMPTS_DIR, loadTemplate, fill, walkerPrompt, asserterPrompt };
