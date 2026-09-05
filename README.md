# Undertow — Recovery Operating System for Merchant Revenue Leakage
**Razorpay AI Buildathon 2026 — Track 03: AI Revenue Recovery**

> **🌐 Live Demo (Instant Access, 1-Click Role Presets):** [https://undertow-web-flax.vercel.app/](https://undertow-web-flax.vercel.app/)  
> **🩺 API Health Check:** [https://undertow-production-c0b8.up.railway.app/health](https://undertow-production-c0b8.up.railway.app/health)  
> **⚡ 1-Click Production Demo Seeder:** [https://undertow-production-c0b8.up.railway.app/seed](https://undertow-production-c0b8.up.railway.app/seed)  
> *Note for Evaluators: Any password is accepted with 1-click test role presets (Owner / Analyst / Viewer) on the login screen for instant evaluation.*

Undertow watches a merchant's payment and billing surface for active revenue leakage — failed payments, abandoned checkouts, overdue B2B invoices, and failing UPI autopay mandates — diagnoses the likely root cause, and picks a recovery channel under hard spend and escalation limits. Every step is logged to an audit table so a merchant can see exactly why the agent did what it did.

This README describes what is **actually implemented in this repository** (`apps/api`, `apps/web`, `packages/db`), not just the pitch. Where an implementation is a simplification of the full production idea, it is called out below.

---

## 🏗️ What's Actually in the Pipeline

```
[ Razorpay Webhooks (apps/api/src/webhooks/razorpay.ts) ]
  │ HMAC-SHA256 signature check (crypto.timingSafeEqual)
  │ Idempotent insert on `risk_events.external_event_id`
  ▼
Stage 1 — Detect (apps/api/src/inngest/functions.ts: processRiskEvent)
  • Small hand-set logistic regression (4 weights + bias) over event type + amount, sigmoid, threshold at p > 0.65
  ▼
Stage 2 — Diagnose (apps/api/src/agent/workflow.ts: diagnoseNode, LangGraph StateGraph)
  • Fast path: `insufficient_funds` inferred directly from structured Razorpay error reason, no LLM call needed
  • Otherwise: builds a 384-dim pseudo-embedding from the event (a deterministic character-hash projection, not a trained embedding model), does a pgvector cosine-similarity lookup against past diagnosed cases for few-shot context (falls back to hardcoded examples if pgvector is unavailable)
  • Calls an LLM with structured output (Zod schema, 9-value enum of root causes): Groq `llama-3.3-70b-versatile` first, falls back to secondary handler/deterministic heuristics if Groq errors or is unconfigured
  ▼
Stage 3 — Decide (apps/api/src/agent/workflow.ts: decideNode)
  • Hard stops: `disputed_or_service_issue` and `voluntary_cancellation_signal` always route to `none` / tier 0
  • NPCI guardrail: `mandate_failed` events at attempt 4+ are hard-capped to `none` regardless of anything else
  • RBI guardrail: `mandate_failed` at ≥ ₹15,000 is force-routed to `payment_link_retry` (cannot be auto-retried per AFA rules)
  • Payday heuristic: `insufficient_funds` cases opened between the 22nd–30th of the month get `scheduledFor` set to the 1st of next month
  • Otherwise: Thompson Sampling over `channel_performance` (Beta(α, β) per merchant/root-cause/channel/tier), seeded with flat priors (email, sms, whatsapp, payment_link_retry) if no history exists yet
  ▼
Stage 4 — Act (apps/api/src/inngest/functions.ts: executeIntervention)
  • Checks customer consent per channel before sending
  • Checks aggregate merchant spend against `spend_ceiling_paise`
  • Writes an `interventions` row (channel, tier, mocked cost, provider ref — simulated delivery in test mode)
  ▼
Stage 5 — Escalate (apps/api/src/inngest/functions.ts: evaluateEscalation cron)
  • Cases stuck > 24h in `intervention_sent` get bumped a tier, or stopped as `stopped_unrecovered` if they hit the merchant's `escalation_ceiling`
  ▼
Stage 6 — Learn (apps/api/src/inngest/functions.ts: processCaseClosed)
  • Triggered on `payment.captured` / subscription charged / invoice paid webhooks
  • Updates the Beta(α, β) posterior for the channel/tier/root-cause arm that was last tried, so future Thompson draws shift accordingly
```

Every LLM call and every bandit decision is written to `agent_runs` with the exact input/output JSON, the model used, and latency — this is the immutable audit trail that merchants inspect.

---

## 🔍 Verified Coverage: 4 Surfaces & 9 Root Causes

### 4 Protected Merchant Surfaces
- [x] **Payments (`payment_failed`)**: E-commerce card, UPI, and net banking failure triage
- [x] **Receivables (`invoice_overdue`)**: B2B Net-15 / Net-30 enterprise invoice recovery
- [x] **Mandates (`mandate_failed`)**: Recurring UPI Autopay / e-mandate failure management
- [x] **Checkouts (`checkout_abandoned`)**: Drop-offs prior to gateway authorization

### 9 Controlled Root-Cause Classes
- [x] `insufficient_funds` — Low balance; scheduled around salary/payday cycles
- [x] `issuer_risk_block` — Bank-side fraud trigger; routed to secondary instrument
- [x] `technical_gateway_failure` — Gateway/bank downtime; exponential jitter retry
- [x] `checkout_friction` — UI drop-off; low-friction payment link recovery
- [x] `expired_or_invalid_instrument` — Card expiry / stale mandate; instrument update flow
- [x] `buyer_side_approval_delay` — B2B multi-tier delay; gentle reminder cadence
- [x] `disputed_or_service_issue` — Chargeback / product dispute; **DETERMINISTIC HARD-STOP**
- [x] `voluntary_cancellation_signal` — User opt-out / churn; **DETERMINISTIC HARD-STOP**
- [x] `undiagnosable` — Ambiguous bank response code; conservative human escalation

---

## 🛠️ Stack (As Actually Used in the Code)

- **Frontend**: React + TanStack Router (`apps/web`), plain CSS, deployed to Vercel as a Vite SPA
- **Backend API**: Hono running on Bun, with `@hono/trpc-server` exposing a typed tRPC router (`cases`, `evaluation`, `auth` namespaces) &mdash; see [`apps/api/src/trpc.ts`](file:///d:/Undertow/apps/api/src/trpc.ts)
- **Auth**: Homegrown cryptographic HMAC-SHA256 session tokens (`ut_<payload>.<sig>`, [`apps/api/src/auth.ts`](file:///d:/Undertow/apps/api/src/auth.ts)) using constant-time comparison (`timingSafeEqual`); roles are `owner` / `analyst` / `viewer` via Postgres enum, enforced with `requireAnalyst` tRPC middleware
- **Orchestration**: Inngest functions (`process-risk-event`, `execute-intervention`, `evaluate-escalation`, `process-case-closed`)
- **Agent Intelligence**: LangGraph `StateGraph` (`detect` → `diagnose` → `decide`) with Groq (`llama-3.3-70b-versatile`) for structured diagnosis
- **Data & Storage**: PostgreSQL via Drizzle ORM, with a custom `vector(384)` column type on `cases.embedding` for `pgvector` similarity search
- **Deployment**: Backend API as a Docker container on Railway (`apps/api/src/index.ts`); frontend SPA on Vercel

---

## ⚡ Local Setup & Verification

### 1. Prerequisites
- [Bun](https://bun.sh/) v1.1+
- PostgreSQL database with `pgvector` extension enabled (e.g., [Neon](https://neon.tech/))

### 2. Configure Environment (`.env`)
```bash
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://user:password@your-neon-host/neondb?sslmode=require"
GROQ_API_KEY="gsk_..."
RAZORPAY_WEBHOOK_SECRET="your_shared_webhook_secret"
INNGEST_EVENT_KEY="your-inngest-event-key"
INNGEST_SIGNING_KEY="your-inngest-signing-key"
```
*Note: `AUTH_SECRET` is optional in development (a fallback secret is provided) but is required in production where the app strictly enforces it.*

### 3. Apply Migrations & Seed Data
```bash
cd packages/db
bun run drizzle-kit push --force
# Seeds 1 merchant + 60 synthetic cases spread across all 9 root causes
# (payment_failed / checkout_abandoned / mandate_failed / invoice_overdue),
# with realistic status/intervention/stop-event history.
bun run scripts/generate.ts
```

### 4. Launch
```bash
# From the repository root
bun run dev
```

- **Operations Dashboard (Recovery Queue)**: `http://localhost:3000`
- **Batch Evaluation Route**: `http://localhost:3000/evaluation` &mdash; recovery-rate and cost-per-recovered-₹ comparison against a single-channel baseline, computed directly from the seeded batch
- **Settings**: `http://localhost:3000/settings` &mdash; merchant spend/escalation ceiling config
- **API & Webhook Receiver**: `http://localhost:3001` (Health check: `http://localhost:3001/health`)

---

## 🧪 Automated Testing

```bash
bun test
```

`apps/api/src/agent/workflow.test.ts` covers `decideNode` directly (mocking the DB layer) and asserts:
- `disputed_or_service_issue` and `voluntary_cancellation_signal` deterministically route to `none` / tier 0 without touching the bandit
- With no channel-performance history, sampling still returns one of the four default arms
- Given a heavily skewed `Beta(100,1)` vs `Beta(1,100)` prior, Thompson Sampling picks the stronger arm in the large majority of draws (asserts > 45/50)
- The NPCI 4-attempt cap and RBI ₹15,000 AFA guardrails fire correctly and independently of the bandit

`apps/api/src/auth.test.ts` covers the HMAC session token sign/verify roundtrip, rejection of tampered/expired tokens, and role-based access control.

---

## ⚠️ Known Limitations (Being Upfront About the Prototype)

1. **Simulated Interventions**: Interventions are logged to the database but not actually dispatched &mdash; there is no live WhatsApp/SMS gateway integration; `providerRef` is a simulated string to prevent unsolicited messaging during evaluation.
2. **Deterministic Pseudo-Embedding**: The "384-dim embedding" used for `pgvector` similarity is a deterministic character-hash projection of the event string, not output from a trained embedding model &mdash; it provides consistent, comparable vectors for similar-looking events, but it is not semantic in the way a sentence embedding model would be.
3. **Hand-Set Scorer**: The Stage 1 risk-detection model is a small hand-set logistic regression (4 features, fixed weights), not a model trained on large-scale historical datasets.
4. **Thompson Sampling Warm-Up**: Bandit priors start flat ($\text{Beta}(1, 1)$) per merchant/root-cause, so early routing decisions explore evenly until closed-case feedback builds up posteriors.

---

## 📁 Repository Structure

```
apps/
  api/src/
    agent/workflow.ts      # LangGraph detect/diagnose/decide graph + bandit logic
    inngest/functions.ts   # Durable orchestration + cron escalation loops
    webhooks/razorpay.ts   # Signed, idempotent webhook ingestion
    trpc.ts                # cases / evaluation / auth routers
    auth.ts                # HMAC session tokens + RBAC middleware
  web/app/routes/
    index.tsx              # Recovery queue dashboard & detail drawer
    evaluation.tsx         # Batch evaluation vs. naive baseline
    settings.tsx           # Spend/escalation ceiling config
    login.tsx              # Split-pane login with 1-click test role presets
packages/
  db/
    schema.ts              # Drizzle schema incl. pgvector column & Beta bandit table
    scripts/generate.ts    # Synthetic 60-case seed generator
```

---

## 👥 License & Authors
- **Shabnam** &mdash; *Undertow Architecture & Engineering*
- **License**: MIT © 2026 Shabnam
