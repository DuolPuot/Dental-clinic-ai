import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';

// ─── Constants ────────────────────────────────────────────────────────────────

const CLINIC_PHONE = '+15551234567';
const CLINIC_PHONE_DISPLAY = '(555) 123-4567';
const CLINIC_WHATSAPP = '15551234567';
const CLINIC_EMAIL = 'hello@dentalai.clinic';
const CLINIC_SMS = '+15551234567';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionType = 'BOOK' | 'CALL' | 'HOURS' | 'WHATSAPP' | 'SMS' | 'EMAIL';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  action?: ActionType;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseReply(raw: string): { text: string; action?: ActionType } {
  const match = raw.match(/\[ACTION:(BOOK|CALL|HOURS|WHATSAPP|SMS|EMAIL)\]/);
  if (match) {
    return {
      text: raw.replace(/\[ACTION:(BOOK|CALL|HOURS|WHATSAPP|SMS|EMAIL)\]/, '').trim(),
      action: match[1] as ActionType,
    };
  }
  return { text: raw.trim() };
}

const ACTION_CONFIG: Record<ActionType, { label: string; color: string; bg: string; border: string }> = {
  BOOK:     { label: '� Book an Appointment',       color: '#a5b4fc', bg: 'rgba(99,102,241,0.15)',  border: 'rgba(99,102,241,0.4)' },
  CALL:     { label: `📞 Call ${CLINIC_PHONE_DISPLAY}`, color: '#6ee7b7', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.35)' },
  WHATSAPP: { label: '💬 WhatsApp Us',               color: '#4ade80', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.35)' },
  SMS:      { label: '💬 Send us an SMS',            color: '#67e8f9', bg: 'rgba(6,182,212,0.12)',   border: 'rgba(6,182,212,0.35)' },
  EMAIL:    { label: '✉️ Email Us',                  color: '#fcd34d', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
  HOURS:    { label: '🕐 View Our Hours',            color: '#fcd34d', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)' },
};

const HOURS_INFO = `Mon–Thu: 8:00 AM – 6:00 PM
Fri: 8:00 AM – 5:00 PM
Sat: 9:00 AM – 2:00 PM
Sun: Closed`;

const SUGGESTIONS = [
  '🦷 What services do you offer?',
  '💰 How much does a cleaning cost?',
  '🏥 Do you accept insurance?',
  '🕐 What are your hours?',
  '🚨 Do you handle emergencies?',
  '📅 I want to book an appointment',
];

// Quick contact buttons shown in header
const CONTACT_BUTTONS = [
  { icon: '📞', label: 'Call',      title: 'Call us',        action: () => window.location.href = `tel:${CLINIC_PHONE}` },
  { icon: '💬', label: 'WhatsApp',  title: 'WhatsApp us',    action: () => window.open(`https://wa.me/${CLINIC_WHATSAPP}?text=Hi%2C%20I%27d%20like%20to%20book%20an%20appointment`, '_blank') },
  { icon: '✉️', label: 'Email',     title: 'Email us',       action: () => window.location.href = `mailto:${CLINIC_EMAIL}?subject=Appointment%20Inquiry` },
  { icon: '📱', label: 'SMS',       title: 'Text us',        action: () => window.location.href = `sms:${CLINIC_SMS}&body=Hi%2C%20I%27d%20like%20to%20book%20an%20appointment` },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatientChatbot() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(true);
  const [showHours, setShowHours] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: "Hi! 👋 I'm Denta, your DentalAI Clinic assistant. Ask me anything about our services, pricing, insurance, or hours — or I can help you book an appointment!",
  }]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const mutation = trpc.ai.publicChat.useMutation({
    onSuccess: (data: { reply: string }) => {
      const { text, action } = parseReply(data.reply);
      setMessages(prev => [...prev, { role: 'assistant', content: text, action }]);
    },
    onError: () => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I'm having trouble right now. You can reach us directly:\n📞 ${CLINIC_PHONE_DISPLAY}\n✉️ ${CLINIC_EMAIL}`,
        action: 'CALL',
      }]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  function handleOpen() {
    setOpen(o => !o);
    setUnread(false);
  }

  function send(text: string) {
    if (!text.trim() || mutation.isPending) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    mutation.mutate({ messages: updated.slice(-10).map(m => ({ role: m.role, content: m.content })) });
  }

  function handleAction(action: ActionType | undefined) {
    if (!action) return;
    switch (action) {
      case 'BOOK':     navigate('/portal/book'); break;
      case 'CALL':     window.location.href = `tel:${CLINIC_PHONE}`; break;
      case 'WHATSAPP': window.open(`https://wa.me/${CLINIC_WHATSAPP}?text=Hi%2C%20I%27d%20like%20to%20book%20an%20appointment`, '_blank'); break;
      case 'SMS':      window.location.href = `sms:${CLINIC_SMS}&body=Hi%2C%20I%27d%20like%20to%20book%20an%20appointment`; break;
      case 'EMAIL':    window.location.href = `mailto:${CLINIC_EMAIL}?subject=Appointment%20Inquiry`; break;
      case 'HOURS':    setShowHours(h => !h); break;
    }
  }

  function clearChat() {
    setMessages([{
      role: 'assistant',
      content: "Hi! 👋 I'm Denta, your DentalAI Clinic assistant. Ask me anything about our services, pricing, insurance, or hours — or I can help you book an appointment!",
    }]);
    setShowHours(false);
  }

  return (
    <>
      {/* Floating button */}
      <button onClick={handleOpen} title="Chat with Denta" className="chatbot-fab" style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
        width: 60, height: 60, borderRadius: '50%',
        background: open ? 'rgba(99,102,241,0.9)' : 'linear-gradient(135deg,#06b6d4,#6366f1)',
        border: 'none', color: '#fff', fontSize: open ? '1.2rem' : '1.6rem',
        boxShadow: '0 4px 24px rgba(6,182,212,0.45)',
        cursor: 'pointer', transition: 'all 0.25s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {open ? '✕' : '💬'}
      </button>

      {/* Unread badge */}
      {!open && unread && (
        <div className="chatbot-badge" style={{
          position: 'fixed', bottom: 76, right: 26, zIndex: 1001,
          width: 16, height: 16, borderRadius: '50%',
          background: '#ef4444', border: '2px solid #0f0f1a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.6rem', color: '#fff', fontWeight: 700,
        }}>1</div>
      )}

      {open && (
        <div className="chatbot-window">

          {/* Header */}
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg,rgba(6,182,212,0.18),rgba(99,102,241,0.18))',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '20px 20px 0 0',
          }}>
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg,#06b6d4,#6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
              }}>🦷</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Denta — DentalAI Clinic</div>
                <div style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  Online · Replies instantly
                </div>
              </div>
              <button onClick={() => navigate('/portal/book')} style={{
                background: 'linear-gradient(135deg,#6366f1,#06b6d4)',
                border: 'none', borderRadius: 8, padding: '6px 10px',
                color: '#fff', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
              }}>📅 Book</button>
              <button onClick={clearChat} title="Clear chat" style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, padding: '6px 9px', color: '#64748b',
                fontSize: '0.8rem', cursor: 'pointer',
              }}>🗑️</button>
            </div>

            {/* Contact bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {CONTACT_BUTTONS.map(btn => (
                <button key={btn.label} onClick={btn.action} title={btn.title} style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, padding: '7px 4px',
                  color: '#cbd5e1', fontSize: '0.7rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                }}>
                  <span style={{ fontSize: '1.1rem' }}>{btn.icon}</span>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px 6px', minHeight: 0, maxHeight: 320 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  gap: 8, alignItems: 'flex-end',
                }}>
                  {m.role === 'assistant' && (
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg,#06b6d4,#6366f1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
                    }}>🦷</div>
                  )}
                  <div style={{
                    maxWidth: '80%', padding: '9px 13px',
                    borderRadius: m.role === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                    background: m.role === 'user'
                      ? 'linear-gradient(135deg,#6366f1,#4f46e5)'
                      : 'rgba(255,255,255,0.06)',
                    color: '#f1f5f9', fontSize: '0.8375rem', lineHeight: 1.55,
                    border: m.role === 'assistant' ? '1px solid rgba(6,182,212,0.12)' : 'none',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {m.content}
                  </div>
                </div>

                {/* Inline action button */}
                {m.role === 'assistant' && m.action && (
                  <div style={{ marginLeft: 34, marginTop: 6 }}>
                    {m.action === 'HOURS' && showHours && (
                      <div style={{
                        padding: '10px 14px', background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10,
                        fontSize: '0.8rem', color: '#fcd34d', marginBottom: 6,
                        whiteSpace: 'pre-line', lineHeight: 1.8,
                      }}>🕐 {HOURS_INFO}</div>
                    )}
                    <button onClick={() => handleAction(m.action)} style={{
                      background: ACTION_CONFIG[m.action].bg,
                      border: `1px solid ${ACTION_CONFIG[m.action].border}`,
                      borderRadius: 10, padding: '8px 14px',
                      color: ACTION_CONFIG[m.action].color,
                      fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      {ACTION_CONFIG[m.action].label}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {mutation.isPending && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#06b6d4,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', flexShrink: 0 }}>🦷</div>
                <div style={{ display: 'flex', gap: 4, padding: '8px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: '14px 14px 14px 3px', border: '1px solid rgba(6,182,212,0.12)' }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#06b6d4', animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && (
            <div style={{ padding: '4px 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)} style={{
                  background: 'rgba(6,182,212,0.07)', border: '1px solid rgba(6,182,212,0.18)',
                  borderRadius: 20, padding: '5px 10px', color: '#67e8f9',
                  fontSize: '0.71rem', cursor: 'pointer', transition: 'all 0.15s',
                }}>{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={e => { e.preventDefault(); send(input); }} style={{
            padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', gap: 7, borderRadius: '0 0 20px 20px',
          }}>
            <input
              className="input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about services, pricing, hours…"
              disabled={mutation.isPending}
              style={{ flex: 1, padding: '8px 12px', fontSize: '0.83rem', borderRadius: 10 }}
            />
            <button type="submit" disabled={!input.trim() || mutation.isPending} style={{
              background: input.trim() ? 'linear-gradient(135deg,#6366f1,#06b6d4)' : 'rgba(255,255,255,0.08)',
              border: 'none', borderRadius: 10, padding: '8px 13px',
              color: '#fff', fontSize: '1rem',
              cursor: input.trim() ? 'pointer' : 'default', transition: 'all 0.2s',
            }}>↑</button>
          </form>
        </div>
      )}
    </>
  );
}
