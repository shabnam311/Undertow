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
    <div id="auth-screen" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.15fr 1fr' }}>
      <div className="auth-left">
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'var(--serif)', fontWeight: 600, fontSize: '20px' }}>
          <svg className="mark" style={{ width: 26, height: 26 }} viewBox="0 0 24 24" fill="none">
            <path d="M2 12c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3 2-3 4-3" stroke="#1FD8B0" strokeWidth="2" strokeLinecap="round" />
            <path d="M2 17c2 0 2-3 4-3s2 3 4 3 2-3 4-3 2 3 4 3 2-3 4-3" stroke="#1FD8B0" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          </svg>
          Undertow
        </div>
        <div className="track-tag" style={{ fontSize: '12px', color: 'var(--muted-2)', fontFamily: 'var(--mono)', marginTop: '20px' }}>
          RAZORPAY AI BUILDATHON · TRACK 03 · REVENUE RECOVERY
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 'clamp(32px, 4.4vw, 50px)', lineHeight: 1.1, marginTop: '36px' }}>
            Every calm dashboard<br />hides a <em style={{ fontStyle: 'italic', color: 'var(--teal)' }}>current</em> of<br />leaking revenue.
          </h1>
          <p className="pitch" style={{ color: 'var(--muted)', fontSize: '15px', lineHeight: 1.6, maxWidth: '460px', marginTop: '20px' }}>
            Undertow watches failed payments, abandoned checkouts, overdue invoices, and failing mandates — diagnoses why they leaked, and pulls the recoverable ones back, inside guardrails you set.
          </p>
          <div className="stat-row" style={{ display: 'flex', gap: '36px', marginTop: '40px', flexWrap: 'wrap' }}>
            <div>
              <div className="s-num" style={{ fontFamily: 'var(--mono)', fontSize: '26px', fontWeight: 600, color: 'var(--foam)' }}>?4.8L</div>
              <div className="s-lbl" style={{ fontSize: '12px', color: 'var(--muted-2)', marginTop: '4px' }}>recovered this month*</div>
            </div>
            <div>
              <div className="s-num" style={{ fontFamily: 'var(--mono)', fontSize: '26px', fontWeight: 600, color: 'var(--foam)' }}>61%</div>
              <div className="s-lbl" style={{ fontSize: '12px', color: 'var(--muted-2)', marginTop: '4px' }}>recovery rate*</div>
            </div>
            <div>
              <div className="s-num" style={{ fontFamily: 'var(--mono)', fontSize: '26px', fontWeight: 600, color: 'var(--foam)' }}>9</div>
              <div className="s-lbl" style={{ fontSize: '12px', color: 'var(--muted-2)', marginTop: '4px' }}>root-cause classes</div>
            </div>
          </div>
        </div>
        <svg className="tide-svg" viewBox="0 0 800 220" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: '-20px', width: '100%', height: '220px', zIndex: 1, opacity: 0.9 }}>
          <path className="tide-path" d="M0,120 C100,80 200,160 300,120 C400,80 500,160 600,120 C700,80 800,160 900,120 L900,220 L0,220 Z" fill="#0d2a30" opacity="0.6" />
          <path className="tide-path" d="M0,150 C120,190 220,110 340,150 C460,190 560,110 680,150 C760,175 830,140 900,150 L900,220 L0,220 Z" fill="#12876c" opacity="0.18" />
        </svg>
      </div>

      <div className="auth-right" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'var(--surface)' }}>
        <div className="auth-card" style={{ width: '100%', maxWidth: '400px' }}>
          <div className="auth-tabs" style={{ display: 'flex', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-m)', padding: '4px', marginBottom: '28px' }}>
            <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(null); }}>Log in</button>
            <button className={`auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => { setTab('signup'); setError(null); }}>Sign up</button>
          </div>

          {error && (
            <div className="error-msg show" style={{ background: 'rgba(255,107,91,0.1)', border: '1px solid rgba(255,107,91,0.35)', color: '#ffb3a8', fontSize: '12.5px', padding: '9px 12px', borderRadius: 'var(--radius-s)', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLogin} id="pane-login">
              <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: '24px', marginBottom: '6px' }}>Welcome back</h2>
              <div className="sub" style={{ color: 'var(--muted)', fontSize: '13.5px', marginBottom: '26px' }}>Log in to your merchant recovery console.</div>
              
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
                  <option value="owner">Owner — full access</option>
                  <option value="analyst">Analyst — manage cases & approve tiers</option>
                  <option value="viewer">Viewer — read-only</option>
                </select>
              </div>

              <div className="row-between" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <label className="checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--muted)' }}>
                  <input type="checkbox" defaultChecked /> Remember this device
                </label>
                <button type="button" className="link-btn" onClick={() => setTab('forgot')}>Forgot password?</button>
              </div>

              <button type="submit" className={`btn-primary ${loginMutation.isLoading ? 'loading' : ''}`} disabled={loginMutation.isLoading}>
                <span className="btn-text">{loginMutation.isLoading ? 'Authenticating...' : 'Log in'}</span>
              </button>

              <div className="divider" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0', color: 'var(--muted-2)', fontSize: '12px' }}>
                or 1-click test roles
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => handleQuickDemo('analyst')}>
                  Analyst (Default)
                </button>
                <button type="button" className="btn-secondary" onClick={() => handleQuickDemo('viewer')}>
                  Viewer (Read-Only)
                </button>
              </div>

              <div className="guest-cta" style={{ marginTop: '22px', textAlign: 'center', paddingTop: '18px', borderTop: '1px dashed var(--border)' }}>
                <button type="button" onClick={() => handleQuickDemo('owner')}>
                  Skip auth entirely — <b style={{ color: 'var(--teal)' }}>view live demo as Owner ?</b>
                </button>
              </div>
            </form>
          )}

          {tab === 'signup' && (
            <form onSubmit={handleSignup} id="pane-signup">
              <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: '24px', marginBottom: '6px' }}>Create your account</h2>
              <div className="sub" style={{ color: 'var(--muted)', fontSize: '13.5px', marginBottom: '26px' }}>Set up a new merchant recovery console.</div>

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
                  <option value="owner">Owner — full access</option>
                  <option value="analyst">Analyst — manage cases</option>
                  <option value="viewer">Viewer — read only</option>
                </select>
              </div>

              <button type="submit" className={`btn-primary ${signupMutation.isLoading ? 'loading' : ''}`} style={{ marginTop: '12px' }} disabled={signupMutation.isLoading}>
                <span className="btn-text">{signupMutation.isLoading ? 'Creating account...' : 'Create account'}</span>
              </button>

              <div className="guest-cta" style={{ marginTop: '22px', textAlign: 'center', paddingTop: '18px', borderTop: '1px dashed var(--border)' }}>
                <button type="button" onClick={() => handleQuickDemo('owner')}>
                  Or skip straight to <b style={{ color: 'var(--teal)' }}>the live demo ?</b>
                </button>
              </div>
            </form>
          )}

          {tab === 'forgot' && (
            <div id="pane-forgot">
              <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: '24px', marginBottom: '6px' }}>Reset password</h2>
              <div className="sub" style={{ color: 'var(--muted)', fontSize: '13.5px', marginBottom: '26px' }}>We will send a demo reset link to your inbox.</div>
              <div className="field">
                <label>Email</label>
                <input type="email" defaultValue={email} placeholder="you@merchant.com" />
              </div>
              <button type="button" className="btn-primary" onClick={() => { alert('Demo reset link sent to ' + email); setTab('login'); }}>
                Send reset link
              </button>
              <div className="guest-cta" style={{ marginTop: '22px', textAlign: 'center' }}>
                <button type="button" onClick={() => setTab('login')}>? Back to log in</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
