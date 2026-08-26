// Engine adapter — phase-0 §2. In-process reads via a thin Node child that
// requires the target project's lib.cjs and emits JSON; direct manifest.json
// reads from the bridge. CLI shelling is reserved for renders (none in Phase 0);
// every engine invocation pins WORKFLOWS_DISPLAY_WIDTH. Gateway text (DATA
// sections, ACTIONS tables) is never scraped.
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = path.join(path.dirname(fileURLToPath(import.meta.url)), 'engine-host.cjs');

// Engine discovery (phase-0 §5): the installed product's scripts directory.
export function discoverEngine(projectRoot: string): string | null {
  const candidates = [
    path.join(projectRoot, '.claude', 'skills', 'workflow-engine', 'scripts'),
    path.join(projectRoot, 'skills', 'workflow-engine', 'scripts'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'lib.cjs'))) return c;
  }
  return null;
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class EngineAdapter {
  private child: ChildProcess | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(
    readonly projectRoot: string,
    readonly enginePath: string,
    readonly displayWidth = 65,
  ) {}

  private ensureChild(): ChildProcess {
    if (this.child && this.child.exitCode === null) return this.child;
    const lib = path.join(this.enginePath, 'lib.cjs');
    this.child = spawn(process.execPath, [HOST, lib, this.projectRoot], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env, WORKFLOWS_DISPLAY_WIDTH: String(this.displayWidth) },
    });
    const rl = createInterface({ input: this.child.stdout! });
    rl.on('line', (line) => {
      let msg: { id: number | null; ok: boolean; result?: unknown; error?: string };
      try {
        msg = JSON.parse(line);
      } catch {
        return;
      }
      const p = msg.id !== null ? this.pending.get(msg.id) : undefined;
      if (!p) return;
      this.pending.delete(msg.id as number);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(msg.error ?? 'engine error'));
    });
    this.child.on('exit', () => {
      for (const p of this.pending.values()) p.reject(new Error('engine host exited'));
      this.pending.clear();
    });
    return this.child;
  }

  call<T = unknown>(method: string, args: Record<string, unknown> = {}): Promise<T> {
    const child = this.ensureChild();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      child.stdin!.write(JSON.stringify({ id, method, args }) + '\n');
    });
  }

  // Direct manifest reads — the bridge reads manifest.json files itself
  // (phase-0 §2); the child is for derivations that must run engine code.
  readProjectManifest(): Record<string, unknown> | null {
    return readJson(path.join(this.projectRoot, '.workflows', 'manifest.json'));
  }

  readUnitManifest(name: string): Record<string, unknown> | null {
    return readJson(path.join(this.projectRoot, '.workflows', name, 'manifest.json'));
  }

  async epicDetailFor(manifest: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.call('epicDetailFor', { manifest });
  }

  async scanPresence(workUnit?: string): Promise<unknown> {
    return this.call('scanPresence', workUnit ? { workUnit } : {});
  }

  stop(): void {
    this.child?.kill();
    this.child = null;
  }
}

function readJson(p: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}
