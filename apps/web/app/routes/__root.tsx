import { Outlet, createRootRoute, Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import '../style.css';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const [user, setUser] = useState<{ name: string; email: string; role: string; merchantName: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem('undertow_token');
      const stored = localStorage.getItem('undertow_user');
      
      const isAuthPage = location.pathname === '/login';

      if (!token && !isAuthPage) {
        navigate({ to: '/login' });
      } else if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {}
    setAuthChecked(true);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('undertow_token');
    localStorage.removeItem('undertow_user');
    window.location.href = '/login';
  };

  const isAuthPage = location.pathname === '/login';

  if (isAuthPage) {
    return <Outlet />;
  }

  if (!authChecked && !localStorage.getItem('undertow_token')) {
    return null;
  }

  const currentUser = user || {
    name: 'Shabnam',
    email: 'analyst@undertow.demo',
    role: 'owner',
    merchantName: 'Meridian Textiles'
  };

  const initials = (currentUser.name || 'S')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M2 12c2 0 2-3 4-3s2 3 4 3 2-3 4-3" stroke="#1FD8B0" strokeWidth="2" strokeLinecap="round" />
              <path d="M2 17c2 0 2-3 4-3s2 3 4 3 2-3 4-3" stroke="#1FD8B0" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            </svg>
          </div>
          <div>
            <div className="brand-name">Undertow</div>
            <div className="brand-sub">Recovery OS</div>
          </div>
        </div>

        <nav className="nav">
          <div className="nav-group-label">Recovery Engine</div>
          <Link to="/" className="nav-item" activeProps={{ className: 'active' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
            <span className="nav-label">Queue & Cases</span>
          </Link>
          <Link to="/evaluation" className="nav-item" activeProps={{ className: 'active' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 15l4-6 3 3 5-8"/></svg>
            <span className="nav-label">Evaluation</span>
          </Link>
          <Link to="/settings" className="nav-item" activeProps={{ className: 'active' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            <span className="nav-label">Settings</span>
          </Link>
        </nav>

        <div className="rail-foot">
          Signed in as<br /><span className="who">{currentUser.name}</span><br />
          <span style={{ fontSize: '11px', color: 'var(--muted-2)' }}>
            {currentUser.role ? (currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)) : 'Owner'} · {currentUser.merchantName || 'Meridian Textiles'}
          </span>
          <div className="mode-badge">
            <span className="dot"></span>
            <span>Test Mode · Active</span>
          </div>
        </div>
      </aside>

      <div className="main-col">
        <div className="topbar">
          <div className="search-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input placeholder="Search cases, customers, IDs…" />
          </div>
          <div className="topbar-right">
            <div className="avatar-menu" style={{ position: 'relative' }}>
              <button className="avatar" onClick={() => setDropdownOpen(!dropdownOpen)}>
                {initials}
              </button>
              {dropdownOpen && (
                <div className="dropdown show" style={{ position: 'absolute', right: 0, top: '44px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-m)', width: '210px', padding: '6px', zIndex: 100, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-soft)', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--foam)' }}>{currentUser.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted-2)' }}>{currentUser.email}</div>
                  </div>
                  <Link to="/settings" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'var(--foam)', fontSize: '13px', padding: '8px 10px', borderRadius: 'var(--radius-s)' }} onClick={() => setDropdownOpen(false)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
                    <span>Settings & Limits</span>
                  </Link>
                  <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'var(--foam)', fontSize: '13px', padding: '8px 10px', borderRadius: 'var(--radius-s)' }} onClick={() => setDropdownOpen(false)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7.5" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
                    <span>Switch Role / Login</span>
                  </Link>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '5px 0' }} />
                  <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'var(--coral)', fontSize: '13px', padding: '8px 10px', borderRadius: 'var(--radius-s)', cursor: 'pointer' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
