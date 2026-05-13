import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Chatbot from './Chatbot';
import { trpc } from '../lib/trpc';

const BILLING_ROLES = ['admin', 'billing_staff'];
const ROLE_COLOR: Record<string, string> = {
  admin: '#f59e0b', dentist: '#6366f1', receptionist: '#06b6d4', billing_staff: '#10b981',
};

const ALL_NAV = [
  { to: '/staff/dashboard',    icon: '🏠', label: 'Dashboard' },
  { to: '/staff/patients',     icon: '👥', label: 'Patients',        hideFor: ['admin'] },
  { to: '/staff/appointments', icon: '📅', label: 'Appointments',    hideFor: ['admin'] },
  { to: '/staff/ai',           icon: '🤖', label: 'AI Assistant',    showFor: ['dentist'] },
  { to: '/staff/treatments',   icon: '📋', label: 'Treatments',      hideFor: ['admin'] },
  { to: '/staff/billing',      icon: '💳', label: 'Billing',         billingOnly: true },
  { to: '/staff/analytics',    icon: '📊', label: 'Analytics' },
  { to: '/staff/predictions',  icon: '🔮', label: 'Predictions',     hideFor: ['admin', 'billing_staff'] },
  { to: '/staff/agents',       icon: '🤝', label: 'Agent Sessions',  showBadge: true, hideFor: ['billing_staff'] },
  { to: '/staff/feedback',     icon: '💬', label: 'Feedback' },
  { to: '/staff/help',         icon: '❓', label: 'Help' },
  { to: '/staff/users',        icon: '👥', label: 'User Management', adminOnly: true },
];

const TOP = 48;

export default function StaffLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const role      = localStorage.getItem('auth-role')  ?? '';
  const name      = localStorage.getItem('auth-name')  ?? 'Staff';
  const email     = localStorage.getItem('auth-email') ?? '';
  const roleColor = ROLE_COLOR[role] ?? '#94a3b8';
  const displayName = role === 'dentist' ? `Dr. ${name}` : name;

  const canSeeBilling = BILLING_ROLES.includes(role);
  const canSeeAgents  = ['admin', 'receptionist', 'dentist'].includes(role);

  const nav = ALL_NAV.filter(n =>
    (!n.billingOnly || canSeeBilling) &&
    (!n.adminOnly   || role === 'admin') &&
    (!n.hideFor     || !n.hideFor.includes(role)) &&
    (!n.showFor     || n.showFor.includes(role))
  );

  const { data: incomingSessions } = trpc.agents.listIncoming.useQuery(undefined, {
    enabled: canSeeAgents && ['admin', 'receptionist'].includes(role),
    refetchInterval: 10000, retry: false,
  });
  const pendingCount = incomingSessions?.filter(s => s.status === 'awaiting_human').length ?? 0;

  function logout() {
    ['auth-token','auth-role','auth-name','auth-email'].forEach(k => localStorage.removeItem(k));
    navigate('/login');
  }

  // Sidebar width logic
  const sidebarW = isMobile ? 0 : (collapsed ? 64 : 220);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── Fixed top bar ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 400,
        height: TOP,
        background: 'linear-gradient(90deg,#1e3a5f,#1d4ed8 55%,#0891b2)',
        borderBottom: '1px solid rgba(255,255,255,0.12)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 12,
        boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
      }}>
        {/* Hamburger — mobile only */}
        {isMobile && (
          <button onClick={() => setMobileOpen(o => !o)}
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, flexShrink: 0 }}>
            {mobileOpen ? '✕' : '☰'}
          </button>
        )}

        {/* Brand */}
        <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#fff', flexShrink: 0 }}>🦷 DentalAI</span>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />

        {/* Avatar */}
        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: roleColor + '44', border: `2px solid ${roleColor}88`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', color: '#fff' }}>
          {name.charAt(0).toUpperCase()}
        </div>

        {/* Name + role */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? 120 : 'none' }}>
            {displayName}
          </span>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: roleColor + '33', border: `1px solid ${roleColor}55`, color: '#fff', textTransform: 'capitalize', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {role.replace('_', ' ')}
          </span>
          {!isMobile && (
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {email}
            </span>
          )}
        </div>

        {/* Date — desktop only */}
        {!isMobile && (
          <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}

        {/* Sign out */}
        <button onClick={logout} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, flexShrink: 0 }}>
          {isMobile ? '🚪' : 'Sign out'}
        </button>
      </header>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, marginTop: TOP }}>

        {/* Mobile backdrop */}
        {isMobile && mobileOpen && (
          <div onClick={() => setMobileOpen(false)}
            style={{ position: 'fixed', inset: 0, top: TOP, background: 'rgba(0,0,0,0.55)', zIndex: 350, backdropFilter: 'blur(2px)' }} />
        )}

        {/* Sidebar */}
        <aside style={{
          width: isMobile ? 240 : (collapsed ? 64 : 220),
          flexShrink: 0,
          background: 'var(--bg2)',
          borderRight: '1px solid var(--card-border)',
          display: 'flex', flexDirection: 'column',
          position: 'fixed', top: TOP, left: 0,
          height: `calc(100vh - ${TOP}px)`,
          overflowY: 'auto', overflowX: 'hidden',
          transition: isMobile ? 'transform 0.25s ease' : 'width 0.3s',
          transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          zIndex: 360,
          padding: '12px 0',
          boxShadow: isMobile && mobileOpen ? '4px 0 24px rgba(0,0,0,0.4)' : 'none',
        }}>
          {/* Collapse toggle — desktop only */}
          {!isMobile && (
            <div style={{ padding: '0 10px 12px', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
              <button onClick={() => setCollapsed(c => !c)}
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94a3b8', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem' }}>
                {collapsed ? '→' : '←'}
              </button>
            </div>
          )}

          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
            {nav.map(n => (
              <NavLink key={n.to} to={n.to} onClick={() => isMobile && setMobileOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  borderRadius: 8, fontSize: '0.875rem', fontWeight: 500, transition: 'all 0.2s',
                  background: isActive ? 'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(6,182,212,0.2))' : 'transparent',
                  color: isActive ? '#a5b4fc' : '#94a3b8',
                  borderLeft: isActive ? '3px solid #6366f1' : '3px solid transparent',
                  textDecoration: 'none',
                })}>
                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{n.icon}</span>
                {(!collapsed || isMobile) && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', flex: 1 }}>{n.label}</span>}
                {(!collapsed || isMobile) && n.showBadge && pendingCount > 0 && (
                  <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, flexShrink: 0 }}>
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Logout in sidebar — mobile */}
          {isMobile && (
            <div style={{ padding: '8px' }}>
              <button onClick={logout} style={{ width: '100%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
                🚪 Sign out
              </button>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main style={{
          flex: 1,
          marginLeft: isMobile ? 0 : (collapsed ? 64 : 220),
          transition: 'margin-left 0.3s',
          padding: isMobile ? '16px 12px' : '28px 32px',
          minHeight: `calc(100vh - ${TOP}px)`,
          background: 'var(--bg)',
          overflowX: 'hidden',
        }}>
          <Outlet />
        </main>
      </div>

      <Chatbot />
    </div>
  );
}
