import { Link } from 'react-router-dom';
import { trpc } from '../lib/trpc';

const QUOTES = [
  'Healthy smiles start with organized care.',
  'Strong systems enable exceptional patient outcomes.',
  'Great administration is the backbone of great healthcare.',
];

const ROLE_COLOR: Record<string, string> = {
  admin: '#fbbf24', dentist: '#60a5fa', receptionist: '#22d3ee', billing_staff: '#4ade80',
};

export default function AdminDashboard() {
  const today = new Date();
  const thirtyAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const quote = QUOTES[today.getDate() % QUOTES.length];
  const token = !!localStorage.getItem('auth-token');

  const { data: analytics } = trpc.analytics.dashboard.useQuery(
    { from: thirtyAgo, to: today },
    { enabled: token, staleTime: 120000, retry: false },
  );
  const { data: users } = trpc.users.list.useQuery(undefined, {
    enabled: token, staleTime: 120000, retry: false,
  });
  const { data: sessions } = trpc.agents.listIncoming.useQuery(undefined, {
    enabled: token, staleTime: 30000, retry: false,
  });

  const activeUsers = (users ?? []).filter(u => u.isActive && !u.deleted);
  const appts   = analytics?.appointments;
  const revenue = analytics?.revenue;
  const patients = analytics?.patients;

  return (
    <div className="animate-fade" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: 2, color: 'var(--text)' }}>
          👑 Admin Dashboard
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontStyle: 'italic' }}>"{quote}"</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(175px,1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Patients',     value: patients?.totalActive ?? '—',  color: '#60a5fa', icon: '👥' },
          { label: 'New Patients (30d)', value: patients?.newPatients ?? '—',  color: '#22d3ee', icon: '🆕' },
          { label: 'Appointments (30d)', value: appts?.totalAppointments ?? '—', color: '#a78bfa', icon: '📅' },
          { label: 'Missed (30d)',       value: appts ? Math.round((appts.noShowRate / 100) * (appts.totalAppointments || 0)) : '—', color: '#f87171', icon: '⚠️' },
          { label: 'Revenue (30d)',      value: revenue ? `$${revenue.totalRevenue.toFixed(0)}` : '—', color: '#4ade80', icon: '💰' },
          { label: 'Active Staff',       value: activeUsers.length, color: '#fbbf24', icon: '👤' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '18px 20px', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Staff overview */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>👤 Staff Overview</h2>
            <Link to="/staff/users" style={{ fontSize: '0.8125rem', color: '#818cf8', fontWeight: 700, textDecoration: 'none' }}>Manage →</Link>
          </div>
          {activeUsers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No staff data.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['dentist', 'receptionist', 'billing_staff', 'admin'] as const).map(r => {
                const count = activeUsers.filter(u => u.role === r).length;
                if (!count) return null;
                const color = ROLE_COLOR[r] ?? '#94a3b8';
                const label = r === 'billing_staff' ? 'Billing Staff' : r.charAt(0).toUpperCase() + r.slice(1);
                return (
                  <div key={r} className="row-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{label}s</span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 800, color, background: color + '22', padding: '2px 14px', borderRadius: 999, border: `1px solid ${color}44` }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Agent sessions */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>🤝 Agent Sessions</h2>
            <Link to="/staff/agents" style={{ fontSize: '0.8125rem', color: '#818cf8', fontWeight: 700, textDecoration: 'none' }}>View All →</Link>
          </div>
          {(() => {
            const s = sessions ?? [];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Needs Action', count: s.filter(x => x.status === 'awaiting_human').length, color: '#a78bfa', border: '#7c3aed' },
                  { label: 'Processing',   count: s.filter(x => x.status === 'in_progress').length,    color: '#22d3ee', border: '#0891b2' },
                  { label: 'Completed',    count: s.filter(x => x.status === 'completed').length,      color: '#4ade80', border: '#16a34a' },
                  { label: 'Failed',       count: s.filter(x => x.status === 'failed').length,         color: '#f87171', border: '#dc2626' },
                ].map(item => (
                  <div key={item.label} className="row-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `3px solid ${item.border}` }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{item.label}</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: item.color }}>{item.count}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Appointment breakdown */}
      {appts && appts.byStatus.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 16, color: 'var(--text)' }}>
            📊 Appointment Breakdown (Last 30 Days)
          </h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {appts.byStatus.map((s: { _id: string; count: number }) => {
              const colorMap: Record<string, string> = {
                completed: '#4ade80', scheduled: '#60a5fa', confirmed: '#34d399',
                cancelled: '#f87171', 'no-show': '#fbbf24',
              };
              const c = colorMap[s._id] ?? '#94a3b8';
              return (
                <div key={s._id} className="row-item" style={{ flex: 1, minWidth: 110, textAlign: 'center', borderLeft: `3px solid ${c}` }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c }}>{s.count}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 2 }}>
                    {s._id.replace('-', ' ')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 12 }}>
        {[
          { to: '/staff/users',     icon: '👥', label: 'User Management', color: '#fbbf24' },
          { to: '/staff/analytics', icon: '📊', label: 'Analytics',       color: '#60a5fa' },
          { to: '/staff/agents',    icon: '🤝', label: 'Agent Sessions',  color: '#a78bfa' },
          { to: '/staff/feedback',  icon: '💬', label: 'Feedback',        color: '#4ade80' },
          { to: '/staff/billing',   icon: '💳', label: 'Billing',         color: '#22d3ee' },
        ].map(l => (
          <Link key={l.to} to={l.to} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: l.color + '22', border: `1px solid ${l.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
              {l.icon}
            </div>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
