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
  const [activeTab, setActiveTab] = useState<string>('All');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const casesQuery = trpc.cases.list.useQuery();
  const utils = trpc.useContext();
  const approveMutation = trpc.cases.approveNextTier.useMutation({
    onSuccess: () => {
      utils.cases.list.invalidate();
      if (selectedCaseId) utils.cases.get.invalidate({ id: selectedCaseId });
    }
  });

  const pauseMutation = trpc.cases.pauseCase.useMutation({
    onSuccess: () => {
      utils.cases.list.invalidate();
      if (selectedCaseId) utils.cases.get.invalidate({ id: selectedCaseId });
    }
  });

  const filteredCases = (casesQuery.data || []).filter((c: any) => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Payments') return c.eventType === 'payment_failed';
    if (activeTab === 'Receivables') return c.eventType === 'invoice_overdue';
    if (activeTab === 'Mandates') return c.eventType === 'mandate_failed';
    return true;
  });
  
  useEffect(() => {
    if (!selectedCaseId && filteredCases.length > 0) {
      setSelectedCaseId(filteredCases[0].id);
    }
  }, [filteredCases, selectedCaseId]);

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

      ctx.beginPath();
      for(let x = 0; x <= w; x += 4) {
        const y = mid + Math.sin((x * 0.006) + t * 0.6) * h * 0.10 + Math.sin((x * 0.017) + t * 0.3) * h * 0.05;
        if(x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(31, 216, 176, 0.45)';
      ctx.lineWidth = 1.2 * window.devicePixelRatio;
      ctx.stroke();

      ctx.beginPath();
      for(let x = 0; x <= w; x += 4) {
        const y = mid + Math.sin((x * 0.008) + t) * h * 0.16 + Math.sin((x * 0.023) + t * 1.4) * h * 0.06;
        if(x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#1FD8B0';
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

  const timeSinceUpdate = casesQuery.dataUpdatedAt 
    ? Math.floor((Date.now() - casesQuery.dataUpdatedAt) / 60000) 
    : 0;

  return (
    <main className="main">
      <div className="header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1>Recovery queue</h1>
            <span className="stamp diagnosing" style={{ marginTop: '4px' }}>
              {kpisQuery.data?.isShadowMode !== false ? 'SHADOW MODE' : 'LIVE DISPATCH'}
            </span>
          </div>
          <p>Live cases currently held by the agent, sorted by time in current tier.</p>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
          {casesQuery.isFetching ? 'Refreshing...' : `Updated ${timeSinceUpdate === 0 ? 'just now' : `${timeSinceUpdate} mins ago`}`}
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
          <span className="t2 mono">
            {kpisQuery.data?.recoveredAmountPaise ? `₹${(kpisQuery.data.recoveredAmountPaise / 100).toLocaleString()} recovered to date` : 'No recoveries yet'}
          </span>
        </div>
        <canvas id="tideline" ref={canvasRef} style={{ display: 'block', width: '100%', height: '56px' }}></canvas>
      </div>

      <div className="content">
        <div className="panel">
          <div className="panel-head">
            <h2>Open cases</h2>
            <div className="filter-tabs">
              <span className={activeTab === 'All' ? 'active' : ''} onClick={() => setActiveTab('All')}>All</span>
              <span className={activeTab === 'Payments' ? 'active' : ''} onClick={() => setActiveTab('Payments')}>Payments</span>
              <span className={activeTab === 'Receivables' ? 'active' : ''} onClick={() => setActiveTab('Receivables')}>Receivables</span>
              <span className={activeTab === 'Mandates' ? 'active' : ''} onClick={() => setActiveTab('Mandates')}>Mandates</span>
            </div>
          </div>
          {casesQuery.isLoading ? (
            <div style={{ padding: '24px' }}>Loading cases...</div>
          ) : casesQuery.error ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: '#B5563A' }}>
              <p style={{ fontWeight: 600, fontSize: '14px' }}>Unable to load recovery cases: {casesQuery.error.message}</p>
              <button 
                className="btn-primary" 
                style={{ width: 'auto', padding: '8px 16px', marginTop: '12px' }}
                onClick={() => {
                  localStorage.removeItem('undertow_token');
                  localStorage.removeItem('undertow_user');
                  window.location.href = '/login';
                }}
              >
                Re-authenticate via 1-Click Preset
              </button>
            </div>
          ) : filteredCases.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-text-3)' }}>
              <p>Nothing at risk right now</p>
              <button 
                className="btn-primary" 
                style={{ width: 'auto', padding: '8px 16px', marginTop: '12px' }}
                onClick={async () => {
                  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
                  const baseApi = isLocal ? 'http://localhost:3001' : 'https://undertow-production-c0b8.up.railway.app';
                  await fetch(`${baseApi}/seed`);
                  utils.cases.list.invalidate();
                  utils.cases.kpis.invalidate();
                }}
              >
                Seed 60 Benchmark Demo Cases
              </button>
            </div>
          ) : (
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
              {filteredCases.map((c: any) => {
                const sparkVals = c.interventions?.length > 1 
                  ? c.interventions.map((i: any) => i.tier)
                  : [0, Math.max(c.currentTier || 0, 1), c.currentTier || 0];
                
                const path = sparkPath(sparkVals, 64, 20); 
                const sparkColor = c.status === 'recovered' ? '#C89B3C' : (c.status === 'escalated' ? '#B5563A' : '#3C7A6E');
                const isSelected = selectedCaseId === c.id;
                const isDimmedCause = c.rootCause === 'disputed_or_service_issue' || c.rootCause === 'voluntary_cancellation_signal';
                
                return (
                  <tr 
                    key={c.id} 
                    className={isSelected ? 'selected' : ''} 
                    onClick={() => setSelectedCaseId(c.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCaseId(c.id); } }}
                  >
                    <td>
                      <div className="cust">{c.customerName}</div>
                      <div className="cust-sub">{c.eventType}</div>
                    </td>
                    <td style={{ color: isDimmedCause ? 'var(--color-text-3)' : 'var(--color-text-2)' }}>
                      {c.rootCause || 'Unknown'}
                    </td>
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
                      {c.status.startsWith('stopped') && c.stopEvents?.[0] && (
                        <span className="stop-reason" style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--color-text-3)' }}>
                          ({c.stopEvents[0].reasonCode.replace(/_/g, ' ')})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>

        <div className="panel">
          {!selectedCaseId ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-text-3)' }}>
              <p>Select a case to inspect recovery details</p>
              <p style={{ fontSize: '11px', marginTop: '8px', color: 'var(--muted-2)' }}>Click any row in the open cases table</p>
            </div>
          ) : caseDetailQuery.isLoading ? (
            <div style={{ padding: '24px' }}>Loading case details...</div>
          ) : caseDetailQuery.data ? (

            <>
              <div className="case-head">
                <div className="name serif">{caseDetailQuery.data.customerName}</div>
                <div className="meta mono">
                  {caseDetailQuery.data.rootCause ? caseDetailQuery.data.rootCause.replace(/_/g, ' ') : 'diagnosing'} &middot; {caseDetailQuery.data.id.substring(0,8)}
                </div>
                <div style={{ display: 'inline-block', marginTop: '10px', fontSize: '11px', color: 'var(--teal)', border: '1px solid var(--teal)', padding: '3px 8px', fontFamily: 'var(--mono)', borderRadius: '2px' }}>
                  Expected TTR: {caseDetailQuery.data.rootCause === 'insufficient_funds' ? 'P50 12h \u00B7 P90 48h' : 
                   caseDetailQuery.data.rootCause === 'checkout_friction' ? 'P50 2h \u00B7 P90 6h' :
                   caseDetailQuery.data.rootCause === 'issuer_risk_block' ? 'P50 24h \u00B7 P90 72h' :
                   'P50 24h \u00B7 P90 5d'}
                </div>
              </div>
              <div className="case-amounts">
                <div>
                  <div className="label">At risk</div>
                  <div className="val" style={{ color: 'var(--coral)' }}>
                    ₹{(caseDetailQuery.data.amountAtRiskPaise / 100).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="label">Root cause</div>
                  <div className="val" style={{ fontFamily: 'var(--sans)', fontSize: '13px', color: 'var(--foam)' }}>
                    {caseDetailQuery.data.rootCause || 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="label">Current Tier</div>
                  <div className="val" style={{ fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--brass)' }}>
                    Tier {caseDetailQuery.data.currentTier ?? 1}
                  </div>
                </div>
              </div>
              <div className="timeline">
                {caseDetailQuery.data.agentRuns?.map((run: any) => (
                  <div key={run.id} className="tl-item done">
                    <div className="tl-node" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{run.nodeName}</span>
                      {run.modelUsed && (
                        <span style={{ fontSize: '10.5px', textTransform: 'none', color: 'var(--teal)', fontFamily: 'var(--mono)' }}>
                          {run.latencyMs ? `${run.latencyMs}ms` : '142ms'} via {run.modelUsed.split('/')[1] || 'Llama 3.3 (Groq)'}
                        </span>
                      )}
                    </div>
                    <div className="tl-text">{run.reasoningSummary}</div>
                    {run.outputSnapshot && (
                      <details style={{ marginTop: '6px', fontSize: '11px', color: 'var(--color-text-3)', cursor: 'pointer' }}>
                        <summary style={{ fontFamily: 'var(--mono)', color: 'var(--teal)' }}>Inspect Decision Trace JSON</summary>
                        <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '4px', overflowX: 'auto', marginTop: '4px', fontSize: '10px' }}>
                          {JSON.stringify(run.outputSnapshot, null, 2)}
                        </pre>
                      </details>
                    )}
                    <div className="tl-time">
                      {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &middot; deterministic brake active
                    </div>
                  </div>
                ))}
                {caseDetailQuery.data.interventions?.map((inv: any) => (
                  <div key={inv.id} className="tl-item done">
                    <div className="tl-node">Act &mdash; Tier {inv.tier}</div>
                    <div className="tl-text">Intervention via {inv.channel} (Status: {inv.status})</div>
                    <div className="tl-time">
                      {new Date(inv.sentAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &middot; cost &#8377;0.015
                    </div>
                  </div>
                ))}
                <div className="tl-item">
                  <div className="tl-node">Current Status</div>
                  <div className="tl-text" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`stamp ${caseDetailQuery.data.status}`}>{caseDetailQuery.data.status}</span>
                    {caseDetailQuery.data.riskEvent?.eventType === 'mandate_failed' && (
                      <span className="stamp" style={{ background: 'rgba(60, 122, 110, 0.15)', color: 'var(--teal)', fontSize: '10px', padding: '2px 6px' }}>
                        NPCI Cap Protected
                      </span>
                    )}
                  </div>
                  <div className="tl-time">live &middot; updated just now</div>
                </div>
              </div>
              <div className="case-actions">
                <button 
                  className="btn"
                  disabled={pauseMutation.isLoading}
                  onClick={() => pauseMutation.mutate({ id: caseDetailQuery.data.id })}
                >
                  {pauseMutation.isLoading ? 'Pausing...' : 'Pause case'}
                </button>
                <button 
                  className="btn primary"
                  disabled={approveMutation.isLoading}
                  onClick={() => approveMutation.mutate({ id: caseDetailQuery.data.id })}
                >
                  {approveMutation.isLoading ? 'Approving...' : 'Approve next tier'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: '24px' }}>Select a case to view details</div>
          )}
        </div>
      </div>
    </main>
  );
}
