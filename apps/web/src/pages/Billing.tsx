import { useState, FormEvent } from 'react';
import { trpc } from '../lib/trpc';

const STATUS_COLOR: Record<string,string> = { draft:'badge-gray', sent:'badge-blue', paid:'badge-green', overdue:'badge-red' };

export default function BillingPage() {
  const [pid, setPid] = useState('');
  const [searchId, setSearchId] = useState('');
  const [payingId, setPayingId] = useState<string|null>(null);
  const [method, setMethod] = useState<'card'|'cash'|'insurance'>('card');
  const [amount, setAmount] = useState('');
  const utils = trpc.useContext();
  const { data, isLoading } = trpc.billing.getPatientInvoices.useQuery({ patientId: searchId }, { enabled: !!searchId });
  const pay = trpc.billing.recordPayment.useMutation({ onSuccess:()=>{ setPayingId(null); setAmount(''); utils.billing.getPatientInvoices.invalidate(); } });
  const exportPdf = trpc.billing.exportClaim.useMutation({ onSuccess:(r)=>{ const a=document.createElement('a'); a.href='data:application/pdf;base64,'+r.pdf; a.download='claim.pdf'; a.click(); } });

  return (
    <div className="animate-fade">
      <h1 style={{ fontSize:'1.75rem', fontWeight:800, marginBottom:24 }}>Billing</h1>
      <form onSubmit={(e:FormEvent)=>{e.preventDefault();setSearchId(pid);}} style={{ display:'flex', gap:10, marginBottom:24 }}>
        <input className="input" placeholder="Enter patient ID…" value={pid} onChange={e=>setPid(e.target.value)} style={{ flex:1 }} />
        <button type="submit" className="btn btn-primary">Load Invoices</button>
      </form>
      {isLoading && <div style={{ textAlign:'center', padding:40 }}><div className="spinner" style={{ margin:'0 auto' }} /></div>}
      {data && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {data.invoices.length===0 && <div className="card" style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>No invoices found.</div>}
          {data.invoices.map(inv => (
            <div key={inv.id} className="card animate-slide" style={{ padding:24 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                <div>
                  <p style={{ color:'#94a3b8', fontSize:'0.8125rem', marginBottom:4 }}>Invoice #{inv.id.slice(-8).toUpperCase()}</p>
                  <p style={{ fontSize:'0.875rem' }}>Due: {new Date(inv.dueDate).toLocaleDateString()}{inv.paidAt && ' · Paid: '+new Date(inv.paidAt).toLocaleDateString()}</p>
                </div>
                <span className={"badge "+(STATUS_COLOR[inv.status]||'badge-gray')}>{inv.status.toUpperCase()}</span>
              </div>
              <table className="table" style={{ marginBottom:12 }}>
                <thead><tr><th>CDT</th><th>Description</th><th style={{textAlign:'right'}}>Amount</th></tr></thead>
                <tbody>
                  {inv.lineItems.map((li,i) => (
                    <tr key={i}><td><span className="badge badge-blue">{li.cdtCode}</span></td><td>{li.description}</td><td style={{textAlign:'right',color:'#a5b4fc'}}>${li.amount.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, fontSize:'0.875rem', marginBottom:16 }}>
                <p>Subtotal: <strong>${inv.subtotal.toFixed(2)}</strong></p>
                <p style={{ color:'#10b981' }}>Insurance: −${inv.insuranceCoverage.toFixed(2)}</p>
                <p style={{ fontSize:'1rem', fontWeight:700, color:'#a5b4fc' }}>Patient Responsibility: ${inv.patientResponsibility.toFixed(2)}</p>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {inv.status!=='paid' && <button className="btn btn-success" style={{ padding:'8px 16px', fontSize:'0.8125rem' }} onClick={()=>setPayingId(inv.id)}>Record Payment</button>}
                <button className="btn btn-ghost" style={{ padding:'8px 16px', fontSize:'0.8125rem' }} onClick={()=>exportPdf.mutate({invoiceId:inv.id})}>Export PDF</button>
              </div>
              {payingId===inv.id && (
                <div style={{ marginTop:16, padding:16, background:'rgba(255,255,255,0.04)', borderRadius:8, display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
                  <div><label className="label">Method</label>
                    <select className="input" value={method} onChange={e=>setMethod(e.target.value as any)} style={{ width:130 }}>
                      <option value="card">Card</option><option value="cash">Cash</option><option value="insurance">Insurance</option>
                    </select>
                  </div>
                  <div><label className="label">Amount ($)</label><input className="input" type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} style={{ width:120 }} /></div>
                  <button className="btn btn-primary" disabled={!amount||pay.isPending} onClick={()=>pay.mutate({invoiceId:inv.id,paymentMethod:method,amount:parseFloat(amount)})}>Confirm</button>
                  <button className="btn btn-ghost" onClick={()=>setPayingId(null)}>Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
