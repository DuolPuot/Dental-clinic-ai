import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 20px', textAlign:'center' }}>
      <div className={"animate-fade"} style={{ opacity: visible ? 1 : 0, transition:'opacity 0.6s' }}>
        <div style={{ fontSize:'4rem', marginBottom:16, animation:'glow 2s ease-in-out infinite' }}>🦷</div>
        <h1 style={{ fontSize:'3rem', fontWeight:800, marginBottom:16, lineHeight:1.1 }}>
          <span className="gradient-text">AI-Assisted</span><br />Dental Clinic Platform
        </h1>
        <p style={{ color:'#94a3b8', fontSize:'1.125rem', maxWidth:520, margin:'0 auto 40px', lineHeight:1.7 }}>
          Intelligent scheduling, AI clinical support, and seamless patient management — all in one platform.
        </p>
        <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
          <Link to="/staff/dashboard" className="btn btn-primary btn-lg" style={{ minWidth:180 }}>
            🏥 Staff Portal
          </Link>
          <Link to="/portal/book" className="btn btn-secondary btn-lg" style={{ minWidth:180 }}>
            📅 Book Appointment
          </Link>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:16, marginTop:60, maxWidth:700, width:'100%' }}>
          {[
            { icon:'🤖', title:'AI Triage', desc:'Smart symptom analysis' },
            { icon:'📅', title:'Smart Scheduling', desc:'No double-bookings' },
            { icon:'💊', title:'Treatment Plans', desc:'Cost-tracked steps' },
            { icon:'🔒', title:'HIPAA Secure', desc:'Encrypted & audited' },
          ].map((f,i) => (
            <div key={i} className="card" style={{ padding:'20px 16px', animationDelay: i*0.1+'s' }} >
              <div style={{ fontSize:'1.75rem', marginBottom:8 }}>{f.icon}</div>
              <div style={{ fontWeight:600, marginBottom:4, fontSize:'0.9rem' }}>{f.title}</div>
              <div style={{ color:'#94a3b8', fontSize:'0.8rem' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
