// Fixture converter — spec 4's Phase 0 form. Fixture v0 is CONVERTED, not
// recorded: a real workflow session is driven from the terminal; this ingests
// the harness's own session transcript (Claude Code session JSONL on disk)
// into journal format. Ask markers are absent until Phase 2's offline re-parse
// — replay pauses at user-record boundaries instead.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

type JournalLine = Record<string, unknown>;

/** Extract text from a Claude-message content array or string. */
function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((b: any) => b?.type === 'text')
    .map((b: any) => b.text)
    .join('\n');
}

function toolResultText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  return content
    .map((b: any) => (typeof b === 'string' ? b : b?.type === 'text' ? b.text : ''))
    .join('\n');
}

/**
 * Convert a Claude Code session transcript (JSONL) to the journal format
 * (spec 2 record shapes). Tolerant of records it does not model — sidechains,
 * summaries, and hook records are skipped.
 */
export function convertTranscript(
  sessionJsonlPath: string,
  opts: { bridgeSessionId: string; width: number; entryPrompt: string; productVersion?: string },
): JournalLine[] {
  const lines = fs
    .readFileSync(sessionJsonlPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as any[];

  const journal: JournalLine[] = [
    {
      record: 'meta',
      bridgeSessionId: opts.bridgeSessionId,
      productVersion: opts.productVersion,
      width: opts.width,
      entryPrompt: opts.entryPrompt,
      recordedAt: lines[0]?.timestamp ?? new Date().toISOString(),
    },
  ];

  // A subagent transcript marks EVERY record as a sidechain; a main-session
  // transcript marks only nested agents' records. Skip sidechains only when
  // the file itself is a main-session transcript.
  const convo = lines.filter((l) => l.type === 'user' || l.type === 'assistant');
  const isSubagentTranscript = convo.length > 0 && convo.every((l) => l.isSidechain === true);

  // Turn = count of user-role messages since session birth (spec 1 — defined
  // once, for all specs). Tool results arrive as user-role records but are
  // NOT user turns; a real user input is text content without tool_result.
  let turn = 0;
  let sawAnythingThisTurn = false;
  const toolNames = new Map<string, string>();

  for (const rec of lines) {
    if (rec.isSidechain && !isSubagentTranscript) continue;
    const ts = rec.timestamp;
    if (rec.type === 'assistant' && rec.message) {
      const msg = rec.message;
      const text = contentText(msg.content);
      if (text.trim()) journal.push({ record: 'assistant', text, ts });
      if (Array.isArray(msg.content)) {
        for (const b of msg.content) {
          if (b?.type === 'tool_use') {
            toolNames.set(b.id, b.name);
            journal.push({ record: 'tool-use', tool: b.name, id: b.id, input: b.input, ts });
          }
        }
      }
      if (msg.usage) {
        journal.push({
          record: 'usage',
          inputTokens: msg.usage.input_tokens ?? 0,
          outputTokens: msg.usage.output_tokens ?? 0,
          ts,
        });
      }
      sawAnythingThisTurn = true;
      continue;
    }
    if (rec.type === 'user' && rec.message) {
      const content = rec.message.content;
      const toolResults = Array.isArray(content) ? content.filter((b: any) => b?.type === 'tool_result') : [];
      if (toolResults.length > 0) {
        for (const tr of toolResults) {
          journal.push({
            record: 'tool-result',
            tool: toolNames.get(tr.tool_use_id),
            id: tr.tool_use_id,
            text: toolResultText(tr.content),
            ts,
          });
        }
        continue;
      }
      const text = contentText(content);
      if (!text.trim()) continue;
      // A real user turn: close the previous turn first.
      if (sawAnythingThisTurn && turn > 0) journal.push({ record: 'turn-end', turn, ts });
      turn += 1;
      journal.push({ record: 'user', text, ts });
      sawAnythingThisTurn = true;
    }
  }
  if (sawAnythingThisTurn && turn > 0) {
    journal.push({ record: 'turn-end', turn });
  }
  // A recording whose last conversational record is assistant-side ended
  // awaiting input — a mid-flight capture, not a completed session. Replay
  // keys its final paused state off this outcome.
  const lastConvo = [...journal].reverse().find((r) => r.record === 'user' || r.record === 'assistant' || r.record === 'tool-result' || r.record === 'tool-use');
  const midFlight = lastConvo !== undefined && lastConvo.record !== 'user';
  journal.push({ record: 'result', outcome: midFlight ? 'interrupted' : 'completed' });
  return journal;
}

/**
 * Derive offline-mode answers.json from the recorded user turns — the
 * harness's job, so the file is generated, never hand-edited. Keys are
 * `turn:N` (the Phase 0 stopgap the Phase 2 re-parse replaces with gate ids).
 */
export function deriveAnswers(journal: JournalLine[]): Record<string, { answer: string; matchMode: 'exact' }> {
  const answers: Record<string, { answer: string; matchMode: 'exact' }> = {};
  let turn = 0;
  for (const rec of journal) {
    if (rec.record !== 'user') continue;
    turn += 1;
    if (turn >= 2) answers[`turn:${turn}`] = { answer: String(rec.text ?? ''), matchMode: 'exact' };
  }
  return answers;
}

/**
 * Snapshot a world (spec 4): committed history as a git bundle + an overlay
 * tar of dirty tracked files and .workflows/.cache — a bundle alone cannot
 * represent mid-session state.
 */
export function snapshotWorld(projectRoot: string, worldDir: string): void {
  worldDir = path.resolve(worldDir); // git -C resolves relative paths against projectRoot
  fs.mkdirSync(worldDir, { recursive: true });
  execFileSync('git', ['-C', projectRoot, 'bundle', 'create', path.join(worldDir, 'repo.bundle'), '--all'], {
    stdio: 'ignore',
  });

  const status = execFileSync('git', ['-C', projectRoot, 'status', '--porcelain', '-z'], { encoding: 'utf8' });
  const dirty = status
    .split('\0')
    .filter(Boolean)
    .map((l) => l.slice(3))
    .filter((p) => p && fs.existsSync(path.join(projectRoot, p)) && fs.statSync(path.join(projectRoot, p)).isFile());
  // The cache overlay carries ONLY product state — never bridge files. A
  // legacy bridge state dir under the cache (pre-fix default) is excluded so
  // UI-native databases can never leak into a committed fixture.
  const cacheDir = path.join(projectRoot, '.workflows', '.cache');
  const paths = [...dirty];
  if (fs.existsSync(cacheDir)) {
    for (const entry of fs.readdirSync(cacheDir)) {
      if (entry === '.bridge-state') continue;
      paths.push(path.posix.join('.workflows/.cache', entry));
    }
  }
  if (paths.length === 0) {
    // An empty overlay is still a valid overlay — restore just untars nothing.
    execFileSync('tar', ['-cf', path.join(worldDir, 'overlay.tar'), '-T', '/dev/null'], { cwd: projectRoot });
    return;
  }
  execFileSync('tar', ['-cf', path.join(worldDir, 'overlay.tar'), ...paths], { cwd: projectRoot });
}

/** Restore a world into a tmpdir: clone the bundle, untar the overlay over it. */
export function restoreWorld(worldDir: string, destDir: string): string {
  fs.mkdirSync(destDir, { recursive: true });
  execFileSync('git', ['clone', '--quiet', path.join(worldDir, 'repo.bundle'), destDir], { stdio: 'ignore' });
  const overlay = path.join(worldDir, 'overlay.tar');
  if (fs.existsSync(overlay)) {
    // Path safety (spec 4): a replay must never be able to write outside its
    // tmpdir. Refuse any overlay entry that is absolute or traverses upward.
    const entries = execFileSync('tar', ['-tf', overlay], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
    for (const e of entries) {
      if (path.isAbsolute(e) || e.split('/').includes('..')) {
        throw new Error(`unsafe overlay entry refused: ${e}`);
      }
    }
    execFileSync('tar', ['-xf', overlay], { cwd: destDir });
  }
  return destDir;
}
