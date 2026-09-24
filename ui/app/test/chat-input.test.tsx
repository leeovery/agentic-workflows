// The shared ChatInput: Enter sends / Shift+Enter is a newline, and an attached
// file (once uploaded) is referenced as [attached: <path>] in the sent text.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ChatInput } from '../src/components/ChatInput';

afterEach(() => {
  cleanup();
  delete (globalThis as any).fetch;
});

describe('ChatInput', () => {
  it('sends on Enter, not on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} placeholder="reply…" />);
    const ta = screen.getByPlaceholderText('reply…');
    fireEvent.change(ta, { target: { value: 'hello' } });
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('the send button is disabled with no text and no ready attachment', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} sendLabel="answer" />);
    fireEvent.click(screen.getByText('answer'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows no attach affordance unless a context is given', () => {
    render(<ChatInput onSend={() => {}} />);
    expect(screen.queryByTitle('attach a file')).toBeNull();
  });

  it('uploads an attached file and references it in the sent text', async () => {
    (globalThis as any).fetch = vi.fn(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes('/api/token')
          ? { token: null }
          : { path: '.workflows/.cache/wu/attachments/ab12cd34-diagram.png' },
    }));
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} attach={{ workUnit: 'wu' }} placeholder="reply…" />);
    const file = new File(['PNG'], 'diagram.png', { type: 'image/png' });
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    // The chip appears (uploading), then the upload resolves to ready — wait for
    // the uploading "…" to clear BEFORE sending, so the ref is composed in.
    await waitFor(() => expect(screen.getByText(/diagram\.png/)).toBeTruthy());
    await waitFor(() => expect(screen.queryByText('…')).toBeNull());
    fireEvent.change(screen.getByPlaceholderText('reply…'), { target: { value: 'see this' } });
    fireEvent.keyDown(screen.getByPlaceholderText('reply…'), { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('see this\n[attached: .workflows/.cache/wu/attachments/ab12cd34-diagram.png]');
  });
});
