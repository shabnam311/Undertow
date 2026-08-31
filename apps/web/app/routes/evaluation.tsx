import { createFileRoute } from '@tanstack/react-router';
import { trpc } from '../utils/trpc';
import React from 'react';

export const Route = createFileRoute('/evaluation')({
  component: EvaluationComponent,
});

function EvaluationComponent() {
  const { data, isLoading, error } = trpc.evaluation.getBatchResults.useQuery();

  if (isLoading) {
    return (
      <main className="main-content flex-center">
        <div className="spinner">Loading evaluation batch...</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="main-content flex-center">
        <div className="error-message">Failed to load batch results.</div>
      </main>
    );
  }

  return (
    <main className="main-content">
      <header className="top-bar">
        <h1>Batch evaluation</h1>
      </header>

      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-label">Recovery Rate</div>
          <div className="kpi-val">{data.recoveryRate}%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Cost of Interventions</div>
          <div className="kpi-val">₹{(data.totalCostPaise / 100).toFixed(2)}</div>
        </div>
      </div>

      <div className="lower">
        <div className="panel mt-6">
          <div className="panel-header">
            <h3>Stop Reasons (Unrecovered)</h3>
          </div>
          <div className="panel-body">
            {data.stopReasons.length === 0 ? (
              <p>No stop events recorded.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reason Code</th>
                    <th className="align-right">% of stopped cases</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stopReasons.map((sr) => (
                    <tr key={sr.reason}>
                      <td><code>{sr.reason}</code></td>
                      <td className="align-right">{sr.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="panel mt-6 baseline">
          <div className="panel-header">
            <h3>Against a fixed-cadence baseline</h3>
          </div>
          <div className="panel-body" style={{ padding: '0 18px 18px' }}>
            <div className="baseline-row">
              <span className="baseline-name">Recovery rate, Undertow</span>
              <span className="baseline-val brass">{data.recoveryRate}%</span>
            </div>
            <div className="baseline-row">
              <span className="baseline-name">Recovery rate, single-channel reminder</span>
              <span className="baseline-val dim">{data.naiveBaselineRecoveryRate}%</span>
            </div>
            <div className="baseline-row">
              <span className="baseline-name">Cost per recovered ₹, Undertow</span>
              <span className="baseline-val brass">₹{data.undertowCostPerRupee.toFixed(3)}</span>
            </div>
            <div className="baseline-row">
              <span className="baseline-name">Cost per recovered ₹, baseline estimate</span>
              <span className="baseline-val dim">₹{data.naiveBaselineCostPerRupee.toFixed(3)}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
