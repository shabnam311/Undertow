import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { useState } from 'react';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsComponent,
});

export function SettingsComponent() {
  const [activeTab, setActiveTab] = useState<'profile' | 'merchant' | 'channels' | 'team' | 'api' | 'danger'>('profile');
  const [spendCeil, setSpendCeil] = useState(18000);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const storedUser = (() => {
    try {
      const u = localStorage.getItem('undertow_user');
      return u ? JSON.parse(u) : { name: 'Shabnam', email: 'analyst@undertow.demo', role: 'owner', merchantName: 'Meridian Textiles' };
    } catch {
      return { name: 'Shabnam', email: 'analyst@undertow.demo', role: 'owner', merchantName: 'Meridian Textiles' };
    }
  })();

  return (
    <main className="main">
      <div className="view-header">
        <div>
          <h1>Settings</h1>
          <p>Profile, merchant config, and autonomous agent guardrails.</p>
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-nav">
          <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>Profile</button>
          <button className={activeTab === 'merchant' ? 'active' : ''} onClick={() => setActiveTab('merchant')}>Merchant & Limits</button>
          <button className={activeTab === 'channels' ? 'active' : ''} onClick={() => setActiveTab('channels')}>Channels</button>
          <button className={activeTab === 'team' ? 'active' : ''} onClick={() => setActiveTab('team')}>Team</button>
          <button className={activeTab === 'api' ? 'active' : ''} onClick={() => setActiveTab('api')}>API & Keys</button>
          <button className={activeTab === 'danger' ? 'active' : ''} onClick={() => setActiveTab('danger')}>Danger Zone</button>
        </div>

        <div>
          {activeTab === 'profile' && (
            <div className="settings-panel">
              <h4>Personal profile</h4>
              <div className="desc">{storedUser.role?.toUpperCase()} · {storedUser.email} · {storedUser.merchantName}</div>
              <div className="field"><label>Full name</label><input defaultValue={storedUser.name} /></div>
              <div className="field"><label>Email</label><input defaultValue={storedUser.email} /></div>
              <div className="field"><label>Role</label><input disabled value={storedUser.role} /></div>
              <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px', marginTop: '12px' }} onClick={() => showToast('Profile saved successfully')}>
                Save changes
              </button>
            </div>
          )}

          {activeTab === 'merchant' && (
            <>
              <div className="settings-panel">
                <h4>Autonomous Spend Ceiling</h4>
                <div className="desc">Maximum recovery spend per day across all communication channels.</div>
                <div className="range-wrap">
                  <input type="range" min="1000" max="50000" value={spendCeil} onChange={(e) => setSpendCeil(Number(e.target.value))} />
                  <div style={{ marginTop: '8px' }}>
                    Current: <span className="range-val">₹{spendCeil.toLocaleString('en-IN')}</span> / day
                  </div>
                </div>
              </div>
              <div className="settings-panel">
                <h4>Escalation Ladder</h4>
                <div className="desc">Tier thresholds before an autonomous case escalates to human review.</div>
                <div className="toggle-row">
                  <div><div className="name">Tier 0 → 1</div><div className="meta">After 1 failed nudge</div></div>
                  <span className="badge tech">Auto</span>
                </div>
                <div className="toggle-row">
                  <div><div className="name">Tier 1 → 2</div><div className="meta">After 3 failed nudges (NPCI Cap)</div></div>
                  <span className="badge tech">Auto</span>
                </div>
                <div className="toggle-row">
                  <div><div className="name">Tier 2 → 3</div><div className="meta">Human analyst review required</div></div>
                  <span className="badge card">Manual</span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'channels' && (
            <div className="settings-panel">
              <h4>Channel Preferences</h4>
              <div className="desc">Toggle which channels the Thompson-sampling bandit is allowed to select.</div>
              <div className="toggle-row">
                <div><div className="name">Email</div><div className="meta">via Resend · Live</div></div>
                <label className="switch"><input type="checkbox" defaultChecked /><span className="slider-tg"></span></label>
              </div>
              <div className="toggle-row">
                <div><div className="name">WhatsApp</div><div className="meta">via Gupshup sandbox · Live</div></div>
                <label className="switch"><input type="checkbox" defaultChecked /><span className="slider-tg"></span></label>
              </div>
              <div className="toggle-row">
                <div><div className="name">SMS</div><div className="meta">Enabled for urgent reminders</div></div>
                <label className="switch"><input type="checkbox" defaultChecked /><span className="slider-tg"></span></label>
              </div>
              <div className="toggle-row">
                <div><div className="name">Payment Link Retry (RBI AFA)</div><div className="meta">Enforced automatically for ₹15,000+ mandates</div></div>
                <label className="switch"><input type="checkbox" defaultChecked disabled /><span className="slider-tg"></span></label>
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="settings-panel">
              <h4>Team Members</h4>
              <div className="toggle-row">
                <div><div className="name">Shabnam</div><div className="meta">analyst@undertow.demo</div></div>
                <span className="badge tech">Owner</span>
              </div>
              <div className="toggle-row">
                <div><div className="name">Demo Analyst</div><div className="meta">analyst@undertow.demo</div></div>
                <span className="badge tech">Analyst</span>
              </div>
              <div className="toggle-row">
                <div><div className="name">judge@razorpay.com</div><div className="meta">Hackathon Evaluator</div></div>
                <span className="badge card">Viewer</span>
              </div>
              <button className="btn-secondary" style={{ width: 'auto', padding: '9px 16px', marginTop: '14px' }} onClick={() => showToast('Invitation link copied')}>
                + Invite teammate
              </button>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="settings-panel">
              <h4>API & Provider Keys</h4>
              <div className="desc">Provider keys are securely managed server-side.</div>
              <div className="field"><label>Groq LPU (Zero-Latency Diagnostician)</label><div className="keyfield">gsk_••••••••••••4f2a <button onClick={() => showToast('Masked key')}>Copy</button></div></div>
              <div className="field"><label>Razorpay Webhook Secret (HMAC-SHA256)</label><div className="keyfield">••••••••••••••••3f9c <button onClick={() => showToast('Masked key')}>Copy</button></div></div>
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="settings-panel danger-panel">
              <h4>Demo Data & Reset</h4>
              <div className="desc">Seed synthetic benchmark batch or reset session.</div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button 
                  className="btn-primary" 
                  style={{ width: 'auto', padding: '10px 18px' }}
                  onClick={async () => {
                    showToast('Seeding 60 benchmark recovery cases...');
                    try {
                      const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
                      const baseApi = isLocal ? 'http://localhost:3001' : 'https://undertow-production-c0b8.up.railway.app';
                      const res = await fetch(`${baseApi}/seed`);
                      const data = await res.json();
                      if (data.success) {
                        showToast('60 benchmark cases successfully seeded!');
                        setTimeout(() => { window.location.href = '/'; }, 800);
                      } else {
                        showToast('Seeding failed: ' + (data.error || 'unknown'));
                      }
                    } catch {
                      showToast('Network error connecting to backend');
                    }
                  }}

                >
                  ⚡ Seed 60 Benchmark Cases
                </button>
                <button className="btn-danger" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => { localStorage.clear(); window.location.href = '/login'; }}>
                  Reset Session
                </button>
              </div>
            </div>
          )}

        </div>
      </div>

      {toastMsg && (
        <div className="toast-wrap">
          <div className="toast">{toastMsg}</div>
        </div>
      )}
    </main>
  );
}
