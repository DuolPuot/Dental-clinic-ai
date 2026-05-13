import { useState, FormEvent } from 'react';
import { trpc } from '../lib/trpc';

const ROLE_OPTIONS = [
  { value: 'dentist',       label: '🦷 Dentist' },
  { value: 'receptionist',  label: '📋 Receptionist' },
  { value: 'billing_staff', label: '💳 Billing Staff' },
  { value: 'admin',         label: '👑 Admin' },
] as const;

const ROLE_COLOR: Record<string, string> = {
  admin: '#f59e0b', dentist: '#6366f1',
  receptionist: '#06b6d4', billing_staff: '#10b981',
};

type RoleValue = typeof ROLE_OPTIONS[number]['value'];

const EMPTY_FORM = { firstName: '', lastName: '', email: '', role: 'dentist' as RoleValue, password: 'Demo@1234' };

export default function UserManagementPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const utils = trpc.useContext();

  const { data: users, isLoading } = trpc.users.list.useQuery(undefined, { retry: false });

  const createMutation = trpc.users.create.useMutation({
    onSuccess: (u) => {
      setFormSuccess(`${u.firstName} ${u.lastName} created. Password: ${form.password}`);
      setFormError('');
      setForm(EMPTY_FORM);
      setShowForm(false);
      utils.users.list.invalidate();
    },
    onError: (err) => { setFormError(err.message); setFormSuccess(''); },
  });

  const deactivateMutation = trpc.users.deactivate.useMutation({
    onSuccess: () => utils.users.list.invalidate(),
    onError: (err) => setFormError(err.message),
  });

  const reactivateMutation = trpc.users.reactivate.useMutation({
    onSuccess: () => utils.users.list.invalidate(),
    onError: (err) => setFormError(err.message),
  });

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    createMutation.mutate(form);
  }

  const filtered = (users ?? []).filter(u => {
    if (filter === 'active'   && (!u.isActive || u.deleted)) return false;
    if (filter === 'inactive' && (u.isActive && !u.deleted)) return false;
    if (roleFilter !== 'all'  && u.role !== roleFilter) return false;
    return true;
  });

  const counts = {
    total:    users?.length ?? 0,
    active:   users?.filter(u => u.isActive && !u.deleted).length ?? 0,
    dentists: users?.filter(u => u.role === 'dentist' && u.isActive).length ?? 0,
    receptionists: users?.filter(u => u.role === 'receptionist' && u.isActive).length ?? 0,
  };

  return (
    <div className="animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 4 }}>👥 User Management</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Add, manage, and deactivate staff accounts.</p>
        </div>
        <button className={showForm ? 'btn btn-ghost' : 'btn btn-primary'}
          onClick={() => { setShowForm(s => !s); setFormError(''); setFormSuccess(''); }}>
          {showForm ? '✕ Cancel' : '+ Add User'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Users',    value: counts.total,        color: '#a5b4fc' },
          { label: 'Active',         value: counts.active,       color: '#6ee7b7' },
          { label: 'Dentists',       value: counts.dentists,     color: '#6366f1' },
          { label: 'Receptionists',  value: counts.receptionists,color: '#06b6d4' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Feedback */}
      {formError   && <div className="alert alert-error"   style={{ marginBottom: 16 }}>{formError}</div>}
      {formSuccess && <div className="alert alert-success" style={{ marginBottom: 16 }}>✅ {formSuccess}</div>}

      {/* Add user form */}
      {showForm && (
        <div className="card animate-slide" style={{ padding: 28, marginBottom: 24, borderColor: 'rgba(99,102,241,0.3)' }}>
          <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 20 }}>New Staff Account</h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="label">First Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" required placeholder="Duol" value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div>
                <label className="label">Last Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input className="input" required placeholder="Smith" value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Email <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="input" type="email" required placeholder="dr.duol@clinic.com" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="label">Role <span style={{ color: '#ef4444' }}>*</span></label>
                <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as RoleValue }))}>
                  {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Initial Password</label>
                <input className="input" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Demo@1234" />
              </div>
            </div>
            <div className="alert alert-warning" style={{ fontSize: '0.8125rem' }}>
              📋 Share the email and password with the new staff member. They can change their password after logging in.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={createMutation.isPending} style={{ flex: 1, justifyContent: 'center' }}>
                {createMutation.isPending ? <><span className="spinner" />Creating…</> : '✅ Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={filter === f ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ padding: '6px 14px', fontSize: '0.8125rem' }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <select className="input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          style={{ width: 'auto', minWidth: 160 }}>
          <option value="all">All Roles</option>
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* User table */}
      {isLoading && <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}

      {!isLoading && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>No users found.</td></tr>
              )}
              {filtered.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>
                    {u.role === 'dentist' ? 'Dr. ' : u.role === 'receptionist' ? '' : ''}
                    {u.firstName} {u.lastName}
                  </td>
                  <td style={{ color: '#94a3b8', fontSize: '0.8125rem' }}>{u.email}</td>
                  <td>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: 999,
                      color: ROLE_COLOR[u.role] ?? '#94a3b8',
                      background: (ROLE_COLOR[u.role] ?? '#94a3b8') + '22',
                    }}>
                      {ROLE_OPTIONS.find(r => r.value === u.role)?.label ?? u.role}
                    </span>
                  </td>
                  <td>
                    <span className={u.isActive && !u.deleted ? 'badge badge-green' : 'badge badge-red'}>
                      {u.isActive && !u.deleted ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', fontSize: '0.8125rem' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    {u.isActive && !u.deleted ? (
                      <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                        disabled={deactivateMutation.isPending}
                        onClick={() => { if (confirm(`Deactivate ${u.firstName} ${u.lastName}?`)) deactivateMutation.mutate({ userId: u.id }); }}>
                        Deactivate
                      </button>
                    ) : (
                      <button className="btn btn-success" style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                        disabled={reactivateMutation.isPending}
                        onClick={() => reactivateMutation.mutate({ userId: u.id })}>
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
