import { createRoute } from '@tanstack/react-router';
import { Route as rootRoute } from './__root';
import { useEffect, useRef, useState } from 'react';
import { trpc } from '../../src/trpc';

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: QueueView,
});

function sparkPath(vals: number[], w: number, h: number) {
  const max = Math.max(...vals), min = Math.min(...vals);
  const range = (max - min) || 1;
  const step = w / (vals.length - 1);
  return vals.map((v,i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
}

function QueueView() {
  const [selectedCaseId, setSelectedCaseId] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const casesQuery = trpc.cases.list.useQuery();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let t = 0;

    function resize() {
      if(canvas) {
        canvas.width = canvas.clientWidth * window.devicePixelRatio;
        canvas.height = canvas.clientHeight * window.devicePixelRatio;
      }
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      if(!canvas || !ctx) return;
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const mid = h * 0.62;

      // secondary muted current line
      ctx.beginPath();
      for(let x = 0; x <= w; x += 4) {
        const y = mid + Math.sin((x * 0.006) + t * 0.6) * h * 0.10 + Math.sin((x * 0.017) + t * 0.3) * h * 0.05;
        if(x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(60,122,110,0.55)';
      ctx.lineWidth = 1.2 * window.devicePixelRatio;
      ctx.stroke();

      // primary brass line
      ctx.beginPath();
      for(let x = 0; x <= w; x += 4) {
        const y = mid + Math.sin((x * 0.008) + t) * h * 0.16 + Math.sin((x * 0.023) + t * 1.4) * h * 0.06;
        if(x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#C89B3C';
      ctx.lineWidth = 1.6 * window.devicePixelRatio;
      ctx.stroke();

      t += 0.006;
      animFrame = requestAnimationFrame(draw);
    }
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  return (
    <main className="main">
      <div className="header">
        <div>
          <h1>Recovery queue</h1>
          <p>Live cases currently held by the agent, sorted by time in current tier.</p>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi">
          <div className="label">Recovered, this cycle</div>
          <div className="value brass mono">₹18,42,600</div>
          <div className="delta up">62% of amount at risk</div>
        </div>
        <div className="kpi">
          <div className="label">At risk, open</div>
          <div className="value rust mono">₹9,05,200</div>
          <div className="delta">42 cases across 4 tiers</div>
        </div>
        <div className="kpi">
          <div className="label">Cost per recovered ₹</div>
          <div className="value mono">₹0.014</div>
          <div className="delta">messaging + inference, blended</div>
        </div>
        <div className="kpi">
          <div className="label">Stopped, unrecovered</div>
          <div className="value mono">11</div>
          <div className="delta">6 disputed · 5 exhausted</div>
        </div>
      </div>

      <div className="tideline-wrap">
        <div className="tideline-head">
          <span className="t1">Aggregate flow, 14 day window</span>
          <span className="t2 mono">+₹41,900 in the last hour</span>
        </div>
        <canvas id="tideline" ref={canvasRef} style={{ display: 'block', width: '100%', height: '56px' }}></canvas>
      </div>

      <div className="content">
        <div className="panel">
          <div className="panel-head">
            <h2>Open cases</h2>
            <div className="filter-tabs">
              <span className="active">All</span>
              <span>Payments</span>
              <span>Receivables</span>
              <span>Mandates</span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Root cause</th>
                <th>Tier</th>
                <th>At risk</th>
                <th>Trend</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="queue-body">
              {casesQuery.data?.map(c => {
                const path = sparkPath(c.trend, 64, 20);
                const sparkColor = c.status === 'recovered' ? '#C89B3C' : (c.status === 'escalated' ? '#B5563A' : '#3C7A6E');
                const isSelected = selectedCaseId === c.id;
                
                return (
                  <tr key={c.id} className={isSelected ? 'selected' : ''} onClick={() => setSelectedCaseId(c.id)}>
                    <td>
                      <div className="cust">{c.name}</div>
                      <div className="cust-sub">{c.sub}</div>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{c.cause}</td>
                    <td>
                      <div className="tier-dots">
                        {[0,1,2,3].map(i => (
                          <span key={i} className={i < c.tier ? 'on' : ''}></span>
                        ))}
                      </div>
                    </td>
                    <td className="amt">{c.amt}</td>
                    <td>
                      <svg className="spark" viewBox="0 0 64 20">
                        <path d={path} fill="none" stroke={sparkColor} strokeWidth="1.4" />
                      </svg>
                    </td>
                    <td>
                      <span className={`stamp ${c.status}`}>{c.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="case-head">
            <div className="name serif">Kavya Menon</div>
            <div className="meta mono">CASE-08841 · opened 2 days ago</div>
          </div>
          <div className="case-amounts">
            <div>
              <div className="label">At risk</div>
              <div className="val" style={{ color: 'var(--rust)' }}>₹18,400</div>
            </div>
            <div>
              <div className="label">Root cause</div>
              <div className="val" style={{ fontFamily: '"Public Sans", sans-serif', fontSize: '13px', color: 'var(--text-1)' }}>Issuer risk block</div>
            </div>
          </div>
          <div className="timeline">
            <div className="tl-item done">
              <div className="tl-node">Detect</div>
              <div className="tl-text">Card declined after four consecutive clean payments — flagged as degradation, not a first-time failure.</div>
              <div className="tl-time">Tue, 09:14</div>
            </div>
            <div className="tl-item done">
              <div className="tl-node">Diagnose</div>
              <div className="tl-text">Decline code matched issuer-side risk hold. Retrying the same instrument will not help; routed to alternate-method flow.</div>
              <div className="tl-time">Tue, 09:14</div>
            </div>
            <div className="tl-item done">
              <div className="tl-node">Act — Tier 1</div>
              <div className="tl-text">Email sent with an alternate-payment-method link. Consent confirmed for email channel before send.</div>
              <div className="tl-time">Tue, 09:15</div>
            </div>
            <div className="tl-item done">
              <div className="tl-node">Escalate — Tier 2</div>
              <div className="tl-text">No response after 48 hour cooldown. Stepped to WhatsApp, approved template, Hindi-English mix per customer preference.</div>
              <div className="tl-time">Thu, 09:20</div>
            </div>
            <div className="tl-item">
              <div className="tl-node">Verify</div>
              <div className="tl-text">Watching for a payment-success signal. Escalation ceiling for this merchant is Tier 3 — voice will not be attempted.</div>
              <div className="tl-time">pending</div>
            </div>
          </div>
          <div className="case-actions">
            <button className="btn">Pause case</button>
            <button className="btn primary">Approve next tier</button>
          </div>
        </div>
      </div>

      <div className="lower">
        <div className="panel stopbar">
          <div className="panel-head" style={{ border: 'none', padding: '0 0 14px' }}>
            <h2>Stop reasons, held-out batch</h2>
          </div>
          <div className="stopbar-row">
            <span className="stopbar-label">Recovered</span>
            <div className="stopbar-track"><div className="stopbar-fill brass" style={{ width: '64%' }}></div></div>
            <span className="stopbar-val">64%</span>
          </div>
          <div className="stopbar-row">
            <span className="stopbar-label">Disputed, handed off</span>
            <div className="stopbar-track"><div className="stopbar-fill rust" style={{ width: '11%' }}></div></div>
            <span className="stopbar-val">11%</span>
          </div>
          <div className="stopbar-row">
            <span className="stopbar-label">Ceiling reached</span>
            <div className="stopbar-track"><div className="stopbar-fill" style={{ width: '9%' }}></div></div>
            <span className="stopbar-val">9%</span>
          </div>
          <div className="stopbar-row">
            <span className="stopbar-label">Max attempts</span>
            <div className="stopbar-track"><div className="stopbar-fill" style={{ width: '8%' }}></div></div>
            <span className="stopbar-val">8%</span>
          </div>
          <div className="stopbar-row">
            <span className="stopbar-label">Undiagnosable</span>
            <div className="stopbar-track"><div className="stopbar-fill" style={{ width: '8%' }}></div></div>
            <span className="stopbar-val">8%</span>
          </div>
        </div>

        <div className="panel baseline">
          <div className="panel-head" style={{ border: 'none', padding: '0 0 14px' }}>
            <h2>Against a fixed-cadence baseline</h2>
          </div>
          <div className="baseline-row">
            <span className="baseline-name">Recovery rate, Undertow</span>
            <span className="baseline-val brass">64%</span>
          </div>
          <div className="baseline-row">
            <span className="baseline-name">Recovery rate, single-channel reminder</span>
            <span className="baseline-val dim">37%</span>
          </div>
          <div className="baseline-row">
            <span className="baseline-name">Cost per recovered ₹, Undertow</span>
            <span className="baseline-val brass">₹0.014</span>
          </div>
          <div className="baseline-row">
            <span className="baseline-name">Cost per recovered ₹, baseline</span>
            <span className="baseline-val dim">₹0.031</span>
          </div>
        </div>
      </div>
    </main>
  );
}
