/**
 * Operations copilot.
 *
 * The language layer never computes a number. It selects tools, the tools read the
 * same twin the screens read, and the answer is assembled from those returned
 * values — which is why every response ships with its tool-call trace. If a figure
 * appears in an answer it appeared first in a tool result, and you can see which.
 */

import { useEffect, useRef, useState } from 'react';
import { api, useTwin, type CopilotAnswer } from '../store.tsx';
import { Loading, Panel, SectionHead, Tag, DecisionBanner } from '../components/Primitives.tsx';

interface Turn {
  id: number;
  question: string;
  answer: CopilotAnswer | null;
  error: string | null;
}

export default function Copilot() {
  const { boot } = useTwin();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const id = nextId.current++;
    setTurns((t) => [...t, { id, question, answer: null, error: null }]);
    setInput('');
    setBusy(true);
    try {
      const a = await api.copilot(question);
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, answer: a } : x)));
    } catch (e) {
      setTurns((t) =>
        t.map((x) => (x.id === id ? { ...x, error: e instanceof Error ? e.message : String(e) } : x)),
      );
    } finally {
      setBusy(false);
    }
  };

  if (!boot) return <Loading message="Loading…" />;

  return (
    <div className="page flush copilot">
      <div className="page-head">
        <div>
          <h1>Operations Copilot</h1>
          <div className="lede">
            Answers come from the same engine the screens read. Every response shows which tools it
            called, so no number is unaccountable.
          </div>
        </div>
        <div className="head-actions">
          <Tag>{boot.copilot.tools.length} tools available</Tag>
          {turns.length > 0 && (
            <button className="btn sm" onClick={() => setTurns([])}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="cp-thread" ref={threadRef}>
        {turns.length === 0 && (
          <div style={{ maxWidth: '78ch', marginBottom: 14 }}>
            <DecisionBanner
              badge="Grounded Copilot Intelligence"
              happening={
                <>
                  Operational query assistant backed by <strong>{boot.copilot.tools.length} grounded tools</strong>.
                </>
              }
              why="The LLM never fabricates numbers. All quantitative claims are read directly from tool call traces over the twin."
              action="Select an operational question below or type your query in the terminal input."
            />
            <div className="empty">
              <h4>Ask about the network</h4>
              <p>
                This is not a general-purpose assistant. It answers operational questions about the
                live network state by calling the same functions the optimiser and the ledger use.
                It cannot invent a figure, because it does not generate figures at all — it reports
                what the tools return.
              </p>
              <div className="why">
                Available tools:{' '}
                {boot.copilot.tools.map((t) => t.name).join(', ')}
              </div>
            </div>
          </div>
        )}

        {turns.map((t) => (
          <div key={t.id}>
            <div className="cp-msg user">
              <div className="cp-who" style={{ color: 'var(--ink)' }}>
                You
              </div>
              <div className="cp-body">{t.question}</div>
            </div>
            <div className="cp-msg">
              <div className="cp-who">Terraflux</div>
              {t.error ? (
                <div className="empty">
                  <h4>That question could not be answered</h4>
                  <p>{t.error}</p>
                </div>
              ) : t.answer ? (
                <>
                  <div className="cp-body">
                    <Markdown text={t.answer.answer} />
                  </div>
                  {t.answer.toolCalls.length > 0 && (
                    <div className="cp-tools">
                      <div className="tt">Tool calls · intent “{t.answer.intent}”</div>
                      {t.answer.toolCalls.map((c, i) => (
                        <div className="tc" key={i}>
                          <b>{c.name}</b>
                          {Object.keys(c.args).length > 0 && (
                            <>({JSON.stringify(c.args).slice(1, -1)})</>
                          )}{' '}
                          → {c.summary}
                        </div>
                      ))}
                    </div>
                  )}
                  {t.answer.followUps.length > 0 && (
                    <div className="cp-sugg">
                      {t.answer.followUps.map((f) => (
                        <button key={f} onClick={() => send(f)} disabled={busy}>
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="loadstate" style={{ padding: 0 }}>
                  <div className="msg">Reading network state and calling tools…</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="cp-input">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about the network — why a facility was selected, what breaks if it fails, where to add capacity…"
            aria-label="Question"
            disabled={busy}
          />
          <button className="btn primary" type="submit" disabled={busy || !input.trim()}>
            {busy ? 'Thinking…' : 'Ask'}
          </button>
        </form>
        <div className="cp-sugg">
          {boot.copilot.suggested.slice(0, 8).map((q) => (
            <button key={q} onClick={() => send(q)} disabled={busy}>
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// A deliberately small Markdown renderer
//
// The copilot emits a fixed, known subset — headings are not used, and the only
// constructs are paragraphs, bullets, pipe tables, bold and inline code. Rendering
// that subset directly is a few dozen lines and avoids pulling in a parser (and the
// sanitisation question a general parser would raise).
// ─────────────────────────────────────────────────────────────────────────────

function inlineFormat(text: string): (string | JSX.Element)[] {
  const out: (string | JSX.Element)[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else out.push(<code key={k++}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: JSX.Element[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    // Table: a header row followed by a separator row of dashes.
    if (line.trim().startsWith('|') && lines[i + 1]?.includes('---')) {
      const header = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => (c.trim().endsWith(':') ? 'right' : 'left'));
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        body.push(splitRow(lines[i]));
        i++;
      }
      blocks.push(
        <table key={key++}>
          <thead>
            <tr>
              {header.map((h, j) => (
                <th key={j} style={{ textAlign: align[j] as 'left' | 'right' }}>
                  {inlineFormat(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri}>
                {row.map((c, ci) => (
                  <td key={ci} style={{ textAlign: align[ci] as 'left' | 'right' }}>
                    {inlineFormat(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }

    // Bullet list
    if (/^\s*[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++}>
          {items.map((it, j) => (
            <li key={j}>{inlineFormat(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Paragraph
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('|') &&
      !/^\s*[-*]\s/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={key++}>{inlineFormat(para.join(' '))}</p>);
  }

  return <>{blocks}</>;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}
