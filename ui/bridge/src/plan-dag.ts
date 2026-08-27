// The plan DAG (phase-5 §3). A lowest-common-denominator model — tasks + deps
// + status — read per adapter, honestly split. local-markdown parses task-file
// frontmatter (the shipped format, fixture-pinned); tick reads its own CLI's
// graph; Linear degrades to link-out (its access channel is the session's MCP
// tools, which the bridge does not have). The TS readers are a knowing,
// contained duplication of prose instructions — retired if an `engine tasks`
// verb lands (UPSTREAM #5). Read-only.
import fs from 'node:fs';
import path from 'node:path';

export type PlanTask = {
  id: string;
  title: string;
  phase: string | null;
  status: string;
  priority: number;
  dependsOn: string[];
};

export type PlanDag =
  | { format: 'local-markdown' | 'tick'; tasks: PlanTask[] }
  | { format: 'linear'; linkOut: string | null }
  | { format: 'unknown'; tasks: [] };

/** Minimal YAML frontmatter parse (the fields the DAG needs, nothing more). */
export function parseFrontmatter(md: string): Record<string, unknown> {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, unknown> = {};
  const lines = m[1]!.split('\n');
  let listKey: string | null = null;
  const list: string[] = [];
  const flush = () => {
    if (listKey) out[listKey] = [...list];
    listKey = null;
    list.length = 0;
  };
  for (const line of lines) {
    const item = line.match(/^\s+-\s+(.+)$/);
    if (item && listKey) {
      list.push(item[1]!.trim());
      continue;
    }
    flush();
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!kv) continue;
    if (kv[2]!.trim() === '') {
      listKey = kv[1]!;
    } else {
      out[kv[1]!] = kv[2]!.trim();
    }
  }
  flush();
  return out;
}

function titleFromBody(md: string, id: string): string {
  const h = md.match(/^#\s+(.+)$/m);
  return h ? h[1]!.trim() : id;
}

/** local-markdown: task files at planning/{topic}/tasks/{id}.md. */
export function readLocalMarkdownDag(projectRoot: string, workUnit: string, topic: string): PlanTask[] {
  const dir = path.join(projectRoot, '.workflows', workUnit, 'planning', topic, 'tasks');
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
  const tasks: PlanTask[] = [];
  for (const f of files) {
    let md: string;
    try {
      md = fs.readFileSync(path.join(dir, f), 'utf8');
    } catch {
      continue;
    }
    const fm = parseFrontmatter(md);
    const id = String(fm.id ?? f.replace(/\.md$/, ''));
    tasks.push({
      id,
      title: titleFromBody(md, id),
      phase: fm.phase != null ? String(fm.phase) : null,
      status: String(fm.status ?? 'pending'),
      priority: fm.priority != null ? Number(fm.priority) : 0,
      dependsOn: Array.isArray(fm.depends_on) ? (fm.depends_on as string[]).map(String) : [],
    });
  }
  return tasks.sort((a, b) => a.id.localeCompare(b.id));
}

/** tick: read its CLI's graph output — a JSON export the bridge shells for. */
export function readTickDag(_projectRoot: string, _workUnit: string, _topic: string): PlanTask[] {
  // tick's graph is its own CLI's JSON; the shape below is its lowest-common
  // projection. In the prototype the tick CLI is not installed, so this
  // returns []; the reader exists so the format branch is honest and the
  // done-means DAG-equality test can drive both readers over one fixture.
  return [];
}

export function planDag(
  projectRoot: string,
  workUnit: string,
  topic: string,
  format: string,
): PlanDag {
  switch (format) {
    case 'local-markdown':
      return { format: 'local-markdown', tasks: readLocalMarkdownDag(projectRoot, workUnit, topic) };
    case 'tick':
      return { format: 'tick', tasks: readTickDag(projectRoot, workUnit, topic) };
    case 'linear':
      return { format: 'linear', linkOut: null };
    default:
      return { format: 'unknown', tasks: [] };
  }
}
