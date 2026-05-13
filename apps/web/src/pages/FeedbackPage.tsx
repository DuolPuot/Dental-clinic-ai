import { useState, FormEvent } from 'react';
import { trpc } from '../lib/trpc';

const CATEGORIES = ['scheduling','staff','ai_assistant','overall','other'] as const;
const STARS = [1,2,3,4,5];

export default function FeedbackPage() {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('overall');
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const submit = trpc.feedback.submit.useMutation({ onSuccess:()=>setDone(true) });

  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime()-30*24*60*60*1000);
  const { data: summary } = trpc.feedback.summary.useQuery(
    { from: thirtyDaysAgo, to: today },
    { retry: false },
  );

  if (done) return (
    <div className="animate-fade" style={{ textAlign:'center', padding:'60px 20px' }}>
      <div style={{ fontSize:'3rem', marginBottom:12 }}>🙏</div>
      <h1 style={{ fontSize:'1.5rem', fontWeight:800, marginBottom:8 }}>Thank you for your feedback!</h1>
      <p style={{ color:'#94a3b8' }}>Your response helps us improve the clinic experience.</p>
      <button className="btn btn-primary" style={{ marginTop:20 }} onClick={()=>{ setDone(false); setRating(0); setComment(''); }}>Submit Another</button>
    </div>
  );

  return (
    <div className="animate-fade">
      <h1 style={{ fontSize:'1.75rem', fontWeight:800, marginBottom:4 }}>💬 Patient Feedback</h1>
      <p style={{ color:'#94a3b8', marginBottom:28, fontSize:'0.875rem' }}>Help us improve by sharing your experience.</p>

      {/* Summary cards */}
      {summary && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:28 }}>
          <div className="card" style={{ padding:20, textAlign:'center' }}>
            <div style={{ fontSize:'2rem', fontWeight:800, color:'#fcd34d' }}>{'⭐'.repeat(Math.round(summary.averageRating))}</div>
            <div style={{ fontSize:'1.5rem', fontWeight:800, color:'#fcd34d' }}>{summary.averageRating}/5</div>
            <div style={{ color:'#94a3b8', fontSize:'0.8125rem' }}>Average Rating</div>
          </div>
          <div className="card" style={{ padding:20, textAlign:'center' }}>
            <div style={{ fontSize:'1.75rem', fontWeight:800, color:'#a5b4fc' }}>{summary.totalResponses}</div>
            <div style={{ color:'#94a3b8', fontSize:'0.8125rem' }}>Total Responses</div>
          </div>
          {summary.byCategory.slice(0,2).map((c,i) => (
            <div key={i} className="card" style={{ padding:20, textAlign:'center' }}>
              <div style={{ fontSize:'1.25rem', fontWeight:800, color:'#67e8f9' }}>{c.avg.toFixed(1)}/5</div>
              <div style={{ color:'#94a3b8', fontSize:'0.8125rem' }}>{c._id.replace('_',' ')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Submit form */}
      <div className="card" style={{ padding:28, maxWidth:520 }}>
        <h2 style={{ fontWeight:700, marginBottom:20, fontSize:'1rem' }}>Share Your Experience</h2>
        <form onSubmit={(e:FormEvent)=>{ e.preventDefault(); if(rating>0) submit.mutate({rating:rating as any,category,comment:comment||undefined}); }} style={{ display:'flex', flexDirection:'column', gap:18 }}>
          {/* Star rating */}
          <div>
            <label className="label">Rating <span style={{color:'#ef4444'}}>*</span></label>
            <div style={{ display:'flex', gap:8 }}>
              {STARS.map(s => (
                <button key={s} type="button" onClick={()=>setRating(s)} onMouseEnter={()=>setHover(s)} onMouseLeave={()=>setHover(0)}
                  style={{ background:'none', border:'none', fontSize:'2rem', cursor:'pointer', transition:'transform 0.1s', transform:(hover||rating)>=s?'scale(1.2)':'scale(1)', filter:(hover||rating)>=s?'none':'grayscale(1)' }}>
                  ⭐
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={e=>setCategory(e.target.value as any)}>
              {CATEGORIES.map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Comments (optional)</label>
            <textarea className="input" rows={3} placeholder="Tell us about your experience…" value={comment} onChange={e=>setComment(e.target.value)} style={{ resize:'vertical' }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={rating===0||submit.isPending} style={{ justifyContent:'center' }}>
            {submit.isPending?<><span className="spinner" />Submitting…</>:'Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  );
}
