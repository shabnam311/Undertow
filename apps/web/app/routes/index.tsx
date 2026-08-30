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
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const casesQuery = trpc.cases.list.useQuery();
  
  useEffect(() => {
    if (!selectedCaseId && casesQuery.data && casesQuery.data.length > 0) {
      setSelectedCaseId(casesQuery.data[0].id);
    }
  }, [casesQuery.data, selectedCaseId]);

  const caseDetailQuery = trpc.cases.get.useQuery(
    { id: selectedCaseId! },
    { enabled: !!selectedCaseId }
  );

  const kpisQuery = trpc.cases.kpis.useQuery();

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
          <div className="value brass mono">₹{((kpisQuery.data?.recoveredAmountPaise || 0) / 100).toLocaleString()}</div>
          <div className="delta up">Live database value</div>
        </div>
        <div className="kpi">
          <div className="label">At risk, open</div>
          <div className="value rust mono">₹{((kpisQuery.data?.atRiskAmountPaise || 0) / 100).toLocaleString()}</div>
          <div className="delta">{kpisQuery.data?.openCasesCount || 0} cases active</div>
        </div>
        <div className="kpi">
          <div className="label">Cost per recovered ₹</div>
          <div className="value mono">₹{(kpisQuery.data?.costPerRecoveredRupee || 0).toFixed(3)}</div>
          <div className="delta">messaging + inference, blended</div>
        </div>
        <div className="kpi">
          <div className="label">Stopped, unrecovered</div>
          <div className="value mono">{kpisQuery.data?.stoppedCount || 0}</div>
          <div className="delta">Disputed or exhausted</div>
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
                const path = sparkPath([2,2,3,4,4,5,6], 64, 20); // Static trend for now
                const sparkColor = c.status === 'recovered' ? '#C89B3C' : (c.status === 'escalated' ? '#B5563A' : '#3C7A6E');
                const isSelected = selectedCaseId === c.id;
                
                return (
                  <tr key={c.id} className={isSelected ? 'selected' : ''} onClick={() => setSelectedCaseId(c.id)}>
                    <td>
                      <div className="cust">{c.customerName}</div>
                      <div className="cust-sub">{c.eventType}</div>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{c.rootCause || 'Unknown'}</td>
                    <td>
                      <div className="tier-dots">
                        {[0,1,2,3].map(i => (
                          <span key={i} className={i < c.currentTier ? 'on' : ''}></span>
                        ))}
                      </div>
                    </td>
                    <td className="amt">₹{(c.amountAtRiskPaise / 100).toLocaleString()}</td>
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
          {caseDetailQuery.isLoading ? (
            <div style={{ padding: '24px' }}>Loading...</div>
          ) : caseDetailQuery.data ? (
            <>
              <div className="case-head">
                <div className="name serif">{caseDetailQuery.data.customerName}</div>
                <div className="meta mono">
                  {caseDetailQuery.data.id.substring(0,8)} · opened {new Date(caseDetailQuery.data.openedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="case-amounts">
                <div>
                  <div className="label">At risk</div>
                  <div className="val" style={{ color: 'var(--rust)' }}>
                    ₹{(caseDetailQuery.data.amountAtRiskPaise / 100).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="label">Root cause</div>
                  <div className="val" style={{ fontFamily: '"Public Sans", sans-serif', fontSize: '13px', color: 'var(--text-1)' }}>
                    {caseDetailQuery.data.rootCause || 'Unknown'}
                  </div>
                </div>
              </div>
              <div className="timeline">
                {caseDetailQuery.data.agentRuns?.map(run => (
                  <div key={run.id} className="tl-item done">
                    <div className="tl-node">{run.nodeName}</div>
                    <div className="tl-text">{run.reasoningSummary}</div>
                    <div className="tl-time">
                      {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                {caseDetailQuery.data.interventions?.map(inv => (
                  <div key={inv.id} className="tl-item done">
                    <div className="tl-node">Act — Tier {inv.tier}</div>
                    <div className="tl-text">Intervention via {inv.channel} (Status: {inv.status})</div>
                    <div className="tl-time">
                      {new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                <div className="tl-item">
                  <div className="tl-node">Current Status</div>
                  <div className="tl-text">{caseDetailQuery.data.status}</div>
                  <div className="tl-time">pending</div>
                </div>
              </div>
              <div className="case-actions">
                <button className="btn">Pause case</button>
                <button className="btn primary">Approve next tier</button>
              </div>
            </>
          ) : (
            <div style={{ padding: '24px' }}>Select a case to view details</div>
          )}
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
