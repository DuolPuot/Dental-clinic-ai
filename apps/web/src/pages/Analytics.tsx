import { useState } from 'react';
import { trpc } from '../lib/trpc';

// Roles that can see billing/revenue data
const BILLING_ROLES = ['admin', 'billing_staff'];

function getRole(): string {
  return localStorage.getItem('auth-role') ?? '';
}

function StatCard({ label, value, sub, color }: { label:string; value:string|number; sub?:string; color:string }) {
  return (
    <div className="card" style={{ padding:20 }}>
      <div style={{ fontSize:'0.8125rem', color:'#94a3b8', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:'1.75rem', fontWeight:800, color, marginBottom:2 }}>{value}</div>
      {sub && <div style={{ fontSize:'0.75rem', color:'#64748b' }}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, valueKey, labelKey, color }: { data:any[]; valueKey:string; labelKey:string; color:string }) {
  if (!data.length) return <p style={{ color:'#64748b', fontSize:'0.875rem' }}>No data</p>;
  const max = Math.max(...data.map(d => d[valueKey]));
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {data.map((d,i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:90, fontSize:'0.75rem', color:'#94a3b8', textAlign:'right', flexShrink:0 }}>{d[labelKey]}</div>
          <div style={{ flex:1, background:'rgba(255,255,255,0.05)', borderRadius:4, height:20, overflow:'hidden' }}>
            <div style={{ width:(d[valueKey]/max*100)+'%', background:color, height:'100%', borderRadius:4, transition:'width 0.5s', display:'flex', alignItems:'center', paddingLeft:6 }}>
              <span style={{ fontSize:'0.7rem', color:'#fff', fontWeight:600 }}>{d[valueKey]}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const role = getRole();
  const canSeeBilling = BILLING_ROLES.includes(role);

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30*24*60*60*1000);
  const [from] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [to] = useState(today.toISOString().split('T')[0]);

  const { data, isLoading, error } = trpc.analytics.dashboard.useQuery(
    { from: new Date(from), to: new Date(to+'T23:59:59') },
    { enabled: !!localStorage.getItem('auth-token'), retry: false },
  );

  if (isLoading) return <div style={{ textAlign:'center', padding:60 }}><div className="spinner" style={{ margin:'0 auto' }} /></div>;
  if (error) return (
    <div className="animate-fade" style={{ textAlign:'center', padding:60 }}>
      <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🔒</div>
      <h2 style={{ fontWeight:700, marginBottom:8 }}>Access Restricted</h2>
      <p style={{ color:'#94a3b8' }}>You don't have permission to view analytics.</p>
    </div>
  );
  if (!data) return null;

  const { appointments, patients, revenue, notifications } = data;

  return (
    <div className="animate-fade">
      <h1 style={{ fontSize:'1.75rem', fontWeight:800, marginBottom:4 }}>📊 Analytics Dashboard</h1>
      <p style={{ color:'#94a3b8', marginBottom:28, fontSize:'0.875rem' }}>Last 30 days</p>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:32 }}>
        <StatCard label="Total Appointments" value={appointments.totalAppointments} color="#a5b4fc" />
        <StatCard label="No-Show Rate" value={appointments.noShowRate+'%'} sub="lower is better" color={appointments.noShowRate>20?'#fca5a5':'#6ee7b7'} />
        <StatCard label="New Patients" value={patients.newPatients} color="#67e8f9" />
        <StatCard label="Total Active Patients" value={patients.totalActive} color="#a5b4fc" />
        {canSeeBilling && <>
          <StatCard label="Revenue Collected" value={'$'+revenue.totalRevenue.toFixed(0)} color="#6ee7b7" />
          <StatCard label="Outstanding" value={'$'+revenue.totalOutstanding.toFixed(0)} color="#fcd34d" />
          <StatCard label="Collection Rate" value={revenue.collectionRate+'%'} color={revenue.collectionRate>80?'#6ee7b7':'#fca5a5'} />
        </>}
        <StatCard label="Notifications Sent" value={notifications.total} color="#c4b5fd" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        <div className="card" style={{ padding:20 }}>
          <h2 style={{ fontWeight:700, fontSize:'0.9375rem', marginBottom:16 }}>Appointments by Type</h2>
          <BarChart data={appointments.byType} valueKey="count" labelKey="_id" color="linear-gradient(90deg,#6366f1,#8b5cf6)" />
        </div>
        <div className="card" style={{ padding:20 }}>
          <h2 style={{ fontWeight:700, fontSize:'0.9375rem', marginBottom:16 }}>Appointments by Status</h2>
          <BarChart data={appointments.byStatus} valueKey="count" labelKey="_id" color="linear-gradient(90deg,#06b6d4,#0891b2)" />
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: canSeeBilling ? '1fr 1fr' : '1fr', gap:20 }}>
        {canSeeBilling && (
          <div className="card" style={{ padding:20 }}>
            <h2 style={{ fontWeight:700, fontSize:'0.9375rem', marginBottom:16 }}>Invoices by Status</h2>
            <BarChart data={revenue.byStatus} valueKey="count" labelKey="_id" color="linear-gradient(90deg,#10b981,#059669)" />
          </div>
        )}
        <div className="card" style={{ padding:20 }}>
          <h2 style={{ fontWeight:700, fontSize:'0.9375rem', marginBottom:16 }}>Notifications by Channel</h2>
          <BarChart data={notifications.byChannel} valueKey="count" labelKey="_id" color="linear-gradient(90deg,#f59e0b,#d97706)" />
        </div>
      </div>
    </div>
  );
}
