// Observability floor — structured log stream (phase-0 §7). JSON lines on
// stdout; an in-memory ring buffer feeds the debug console.
export type LogEntry = { ts: string; level: 'debug' | 'info' | 'warn' | 'error'; msg: string; [k: string]: unknown };

const RING_SIZE = 500;
const ring: LogEntry[] = [];
const listeners = new Set<(e: LogEntry) => void>();

export function log(level: LogEntry['level'], msg: string, fields: Record<string, unknown> = {}): void {
  const entry: LogEntry = { ts: new Date().toISOString(), level, msg, ...fields };
  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();
  process.stdout.write(JSON.stringify(entry) + '\n');
  for (const l of listeners) l(entry);
}

export const logger = {
  debug: (msg: string, f?: Record<string, unknown>) => log('debug', msg, f),
  info: (msg: string, f?: Record<string, unknown>) => log('info', msg, f),
  warn: (msg: string, f?: Record<string, unknown>) => log('warn', msg, f),
  error: (msg: string, f?: Record<string, unknown>) => log('error', msg, f),
};

export function recentLogs(): LogEntry[] {
  return [...ring];
}

export function onLog(fn: (e: LogEntry) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
