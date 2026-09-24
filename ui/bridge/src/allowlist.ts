// The tool allowlist — GENERATED, not remembered (spec 2): built mechanically
// at bridge start by sweeping the installed product's skills' frontmatter
// `allowed-tools`, union'd with the SDK basics. Hand-enumeration was found
// verifiably incomplete; a permission prompt firing headless is an allowlist
// bug logged on the observability floor.
import fs from 'node:fs';
import path from 'node:path';

// The generated allowlist governs BASH ONLY. File tools (Write/Edit/…) and the
// read-only basics are decided by the session manager's canUseTool policy, not
// by declarative rules — the harness's sensitive-file guard shadows declarative
// file grants under acceptEdits, and a bare tool name auto-approves before the
// callback runs (both measured, round 8). SDK_BASICS therefore lists Bash
// prefixes only; the tool-name basics are named in canUseTool.
export const SDK_BASICS: string[] = [];

function splitOutsideParens(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

/** Parse the frontmatter `allowed-tools` list of one SKILL.md. */
export function skillAllowedTools(skillMd: string): string[] {
  const fm = skillMd.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return [];
  const lines = fm[1]!.split('\n');
  const tools: string[] = [];
  let inList = false;
  for (const line of lines) {
    const inline = line.match(/^allowed-tools:\s*(.+)$/);
    if (inline && inline[1]!.trim() !== '') {
      // Inline form: comma-separated, but Bash(...) scopes may hold commas —
      // split only outside parentheses.
      return splitOutsideParens(inline[1]!)
        .map((t) => t.trim())
        .filter(Boolean);
    }
    if (/^allowed-tools:\s*$/.test(line)) {
      inList = true;
      continue;
    }
    if (inList) {
      const item = line.match(/^\s+-\s+(.+)$/);
      if (item) tools.push(item[1]!.trim());
      else if (!/^\s/.test(line)) break;
    }
  }
  return tools;
}

// Base dev-command prefixes the pipeline legitimately runs beyond the skills'
// own frontmatter (the implementation phase executes project code and tests;
// review agents read history). Each permission denial observed in a session is
// an allowlist bug — this set grew from round 8's live run.
export const BASE_BASH = [
  'node',
  'npm test',
  'npm run',
  'ls',
  'cat',
  'head',
  'tail',
  'grep',
  'rg',
  'wc',
  'find',
  'mkdir',
  'git status',
  'git diff',
  'git log',
  'git add',
  'git commit',
  'git show',
  'git rev-parse',
  'git blame',
  'git bisect',
  'git rm --cached',
  // Cache housekeeping the skills legitimately run (spec 2 named these as the
  // hand-enumeration gap) — scoped to the workflow cache, never bare.
  'rm -rf .workflows/.cache',
  'rm .workflows/.cache',
  'mv .workflows/.cache',
];

/**
 * Sweep the installed product for the union allowlist. Skills live under
 * `<project>/.claude/skills/` in an installed project.
 */
export function generateAllowlist(projectRoot: string): string[] {
  const skillsDir = path.join(projectRoot, '.claude', 'skills');
  const union = new Set<string>(SDK_BASICS);
  // Absolute-form grants too — relative patterns don't reliably resolve
  // against the session cwd in every harness context (measured).
  for (const b of BASE_BASH) union.add(`Bash(${b}:*)`);
  let names: string[] = [];
  try {
    names = fs.readdirSync(skillsDir);
  } catch {
    return [...union].sort();
  }
  for (const name of names) {
    const p = path.join(skillsDir, name, 'SKILL.md');
    let text: string;
    try {
      text = fs.readFileSync(p, 'utf8');
    } catch {
      continue;
    }
    for (const t of skillAllowedTools(text)) {
      union.add(t);
      // A frontmatter grant `Bash(cmd)` means "this command" — but the
      // permission-rule grammar matches it as the EXACT argv-less string, so
      // `cmd boot` still prompts (observed live). Expand to the wildcard form
      // alongside the literal.
      const bash = t.match(/^Bash\((.+)\)$/);
      if (bash && !bash[1]!.includes('*')) union.add(`Bash(${bash[1]}:*)`);
    }
  }
  return [...union].sort();
}
