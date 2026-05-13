import { useState, FormEvent } from 'react';
import { trpc } from '../lib/trpc';

const role = () => localStorage.getItem('auth-role') ?? '';

const TRIAGE_COLOR: Record<string, string> = {
  emergency: '#ef4444', urgent: '#f59e0b', routine: '#6366f1', elective: '#10b981',
};
const STAGE_LABEL: Record<string, string> = {
  intake: '📋 Intake', triage: '🔍 Triage',
  awaiting_assignment: '👥 Awaiting Doctor Assignment',
  awaiting_doctor: '🦷 Awaiting Doctor Details',
  awaiting_confirmation: '📨 Awaiting Patient Confirmation',
  scheduling: '📅 Scheduling', notification: '🔔 Notification',
  summary: '📝 Summary', completed: '✅ Completed',
};

export default function AgentSessionsPage() {
  const userRole = role();
  const isReceptionist = ['admin', 'receptionist'].includes(userRole);
  const isDentist = ['admin', 'dentist'].includes(userRole);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignDoctorId, setAssignDoctorId] = useState('');
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');
  const [apptForm, setApptForm] = useState({ operatoryId: '', date: '', startTime: '', endTime: '', notes: '' });
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const utils = trpc.useContext();

  // Receptionist: incoming sessions awaiting action
  const { data: incoming, isLoading: loadingIncoming } = trpc.agents.listIncoming.useQuery(undefined, {
    enabled: isReceptionist,
    refetchInterval: 5000,
    retry: false,
  });

  // Doctor: sessions assigned to me
  const { data: myAssigned, isLoading: loadingAssigned } = trpc.agents.listMyAssigned.useQuery(undefined, {
    enabled: isDentist,
    refetchInterval: 5000,
    retry: false,
  });

  // Dropdown data
  const { data: doctors } = trpc.agents.getDoctors.useQuery(undefined, { enabled: isReceptionist, retry: false });
  const { data: operatories } = trpc.agents.getOperatories.useQuery(undefined, { enabled: isDentist, retry: false });

  // Selected session detail
  const { data: selected } = trpc.agents.getSession.useQuery(
    { sessionId: selectedId ?? '' },
    { enabled: !!selectedId, refetchInterval: 3000, retry: false },
  );

  function success(msg: string) { setActionSuccess(msg); setActionError(''); setTimeout(() => setActionSuccess(''), 4000); }
  function fail(msg: string) { setActionError(msg); setActionSuccess(''); }

  const assignMutation = trpc.agents.assignDoctor.useMutation({
    onSuccess: () => { success('Doctor assigned successfully.'); utils.agents.listIncoming.invalidate(); setAssignDoctorId(''); },
    onError: (e) => fail(e.message),
  });

  const confirmMutation = trpc.agents.sendConfirmation.useMutation({
    onSuccess: () => { success('Confirmation sent to patient.'); utils.agents.listIncoming.invalidate(); setSelectedId(null); },
    onError: (e) => fail(e.message),
  });

  const apptMutation = trpc.agents.submitAppointmentDetails.useMutation({
    onSuccess: () => { success('Appointment details submitted.'); utils.agents.listMyAssigned.invalidate(); setSelectedId(null); },
    onError: (e) => fail(e.message),
  });

  function handleAssign(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !assignDoctorId) return;
    assignMutation.mutate({ sessionId: selectedId, doctorId: assignDoctorId });
  }

  function handleApptSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    apptMutation.mutate({ sessionId: selectedId, ...apptForm });
  }

  function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    confirmMutation.mutate({ sessionId: selectedId, channel });
  }

  const sessions = isReceptionist ? (incoming ?? []) : (myAssigned ?? []);
  const isLoading = isReceptionist ? loadingIncoming : loadingAssigned;

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 4 }}>🤝 Agent Sessions</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          {isReceptionist
            ? `Patient requests processed by AI agents. Assign doctors and send confirmations.`
            : 'Appointment requests assigned to you. Fill in the details and submit.'}
        </p>
        {isReceptionist && sessions.length > 0 && (
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'rgba(99,102,241,0.15)', borderRadius: 999, fontSize: '0.8125rem', color: '#a5b4fc', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
            {sessions.filter(s => s.status === 'awaiting_human').length} awaiting action
            {sessions.filter(s => s.status === 'in_progress').length > 0 && ` · ${sessions.filter(s => s.status === 'in_progress').length} processing`}
          </div>
        )}
      </div>

      {actionError   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{actionError}</div>}
      {actionSuccess && <div className="alert alert-success" style={{ marginBottom: 16 }}>{actionSuccess}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: selectedId ? '1fr 1.2fr' : '1fr', gap: 20 }}>

        {/* ── Session list ── */}
        <div>
          {isLoading && <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}
          {!isLoading && sessions.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>
              {isReceptionist ? 'No pending patient requests.' : 'No appointments assigned to you.'}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sessions.map(s => {
              const contact = s.patientContactInfo as { firstName?: string; lastName?: string; phone?: string } | undefined;
              const intake = s.intakeData as { chiefComplaint?: string; appointmentType?: string; severity?: string; disease?: string } | undefined;
              const isUrgent = s.requiresImmediateAttention;
              return (
                <div key={s.id} className="row-item" onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                  style={{ cursor: 'pointer', borderLeft: `4px solid ${s.id === selectedId ? '#6366f1' : (TRIAGE_COLOR[s.triageLevel ?? ''] ?? 'var(--card-border)')}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Name row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '2px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', color: '#818cf8', flexShrink: 0 }}>
                          {(contact?.firstName ?? '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
                            {contact?.firstName} {contact?.lastName}
                            {isUrgent && <span style={{ marginLeft: 6, fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#dc2626', color: '#fff' }}>URGENT</span>}
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>📞 {contact?.phone ?? 'No phone'}</div>
                        </div>
                      </div>
                      {/* Tags */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 42 }}>
                        {intake?.appointmentType && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
                            {intake.appointmentType.replace('_', ' ')}
                          </span>
                        )}
                        {intake?.disease && (
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '2px 8px', borderRadius: 999, background: 'rgba(8,145,178,0.1)', color: '#22d3ee', border: '1px solid rgba(8,145,178,0.2)' }}>
                            {intake.disease}
                          </span>
                        )}
                        {intake?.chiefComplaint && !intake.disease && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{intake.chiefComplaint}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      {s.triageLevel && (
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: TRIAGE_COLOR[s.triageLevel] ?? '#94a3b8', background: (TRIAGE_COLOR[s.triageLevel] ?? '#94a3b8') + '22', border: `1px solid ${(TRIAGE_COLOR[s.triageLevel] ?? '#94a3b8')}44` }}>
                          {s.triageLevel.toUpperCase()}
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: s.status === 'failed' ? '#fca5a5' : s.status === 'in_progress' ? '#67e8f9' : 'var(--text-muted)' }}>
                        {s.status === 'in_progress' ? '⟳ Processing…' : s.status === 'failed' ? '⚠ Failed' : STAGE_LABEL[s.currentStage] ?? s.currentStage}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, paddingLeft: 42 }}>
                    {new Date(s.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Action panel ── */}
        {selectedId && selected && (
          <div className="card animate-slide" style={{ padding: 24, alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontWeight: 700, fontSize: '1rem' }}>
                {(selected.patientContactInfo as { firstName?: string; lastName?: string } | undefined)?.firstName}{' '}
                {(selected.patientContactInfo as { firstName?: string; lastName?: string } | undefined)?.lastName}
              </h2>
              <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setSelectedId(null)}>✕</button>
            </div>

            {/* Patient info */}
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(() => {
                const c = selected.patientContactInfo as { firstName?: string; lastName?: string; email?: string; phone?: string } | undefined;
                const i = selected.intakeData as { chiefComplaint?: string; appointmentType?: string; disease?: string; severity?: string; duration?: string; description?: string; symptoms?: string[] } | undefined;
                return <>
                  {c?.email && <div><span style={{ color: '#64748b' }}>Email: </span>{c.email}</div>}
                  <div><span style={{ color: '#64748b' }}>Phone: </span>{c?.phone}</div>
                  <div><span style={{ color: '#64748b' }}>Type: </span>{i?.appointmentType?.replace('_', ' ')}</div>
                  {i?.disease && <div><span style={{ color: '#64748b' }}>Condition: </span>{i.disease}</div>}
                  {i?.severity && <div><span style={{ color: '#64748b' }}>Severity: </span>{i.severity}</div>}
                  {i?.duration && <div><span style={{ color: '#64748b' }}>Duration: </span>{i.duration}</div>}
                  {i?.description && <div><span style={{ color: '#64748b' }}>Notes: </span>{i.description}</div>}
                  {i?.symptoms && <div><span style={{ color: '#64748b' }}>Symptoms: </span>{i.symptoms.join(', ')}</div>}
                </>;
              })()}
            </div>

            {/* Triage result */}
            {selected.triageLevel && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: (TRIAGE_COLOR[selected.triageLevel] ?? '#6366f1') + '15', borderRadius: 8, borderLeft: `3px solid ${TRIAGE_COLOR[selected.triageLevel] ?? '#6366f1'}`, fontSize: '0.8125rem' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Triage: {selected.triageLevel.toUpperCase()}</div>
                <div style={{ color: '#94a3b8' }}>{(selected.triageRationale as string | undefined)?.split('DISCLAIMER')[0]}</div>
              </div>
            )}

            {/* RECEPTIONIST: Assign doctor (awaiting_assignment) */}
            {isReceptionist && selected.currentStage === 'awaiting_assignment' && (
              <form onSubmit={handleAssign} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>Assign to Doctor</div>
                <select className="input" required value={assignDoctorId} onChange={e => setAssignDoctorId(e.target.value)}>
                  <option value="">Select a doctor…</option>
                  {doctors?.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button type="submit" className="btn btn-primary" disabled={assignMutation.isPending} style={{ justifyContent: 'center' }}>
                  {assignMutation.isPending ? <><span className="spinner" />Assigning…</> : '👨‍⚕️ Assign Doctor'}
                </button>
              </form>
            )}

            {/* RECEPTIONIST: Send confirmation (awaiting_confirmation) */}
            {isReceptionist && selected.currentStage === 'awaiting_confirmation' && (
              <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>Send Confirmation to Patient</div>
                {/* Show appointment details filled by doctor */}
                {(() => {
                  const appt = selected.appointmentDetails as { date?: string; startTime?: string; endTime?: string; operatoryName?: string; notes?: string } | undefined;
                  return appt ? (
                    <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, borderLeft: '3px solid #10b981', fontSize: '0.8125rem', marginBottom: 4 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>📅 Appointment Details (from Doctor)</div>
                      <div>Date: {appt.date}</div>
                      <div>Time: {appt.startTime} – {appt.endTime}</div>
                      <div>Room: {appt.operatoryName}</div>
                      {appt.notes && <div>Notes: {appt.notes}</div>}
                    </div>
                  ) : null;
                })()}
                <div>
                  <label className="label">Notify patient via</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['email', 'whatsapp', 'sms'] as const).map(ch => (
                      <button key={ch} type="button" onClick={() => setChannel(ch)}
                        style={{ flex: 1, padding: '8px 0', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          border: `1px solid ${channel === ch ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'}`,
                          background: channel === ch ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                          color: channel === ch ? '#a5b4fc' : '#94a3b8' }}>
                        {ch === 'email' ? '📧 Email' : ch === 'whatsapp' ? '💬 WhatsApp' : '📱 SMS'}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" className="btn btn-success" disabled={confirmMutation.isPending} style={{ justifyContent: 'center' }}>
                  {confirmMutation.isPending ? <><span className="spinner" />Sending…</> : '📨 Send Confirmation'}
                </button>
              </form>
            )}

            {/* DOCTOR: Fill appointment details (awaiting_doctor) */}
            {isDentist && selected.currentStage === 'awaiting_doctor' && (
              <form onSubmit={handleApptSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>Fill Appointment Details</div>
                <div>
                  <label className="label">Room / Operatory <span style={{ color: '#ef4444' }}>*</span></label>
                  <select className="input" required value={apptForm.operatoryId} onChange={e => setApptForm(f => ({ ...f, operatoryId: e.target.value }))}>
                    <option value="">Select room…</option>
                    {operatories?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Date <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="input" type="date" required min={new Date().toISOString().split('T')[0]}
                    value={apptForm.date} onChange={e => setApptForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label className="label">Start Time <span style={{ color: '#ef4444' }}>*</span></label>
                    <input className="input" type="time" required value={apptForm.startTime} onChange={e => setApptForm(f => ({ ...f, startTime: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">End Time <span style={{ color: '#ef4444' }}>*</span></label>
                    <input className="input" type="time" required value={apptForm.endTime} onChange={e => setApptForm(f => ({ ...f, endTime: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="label">Notes <span style={{ color: '#64748b', fontWeight: 400 }}>(optional)</span></label>
                  <textarea className="input" rows={2} placeholder="Any notes for the patient…"
                    value={apptForm.notes} onChange={e => setApptForm(f => ({ ...f, notes: e.target.value }))}
                    style={{ resize: 'vertical' }} />
                </div>
                <button type="submit" className="btn btn-primary" disabled={apptMutation.isPending} style={{ justifyContent: 'center' }}>
                  {apptMutation.isPending ? <><span className="spinner" />Submitting…</> : '📅 Submit Appointment'}
                </button>
              </form>
            )}

            {/* Completed */}
            {selected.currentStage === 'completed' && (
              <div className="alert alert-success">✅ Appointment confirmed and sent to patient.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
