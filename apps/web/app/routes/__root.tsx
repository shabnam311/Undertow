import { Outlet, createRootRoute } from '@tanstack/react-router';
import '../style.css';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Undertow | Revenue Recovery OS</title>
        {/* Load Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..900&family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-ink text-paper font-body antialiased min-h-screen flex flex-col">
        {/* Tideline header element */}
        <header className="border-b border-ledger/50 bg-ledger/30 h-14 flex items-center px-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-brass/40 animate-pulse"></div>
          <h1 className="font-display text-lg tracking-tight text-brass">Undertow</h1>
          <div className="ml-auto font-mono text-sm text-current-teal">
            Active Cases: 124
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
          <Outlet />
        </main>
      </body>
    </html>
  );
}
