import { trpc } from '../lib/trpc';

const RISK_COLOR = { low:'badge-green', medium:'badge-yellow', high:'badge-red' };
const RISK_ICON = { low:'🟢', medium:'🟡', high:'🔴' };

export default function PredictionsPage() {
  const isAuthenticated = !!localStorage.getItem('auth-token');

  const { data, isLoading, error, refetch } = trpc.prediction.upcomingRisks.useQuery(
    undefined,
    {
      enabled: isAuthenticated,   // never fire without a token
      staleTime: 5 * 60 * 1000,
      retry: false,               // don't retry 401/403 — fail fast
    },
  );

  const high = data?.filter(r=>r.riskLevel==='high').length ?? 0;
  const medium = data?.filter(r=>r.riskLevel==='medium').length ?? 0;
  const low = data?.filter(r=>r.riskLevel==='low').length ?? 0;

  return (
    <div className="animate-fade">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:'1.75rem', fontWeight:800, marginBottom:4 }}>🔮 Predictive Scheduling</h1>
          <p style={{ color:'#94a3b8', fontSize:'0.875rem' }}>No-show risk scores for upcoming appointments (next 7 days)</p>
        </div>
        <button className="btn btn-ghost" onClick={()=>refetch()}>↻ Refresh</button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          {(error as any)?.data?.httpStatus === 401
            ? 'Session expired. Please log out and log back in.'
            : 'Failed to load predictions. Try refreshing.'}
        </div>
      )}

      {/* Summary */}
      {data && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:28 }}>
          <div className="card" style={{ padding:16, textAlign:'center', borderColor:'rgba(239,68,68,0.3)' }}>
            <div style={{ fontSize:'2rem', fontWeight:800, color:'#fca5a5' }}>{high}</div>
            <div style={{ color:'#94a3b8', fontSize:'0.8125rem' }}>🔴 High Risk</div>
          </div>
          <div className="card" style={{ padding:16, textAlign:'center', borderColor:'rgba(245,158,11,0.3)' }}>
            <div style={{ fontSize:'2rem', fontWeight:800, color:'#fcd34d' }}>{medium}</div>
            <div style={{ color:'#94a3b8', fontSize:'0.8125rem' }}>🟡 Medium Risk</div>
          </div>
          <div className="card" style={{ padding:16, textAlign:'center', borderColor:'rgba(16,185,129,0.3)' }}>
            <div style={{ fontSize:'2rem', fontWeight:800, color:'#6ee7b7' }}>{low}</div>
            <div style={{ color:'#94a3b8', fontSize:'0.8125rem' }}>🟢 Low Risk</div>
          </div>
        </div>
      )}

      {isLoading && <div style={{ textAlign:'center', padding:60 }}><div className="spinner" style={{ margin:'0 auto' }} /></div>}

      {data && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {data.length===0 && <div className="card" style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>No upcoming appointments in the next 7 days.</div>}
          {/* Sort by risk score descending */}
          {[...data].sort((a,b)=>b.riskScore-a.riskScore).map(r => (
            <div key={r.appointmentId} className="card animate-slide" style={{ padding:'16px 20px', borderColor: r.riskLevel==='high'?'rgba(239,68,68,0.3)':r.riskLevel==='medium'?'rgba(245,158,11,0.3)':'rgba(16,185,129,0.2)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:'1.1rem' }}>{RISK_ICON[r.riskLevel]}</span>
                    <span className={"badge "+RISK_COLOR[r.riskLevel]}>{r.riskLevel.toUpperCase()} RISK</span>
                    <span style={{ color:'#94a3b8', fontSize:'0.8125rem' }}>Score: {r.riskScore}/100</span>
                  </div>
                  <div style={{ fontSize:'0.8125rem', color:'#64748b' }}>
                    Patient: <code style={{ color:'#a5b4fc' }}>{r.patientId.slice(-8)}</code>
                    &nbsp;·&nbsp;Appt: <code style={{ color:'#67e8f9' }}>{r.appointmentId.slice(-8)}</code>
                  </div>
                </div>
                {/* Risk score bar */}
                <div style={{ width:80, textAlign:'right' }}>
                  <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:4, height:6, overflow:'hidden' }}>
                    <div style={{ width:r.riskScore+'%', height:'100%', borderRadius:4, background: r.riskLevel==='high'?'#ef4444':r.riskLevel==='medium'?'#f59e0b':'#10b981', transition:'width 0.5s' }} />
                  </div>
                </div>
              </div>
              {/* Factors */}
              {r.factors.length>0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                  {r.factors.map((f,i) => <span key={i} style={{ fontSize:'0.75rem', background:'rgba(255,255,255,0.06)', padding:'2px 8px', borderRadius:4, color:'#94a3b8' }}>{f}</span>)}
                </div>
              )}
              {/* Recommendation */}
              <div style={{ fontSize:'0.8125rem', color:'#67e8f9', background:'rgba(6,182,212,0.08)', padding:'6px 10px', borderRadius:6, borderLeft:'3px solid #06b6d4' }}>
                💡 {r.recommendation}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
