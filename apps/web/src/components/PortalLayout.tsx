import { Outlet, Link } from 'react-router-dom';
import PatientChatbot from './PatientChatbot';

export default function PortalLayout() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <header className="portal-header">
        <Link to="/" style={{ fontWeight: 800, fontSize: '1.125rem', background: 'linear-gradient(135deg,#a5b4fc,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', flexShrink: 0 }}>
          🦷 DentalAI Portal
        </Link>
        <nav style={{ display: 'flex', gap: 12 }}>
          <Link to="/portal/book" className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.875rem' }}>
            Book Appointment
          </Link>
        </nav>
      </header>
      <main style={{ maxWidth: 680, margin: '0 auto', padding: '32px 16px' }}>
        <Outlet />
      </main>
      <PatientChatbot />
    </div>
  );
}
