import { Outlet, createRootRoute, Link } from '@tanstack/react-router';
import '../style.css';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Undertow — Recovery Operating System</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="shell">
          <aside className="rail">
            <div className="brand">
              <div className="brand-mark">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M2 12c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3 2-3 4-3" stroke="#1FD8B0" strokeWidth="2" strokeLinecap="round" />
                  <path d="M2 17c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3 2-3 4-3" stroke="#1FD8B0" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
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
            </nav>

            <div className="rail-foot">
              Signed in as<br /><span className="who">Shabnam Ansari</span><br />
              <span style={{ fontSize: '11px', color: 'var(--muted-2)' }}>Owner · Meridian Textiles</span>
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
                <button className="avatar">SA</button>
              </div>
            </div>
            <Outlet />
          </div>
        </div>
      </body>
    </html>
  );
}
