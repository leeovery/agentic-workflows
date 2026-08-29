// The shared chat input (round-13 consolidation): one textarea + send affordance
// used by the thread reply, the gate card's free-text row, comments, and capture
// — a consistent keyboard model (Enter sends, Shift+Enter is a newline) and a
// uniform disabled/busy look. When `attach` is given, it also accepts files
// (pick / paste / drop): each is materialized into the gitignored cache and, on
// send, referenced as `[attached: <path>]` so the session's Read tool picks it
// up. Attachments are offered only where a session actually consumes the turn.
import { useRef, useState } from 'react';
import { clsx } from 'clsx';
import { api } from '../api';

export type AttachContext = { workUnit?: string; bridgeSessionId?: string };
type Pending = { id: number; name: string; path?: string; status: 'uploading' | 'ready' | 'error' };

let pendingSeq = 0;

export function ChatInput({
  onSend,
  placeholder,
  disabled,
  busy,
  sendLabel = 'send',
  attach,
  autoFocus,
  rows = 2,
  inputRef,
  value,
  onChange,
}: {
  onSend: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
  sendLabel?: string;
  attach?: AttachContext; // present → file attachment enabled
  autoFocus?: boolean;
  rows?: number;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  // Optional controlled mode — so a caller (the gate card) can drive the text,
  // e.g. quote-a-comment-into-the-draft. Uncontrolled otherwise.
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [internal, setInternal] = useState('');
  const text = value !== undefined ? value : internal;
  const setText = (v: string) => (onChange ? onChange(v) : setInternal(v));
  const [files, setFiles] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const localRef = useRef<HTMLTextAreaElement>(null);
  const taRef = inputRef ?? localRef;
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadable = attach !== undefined && !disabled;

  const addFiles = async (list: FileList | File[]) => {
    if (!attach) return;
    for (const f of Array.from(list)) {
      const id = ++pendingSeq;
      setFiles((prev) => [...prev, { id, name: f.name, status: 'uploading' }]);
      try {
        const res = await api.uploadAttachment(f, attach);
        setFiles((prev) => prev.map((p) => (p.id === id ? { ...p, path: res.path, status: res.path ? 'ready' : 'error' } : p)));
      } catch {
        setFiles((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'error' } : p)));
      }
    }
  };

  const removeFile = (id: number) => setFiles((prev) => prev.filter((p) => p.id !== id));

  const send = () => {
    if (busy || disabled) return;
    const t = text.trim();
    const refs = files.filter((f) => f.status === 'ready' && f.path).map((f) => `[attached: ${f.path}]`);
    if (t === '' && refs.length === 0) return;
    onSend([t, ...refs].filter(Boolean).join('\n'));
    setText('');
    setFiles([]);
  };

  return (
    <div
      className={clsx('rounded border bg-transparent', dragging ? 'border-nav border-dashed' : 'border-transparent')}
      onDragOver={uploadable ? (e) => { e.preventDefault(); setDragging(true); } : undefined}
      onDragLeave={uploadable ? () => setDragging(false) : undefined}
      onDrop={
        uploadable
          ? (e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files); }
          : undefined
      }
    >
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {files.map((f) => (
            <span
              key={f.id}
              className={clsx(
                'inline-flex items-center gap-1 text-[11px] font-sans rounded px-1.5 py-0.5 border',
                f.status === 'error' ? 'border-warn/50 text-warn' : 'border-stone-300 dark:border-stone-700 text-stone-500',
              )}
            >
              📎 {f.name}
              {f.status === 'uploading' && <span className="text-stone-400">…</span>}
              {f.status === 'error' && <span>failed</span>}
              <button onClick={() => removeFile(f.id)} className="text-stone-400 hover:text-warn" aria-label={`remove ${f.name}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-end">
        {uploadable && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              title="attach a file"
              className="shrink-0 text-stone-400 hover:text-nav disabled:opacity-40 pb-1.5"
            >
              📎
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) void addFiles(e.target.files); e.target.value = ''; }}
            />
          </>
        )}
        <textarea
          ref={taRef}
          value={text}
          rows={rows}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onPaste={uploadable ? (e) => { if (e.clipboardData.files.length) { e.preventDefault(); void addFiles(e.clipboardData.files); } } : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          className="flex-1 rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-1.5 text-[15px] font-serif focus:outline-none focus:border-nav disabled:opacity-50 resize-none"
        />
        <button
          onClick={send}
          disabled={busy || disabled || (text.trim() === '' && !files.some((f) => f.status === 'ready'))}
          className="shrink-0 rounded px-3 py-1.5 text-sm font-sans bg-nav text-white disabled:opacity-40"
        >
          {busy ? '…' : sendLabel}
        </button>
      </div>
    </div>
  );
}
