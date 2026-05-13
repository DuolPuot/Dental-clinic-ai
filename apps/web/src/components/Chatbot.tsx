import { useState, useRef, useEffect, FormEvent } from 'react';
import { trpc } from '../lib/trpc';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'What CDT code is used for a cleaning?',
  'How do I cancel an appointment?',
  'What does a porcelain crown cost?',
  'How do I add a new patient?',
];

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I\'m DentalAI Assistant 🦷 How can I help you today?' },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const mutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    },
    onError: (err) => {
      setMessages(prev => [...prev, { role: 'assistant', content: `Sorry, something went wrong: ${err.message}` }]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  function send(text: string) {
    if (!text.trim() || mutation.isPending) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    // Send last 10 messages for context
    mutation.mutate({ messages: updated.slice(-10) });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
          width: 56, height: 56, borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
          border: 'none', color: '#fff', fontSize: '1.5rem',
          boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
          cursor: 'pointer', transition: 'transform 0.2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        title="DentalAI Assistant"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 96, right: 28, zIndex: 1000,
          width: 360, height: 500,
          background: 'rgba(15,15,26,0.97)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(99,102,241,0.3)', borderRadius: 16,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg,#6366f1,#06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
            }}>🤖</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>DentalAI Assistant</div>
              <div style={{ fontSize: '0.7rem', color: '#10b981' }}>● Online</div>
            </div>
            <button onClick={() => setMessages([{ role: 'assistant', content: 'Hi! I\'m DentalAI Assistant 🦷 How can I help you today?' }])}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.75rem' }}>
              Clear
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 8px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 10,
              }}>
                <div style={{
                  maxWidth: '82%', padding: '9px 13px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : 'rgba(255,255,255,0.07)',
                  color: '#f1f5f9', fontSize: '0.8375rem', lineHeight: 1.5,
                  border: m.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {mutation.isPending && (
              <div style={{ display: 'flex', gap: 5, padding: '6px 4px' }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#6366f1',
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (only when 1 message) */}
          {messages.length === 1 && (
            <div style={{ padding: '0 14px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: 20, padding: '4px 10px', color: '#a5b4fc',
                  fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} style={{
            padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', gap: 8,
          }}>
            <input
              className="input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything…"
              disabled={mutation.isPending}
              style={{ flex: 1, padding: '9px 13px', fontSize: '0.85rem', borderRadius: 10 }}
            />
            <button type="submit" disabled={!input.trim() || mutation.isPending}
              className="btn btn-primary"
              style={{ padding: '9px 14px', borderRadius: 10, fontSize: '1rem' }}>
              ↑
            </button>
          </form>
        </div>
      )}
    </>
  );
}
