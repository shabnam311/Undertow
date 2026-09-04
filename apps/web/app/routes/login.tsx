import { createRoute, useNavigate } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { useState } from 'react';
import { trpc } from '../../src/trpc';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginComponent,
});

export function LoginComponent() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'login' | 'signup' | 'forgot' | 'otp'>('login');
  const [email, setEmail] = useState('analyst@undertow.demo');
  const [password, setPassword] = useState('demopass123');
  const [name, setName] = useState('Shabnam Ansari');
  const [role, setRole] = useState<'owner' | 'analyst' | 'viewer'>('analyst');
  const [error, setError] = useState<string | null>(null);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem('undertow_token', data.token);
      localStorage.setItem('undertow_user', JSON.stringify(data.user));
      window.location.href = '/';
    },
    onError: (err) => {
      setError(err.message || 'Login failed. Please try again.');
    }
  });

  const signupMutation = trpc.auth.signup.useMutation({
    onSuccess: (data) => {
      localStorage.setItem('undertow_token', data.token);
      localStorage.setItem('undertow_user', JSON.stringify(data.user));
      window.location.href = '/';
    },
    onError: (err) => {
      setError(err.message || 'Signup failed.');
    }
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    loginMutation.mutate({ email, password, role });
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    signupMutation.mutate({ name, email, password, role });
  };

  const handleQuickDemo = (demoRole: 'owner' | 'analyst' | 'viewer') => {
    const demoEmail = `${demoRole}@undertow.demo`;
    loginMutation.mutate({
      email: demoEmail,
      password: 'demopassword',
      role: demoRole,
    });
  };

  return (
    <div id="auth-screen">
      <div className="auth-left">
        <div className="brand">
          <svg className="mark" viewBox="0 0 24 24" fill="none">
            <path d="M2 12c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3 2-3 4-3" stroke="#1FD8B0" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 17c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3 2-3 4-3" stroke="#1FD8B0" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          </svg>
          Undertow
        </div>
        <div className="track-tag">
          RAZORPAY AI BUILDATHON &middot; TRACK 03 &middot; REVENUE RECOVERY
        </div>
        <div>
          <h1>
            Every calm dashboard<br />hides a <em>current</em> of<br />leaking revenue.
          </h1>
          <p className="pitch">
            Undertow watches failed payments, abandoned checkouts, overdue invoices, and failing mandates &mdash; diagnoses why they leaked, and pulls the recoverable ones back, inside guardrails you set.
          </p>
          <div className="stat-row">
            <div>
              <div className="s-num">&#8377;4.8L</div>
              <div className="s-lbl">recovered this month*</div>
            </div>
            <div>
              <div className="s-num">61%</div>
              <div className="s-lbl">recovery rate*</div>
            </div>
            <div>
              <div className="s-num">9</div>
              <div className="s-lbl">root-cause classes</div>
            </div>
          </div>
        </div>
        <svg className="tide-svg" viewBox="0 0 800 220" preserveAspectRatio="none">
          <path className="tide-path" d="M0,120 C100,80 200,160 300,120 C400,80 500,160 600,120 C700,80 800,160 900,120 L900,220 L0,220 Z" fill="#0d2a30" opacity="0.6" />
          <path className="tide-path" d="M0,150 C120,190 220,110 340,150 C460,190 560,110 680,150 C760,175 830,140 900,150 L900,220 L0,220 Z" fill="#12876c" opacity="0.18" />
        </svg>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(null); }}>Log in</button>
            <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setError(null); }}>Sign up</button>
          </div>

          {error && (
            <div className="error-msg show">
              {error}
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLogin} id="pane-login">
              <h2>Welcome back</h2>
              <div className="sub">Log in to your merchant recovery console.</div>
              
              <div className="field">
                <label>Email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@merchant.com" />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="field">
                <label>Active Role</label>
                <select value={role} onChange={e => setRole(e.target.value as any)}>
                  <option value="owner">Owner &mdash; full access</option>
                  <option value="analyst">Analyst &mdash; manage cases &amp; approve tiers</option>
                  <option value="viewer">Viewer &mdash; read-only</option>
                </select>
              </div>

              <div className="row-between">
                <label className="checkbox-row">
                  <input type="checkbox" defaultChecked /> Remember this device
                </label>
                <button type="button" className="link-btn" onClick={() => setTab('forgot')}>Forgot password?</button>
              </div>

              <button type="submit" className={`btn-primary ${loginMutation.isLoading ? 'loading' : ''}`} disabled={loginMutation.isLoading}>
                <span className="btn-text">{loginMutation.isLoading ? 'Authenticating...' : 'Log In'}</span>
              </button>

              <div className="divider">
                or 1-click test roles
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <button type="button" className="btn-secondary" onClick={() => handleQuickDemo('analyst')}>
                  Analyst (Default)
                </button>
                <button type="button" className="btn-secondary" onClick={() => handleQuickDemo('viewer')}>
                  Viewer (Read-Only)
                </button>
              </div>

              <div className="guest-cta">
                <button type="button" onClick={() => handleQuickDemo('owner')}>
                  Skip auth entirely &mdash; <b>view live demo as Owner &rarr;</b>
                </button>
              </div>
            </form>
          )}

          {tab === 'signup' && (
            <form onSubmit={handleSignup} id="pane-signup">
              <h2>Create your account</h2>
              <div className="sub">Set up a new merchant recovery console.</div>

              <div className="field">
                <label>Full name</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="Shabnam Ansari" />
              </div>
              <div className="field">
                <label>Work email</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@merchant.com" />
              </div>
              <div className="field">
                <label>Password</label>
                <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password" />
              </div>
              <div className="field">
                <label>Your role</label>
                <select value={role} onChange={e => setRole(e.target.value as any)}>
                  <option value="owner">Owner &mdash; full access</option>
                  <option value="analyst">Analyst &mdash; manage cases</option>
                  <option value="viewer">Viewer &mdash; read only</option>
                </select>
              </div>

              <button type="submit" className={`btn-primary ${signupMutation.isLoading ? 'loading' : ''}`} style={{ marginTop: '12px' }} disabled={signupMutation.isLoading}>
                <span className="btn-text">{signupMutation.isLoading ? 'Creating account...' : 'Create account'}</span>
              </button>

              <div className="guest-cta">
                <button type="button" onClick={() => handleQuickDemo('owner')}>
                  Or skip straight to <b>the live demo &rarr;</b>
                </button>
              </div>
            </form>
          )}

          {tab === 'forgot' && (
            <div id="pane-forgot">
              <h2>Reset password</h2>
              <div className="sub">We will send a demo reset link to your inbox.</div>
              <div className="field">
                <label>Email</label>
                <input type="email" defaultValue={email} placeholder="you@merchant.com" />
              </div>
              <button type="button" className="btn-primary" onClick={() => { alert('Demo reset link sent to ' + email); setTab('login'); }}>
                Send reset link
              </button>
              <div className="guest-cta">
                <button type="button" onClick={() => setTab('login')}>&larr; Back to log in</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
