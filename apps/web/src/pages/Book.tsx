import { useState, FormEvent } from 'react';
import { trpc } from '../lib/trpc';

const APPOINTMENT_TYPES = [
  { value: 'checkup',      label: '🔍 Check-up',      hasDuration: false, hasDisease: false },
  { value: 'cleaning',     label: '🦷 Cleaning',       hasDuration: false, hasDisease: false },
  { value: 'whitening',    label: '✨ Whitening',       hasDuration: false, hasDisease: false },
  { value: 'x_ray',        label: '📷 X-Ray',           hasDuration: false, hasDisease: false },
  { value: 'consultation', label: '💬 Consultation',    hasDuration: false, hasDisease: true  },
  { value: 'filling',      label: '🪥 Filling',         hasDuration: true,  hasDisease: true  },
  { value: 'extraction',   label: '🦷 Extraction',      hasDuration: true,  hasDisease: true  },
  { value: 'root_canal',   label: '💉 Root Canal',      hasDuration: true,  hasDisease: true  },
  { value: 'crown',        label: '👑 Crown',           hasDuration: true,  hasDisease: true  },
  { value: 'orthodontics', label: '🦷 Orthodontics',    hasDuration: true,  hasDisease: true  },
  { value: 'implant',      label: '🔩 Implant',         hasDuration: true,  hasDisease: true  },
  { value: 'emergency',    label: '🚨 Emergency',       hasDuration: true,  hasDisease: true  },
  { value: 'other',        label: '📋 Other',           hasDuration: true,  hasDisease: true  },
] as const;

const DISEASE_OPTIONS: Record<string, string[]> = {
  filling:      ['Tooth Decay (Cavity)', 'Cracked Tooth', 'Broken Filling', 'Worn Enamel', 'Sensitivity'],
  extraction:   ['Severe Decay', 'Impacted Wisdom Tooth', 'Overcrowding', 'Infection/Abscess', 'Fractured Tooth'],
  root_canal:   ['Pulp Infection', 'Deep Cavity', 'Cracked Tooth to Root', 'Repeated Dental Procedures', 'Trauma'],
  crown:        ['Severely Decayed Tooth', 'Cracked/Broken Tooth', 'After Root Canal', 'Worn Down Tooth', 'Cosmetic Reason'],
  orthodontics: ['Crooked Teeth', 'Overbite', 'Underbite', 'Crossbite', 'Gaps Between Teeth', 'Crowding'],
  implant:      ['Missing Tooth', 'Failed Bridge', 'Bone Loss', 'Multiple Missing Teeth'],
  emergency:    ['Severe Toothache', 'Knocked-Out Tooth', 'Broken/Chipped Tooth', 'Lost Filling or Crown', 'Swollen Jaw/Abscess', 'Bleeding Gums', 'Dental Trauma'],
  consultation: ['Second Opinion', 'Treatment Planning', 'Cosmetic Assessment', 'Pain Evaluation', 'General Concern'],
  other:        ['Gum Disease (Gingivitis)', 'Gum Disease (Periodontitis)', 'Dry Mouth', 'Bad Breath', 'Jaw Pain (TMJ)', 'Mouth Sores', 'Other'],
};

const SEVERITY_OPTIONS = [
  { value: 'mild',     label: '🟢 Mild',     desc: 'Minor discomfort, not affecting daily life' },
  { value: 'moderate', label: '🟡 Moderate', desc: 'Noticeable pain, some impact on daily activities' },
  { value: 'severe',   label: '🔴 Severe',   desc: 'Significant pain, affecting eating or sleeping' },
  { value: 'critical', label: '🚨 Critical', desc: 'Unbearable pain or visible swelling/infection' },
];

const DURATION_OPTIONS = [
  { value: 'today',     label: 'Started today' },
  { value: '1-3days',   label: '1–3 days ago' },
  { value: '1week',     label: 'About a week ago' },
  { value: '2-4weeks',  label: '2–4 weeks ago' },
  { value: '1-3months', label: '1–3 months ago' },
  { value: '3months+',  label: 'More than 3 months ago' },
  { value: 'chronic',   label: 'Ongoing / chronic condition' },
];

type ApptType = typeof APPOINTMENT_TYPES[number]['value'];

interface FormState {
  firstName: string; lastName: string; email: string; phone: string;
  appointmentType: ApptType;
  disease: string; severity: string; duration: string; description: string;
}

