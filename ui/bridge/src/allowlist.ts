// The tool allowlist — GENERATED, not remembered (spec 2): built mechanically
// at bridge start by sweeping the installed product's skills' frontmatter
// `allowed-tools`, union'd with the SDK basics. Hand-enumeration was found
// verifiably incomplete; a permission prompt firing headless is an allowlist
// bug logged on the observability floor.
import fs from 'node:fs';
import path from 'node:path';

export const SDK_BASICS = ['Read', 'Glob', 'Grep', 'Write', 'Edit', 'Skill', 'Task', 'TodoWrite'];

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

/**
 * Sweep the installed product for the union allowlist. Skills live under
 * `<project>/.claude/skills/` in an installed project.
 */
export function generateAllowlist(projectRoot: string): string[] {
  const skillsDir = path.join(projectRoot, '.claude', 'skills');
  const union = new Set<string>(SDK_BASICS);
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
    for (const t of skillAllowedTools(text)) union.add(t);
  }
  return [...union].sort();
}
