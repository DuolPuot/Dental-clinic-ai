import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { trpc } from '../lib/trpc';

const DEMO_ACCOUNTS = [
  { label: '👑 Admin', email: 'admin@demo.com' },
  { label: '🦷 Dentist', email: 'dentist@demo.com' },
  { label: '📋 Receptionist', email: 'receptionist@demo.com' },
  { label: '💳 Billing', email: 'billing@demo.com' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem('auth-token', data.accessToken);
      localStorage.setItem('auth-role', data.user.role);
      localStorage.setItem('auth-name', `${data.user.firstName} ${data.user.lastName}`);
      localStorage.setItem('auth-email', data.user.email);
      navigate('/staff/dashboard');
    },
    onError: (err) => {
      setError(err.message ?? 'Invalid credentials.');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ email, password });
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('Demo@1234');
    setError('');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card animate-fade" style={{ width: '100%', maxWidth: 440, padding: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🦷</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6 }}>Welcome back</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Sign in to your staff account</p>
        </div>

        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 8, textAlign: 'center' }}>
            — Quick demo login —
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DEMO_ACCOUNTS.map(a => (
              <button
                key={a.email}
                type="button"
                onClick={() => fillDemo(a.email)}
                style={{
                  background: email === a.email ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${email === a.email ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8, padding: '8px 10px', color: email === a.email ? '#a5b4fc' : '#94a3b8',
                  fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="label">Email address</label>
            <input className="input" type="email" required autoComplete="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="doctor@clinic.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required autoComplete="current-password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loginMutation.isPending}
            style={{ marginTop: 8, justifyContent: 'center' }}>
            {loginMutation.isPending ? <><span className="spinner" />Signing in…</> : 'Sign in →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, color: '#475569', fontSize: '0.75rem' }}>
          Demo password: <code style={{ color: '#a5b4fc' }}>Demo@1234</code>
        </p>
        <p style={{ textAlign: 'center', marginTop: 12, color: '#94a3b8', fontSize: '0.875rem' }}>
          Patient? <Link to="/portal/book">Book an appointment</Link>
        </p>
      </div>
    </div>
  );
}
