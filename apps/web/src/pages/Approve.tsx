import { useState } from 'react';
import { trpc } from '../lib/trpc';

export default function ApprovePage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const [decision, setDecision] = useState<'approve'|'decline'|null>(null);
  const [done, setDone] = useState(false);
  const mutation = trpc.treatments.processApproval.useMutation({ onSuccess:()=>setDone(true) });

  if (!token) return <div className="alert alert-error">Invalid or missing approval token.</div>;

  if (done) return (
    <div className="animate-fade" style={{ textAlign:'center', padding:'60px 20px' }}>
      <div style={{ fontSize:'4rem', marginBottom:16 }}>{decision==='approve'?'✅':'❌'}</div>
      <h1 style={{ fontSize:'1.75rem', fontWeight:800, marginBottom:8 }}>{decision==='approve'?'Treatment Plan Approved':'Treatment Plan Declined'}</h1>
      <p style={{ color:'#94a3b8', maxWidth:400, margin:'0 auto' }}>
        {decision==='approve'?'Your dental team will be in touch to schedule your appointments.':'Please contact the clinic if you have questions.'}
      </p>
    </div>
  );

  return (
    <div className="animate-fade">
      <h1 style={{ fontSize:'1.75rem', fontWeight:800, marginBottom:6 }}>Review Treatment Plan</h1>
      <p style={{ color:'#94a3b8', marginBottom:28, fontSize:'0.875rem' }}>Please review and indicate your decision below.</p>
      {mutation.error && <div className="alert alert-error" style={{ marginBottom:20 }}>{mutation.error.message}</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:28 }}>
        {(['approve','decline'] as const).map(d => (
          <label key={d} className="card" style={{ padding:20, display:'flex', alignItems:'center', gap:16, cursor:'pointer', borderColor: decision===d?(d==='approve'?'rgba(99,102,241,0.6)':'rgba(239,68,68,0.6)'):'rgba(255,255,255,0.1)', background: decision===d?(d==='approve'?'rgba(99,102,241,0.1)':'rgba(239,68,68,0.1)'):'rgba(255,255,255,0.05)' }}>
            <input type="radio" name="decision" value={d} checked={decision===d} onChange={()=>setDecision(d)} style={{ accentColor: d==='approve'?'#6366f1':'#ef4444' }} />
            <div>
              <p style={{ fontWeight:600, marginBottom:2 }}>{d==='approve'?'✅ Approve Treatment Plan':'❌ Decline Treatment Plan'}</p>
              <p style={{ color:'#94a3b8', fontSize:'0.8125rem' }}>{d==='approve'?'I agree to proceed with the proposed treatment.':'I do not wish to proceed at this time.'}</p>
            </div>
          </label>
        ))}
      </div>
      <button className={"btn btn-lg "+(decision==='approve'?'btn-primary':'btn-danger')} disabled={!decision||mutation.isPending} onClick={()=>decision&&mutation.mutate({token,decision})} style={{ width:'100%', justifyContent:'center' }}>
        {mutation.isPending?<><span className="spinner" />Submitting…</>:'Submit Decision'}
      </button>
    </div>
  );
}