const INITIAL: FormState = {
  firstName: '', lastName: '', email: '', phone: '',
  appointmentType: 'checkup',
  disease: '', severity: '', duration: '', description: '',
};

export default function BookPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const submitMutation = trpc.agents.submitPatientRequest.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => setSubmitError(err.message),
  });

  function set(k: keyof FormState, v: string) {
    setForm(f => {
      const next = { ...f, [k]: v };
      // Reset condition fields when type changes
      if (k === 'appointmentType') {
        next.disease = '';
        next.severity = '';
        next.duration = '';
      }
      return next;
    });
  }

  const selectedType = APPOINTMENT_TYPES.find(t => t.value === form.appointmentType)!;
  const diseaseList = DISEASE_OPTIONS[form.appointmentType] ?? [];
  const showDisease   = selectedType.hasDisease && diseaseList.length > 0;
  const showSeverity  = selectedType.hasDisease;
  const showDuration  = selectedType.hasDuration;
  const showCondition = showDisease || showSeverity || showDuration;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError('');

    // Validate required conditional fields
    if (showDisease && !form.disease) { setSubmitError('Please select your condition.'); return; }
    if (showSeverity && !form.severity) { setSubmitError('Please select the severity.'); return; }
    if (showDuration && !form.duration) { setSubmitError('Please select how long you have had this.'); return; }

    const symptomList = [
      form.disease,
      form.severity ? `Severity: ${form.severity}` : '',
      form.duration ? `Duration: ${form.duration}` : '',
    ].filter(Boolean) as string[];

    submitMutation.mutate({
      firstName:       form.firstName,
      lastName:        form.lastName,
      email:           form.email || undefined,
      phone:           form.phone,
      symptoms:        symptomList.length ? symptomList : [form.appointmentType],
      chiefComplaint:  form.description || form.disease || form.appointmentType,
      appointmentType: form.appointmentType,
      disease:         form.disease || undefined,
      severity:        form.severity || undefined,
      duration:        form.duration || undefined,
      description:     form.description || undefined,
    });
  }

  if (submitted) return (
    <div className="animate-fade" style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '4rem', marginBottom: 16 }}>✅</div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8 }}>Request Received!</h1>
      <p style={{ color: '#94a3b8', marginBottom: 4 }}>
        Thank you, <strong style={{ color: '#a5b4fc' }}>{form.firstName}</strong>. Your appointment request has been submitted.
      </p>
      <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 8 }}>
        Our team will review your request and contact you to confirm a date and time.
      </p>
      {form.email && (
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 28 }}>
          A confirmation will be sent to <strong style={{ color: '#a5b4fc' }}>{form.email}</strong>.
        </p>
      )}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 24, textAlign: 'left', maxWidth: 400, margin: '0 auto 24px' }}>
        <div style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: 8 }}>Your request summary</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.875rem' }}>
          <div><span style={{ color: '#94a3b8' }}>Name: </span>{form.firstName} {form.lastName}</div>
          <div><span style={{ color: '#94a3b8' }}>Phone: </span>{form.phone}</div>
          <div><span style={{ color: '#94a3b8' }}>Type: </span>{selectedType.label}</div>
          {form.disease   && <div><span style={{ color: '#94a3b8' }}>Condition: </span>{form.disease}</div>}
          {form.severity  && <div><span style={{ color: '#94a3b8' }}>Severity: </span>{SEVERITY_OPTIONS.find(s => s.value === form.severity)?.label}</div>}
        </div>
      </div>
      <button className="btn btn-primary btn-lg" onClick={() => { setSubmitted(false); setForm(INITIAL); setStep(1); }}>
        Submit Another Request
      </button>
    </div>
  );

  return (
    <div className="animate-fade">
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 4 }}>📅 Book an Appointment</h1>
      <p style={{ color: '#94a3b8', marginBottom: 28, fontSize: '0.875rem' }}>
        Fill in your details and condition. Our team will contact you to confirm your appointment time.
      </p>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, alignItems: 'center' }}>
        {(['Your Details', 'Your Condition'] as const).map((label, i) => {
          const s = (i + 1) as 1 | 2;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.875rem',
                background: step >= s ? 'linear-gradient(135deg,#6366f1,#06b6d4)' : 'rgba(255,255,255,0.08)',
                color: step >= s ? '#fff' : '#64748b',
              }}>{s}</div>
              <span style={{ fontSize: '0.8125rem', color: step >= s ? '#a5b4fc' : '#64748b' }}>{label}</span>
              {s < 2 && <div style={{ width: 28, height: 2, background: step > s ? '#6366f1' : 'rgba(255,255,255,0.1)', borderRadius: 2 }} />}
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 32 }}>

        {/* ── Step 1: Patient Details ── */}
        {step === 1 && (
          <form onSubmit={e => { e.preventDefault(); setStep(2); }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Your Information</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="label">First Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" required placeholder="John" value={form.firstName} onChange={e => set('firstName', e.target.value)} />
              </div>
              <div>
                <label className="label">Last Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" required placeholder="Doe" value={form.lastName} onChange={e => set('lastName', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Email Address <span style={{ color: '#64748b', fontWeight: 400 }}>(optional)</span></label>
              <input className="input" type="email" placeholder="john@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div>
              <label className="label">Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="input" type="tel" required placeholder="+1 555 000 0000" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="alert alert-warning" style={{ fontSize: '0.8125rem' }}>
              📞 Our team will call you on this number to confirm your appointment date and time.
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{ justifyContent: 'center', marginTop: 4 }}>
              Continue →
            </button>
          </form>
        )}

        {/* ── Step 2: Condition ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Your Condition</h2>

            {/* Appointment type selector */}
            <div>
              <label className="label">What do you need? <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(148px,1fr))', gap: 8 }}>
                {APPOINTMENT_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => set('appointmentType', t.value)}
                    style={{
                      padding: '10px 12px', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 500,
                      border: `1px solid ${form.appointmentType === t.value ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'}`,
                      background: form.appointmentType === t.value ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                      color: form.appointmentType === t.value ? '#a5b4fc' : '#94a3b8',
                      cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Condition fields — only shown when relevant to the selected type */}
            {showCondition && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px', background: 'rgba(99,102,241,0.05)', borderRadius: 10, border: '1px solid rgba(99,102,241,0.15)' }}>
                <div style={{ fontSize: '0.8125rem', color: '#a5b4fc', fontWeight: 600, marginBottom: -4 }}>
                  Condition Details for {selectedType.label}
                </div>

                {/* Disease dropdown */}
                {showDisease && (
                  <div>
                    <label className="label">Condition / Disease <span style={{ color: '#ef4444' }}>*</span></label>
                    <select className="input" value={form.disease} onChange={e => set('disease', e.target.value)}>
                      <option value="">Select your condition…</option>
                      {diseaseList.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}

                {/* Severity — radio cards */}
                {showSeverity && (
                  <div>
                    <label className="label">Severity <span style={{ color: '#ef4444' }}>*</span></label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {SEVERITY_OPTIONS.map(s => (
                        <label key={s.value} onClick={() => set('severity', s.value)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                            borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                            border: `1px solid ${form.severity === s.value ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                            background: form.severity === s.value ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                          }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                            border: `2px solid ${form.severity === s.value ? '#6366f1' : '#475569'}`,
                            background: form.severity === s.value ? '#6366f1' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {form.severity === s.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: form.severity === s.value ? '#a5b4fc' : '#f1f5f9' }}>{s.label}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Duration dropdown */}
                {showDuration && (
                  <div>
                    <label className="label">How long have you had this? <span style={{ color: '#ef4444' }}>*</span></label>
                    <select className="input" value={form.duration} onChange={e => set('duration', e.target.value)}>
                      <option value="">Select duration…</option>
                      {DURATION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Description — always shown */}
            <div>
              <label className="label">
                Additional Details
                {!showCondition && <span style={{ color: '#64748b', fontWeight: 400 }}> (optional)</span>}
              </label>
              <textarea className="input" rows={3}
                placeholder={showCondition
                  ? 'Describe your symptoms, when the pain started, what makes it better or worse…'
                  : 'Any specific requests or notes for your appointment…'}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            {submitError && <div className="alert alert-error">{submitError}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button type="submit" className="btn btn-primary btn-lg" disabled={submitMutation.isPending} style={{ flex: 1, justifyContent: 'center' }}>
                {submitMutation.isPending ? <><span className="spinner" />Submitting…</> : '📅 Submit Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
