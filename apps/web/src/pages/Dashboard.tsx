import { Link } from 'react-router-dom';
import DentistDashboard from './DentistDashboard';
import ReceptionistDashboard from './ReceptionistDashboard';
import AdminDashboard from './AdminDashboard';

// Billing staff gets the generic card grid
function DefaultDashboard() {
  const name  = localStorage.getItem('auth-name')  ?? 'Staff Member';
  const email = localStorage.getItem('auth-email') ?? '';
  const role  = localStorage.getItem('auth-role')  ?? '';
  const today = new Date();
  const hour  = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const cards = [
    { to: '/staff/billing',   icon: '💳', label: 'Billing',   desc: 'Invoices & payments',        color: '#f59e0b' },
    { to: '/staff/patients',  icon: '👥', label: 'Patients',  desc: 'Search & manage records',    color: '#2563eb' },
    { to: '/staff/analytics', icon: '📊', label: 'Analytics', desc: 'Clinic performance metrics', color: '#0891b2' },
    { to: '/staff/feedback',  icon: '💬', label: 'Feedback',  desc: 'Patient satisfaction',       color: '#16a34a' },
  ];

  return (
    <div className="animate-fade">
      <div className="card" style={{ padding: '20px 24px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(135deg,rgba(37,99,235,0.1),rgba(8,145,178,0.07))' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#f59e0b22', border: '2px solid #f59e0b44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
          {name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '1.125rem', marginBottom: 2 }}>{greeting}, {name.split(' ')[0]}!</div>
          <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>{email} · <span style={{ color: '#f59e0b', fontWeight: 600 }}>{role.replace('_', ' ')}</span></div>
        </div>
        <div style={{ textAlign: 'right', color: '#94a3b8', fontSize: '0.8125rem' }}>
          <div>{today.toLocaleDateString('en-US', { weekday: 'long' })}</div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        </div>
      </div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6 }}>Dashboard</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: '0.875rem' }}>What would you like to do today?</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 14 }}>
        {cards.map((c, i) => (
          <Link key={c.to} to={c.to} className="card" style={{ padding: 22, display: 'block', animationDelay: i * 0.06 + 's' }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: c.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', marginBottom: 12, border: '1px solid ' + c.color + '33' }}>
              {c.icon}
            </div>
            <div style={{ fontWeight: 700, marginBottom: 3 }}>{c.label}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const role = localStorage.getItem('auth-role') ?? '';
  if (role === 'dentist')      return <DentistDashboard />;
  if (role === 'receptionist') return <ReceptionistDashboard />;
  if (role === 'admin')        return <AdminDashboard />;
  return <DefaultDashboard />;
}
