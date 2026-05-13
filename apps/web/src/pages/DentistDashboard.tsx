import { Link } from 'react-router-dom';
import { trpc } from '../lib/trpc';

const QUOTES = [
  'Your work improves lives one smile at a time.',
  'Excellence in dentistry begins with compassionate care.',
  'Every patient trusts you with their health — honour that trust.',
];

function getMyUserId(): string {
  try {
    const token = localStorage.getItem('auth-token') ?? '';
    return JSON.parse(atob(token.split('.')[1])).sub ?? '';
  } catch { return ''; }
}

const STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  scheduled:  { bg: '#dbeafe', text: '#1d4ed8', label: 'Scheduled' },
  confirmed:  { bg: '#dcfce7', text: '#15803d', label: 'Confirmed' },
  completed:  { bg: '#f0fdf4', text: '#166534', label: 'Treated' },
  cancelled:  { bg: '#fef2f2', text: '#b91c1c', label: 'Cancelled' },
  'no-show':  { bg: '#fef9c3', text: '#a16207', label: 'Missed' },
};

export default function DentistDashboard() {
  const name  = localStorage.getItem('auth-name')  ?? 'Doctor';
  const dentistId = getMyUserId();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const thirtyAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const quote = QUOTES[today.getDate() % QUOTES.length];
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const token = !!localStorage.getItem('auth-token');

  const { data: todayAppts, isLoading: loadingToday } = trpc.appointments.getCalendar.useQuery(
    { dentistId, from: new Date(todayStr + 'T00:00:00'), to: new Date(todayStr + 'T23:59:59') },
    { enabled: token && !!dentistId, staleTime: 60000, retry: false },
  );

  const { data: recentAppts } = trpc.appointments.getCalendar.useQuery(
    { dentistId, from: thirtyAgo, to: today },
    { enabled: token && !!dentistId, staleTime: 120000, retry: false },
  );

  const allAppts = recentAppts?.appointments ?? [];
  const todayList = todayAppts?.appointments ?? [];

  const stats = {
    treated:   allAppts.filter(a => a.status === 'completed').length,
    todayCount: todayList.length,
    missed:    allAppts.filter(a => a.status === 'no-show').length,
    scheduled: todayList.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length,
  };

  const missedList  = allAppts.filter(a => a.status === 'no-show').slice(0, 5);
  const treatedList = allAppts.filter(a => a.status === 'completed').slice(0, 5);

  return (
    <div className="animate-fade" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: 2 }}>🦷 Dentist Dashboard</h1>
        <p style={{ color: '#64748b', fontSize: '0.8125rem', fontStyle: 'italic' }}>"{quote}"</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Treated (30d)',    value: stats.treated,   color: '#16a34a', bg: '#f0fdf4', icon: '✅' },
          { label: "Today's Appts",   value: stats.todayCount, color: '#2563eb', bg: '#eff6ff', icon: '📅' },
          { label: 'Missed (30d)',     value: stats.missed,    color: '#dc2626', bg: '#fef2f2', icon: '⚠️' },
          { label: 'Scheduled Today', value: stats.scheduled, color: '#0891b2', bg: '#f0f9ff', icon: '🕐' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '18px 20px', background: s.bg, border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Today's schedule */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            📅 Today's Schedule
            {loadingToday && <span className="spinner" style={{ width: 14, height: 14 }} />}
          </h2>
          {todayList.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No appointments today.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayList.map(a => {
                const s = STATUS_COLOR[a.status] ?? STATUS_COLOR.scheduled;
                return (
                  <div key={a.id} className="row-item" style={{ borderLeft: `4px solid ${s.text}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)', marginBottom: 2 }}>
                        🕐 {new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}> — </span>
                        {new Date(a.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {a.appointmentType.replace('_', ' ')}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: s.bg, color: s.text, border: `1px solid ${s.text}33` }}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Missed appointments */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 16 }}>⚠️ Missed Appointments</h2>
          {missedList.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No missed appointments in the last 30 days.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {missedList.map(a => (
                <div key={a.id} className="row-item" style={{ borderLeft: '4px solid #ca8a04' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text)', marginBottom: 2 }}>
                    ⚠️ {new Date(a.startTime).toLocaleDateString()} · {a.appointmentType.replace('_', ' ')}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Patient ID: {a.patientId.slice(-8)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recently treated */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 16 }}>✅ Recently Treated Patients</h2>
        {treatedList.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No completed treatments in the last 30 days.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--card-border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Patient ID</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Treatment</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Date</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {treatedList.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#818cf8', fontWeight: 600 }}>{a.patientId.slice(-8)}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text)', textTransform: 'capitalize' }}>{a.appointmentType.replace('_', ' ')}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{new Date(a.startTime).toLocaleDateString()}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'rgba(22,163,74,0.15)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.3)' }}>✅ Treated</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
        {[
          { to: '/staff/treatments', icon: '📋', label: 'Treatments',    color: '#0891b2' },
          { to: '/staff/ai',         icon: '🤖', label: 'AI Assistant',  color: '#7c3aed' },
          { to: '/staff/patients',   icon: '👥', label: 'Patients',      color: '#2563eb' },
          { to: '/staff/agents',     icon: '🤝', label: 'Agent Sessions',color: '#a78bfa' },
        ].map(l => (
          <Link key={l.to} to={l.to} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: l.color + '18', border: `1px solid ${l.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>{l.icon}</div>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{l.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
