import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: QueueView,
});

function QueueView() {
  return (
    <div className="flex w-full h-full">
      {/* Left rail for saved filter views */}
      <aside className="w-64 border-r border-ledger bg-ink p-4 flex flex-col gap-2">
        <h2 className="font-display text-sm tracking-wide text-paper/70 mb-2 uppercase">Views</h2>
        <button className="text-left px-3 py-2 text-sm bg-ledger border border-ledger rounded-md text-paper">
          All Open Cases
        </button>
        <button className="text-left px-3 py-2 text-sm hover:bg-ledger/50 rounded-md text-paper/70">
          High Value
        </button>
        <button className="text-left px-3 py-2 text-sm hover:bg-ledger/50 rounded-md text-paper/70">
          Awaiting Review
        </button>
        <button className="text-left px-3 py-2 text-sm hover:bg-ledger/50 rounded-md text-paper/70">
          Near Escalation Ceiling
        </button>
      </aside>

      {/* Main queue table area */}
      <section className="flex-1 p-6 flex flex-col bg-ink">
        <h2 className="font-display text-2xl tracking-tight mb-6">Recovery Queue</h2>
        
        <div className="border border-ledger rounded-sm flex-1 overflow-auto bg-ledger/20">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-ledger text-xs font-mono uppercase text-paper/60 border-b border-ledger">
              <tr>
                <th className="p-3 font-normal">Customer</th>
                <th className="p-3 font-normal">Amount at Risk</th>
                <th className="p-3 font-normal">Root Cause</th>
                <th className="p-3 font-normal">Current Tier</th>
                <th className="p-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b border-ledger/50 hover:bg-ledger/40 cursor-pointer transition-colors">
                <td className="p-3">Acme Corp</td>
                <td className="p-3 font-mono text-rust">₹45,000</td>
                <td className="p-3">
                  <span className="badge">buyer_approval_delay</span>
                </td>
                <td className="p-3 font-mono">Tier 2 (Email)</td>
                <td className="p-3 text-current-teal">In Progress</td>
              </tr>
              <tr className="border-b border-ledger/50 hover:bg-ledger/40 cursor-pointer transition-colors">
                <td className="p-3">Rahul Sharma</td>
                <td className="p-3 font-mono text-rust">₹1,200</td>
                <td className="p-3">
                  <span className="badge border-rust text-rust">insufficient_funds</span>
                </td>
                <td className="p-3 font-mono">Tier 1 (Retry)</td>
                <td className="p-3 text-paper/60">Pending</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
