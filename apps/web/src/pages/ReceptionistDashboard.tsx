import { Link } from 'react-router-dom';
import { trpc } from '../lib/trpc';

const QUOTES = [
  'Every patient deserves excellent service.',
  'You are the first smile patients see — make it count.',
  'Great coordination leads to great care.',
];

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  scheduled:         { bg: '#dbeafe', text: '#1d4ed8', label: 'Scheduled' },
  confirmed:         { bg: '#dcfce7', text: '#15803d', label: 'Confirmed' },
  completed:         { bg: '#f0fdf4', text: '#166534', label: 'Treated' },
  cancelled:         { bg: '#fef2f2', text: '#b91c1c', label: 'Cancelled' },
  'no-show':         { bg: '#fef9c3', text: '#a16207', label: 'Missed' },
  awaiting_human:    { bg: '#ede9fe', text: '#6d28d9', label: 'Needs Action' },
  in_progress:       { bg: '#e0f2fe', text: '#0369a1', label: 'Processing' },
  awaiting_assignment: { bg: '#fef3c7', text: '#92400e', label: 'Assign Doctor' },
};

export default function ReceptionistDashboard() {
  const name  = localStorage.getItem('auth-name') ?? 'Receptionist';
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const quote = QUOTES[today.getDate() % QUOTES.length];
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const token = !!localStorage.getItem('auth-token');

  const { data: incoming, isLoading: loadingIncoming } = trpc.agents.listIncoming.useQuery(undefined, {
    enabled: token, staleTime: 30000, refetchInterval: 15000, retry: false,
  });

  const sessions = incoming ?? [];
  const pendingAction = sessions.filter(s => s.status === 'awaiting_human');
  const processing    = sessions.filter(s => s.status === 'in_progress');

  const stats = {
    pending:    pendingAction.length,
    processing: processing.length,
    total:      sessions.length,
    needsDoctor: sessions.filter(s => s.currentStage === 'awaiting_assignment').length,
  };

  return (
    <div className="animate-fade" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: 2 }}>📋 Receptionist Dashboard</h1>
        <p style={{ color: '#64748b', fontSize: '0.8125rem', fontStyle: 'italic' }}>"{quote}"</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Needs Action',   value: stats.pending,    color: '#7c3aed', bg: '#f5f3ff', icon: '🔔' },
          { label: 'Needs Doctor',   value: stats.needsDoctor,color: '#ca8a04', bg: '#fefce8', icon: '👨‍⚕️' },
          { label: 'Processing',     value: stats.processing, color: '#0891b2', bg: '#f0f9ff', icon: '⟳' },
          { label: 'Total Requests', value: stats.total,      color: '#2563eb', bg: '#eff6ff', icon: '📋' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '18px 20px', background: s.bg, border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Incoming patient requests */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            🤝 Incoming Patient Requests
            {loadingIncoming && <span className="spinner" style={{ width: 14, height: 14 }} />}
            {pendingAction.length > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', fontSize: '0.7rem', fontWeight: 700, padding: '1px 7px', borderRadius: 999 }}>
                {pendingAction.length} need action
              </span>
            )}
          </h2>
          <Link to="/staff/agents" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8125rem' }}>
            Open All →
          </Link>
        </div>

        {sessions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No incoming requests at the moment.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessions.slice(0, 8).map(s => {
              const contact = s.patientContactInfo as { firstName?: string; lastName?: string; phone?: string } | undefined;
              const intake  = s.intakeData as { appointmentType?: string; disease?: string; severity?: string } | undefined;
              const stStyle = STATUS_STYLE[s.currentStage] ?? STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled;
              const isUrgent = s.currentStage === 'awaiting_assignment' || s.requiresImmediateAttention;
              return (
                <div key={s.id} className="row-item" style={{
                  borderLeft: `4px solid ${stStyle.text}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Patient name — large and bold */}
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 32, height: 32, borderRadius: '50%', background: `${stStyle.text}22`, border: `2px solid ${stStyle.text}44`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 800, color: stStyle.text, flexShrink: 0 }}>
                        {(contact?.firstName ?? '?').charAt(0).toUpperCase()}
                      </span>
                      <span>{contact?.firstName} {contact?.lastName}</span>
                      {isUrgent && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#dc2626', color: '#fff' }}>URGENT</span>}
                    </div>
                    {/* Phone */}
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 4, paddingLeft: 40 }}>
                      📞 {contact?.phone ?? 'No phone'}
                    </div>
                    {/* Appointment type + condition */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 40 }}>
                      {intake?.appointmentType && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)' }}>
                          {intake.appointmentType.replace('_', ' ')}
                        </span>
                      )}
                      {intake?.disease && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: 'rgba(8,145,178,0.12)', color: '#22d3ee', border: '1px solid rgba(8,145,178,0.25)' }}>
                          {intake.disease}
                        </span>
                      )}
                      {intake?.severity && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }}>
                          {intake.severity}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: stStyle.bg, color: stStyle.text, border: `1px solid ${stStyle.text}33` }}>
                      {stStyle.label}
                    </span>
                    <Link to="/staff/agents" style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#6366f1', padding: '4px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', textDecoration: 'none', transition: 'all 0.2s' }}>
                      Review →
                    </Link>
                  </div>
                </div>
              );
            })}
            {sessions.length > 8 && (
              <Link to="/staff/agents" style={{ textAlign: 'center', fontSize: '0.875rem', color: '#6366f1', fontWeight: 600, padding: '10px', display: 'block', background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)', textDecoration: 'none' }}>
                View all {sessions.length} requests →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Status summary */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 16 }}>📊 Request Status Summary</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Assign Doctor',    count: sessions.filter(s => s.currentStage === 'awaiting_assignment').length,   color: '#ca8a04', bg: '#fefce8' },
            { label: 'Doctor Filling',   count: sessions.filter(s => s.currentStage === 'awaiting_doctor').length,       color: '#0891b2', bg: '#f0f9ff' },
            { label: 'Send Confirmation',count: sessions.filter(s => s.currentStage === 'awaiting_confirmation').length, color: '#7c3aed', bg: '#f5f3ff' },
            { label: 'Completed',        count: sessions.filter(s => s.status === 'completed').length,                   color: '#16a34a', bg: '#f0fdf4' },
          ].map(item => (
            <div key={item.label} style={{ flex: 1, minWidth: 140, padding: '12px 16px', background: item.bg, borderRadius: 10, border: `1px solid ${item.color}22`, textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: item.color }}>{item.count}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
        {[
          { to: '/staff/agents',       icon: '🤝', label: 'Agent Sessions', color: '#7c3aed' },
          { to: '/staff/appointments', icon: '📅', label: 'Appointments',   color: '#2563eb' },
          { to: '/staff/patients',     icon: '👥', label: 'Patients',       color: '#0891b2' },
          { to: '/staff/feedback',     icon: '💬', label: 'Feedback',       color: '#16a34a' },
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
