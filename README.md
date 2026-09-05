# Undertow — Recovery Operating System for Merchant Revenue Leakage
**Razorpay AI Buildathon 2026 — Track 03: AI Revenue Recovery**

> **🌐 Live Demo (Instant Access, 1-Click Role Presets):** [Undertow](https://undertow-web-flax.vercel.app/)  
> **🩺 Production API & Service Readiness:** [https://undertow-production-c0b8.up.railway.app/health](https://undertow-production-c0b8.up.railway.app/health)  
> *Note for Evaluators: Any password is accepted with 1-click test role presets (Owner/Analyst/Viewer) for immediate evaluation convenience.*

Undertow is an autonomous, bounded, and fully auditable revenue recovery engine. It watches a merchant''s payment and billing surface for active revenue leakage (failed payments, abandoned checkouts, overdue B2B invoices, and failing UPI autopay mandates), diagnoses the root cause using an LLM with vector similarity few-shot context, and recovers capital using an online Thompson-Sampling Contextual Bandit bounded by strict spend ceilings, escalation ladders, and regulatory guardrails (NPCI Circular No. 34 & RBI ₹15,000 AFA Rule).

---

## 🎯 Alignment with Razorpay Judging Criteria

| Axis | How Undertow Delivers |
| :--- | :--- |
| **1. Problem Taste** | Focuses strictly on multi-surface Indian merchant revenue leakage (e-commerce payments, checkout drop-offs, B2B net-30 invoices, and UPI autopay mandates) rather than generic cart-abandonment bots. |
| **2. Build Quality** | Cryptographic HMAC-SHA256 webhook ingestion, constant-time verification, pgvector dense retrieval, immutable `agent_runs` audit trails, type-safe tRPC routes, and 100% test suite pass rate. |
| **3. AI Judgment** | Uses LLMs strictly where unstructured reasoning adds value (root-cause classification with dense few-shot examples), while relying on **deterministic brakes** for compliance (spend ceilings, NPCI retry caps, hard stops for disputed claims). |
| **4. Failure Recovery** | Dual-LLM automatic failover (Groq LPU $\to$ Anthropic Claude Haiku $\to$ Heuristic classifier), database connection resilience, and full idempotency under webhook replays. |

---

## 🚀 Key Innovations & Competitive Differentiators

| Dimension | Naive Automation & Rule Bots | Undertow Recovery OS |
| :--- | :--- | :--- |
| **Scope of Leakage** | Single-channel e-commerce carts only | **Unified 4-Surface Ledger**: Payments, Dropped Checkouts, B2B Invoices, and Mandates |
| **Risk Detection** | Fixed threshold or blind retries | **Interpretable Logistic Regression** scoring engine for zero-latency triage |
| **Error Diagnosis** | Rigid error string matching | **LangGraph + Groq/Claude** with dynamic **`pgvector` cosine similarity** few-shot retrieval |
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
  │  • Primary: Groq Llama 3.3 (LPU)                       │
  │  • Resilient Fallback: Anthropic Claude Haiku 4.5      │
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
- **Agent Intelligence**: LangGraph `StateGraph` + Groq (`llama-3.3-70b-versatile`) with automatic failover to Anthropic (`claude-haiku-4-5-20251001`)
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
2. **Multi-LLM Graceful Fallbacks**: When primary Groq LPU inference experiences rate-limiting or network timeouts, the pipeline automatically fails over to Anthropic Claude Haiku, and ultimately to deterministic heuristics so no customer payment remains undiagnosed.
3. **Channel Delivery in Test Mode**: Real delivery is fully active for Email (Resend) and Webhook Link Retries; SMS and WhatsApp channels run in simulated test mode to prevent unsolicited messaging during evaluation.
4. **Token Storage vs CSRF Tradeoff**: Auth session tokens use signed HMAC-SHA256 bearer tokens stored in `localStorage` + `Authorization` headers. This completely eliminates CSRF vulnerabilities, but frontend state is guarded against XSS via strict input sanitization and zero dynamic `eval`/`dangerouslySetInnerHTML`.
5. **Bandit Exploration Warm-up**: In fresh merchant environments with no priors, the Thompson Sampling algorithm starts with uniform $\text{Beta}(1, 1)$ distributions before converging to optimal channels as recovery webhooks are received.
6. **Evaluator Authentication Mode**: In this buildathon release, role-based access control (Owner, Analyst, Viewer) is unlocked with 1-click test presets and demo authentication so evaluators can inspect permissions and trigger approvals with zero barrier to entry.

---

## 👥 Authors & Team
- **Shabnam** &mdash; *Undertow Architecture & Engineering*
- **License**: MIT
