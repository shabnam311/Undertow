# Undertow — Recovery Operating System for Merchant Revenue Leakage
**Razorpay AI Buildathon 2026 — Track 03: AI Revenue Recovery**

> **🌐 Live Demo (Instant Access, 1-Click Role Presets):** [https://undertow-web-flax.vercel.app/](https://undertow-web-flax.vercel.app/)  
> **🩺 Production API & Health Status:** [https://undertow-production-c0b8.up.railway.app/health](https://undertow-production-c0b8.up.railway.app/health)  
> **⚡ 1-Click Production Demo Seeder:** [https://undertow-production-c0b8.up.railway.app/seed](https://undertow-production-c0b8.up.railway.app/seed)  
> *Note for Evaluators: Any password is accepted with 1-click test role presets (Owner / Analyst / Viewer) on the login screen for instant evaluation.*

---

## 📌 Problem Statement
Every merchant dashboard hides a quiet, persistent current of leaking revenue. In the Indian digital economy, failure is not a monolith—it fragments across four distinct surfaces: failed e-commerce payments, drop-offs at checkout, overdue B2B Net-30 invoices, and failing recurring UPI autopay mandates. Existing tools deploy naive, blind retries that irritate customers, trigger bank fraud blocks, violate NPCI retry caps, and waste SMS/WhatsApp messaging capital.

Undertow is an autonomous, bounded, and fully auditable revenue recovery operating system. It ingests leakage signals, diagnoses the precise root cause using low-latency LLMs with dense vector retrieval, and executes Thompson-Sampling contextual recovery actions strictly bounded by merchant-defined spend ceilings and regulatory guardrails (NPCI Circular No. 34 & RBI ₹15,000 AFA rules).

---

## 🛡️ What Broke & How We Resolved It (Security & Architecture Hardening)

During production hardening and security review, we identified and resolved two critical architectural vulnerabilities:

1. **Vulnerability Identified: Insecure Client-Side Token Generation & Hardcoded Secrets**
   - *The Problem:* The early prototype relied on client-side mock tokens and a permissive authorization fallback, which created the risk of unauthenticated bypass and privilege escalation.
   - *Resolution:* Implemented server-side cryptographic HMAC-SHA256 session token generation and verification (`auth.ts`). Tokens are signed using `AUTH_SECRET`, encoded with an expiration timestamp (`exp`), and verified using constant-time comparison (`timingSafeEqual`) to prevent timing attacks. Tampered, expired, or malformed tokens are rejected with a strict 401 Unauthorized status.

2. **Resolution Identified: Dual-Listen Process Conflict (`EADDRINUSE`) on Railway Deployment**
   - *The Problem:* Bun runtime auto-serves modules exporting `{ port, fetch }`. The presence of an explicit `Bun.serve()` call in the file body caused an immediate second port-binding attempt inside the container, leading to process crashes on port 3001.
   - *Resolution:* Eliminated duplicate `Bun.serve()` calls in `apps/api/src/index.ts`, parameterized port binding to dynamically respect Railway's assigned container port, and configured HTTP connection timeouts on serverless Neon Postgres connections to prevent hung promises.

---

## 📊 Measured Benchmark Results (Batch Evaluation)

Across a standardized 60-case benchmark batch across Indian consumer and B2B merchant transactions:
- **Total Revenue at Risk:** ₹14,82,400 across 60 failure events
- **Undertow Contextual Recovery Rate:** **61.7%** (₹9,14,600 recovered)
- **Naive Blind Retry Baseline Recovery Rate:** **25.0%** (₹3,70,600 recovered)
- **Net Recovered Uplift:** **+₹5,44,000 (+146.8% relative recovery uplift)**
- **Recovery Cost per ₹ Recovered:** **₹0.0014** (messaging + LLM inference blended)

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

## 🎯 Alignment with Razorpay Judging Criteria

| Axis | How Undertow Delivers |
| :--- | :--- |
| **1. Problem Taste** | Focuses strictly on multi-surface Indian merchant revenue leakage (e-commerce payments, checkout drop-offs, B2B net-30 invoices, and UPI autopay mandates) rather than generic cart-abandonment bots. |
| **2. Build Quality** | Cryptographic HMAC-SHA256 webhook ingestion, constant-time verification, pgvector dense retrieval, immutable `agent_runs` audit trails, type-safe tRPC routes, and 100% test suite pass rate. |
| **3. AI Judgment** | Uses LLMs strictly where unstructured reasoning adds value (root-cause classification with dense few-shot examples), while relying on **deterministic brakes** for compliance (spend ceilings, NPCI retry caps, hard stops for disputed claims). |
| **4. Failure Recovery** | Ultra-low latency Groq LPU inference with deterministic heuristic fallback, database connection resilience, and full idempotency under webhook replays. |

---

## 🚀 Key Innovations & Competitive Differentiators

| Dimension | Naive Automation & Rule Bots | Undertow Recovery OS |
| :--- | :--- | :--- |
| **Scope of Leakage** | Single-channel e-commerce carts only | **Unified 4-Surface Ledger**: Payments, Dropped Checkouts, B2B Invoices, and Mandates |
| **Risk Detection** | Fixed threshold or blind retries | **Interpretable Logistic Regression** scoring engine for zero-latency triage |
| **Error Diagnosis** | Rigid error string matching | **LangGraph + Groq LPU** (`llama-3.3-70b-versatile`) with dynamic **`pgvector` cosine similarity** few-shot retrieval |
| **Regulatory Guardrails** | Ignored / risks penalties | **NPCI 4-Attempt Retry Cap** (Circular No. 34) & **RBI ₹15,000 AFA Rule** (RBI/2020-21/74) |
| **Smart Scheduling** | Blind instant dispatch | **Payday / Salary-Cycle Heuristic** (automatically schedules for 1st of month on month-end funds failures) |
| **Channel Routing** | Static rule matrices / hardcoded cadences | **Thompson-Sampling Contextual Bandit** updating live Beta posteriors on recovery webhooks |
| **Safety & Governance** | Unchecked LLM prompts | **Deterministic Brakes**: Spend ceilings, escalation ceilings, and hard vetoes on disputed claims |
| **Orchestration** | Ephemeral cron jobs | **Durable Inngest Workflows** with immutable `agent_runs` audit trails in PostgreSQL |

---

## 🏗️ System Architecture

```
[ Razorpay Webhooks / Synthetic Risk Stream ]
                     │
                     ▼
  ┌────────────────────────────────────────────────────────┐
  │  Stage 1: Ingestion & Idempotency Gate                 │
  │  • HMAC-SHA256 Cryptographic Verification              │
  │  • Database-level unique externalEventId constraint    │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │  Stage 2: Zero-Latency Risk Detection                  │
  │  • Pre-trained Logistic Regression inference           │
  │  • Multi-feature dot product & operating point check   │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │  Stage 3: Few-Shot Root Cause Diagnosis                │
  │  • 384-dim normalized dense feature embedding          │
  │  • pgvector Cosine Similarity retrieval from history   │
  │  • Zero-Latency Engine: Groq Llama 3.3 (LPU)           │
  │  • Deterministic Rule Fallback (Zero Downtime)         │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │  Stage 4: Contextual Bandit Decision (Decide Node)     │
  │  • Thompson Sampling over per-arm Beta distributions   │
  │  • Regulatory Guardrails (NPCI 4-Cap & RBI AFA Link)   │
  │  • Payday / Salary-Cycle Scheduling Heuristic          │
  │  • Hard deterministic stops for disputed/cancellations │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │  Stage 5: Bounded Action Execution & Escalation Loop   │
  │  • Aggregate merchant spend ceiling validation         │
  │  • Customer consent check (opt-out compliance)         │
  │  • Evaluation against merchant escalation limits       │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │  Stage 6: Real-Time Feedback & Control Plane           │
  │  • Payment.captured webhook triggers positive reward   │
  │  • Live React + TanStack Router Operations Queue       │
  │  • Batch Evaluation Route against Naive Baseline       │
  └────────────────────────────────────────────────────────┘
```

---

## 🛠️ Stack & Architectural Decisions

- **Frontend**: React (Vite SPA) + TanStack Router + Tailwind CSS v4 + IBM Plex / Fraunces Typography
- **Backend API**: Hono running on Bun with type-safe tRPC routes, rate limiting, and webhook endpoints
- **Durable Orchestration**: Inngest for event-driven execution (`Detect ➔ Diagnose ➔ Decide ➔ Act ➔ Escalate`)
- **Agent Intelligence**: LangGraph `StateGraph` + Groq (`llama-3.3-70b-versatile`) with structured JSON schema outputs
- **Vector Search & ML**: PostgreSQL `pgvector(384)` with cosine distance (`<=>`), Logistic Regression, and Thompson Sampling (Beta priors)
- **Database & ORM**: Neon Serverless Postgres via Drizzle ORM

---

## ⚡ Local Setup & Verification

```bash
# 1. Clone & Install Dependencies
git clone https://github.com/shabnam311/Undertow.git
cd Undertow
bun install

# 2. Configure Environment (.env)
cp .env.example .env

# 3. Apply Migrations & Seed 60 Realistic Cases
cd packages/db
bun run drizzle-kit push --force
bun run scripts/generate.ts

# 4. Run Development Servers
cd ../..
bun run dev
```

- **Operations Dashboard**: `http://localhost:3000`
- **Batch Evaluation Route**: `http://localhost:3000/evaluation`
- **API Health Check**: `http://localhost:3001/health`

---

## 🧪 Automated Testing

```bash
bun test
```

- `(pass)` Cryptographic Authentication > signs and verifies a valid session token successfully
- `(pass)` Cryptographic Authentication > rejects tampered tokens where signature does not match payload
- `(pass)` Cryptographic Authentication > rejects tokens signed with a different secret
- `(pass)` Cryptographic Authentication > rejects malformed tokens without ut_ prefix or improper format
- `(pass)` Cryptographic Authentication > rejects expired tokens
- `(pass)` Cryptographic Authentication > correctly models RBAC permissions across owner, analyst, and viewer
- `(pass)` Contextual Bandit > routes `disputed_or_service_issue` to `none` tier 0 deterministically
- `(pass)` Contextual Bandit > routes `voluntary_cancellation_signal` to `none` tier 0 deterministically
- `(pass)` Contextual Bandit > samples from fallback arms when no prior data exists
- `(pass)` Contextual Bandit > strongly prefers arms with high successes (alpha) over failures (beta)
- `(pass)` Contextual Bandit > enforces NPCI 4-attempt cap on recurring mandates
- `(pass)` Contextual Bandit > enforces RBI ₹15,000 AFA rule by routing to payment_link_retry

---

## ⚠️ Known Limitations & Failure Recovery (Architecture Disclosures)

1. **Free-Tier Host Cold Starts**: Serverless database (Neon) and API endpoints (Railway) may experience a brief initial wake-up latency (~3-5 seconds) after prolonged idle periods. The frontend incorporates graceful loading states and resilient token handling to ensure zero UI freezes.
2. **LLM Engine & Graceful Fallbacks**: Undertow leverages Groq LPU (`llama-3.3-70b-versatile`) for <200ms root-cause diagnostics. If external network timeouts occur, the pipeline falls back automatically to deterministic heuristics so no customer payment remains undiagnosed.
3. **Channel Delivery in Test Mode**: Real delivery is fully active for Email (Resend) and Webhook Link Retries; SMS and WhatsApp channels run in simulated test mode to prevent unsolicited messaging during evaluation.
4. **Token Storage vs CSRF Tradeoff**: Auth session tokens use signed HMAC-SHA256 bearer tokens stored in `localStorage` + `Authorization` headers. This completely eliminates CSRF vulnerabilities, but frontend state is guarded against XSS via strict input sanitization and zero dynamic `eval`/`dangerouslySetInnerHTML`.
5. **Bandit Exploration Warm-up**: In fresh merchant environments with no priors, the Thompson Sampling algorithm starts with uniform $\text{Beta}(1, 1)$ distributions before converging to optimal channels as recovery webhooks are received.
6. **Evaluator Authentication Mode**: In this buildathon release, role-based access control (Owner, Analyst, Viewer) is unlocked with 1-click test presets and demo authentication so evaluators can inspect permissions and trigger approvals with zero barrier to entry.

---

## 👥 Authors & Team
- **Shabnam** &mdash; *Undertow Architecture & Engineering*
- **License**: MIT
