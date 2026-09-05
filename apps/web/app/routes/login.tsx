import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { useEffect, useRef, useState } from 'react';
import { trpc } from '../../src/trpc';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginComponent,
});

export function LoginComponent() {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('analyst@undertow.demo');
  const [password, setPassword] = useState('demopass123');
  const [name, setName] = useState('Shabnam');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem('undertow_token', data.token);
      localStorage.setItem('undertow_user', JSON.stringify(data.user));
      showToast(`Signed in as ${data.user.role}`);
      setTimeout(() => {
        window.location.href = '/';
      }, 400);
    },
    onError: (err) => {
      setIsSubmitting(false);
      setError(err.message || 'Authentication failed. Please verify API status.');
    }
  });

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: (data) => {
      localStorage.setItem('undertow_token', data.token);
      localStorage.setItem('undertow_user', JSON.stringify(data.user));
      showToast('Account created successfully');
      setTimeout(() => {
        window.location.href = '/';
      }, 400);
    },
    onError: (err) => {
      setIsSubmitting(false);
      setError(err.message || 'Account creation failed. Please verify API status.');
    }
  });

  const handleAuth = (mode: 'signin' | 'signup') => {
    setError(null);
    setIsSubmitting(true);
    if (mode === 'signin') {
      const role = email.includes('owner') ? 'owner' : email.includes('viewer') ? 'viewer' : 'analyst';
      loginMutation.mutate({ email, password, role });
    } else {
      const role = email.includes('owner') ? 'owner' : email.includes('viewer') ? 'viewer' : 'analyst';
      signupMutation.mutate({ name, email, password, role });
    }
  };

  const handleQuickDemo = (demoRole: 'owner' | 'analyst' | 'viewer') => {
    const demoEmail = `${demoRole}@undertow.demo`;
    setError(null);
    setIsSubmitting(true);
    loginMutation.mutate({ email: demoEmail, password: 'demopassword', role: demoRole });
  };

  // Canvas wave animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let lt = 0;

    const resize = () => {
      if (canvas) {
        canvas.width = window.innerWidth * window.devicePixelRatio;
        canvas.height = window.innerHeight * window.devicePixelRatio;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (let layer = 0; layer < 3; layer++) {
        ctx.beginPath();
        const mid = h * (0.3 + layer * 0.22);
        for (let x = 0; x <= w; x += 6) {
          const y = mid + Math.sin((x * 0.003) + lt * 0.15 + layer) * h * 0.05 + Math.sin((x * 0.009) + lt * 0.08) * h * 0.02;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = layer === 1 ? 'rgba(200, 155, 60, 0.35)' : 'rgba(60, 122, 110, 0.25)';
        ctx.lineWidth = 1.2 * window.devicePixelRatio;
        ctx.stroke();
      }
      lt += 0.01;
      animFrame = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  return (
    <div id="login-view">
      <canvas id="login-canvas" ref={canvasRef} />
      <div className="login-vignette" />

      {toastMessage && (
        <div className="toast show">
          {toastMessage}
        </div>
      )}

      <div className="login-card">
        <div className="login-brand">
          <div className="login-mark">
            <svg viewBox="0 0 26 26" fill="none">
              <path d="M2 16 Q 8 10, 13 16 T 24 16" stroke="#C89B3C" strokeWidth="1.6" fill="none" />
              <path d="M2 20 Q 8 15, 13 20 T 24 20" stroke="#3C7A6E" strokeWidth="1.2" fill="none" opacity="0.7" />
            </svg>
          </div>
          <h1>Undertow</h1>
          <p>Recovery ledger &middot; sign in to continue</p>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={tab === 'signin' ? 'active' : ''}
            onClick={() => { setTab('signin'); setError(null); }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={tab === 'signup' ? 'active' : ''}
            onClick={() => { setTab('signup'); setError(null); }}
          >
            Create account
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(181, 86, 58, 0.15)',
            border: '1px solid var(--rust)',
            color: 'var(--rust)',
            padding: '8px 12px',
            fontSize: '12px',
            marginBottom: '14px',
            borderRadius: '2px'
          }}>
            {error}
          </div>
        )}

        {tab === 'signin' ? (
          <form onSubmit={(e) => { e.preventDefault(); handleAuth('signin'); }} id="signin-fields">
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@merchant.com"
                id="signin-email"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                id="signin-password"
              />
            </div>
            <button
              type="submit"
              className={`btn-primary ${isSubmitting ? 'loading' : ''}`}
              disabled={isSubmitting}
              id="signin-btn"
            >
              <span className="btn-label">{isSubmitting ? 'Authenticating...' : 'Sign in'}</span>
              {isSubmitting && (
                <span className="spinner">
                  <span className="spinner-ring" />
                </span>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleAuth('signup'); }} id="signup-fields">
            <div className="field">
              <label>Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Shabnam"
                id="signup-name"
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@merchant.com"
                id="signup-email"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                id="signup-password"
              />
            </div>
            <button
              type="submit"
              className={`btn-primary ${isSubmitting ? 'loading' : ''}`}
              disabled={isSubmitting}
              id="signup-btn"
            >
              <span className="btn-label">{isSubmitting ? 'Creating account...' : 'Create account'}</span>
              {isSubmitting && (
                <span className="spinner">
                  <span className="spinner-ring" />
                </span>
              )}
            </button>
          </form>
        )}

        <div className="divider">or continue as</div>

        <div className="demo-roles">
          <button
            type="button"
            className="role-btn"
            disabled={isSubmitting}
            onClick={() => handleQuickDemo('owner')}
          >
            <span className="role-name">Owner</span>
            <span className="role-desc">full access &middot; limits</span>
          </button>
          <button
            type="button"
            className="role-btn"
            disabled={isSubmitting}
            onClick={() => handleQuickDemo('analyst')}
          >
            <span className="role-name">Analyst</span>
            <span className="role-desc">act on cases</span>
          </button>
          <button
            type="button"
            className="role-btn"
            disabled={isSubmitting}
            onClick={() => handleQuickDemo('viewer')}
          >
            <span className="role-name">Viewer</span>
            <span className="role-desc">read only</span>
          </button>
        </div>

        <div className="login-foot">
          Demo mode &middot; cryptographically signed session, not production SSO
        </div>
      </div>
    </div>
  );
}
