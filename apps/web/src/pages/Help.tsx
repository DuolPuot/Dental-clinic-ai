import { Link } from 'react-router-dom';

export default function HelpPage() {
  const role = localStorage.getItem('auth-role') ?? '';
  const name = localStorage.getItem('auth-name') ?? 'there';

  const sections = [
    {
      icon: '👥',
      title: 'Patients',
      color: '#6366f1',
      items: [
        { q: 'How do I search for a patient?', a: 'Go to Patients and type a name, phone number, date of birth, or patient ID into the search box. Results appear instantly.' },
        { q: 'How do I add a new patient?', a: 'On the Patients page, click "New Patient" and fill in the required fields (name, DOB, email, phone). Click Save when done.' },
        { q: 'How do I upload an X-ray?', a: 'Open a patient record, scroll to the X-rays section, and click "Upload X-ray". Accepted formats: JPEG, PNG, DICOM. Max 10 MB.' },
        { q: 'Can I delete a patient?', a: 'Patients are soft-deleted — their record is hidden from searches but retained for compliance. Use the "Delete" option on the patient record. Only admins can do this.' },
        { q: 'What is a patient ID?', a: 'Patient IDs are MongoDB ObjectIDs — 24-character hex strings. Copy them from the Patients search results and use them in Treatments, Billing, and Agent Sessions.' },
      ],
    },
    {
      icon: '📅',
      title: 'Appointments',
      color: '#06b6d4',
      items: [
        { q: 'How does the appointment booking workflow work?', a: 'Patients submit a request via the patient portal (/portal/book) with their details and condition. The doctor or receptionist then schedules the actual appointment from the staff Appointments page — selecting the dentist, room, date, and time.' },
        { q: 'How do I schedule an appointment as a doctor or receptionist?', a: 'Go to Appointments and click "+ Schedule Appointment". Fill in the patient ID, select the dentist and room from the dropdowns, choose the appointment type, date, and time, then click "Confirm Appointment".' },
        { q: 'Why does the doctor schedule the appointment, not the patient?', a: 'The doctor knows their own availability and which time slots are free. Patients submit their condition and contact details — the clinic team then confirms a suitable time and contacts the patient.' },
        { q: 'How do I view a dentist\'s calendar?', a: 'Go to Appointments, enter the dentist\'s ID, and select a date. All appointments for that day will appear.' },
        { q: 'How do I cancel an appointment?', a: 'Find the appointment in the calendar view and click "Cancel". You\'ll be asked for a cancellation reason.' },
        { q: 'What does "no-show" mean?', a: 'A no-show is when a patient had a scheduled appointment but did not attend and did not cancel. This affects their risk score in Predictions.' },
      ],
    },
    {
      icon: '🤝',
      title: 'Agent Sessions (AI Workflow)',
      color: '#a78bfa',
      roles: ['admin', 'dentist', 'receptionist'],
      items: [
        { q: 'What is an Agent Session?', a: 'An Agent Session is an automated AI workflow that processes a patient through 5 stages: Intake → Triage → Scheduling → Notification → Summary. Each stage is handled by a specialized AI agent.' },
        { q: 'What does each agent do?', a: '📋 Intake Agent: Collects patient symptoms and medical history.\n🔍 Triage Agent: Uses GPT-4o to assess urgency (emergency / urgent / routine / elective).\n📅 Scheduling Agent: Automatically finds and books the earliest available slot based on urgency.\n🔔 Notification Agent: Sends appointment confirmations and urgent-care alerts.\n📝 Summary Agent: Generates a pre-consultation summary for the dentist.' },
        { q: 'How do I start an Agent Session?', a: 'Go to Agent Sessions, enter the patient ID, click "+ New Session", enter the patient\'s symptoms (comma-separated) and chief complaint, then click "Start Workflow". The pipeline runs automatically in the background.' },
        { q: 'Who can start an Agent Session?', a: 'Receptionists and Admins can start sessions. Dentists and Admins can view the consultation summary once the session completes.' },
        { q: 'What do the status colours mean?', a: '⬜ Pending: Session created, not yet started.\n🔵 In Progress: Agents are actively running — the page refreshes every 3 seconds.\n🟢 Completed: All 5 agents finished successfully.\n🔴 Failed: An agent encountered an error. Check the error details on the session card.' },
        { q: 'What is the triage level?', a: '🚨 Emergency: Book within 2 hours. Urgent alert sent to on-duty dentist.\n🟡 Urgent: Book within 24 hours.\n🔵 Routine: Book within 7 days.\n🟢 Elective: Book within 7 days, lower priority.' },
        { q: 'Where do I see the consultation summary?', a: 'Click on a completed session in Agent Sessions. If you are a Dentist or Admin, the summary panel will appear on the right with all 6 sections: Patient Overview, Chief Complaint, Triage Assessment, Appointment Details, Medical History Highlights, and Suggested Preparation Notes.' },
        { q: 'What if the AI is unavailable?', a: 'Both the Triage Agent and Summary Agent have fallback modes. If GPT-4o is unavailable, triage defaults to "routine" and the summary is built from structured intake data. A warning badge appears on the session card.' },
      ],
    },
    {
      icon: '📋',
      title: 'Treatment Plans',
      color: '#10b981',
      items: [
        { q: 'How do I load a patient\'s treatment plans?', a: 'Go to Treatments, enter the patient\'s ID, and click "Load Plans". All plans for that patient will appear.' },
        { q: 'How do I send a plan for patient approval?', a: 'On a plan with status "draft", click "Send for Approval". The patient receives a link to approve or decline.' },
        { q: 'How do I mark a treatment step as complete?', a: 'In the treatment plan table, click "Start" to begin a step, then "Complete" when it\'s done. This updates the step status and enables invoice generation.' },
        { q: 'Where do CDT codes come from?', a: 'CDT (Current Dental Terminology) codes are standard ADA procedure codes. Costs are pulled automatically from the clinic\'s fee schedule.' },
      ],
    },
    {
      icon: '🤖',
      title: 'AI Assistant',
      color: '#8b5cf6',
      roles: ['admin', 'dentist'],
      items: [
        { q: 'What can the AI Assistant do?', a: 'It provides clinical decision support — possible diagnoses, treatment suggestions, and contraindication flags based on symptoms and patient history. It also analyses X-ray images.' },
        { q: 'How is the AI Assistant different from Agent Sessions?', a: 'The AI Assistant (🤖 chatbot) is for on-demand questions — you type a question and get an instant answer. Agent Sessions run a full automated pipeline for a specific patient, coordinating intake, triage, scheduling, notifications, and a summary report.' },
        { q: 'Is the AI output a medical diagnosis?', a: 'No. All AI output is for informational support only and must be reviewed by a licensed dentist. The mandatory disclaimer appears on every response.' },
        { q: 'How do I use the chatbot?', a: 'Click the 🤖 button in the bottom-right corner of any staff page. Type your question and press Enter or click the send button. It knows the clinic\'s fee schedule, CDT codes, team, and hours.' },
        { q: 'What if the AI gives a wrong answer?', a: 'Always apply clinical judgment. The AI can make mistakes. Never act on AI output without professional review.' },
      ],
    },
    {
      icon: '💳',
      title: 'Billing',
      color: '#f59e0b',
      roles: ['admin', 'billing_staff'],
      items: [
        { q: 'How do I generate an invoice?', a: 'Go to Billing, enter the patient ID, and click "Load Invoices". Invoices are auto-generated from completed treatment steps.' },
        { q: 'How do I record a payment?', a: 'On an unpaid invoice, click "Record Payment", select the payment method (card, cash, or insurance), enter the amount, and confirm.' },
        { q: 'How do I export a claim PDF?', a: 'On any invoice, click "Export PDF" to download an ADA Dental Claim Form for insurance submission.' },
        { q: 'What does "patient responsibility" mean?', a: 'It\'s the amount the patient owes after insurance coverage is deducted. Formula: Subtotal − Insurance Coverage = Patient Responsibility.' },
      ],
    },
    {
      icon: '📊',
      title: 'Analytics',
      color: '#67e8f9',
      items: [
        { q: 'What does the Analytics dashboard show?', a: 'Last 30 days of clinic performance: total appointments, no-show rate, new patients, and (for admin/billing) revenue collected and outstanding balance.' },
        { q: 'Why can\'t I see revenue data?', a: 'Revenue and billing metrics are only visible to Admin and Billing Staff roles. Dentists and receptionists see appointment and patient metrics only.' },
        { q: 'How often is the data updated?', a: 'Analytics data is cached for 2 minutes. Refresh the page to get the latest figures.' },
      ],
    },
    {
      icon: '🔮',
      title: 'Predictions',
      color: '#f472b6',
      items: [
        { q: 'What is the no-show risk score?', a: 'A score from 0–100 predicting how likely a patient is to miss their upcoming appointment. It factors in past no-show rate, cancellation history, days until appointment, time of day, and appointment type.' },
        { q: 'What do the risk levels mean?', a: '🟢 Low (0–29): Standard reminder.\n🟡 Medium (30–59): Send extra reminders and consider a confirmation call.\n🔴 High (60–100): Proactive outreach recommended, consider overbooking.' },
        { q: 'How far ahead does it predict?', a: 'The next 7 days of scheduled and confirmed appointments are scored.' },
      ],
    },
    {
      icon: '💬',
      title: 'Feedback',
      color: '#34d399',
      items: [
        { q: 'How do patients submit feedback?', a: 'Patients can submit feedback via the patient portal at /portal/feedback. No login required.' },
        { q: 'Where do I view feedback?', a: 'Go to the Feedback page in the staff portal. You can filter by category, rating, and date range.' },
        { q: 'What categories are available?', a: 'Scheduling, Staff, AI Assistant, Overall, and Other.' },
      ],
    },
  ];

  // Role-based quick actions
  const quickActions: { label: string; to: string; icon: string; color: string; roles?: string[] }[] = [
    { label: 'Search Patients',    to: '/staff/patients',     icon: '👥', color: '#6366f1' },
    { label: 'Schedule Appointment', to: '/staff/appointments', icon: '📅', color: '#06b6d4' },
    { label: 'Start Agent Session', to: '/staff/agents',       icon: '🤝', color: '#a78bfa', roles: ['admin','receptionist'] },
    { label: 'View Summary',        to: '/staff/agents',       icon: '📝', color: '#8b5cf6',  roles: ['admin','dentist'] },
    { label: 'Treatment Plans',     to: '/staff/treatments',   icon: '📋', color: '#10b981' },
    { label: 'Billing',             to: '/staff/billing',      icon: '💳', color: '#f59e0b',  roles: ['admin','billing_staff'] },
    { label: 'Analytics',           to: '/staff/analytics',    icon: '📊', color: '#67e8f9' },
    { label: 'Predictions',         to: '/staff/predictions',  icon: '🔮', color: '#f472b6' },
  ].filter(a => !a.roles || a.roles.includes(role));

  const visible = sections.filter(s => !s.roles || s.roles.includes(role));

  return (
    <div className="animate-fade">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 6 }}>❓ Help & Guidance</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          Hi {name.split(' ')[0]}! Quick answers, workflow guides, and tips for every feature.
        </p>
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Actions</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
          {quickActions.map(a => (
            <Link key={a.to + a.label} to={a.to} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: a.color + '22', border: '1px solid ' + a.color + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                {a.icon}
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)' }}>{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Workflow overview */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 28, background: 'linear-gradient(135deg,rgba(167,139,250,0.1),rgba(6,182,212,0.06))' }}>
        <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔄</span> Patient Workflow Overview
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: '0.8125rem' }}>
          {[
            { step: '1', label: 'Patient Books', icon: '🌐', desc: 'via /portal/book' },
            { step: '2', label: 'Staff Reviews', icon: '👥', desc: 'Patients page' },
            { step: '3', label: 'Agent Session', icon: '🤝', desc: 'Auto triage & schedule' },
            { step: '4', label: 'Doctor Schedules', icon: '📅', desc: 'Appointments page' },
            { step: '5', label: 'Treatment Plan', icon: '📋', desc: 'Treatments page' },
            { step: '6', label: 'Invoice & Pay', icon: '💳', desc: 'Billing page' },
          ].map((s, i, arr) => (
            <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', margin: '0 auto 4px' }}>{s.icon}</div>
                <div style={{ fontWeight: 600, color: '#a5b4fc' }}>{s.label}</div>
                <div style={{ color: '#64748b', fontSize: '0.7rem' }}>{s.desc}</div>
              </div>
              {i < arr.length - 1 && <div style={{ color: '#475569', fontSize: '1rem', flexShrink: 0 }}>→</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Quick tips */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 28, background: 'linear-gradient(135deg,rgba(99,102,241,0.08),rgba(6,182,212,0.05))', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>💡</span>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Quick Tips</div>
          <ul style={{ color: '#94a3b8', fontSize: '0.875rem', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <li>The <strong style={{ color: '#a5b4fc' }}>🤖 AI chatbot</strong> (bottom-right) knows the clinic's fee schedule, CDT codes, team, and hours.</li>
            <li>Patient IDs are 24-character codes — copy them from the Patients search results.</li>
            <li><strong style={{ color: '#a5b4fc' }}>Doctors schedule appointments</strong> from the Appointments page — patients only submit a request via the portal.</li>
            <li><strong style={{ color: '#a5b4fc' }}>Agent Sessions</strong> automate the full intake-to-summary pipeline. Start one from the 🤝 Agent Sessions page.</li>
            <li>All AI output requires review by a licensed dental professional before acting on it.</li>
            <li>Use the <strong style={{ color: '#a5b4fc' }}>theme toggle</strong> (top-right) to switch between dark and light mode.</li>
          </ul>
        </div>
      </div>

      {/* Role badge */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>Showing help for your role:</span>
        <span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>{role.replace('_', ' ')}</span>
        <span style={{ fontSize: '0.75rem', color: '#475569' }}>— some sections are hidden based on your permissions</span>
      </div>

      {/* FAQ sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {visible.map(section => (
          <div key={section.title}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: section.color + '22', border: '1px solid ' + section.color + '44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>
                {section.icon}
              </div>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>{section.title}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {section.items.map((item, i) => (
                <details key={i} style={{ background: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: 10, overflow: 'hidden' }}>
                  <summary style={{ padding: '12px 16px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}>
                    <span>{item.q}</span>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', flexShrink: 0, marginLeft: 12 }}>▼</span>
                  </summary>
                  <div style={{ padding: '10px 16px 14px', color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.7, borderTop: '1px solid var(--card-border)', whiteSpace: 'pre-line' }}>
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="card" style={{ padding: '20px 24px', marginTop: 32, textAlign: 'center' }}>
        <div style={{ fontSize: '1.25rem', marginBottom: 8 }}>🦷</div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Still need help?</div>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 12 }}>
          Use the AI chatbot for platform questions, or contact your system administrator.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>📞 (555) 123-4567</span>
          <span style={{ color: '#475569' }}>·</span>
          <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>📧 hello@dentalai.clinic</span>
        </div>
      </div>
    </div>
  );
}
