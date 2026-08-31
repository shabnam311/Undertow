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
        <title>Undertow — recovery console</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="shell">
          <aside className="rail">
            <div className="brand">
              <div className="brand-mark">
                <svg viewBox="0 0 26 26" fill="none">
                  <path d="M2 16 Q 8 10, 13 16 T 24 16" stroke="#C89B3C" strokeWidth="1.6" fill="none" />
                  <path d="M2 20 Q 8 15, 13 20 T 24 20" stroke="#3C7A6E" strokeWidth="1.2" fill="none" opacity="0.7" />
                </svg>
              </div>
              <div className="brand-name">Undertow</div>
              <div className="brand-sub">Recovery ledger</div>
            </div>

            <nav className="nav">
              <div className="nav-group-label">Workspace</div>
              <Link to="/" className="nav-item" activeProps={{ className: 'active' }}>
                Queue
              </Link>
              <Link to="/evaluation" className="nav-item" activeProps={{ className: 'active' }}>
                Batch evaluation
              </Link>
            </nav>

            <div className="rail-foot">
              Signed in as<br /><span className="who">Ananya Rao · Analyst</span><br />Meridian Textiles
            </div>
          </aside>

          <Outlet />
        </div>
      </body>
    </html>
  );
}
