// The Read lens's markdown renderer: react-markdown + remark-gfm, Shiki for
// code, mermaid for diagrams, heading anchors for section links.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { codeToHtml } from 'shiki';
import mermaid from 'mermaid';

let mermaidReady = false;
function ensureMermaid(dark: boolean): void {
  if (mermaidReady) return;
  mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral' });
  mermaidReady = true;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function headingText(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(headingText).join('');
  if (children && typeof children === 'object' && 'props' in (children as any)) {
    return headingText((children as any).props.children);
  }
  return '';
}

function ShikiBlock({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const dark = document.documentElement.classList.contains('dark');
    codeToHtml(code, { lang: lang || 'text', theme: dark ? 'github-dark' : 'github-light' })
      .then((h) => alive && setHtml(h))
      .catch(() => alive && setHtml(null));
    return () => {
      alive = false;
    };
  }, [code, lang]);
  if (html === null) {
    return (
      <pre>
        <code>{code}</code>
      </pre>
    );
  }
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark');
    ensureMermaid(dark);
    const id = `mmd-${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      })
      .catch(() => {
        if (ref.current) ref.current.textContent = code;
      });
  }, [code]);
  return <div ref={ref} className="my-4 overflow-x-auto" />;
}

const heading =
  (Tag: 'h1' | 'h2' | 'h3' | 'h4') =>
  ({ children }: { children?: ReactNode }) => {
    const id = slugify(headingText(children));
    return (
      <Tag id={id}>
        <a href={`#${id}`} className="!no-underline !text-inherit hover:underline">
          {children}
        </a>
      </Tag>
    );
  };

export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: heading('h1'),
        h2: heading('h2'),
        h3: heading('h3'),
        h4: heading('h4'),
        code({ className, children }) {
          const match = /language-(\w+)/.exec(className ?? '');
          const code = String(children).replace(/\n$/, '');
          if (!match) return <code>{children}</code>;
          if (match[1] === 'mermaid') return <MermaidBlock code={code} />;
          return <ShikiBlock code={code} lang={match[1]!} />;
        },
        pre({ children }) {
          // Shiki/mermaid own their pre; unwrap the default.
          return <>{children}</>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
