import { useState, FormEvent } from 'react';
import { trpc } from '../lib/trpc';

export default function AIPage() {
  const [symptoms, setSymptoms] = useState('');
  const [history, setHistory] = useState('');
  const [meds, setMeds] = useState('');
  const mutation = trpc.ai.getDecisionSupport.useMutation();
  const r = mutation.data;

  return (
    <div className="animate-fade" style={{ maxWidth:760 }}>
      <h1 style={{ fontSize:'1.75rem', fontWeight:800, marginBottom:6 }}>🤖 AI Clinical Decision Support</h1>
      <p style={{ color:'#94a3b8', marginBottom:28, fontSize:'0.875rem' }}>AI-assisted suggestions for licensed dentists only. All output requires professional review.</p>
      <div className="card" style={{ padding:28, marginBottom:24 }}>
        <form onSubmit={(e:FormEvent)=>{e.preventDefault();mutation.mutate({symptoms,patientHistorySummary:history||undefined,currentMedications:meds?meds.split(',').map(m=>m.trim()).filter(Boolean):undefined});}} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div><label className="label">Symptoms <span style={{color:'#ef4444'}}>*</span></label><textarea className="input" rows={4} required placeholder="Describe the patient's symptoms…" value={symptoms} onChange={e=>setSymptoms(e.target.value)} style={{ resize:'vertical' }} /></div>
          <div><label className="label">Patient History</label><textarea className="input" rows={2} placeholder="Relevant medical/dental history (optional)…" value={history} onChange={e=>setHistory(e.target.value)} style={{ resize:'vertical' }} /></div>
          <div><label className="label">Current Medications</label><input className="input" placeholder="Comma-separated (optional)" value={meds} onChange={e=>setMeds(e.target.value)} /></div>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending||!symptoms.trim()} style={{ alignSelf:'flex-start', minWidth:180, justifyContent:'center' }}>
            {mutation.isPending ? <><span className="spinner" />Analysing…</> : '✨ Get Decision Support'}
          </button>
        </form>
      </div>
      {mutation.error && <div className="alert alert-error" style={{ marginBottom:20 }}>{mutation.error.message}</div>}
      {r && (
        <div className="animate-fade">
          <div className="alert alert-warning" style={{ marginBottom:20 }}>⚠️ {r.disclaimer}</div>
          {r.diagnoses.length>0 && (
            <div style={{ marginBottom:20 }}>
              <h2 style={{ fontWeight:700, marginBottom:12, fontSize:'1rem' }}>Possible Diagnoses</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {r.diagnoses.map((d,i) => (
                  <div key={i} className="card" style={{ padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div><div style={{ fontWeight:600, marginBottom:4 }}>{d.name}</div><div style={{ color:'#94a3b8', fontSize:'0.8125rem' }}>{d.evidence}</div></div>
                    <span className={"badge "+(d.confidence==='high'?'badge-green':d.confidence==='medium'?'badge-yellow':'badge-red')}>{d.confidence}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {r.treatments.length>0 && (
            <div style={{ marginBottom:20 }}>
              <h2 style={{ fontWeight:700, marginBottom:12, fontSize:'1rem' }}>Suggested Treatments</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {r.treatments.map((t,i) => (
                  <div key={i} className="card" style={{ padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div><div style={{ fontWeight:600, marginBottom:4 }}>{t.name}</div><div style={{ color:'#94a3b8', fontSize:'0.8125rem' }}>{t.rationale}</div></div>
                    <span className={"badge "+(t.priority==='urgent'?'badge-red':t.priority==='recommended'?'badge-blue':'badge-gray')}>{t.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {r.contraindications.length>0 && (
            <div><h2 style={{ fontWeight:700, marginBottom:12, fontSize:'1rem' }}>⚠️ Contraindications</h2>
              <ul style={{ paddingLeft:20, display:'flex', flexDirection:'column', gap:6 }}>
                {r.contraindications.map((c,i) => <li key={i} style={{ color:'#fca5a5', fontSize:'0.875rem' }}>{c}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
