import { useState, FormEvent } from 'react';
import { trpc } from '../lib/trpc';

const STATUS_COLOR: Record<string, string> = {
  scheduled: 'badge-blue',
  confirmed: 'badge-green',
  completed: 'badge-gray',
  cancelled: 'badge-red',
  'no-show': 'badge-yellow',
};

const APPT_TYPES = [
  'checkup','cleaning','filling','extraction','root_canal',
  'crown','whitening','consultation','emergency','x_ray',
  'orthodontics','implant','other',
] as const;

const EMPTY_FORM = {
  patientId: '', dentistId: '', operatoryId: '',
  appointmentType: 'checkup' as string,
  date: '', startTime: '', endTime: '', notes: '',
};

export default function AppointmentsPage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dentistId, setDentistId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [bookError, setBookError] = useState('');
  const [bookSuccess, setBookSuccess] = useState(false);

  const utils = trpc.useContext();

  const { data: dentistsData } = trpc.appointments.getPublicDentists.useQuery();
  const { data: opsData }      = trpc.appointments.getPublicOperatories.useQuery();

  const { data, isLoading, isFetching } = trpc.appointments.getCalendar.useQuery(
    { dentistId: dentistId || '000000000000000000000000', from: new Date(date + 'T00:00:00'), to: new Date(date + 'T23:59:59') },
    { enabled: !!dentistId, staleTime: 60 * 1000, keepPreviousData: true },
  );

  const cancel = trpc.appointments.cancel.useMutation({
    onSuccess: () => utils.appointments.getCalendar.invalidate(),
  });

  const create = trpc.appointments.create.useMutation({
    onSuccess: () => {
      setBookSuccess(true);
      setBookError('');
      setForm(EMPTY_FORM);
      utils.appointments.getCalendar.invalidate();
      setTimeout(() => setBookSuccess(false), 4000);
    },
    onError: (err) => setBookError(err.message),
  });

  function setF(k: keyof typeof EMPTY_FORM, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function handleBook(e: FormEvent) {
    e.preventDefault();
    setBookError('');
    create.mutate({
      patientId: form.patientId,
      dentistId: form.dentistId,
      operatoryId: form.operatoryId,
      appointmentType: form.appointmentType as any,
      startTime: new Date(`${form.date}T${form.startTime}`),
      endTime:   new Date(`${form.date}T${form.endTime}`),
      notes: form.notes || undefined,
    });
  }

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Appointments</h1>
        <button
          className={showForm ? 'btn btn-ghost' : 'btn btn-primary'}
          onClick={() => { setShowForm(s => !s); setBookError(''); setBookSuccess(false); }}
        >
          {showForm ? '✕ Close' : '+ Schedule Appointment'}
        </button>
      </div>

      {/* ── Doctor scheduling form ── */}
      {showForm && (
        <div className="card animate-slide" style={{ padding: 28, marginBottom: 28, borderColor: 'rgba(99,102,241,0.3)' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 20 }}>📅 Schedule an Appointment</h2>

          {bookError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{bookError}</div>}
          {bookSuccess && <div className="alert alert-success" style={{ marginBottom: 16 }}>✅ Appointment scheduled successfully.</div>}

          <form onSubmit={handleBook} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Patient ID */}
            <div>
              <label className="label">Patient ID <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="input" required placeholder="Paste patient ID from Patients page…"
                value={form.patientId} onChange={e => setF('patientId', e.target.value)} />
            </div>

            {/* Dentist + Operatory */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="label">Dentist <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="input" required value={form.dentistId} onChange={e => setF('dentistId', e.target.value)}>
                  <option value="">Select dentist</option>
                  {dentistsData?.dentists.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Room / Operatory <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="input" required value={form.operatoryId} onChange={e => setF('operatoryId', e.target.value)}>
                  <option value="">Select room</option>
                  {opsData?.operatories.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>

            {/* Appointment type */}
            <div>
              <label className="label">Appointment Type <span style={{ color: '#ef4444' }}>*</span></label>
              <select className="input" required value={form.appointmentType} onChange={e => setF('appointmentType', e.target.value)}>
                {APPT_TYPES.map(t => (
                  <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>

            {/* Date + Times */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label className="label">Date <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" type="date" required
                  min={new Date().toISOString().split('T')[0]}
                  value={form.date} onChange={e => setF('date', e.target.value)} />
              </div>
              <div>
                <label className="label">Start Time <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" type="time" required value={form.startTime} onChange={e => setF('startTime', e.target.value)} />
              </div>
              <div>
                <label className="label">End Time <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" type="time" required value={form.endTime} onChange={e => setF('endTime', e.target.value)} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="label">Notes <span style={{ color: '#64748b', fontWeight: 400 }}>(optional)</span></label>
              <textarea className="input" rows={2} placeholder="Any notes for this appointment…"
                value={form.notes} onChange={e => setF('notes', e.target.value)}
                style={{ resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={create.isPending} style={{ flex: 1, justifyContent: 'center' }}>
                {create.isPending ? <><span className="spinner" />Scheduling…</> : '📅 Confirm Appointment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Calendar filter ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={date}
            onChange={e => setDate(e.target.value)} style={{ width: 180 }} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="label">Dentist ID</label>
          <input className="input" placeholder="Enter dentist ID to view calendar…"
            value={dentistId} onChange={e => setDentistId(e.target.value)} />
        </div>
      </div>

      {!dentistId && <div className="alert alert-warning">Enter a dentist ID to view their calendar.</div>}
      {isFetching && !isLoading && <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 8 }}>Refreshing…</div>}
      {isLoading && <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.appointments.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No appointments for this date.</div>
          )}
          {data.appointments.map(a => (
            <div key={a.id} className="card animate-slide"
              style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' — '}
                  {new Date(a.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={'badge ' + (STATUS_COLOR[a.status] || 'badge-gray')}>{a.status}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>{a.appointmentType}</span>
                </div>
              </div>
              {a.status !== 'cancelled' && a.status !== 'completed' && (
                <button className="btn btn-danger" style={{ padding: '6px 14px', fontSize: '0.8125rem' }}
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate({ appointmentId: a.id, cancellationReason: 'Cancelled by staff' })}>
                  Cancel
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
