import { useState, FormEvent } from 'react';
import { trpc } from '../lib/trpc';

export default function PatientsPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState(' ');
  const { data, isLoading, error } = trpc.patients.search.useQuery(
    { query: search, limit: 20, offset: 0 },
    { enabled: !!localStorage.getItem('auth-token'), retry: false },
  );

  return (
    <div className="animate-fade">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <h1 style={{ fontSize:'1.75rem', fontWeight:800 }}>Patients</h1>
      </div>
      <form onSubmit={(e:FormEvent)=>{e.preventDefault();setSearch(q||' ');}} style={{ display:'flex', gap:10, marginBottom:24 }}>
        <input className="input" placeholder="Search by name, phone, or ID…" value={q} onChange={e=>setQ(e.target.value)} style={{ flex:1 }} />
        <button type="submit" className="btn btn-primary">Search</button>
      </form>
      {isLoading && <div style={{ textAlign:'center', padding:40 }}><div className="spinner" style={{ margin:'0 auto' }} /></div>}
      {error && <div className="alert alert-error">{error.message}</div>}
      {data && (
        <>
          <p style={{ color:'#94a3b8', fontSize:'0.875rem', marginBottom:12 }}>{data.total} patient{data.total!==1?'s':''} found</p>
          <div className="card" style={{ overflow:'hidden' }}>
            <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Date of Birth</th><th>Email</th><th>Phone</th><th>Insurance</th></tr></thead>
              <tbody>
                {data.patients.map(p => (
                  <tr key={p.id} className="animate-slide">
                    <td><span style={{ fontWeight:600, color:'#a5b4fc' }}>{p.firstName} {p.lastName}</span></td>
                    <td style={{ color:'#94a3b8' }}>{new Date(p.dateOfBirth).toLocaleDateString()}</td>
                    <td style={{ color:'#94a3b8' }}>{p.email}</td>
                    <td style={{ color:'#94a3b8' }}>{p.phone}</td>
                    <td>{p.insuranceProvider ? <span className="badge badge-blue">{p.insuranceProvider}</span> : <span style={{ color:'#475569' }}>—</span>}</td>
                  </tr>
                ))}
                {data.patients.length===0 && <tr><td colSpan={5} style={{ textAlign:'center', color:'#94a3b8', padding:32 }}>No patients found.</td></tr>}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
