# Undertow — Recovery Operating System for Merchant Revenue Leakage
**Razorpay AI Buildathon 2026 — Track 03: AI Revenue Recovery**

Undertow is an autonomous, bounded, and fully auditable revenue recovery engine. It watches a merchant's payment and billing surface for active revenue leakage (failed payments, abandoned checkouts, overdue B2B invoices, and failing UPI autopay mandates), diagnoses the root cause using an LLM with vector similarity few-shot context, and recovers capital using an online Thompson-Sampling Contextual Bandit bounded by strict spend ceilings, escalation ladders, and regulatory guardrails.

---

## 🚀 Key Innovations & Competitive Differentiators

| Dimension | Naive Automation & Rule Bots | Undertow Recovery OS |
| :--- | :--- | :--- |
| **Scope of Leakage** | Single-channel e-commerce carts only | **Unified 4-Surface Ledger**: Payments, Dropped Checkouts, B2B Invoices, and Mandates |
| **Risk Detection** | Fixed threshold or blind retries | **Interpretable Logistic Regression** scoring engine for zero-latency triage |
| **Error Diagnosis** | Rigid error string matching | **LangGraph + Groq/Claude** with dynamic **`pgvector` cosine similarity** few-shot retrieval |
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
  │  • LangGraph + Llama 3.3 (Groq) / Claude Haiku 4.5    │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │  Stage 4: Contextual Bandit Decision (Decide Node)     │
  │  • Thompson Sampling over per-arm Beta distributions   │
  │  • Dynamic channel & tier selection (Email/SMS/WA/Link)│
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

## 🛠️ Stack & Technologies

- **Frontend**: React (Vite SPA) + TanStack Router + Tailwind CSS v4
- **Backend API**: Hono running on Bun with type-safe tRPC routes and webhook endpoints
- **Durable Orchestration**: Inngest for resilient event-driven execution (Detect ➔ Diagnose ➔ Decide ➔ Act ➔ Escalate)
- **Agent Intelligence**: LangGraph `StateGraph` + Groq (`llama-3.3-70b-versatile`) / Anthropic (`claude-haiku-4-5-20251001`)
- **Vector Search & ML**: PostgreSQL `pgvector(384)` with cosine distance (`<=>`), Logistic Regression, and Thompson Sampling (Beta priors)
- **Database & ORM**: Neon Serverless Postgres via Drizzle ORM

---

## ⚡ Local Setup

### 1. Prerequisites
- [Bun](https://bun.sh) (v1.1+) installed
- A free [Neon](https://neon.tech) database or local Postgres with `pgvector`

### 2. Configure Environment (`.env`)
Create a `.env` file in the project root:

```ini
# Application
NODE_ENV=development
PORT=3001

# Database (Neon Serverless Postgres)
DATABASE_URL="postgresql://user:password@your-neon-host/neondb?sslmode=require"

# LLM Providers (100% Free Tier via Groq)
GROQ_API_KEY="gsk_..."
ANTHROPIC_API_KEY=""

# Razorpay Webhook Secret
RAZORPAY_WEBHOOK_SECRET="undertow_secret_buildathon_2026"

# Inngest Orchestration
INNGEST_EVENT_KEY="your-inngest-event-key"
INNGEST_SIGNING_KEY="your-inngest-signing-key"

# Feature Flags
ENABLE_SHADOW_MODE=true
```

### 3. Apply Migrations & Seed Data
```bash
# 1. Push schema to database
cd packages/db
bun run drizzle-kit push --force

# 2. Seed 60 realistic recovery cases across all 9 root causes
bun run scripts/generate.ts
```

### 4. Launch the Application
```bash
# From the repository root
bun run dev
```

- **Operations Dashboard**: `http://localhost:3000`
- **Batch Evaluation & Baseline Benchmarks**: `http://localhost:3000/evaluation`
- **Backend API & Webhook Receiver**: `http://localhost:3001`

---

## 🧪 Testing & Verification

Undertow features an isolated unit and statistical test suite testing deterministic hard-stops and bandit sampling tendencies:

```bash
bun test
```

- `(pass)` routes `disputed_or_service_issue` to `none` tier 0 deterministically
- `(pass)` routes `voluntary_cancellation_signal` to `none` tier 0 deterministically
- `(pass)` samples from fallback arms when no prior data exists
- `(pass)` strongly prefers arms with high successes (alpha) over failures (beta)
