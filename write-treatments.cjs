const fs = require('fs');
const content = `import { useState, FormEvent } from 'react';
import { trpc } from '../lib/trpc';

const STATUS_COLOR = { draft: 'badge-gray', pending_approval: 'badge-yellow', approved: 'badge-green', in_progress: 'badge-blue', completed: 'badge-gray' };

export default function TreatmentsPage() {
  const [pid, setPid] = useState('');
  const [searchId, setSearchId] = useState('');
  const utils = trpc.useContext();
  const { data, isLoading, isFetching } = trpc.treatments.getPatientPlans.useQuery(
    { patientId: searchId },
    { enabled: !!searchId, staleTime: 60 * 1000, keepPreviousData: true },
  );
  const updateStep = trpc.treatments.updateStep.useMutation({ onSuccess: () => utils.treatments.getPatientPlans.invalidate() });
  const genApproval = trpc.treatments.generateApproval.useMutation();

  return (
    <div className="animate-fade">
      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 24 }}>Treatment Plans</h1>
      <form onSubmit={(e) => { e.preventDefault(); setSearchId(pid); }} style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input className="input" placeholder="Enter patient ID..." value={pid} onChange={e => setPid(e.target.value)} style={{ flex: 1 }} />
        <button type="submit" className="btn btn-primary">Load Plans</button>
      </form>
      {isFetching && !isLoading && <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: 8 }}>Refreshing...</div>}
      {isLoading && <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {data.plans.length === 0 && <div className="card" style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No treatment plans found.</div>}
          {data.plans.map(plan => (
            <div key={plan.id} className="card animate-slide" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontWeight: 700, fontSize: '1.0625rem', marginBottom: 4 }}>{plan.title}</h2>
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Total: <strong style={{ color: '#a5b4fc' }}>\${plan.totalEstimatedCost.toFixed(2)}</strong></p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={'badge ' + (STATUS_COLOR[plan.status] || 'badge-gray')}>{plan.status.replace('_', ' ')}</span>
                  {plan.status === 'draft' && (
                    <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8125rem' }} disabled={genApproval.isPending} onClick={() => genApproval.mutate({ planId: plan.id })}>
                      Send for Approval
                    </button>
                  )}
                </div>
              </div>
              <table className="table">
                <thead><tr><th>CDT Code</th><th>Description</th><th>Cost</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {plan.steps.map(step => (
                    <tr key={step.id}>
                      <td><span className="badge badge-blue">{step.cdtCode}</span></td>
                      <td>{step.description}</td>
                      <td style={{ color: '#a5b4fc' }}>\${step.estimatedCost.toFixed(2)}</td>
                      <td><span className={'badge ' + (step.status === 'completed' ? 'badge-green' : step.status === 'in_progress' ? 'badge-yellow' : 'badge-gray')}>{step.status}</span></td>
                      <td>
                        {step.status !== 'completed' && (
                          <button className="btn btn-ghost" style={{ padding: '4px 12px', fontSize: '0.75rem' }} disabled={updateStep.isPending}
                            onClick={() => updateStep.mutate({ planId: plan.id, stepId: step.id, status: step.status === 'planned' ? 'in_progress' : 'completed' })}>
                            {step.status === 'planned' ? 'Start' : 'Complete'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
`;
fs.writeFileSync('apps/web/src/pages/Treatments.tsx', content, 'utf8');
console.log('Done. Size:', fs.statSync('apps/web/src/pages/Treatments.tsx').size, 'bytes');
