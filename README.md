# Undertow — Recovery Operating System for Merchant Revenue Leakage

Undertow is a bounded, auditable agent that watches a merchant's payment and billing surface for revenue that is actively leaking (e.g. failed payments, abandoned checkouts, overdue invoices), diagnoses the root cause using an LLM, and attempts to recover it through multi-channel outreach, bounded by strict spend and escalation policies.

## Architecture

- **Frontend**: TanStack Router + React (Vite SPA) + Tailwind v4
- **Backend API**: Hono running on Bun, exposing tRPC routes and Razorpay Webhooks.
- **Durable Orchestration**: Inngest for stateful event execution (Detect, Diagnose, Decide, Act, Escalate)
- **Agent Reasoning**: LangGraph `StateGraph` + Claude Haiku (`claude-haiku-4-5-20251001`) for diagnosis of unstructured failure events.
- **Channel Policy**: Thompson-Sampling Contextual Bandit dynamically updating Beta posteriors on recovery/failure.
- **Database**: PostgreSQL (with pgvector extension) via Drizzle ORM

## Local Setup

To run Undertow locally, ensure you have [Bun](https://bun.sh) and [Docker](https://www.docker.com) installed.

1. Install dependencies:
   ```bash
   bun install
   ```

2. Start the local database (pgvector):
   ```bash
   docker-compose up -d
   ```

3. Configure environment:
   Copy `.env.example` to `.env` and fill in the required values:
   - `DATABASE_URL`: `postgresql://postgres:password@localhost:5432/undertow`
   - `ANTHROPIC_API_KEY`: Required for the LLM diagnosis node
   - `RAZORPAY_WEBHOOK_SECRET`: Required to verify incoming webhooks
   - `INNGEST_EVENT_KEY`: For local Inngest execution

4. Apply Database Schema:
   ```bash
   cd packages/db
   bun run drizzle-kit push --force
   ```

5. Run the Dev Server:
   ```bash
   # Starts both the Hono API and Vite Frontend concurrently
   bun run dev
   ```

## Current Status: What is real vs stubbed?

This prototype implements the full structural skeleton of the system:
- **Implemented**: Database schemas (with all strict enums and foreign-key constraints enforced by Postgres), Webhook signature verification & idempotency, Inngest orchestration loops with agentRuns audit trails, Thompson-sampling contextual bandit channel decisions, aggregate spend and escalation ceilings, LangGraph StateGraph flow, tRPC transport layer, React UI components, Dynamic KPIs tracking live DB data, Synthetic Evaluation Data Generator.
- **Stubbed**: 
  - `apps/web` is currently a single-page Vite app rather than a full TanStack Start SSR Nitro build.
  - Authentication (WorkOS) is completely stubbed out. The tRPC layer has basic role checks but no real session context.
  - The final `executeIntervention` channel delivery (e.g. Resend, MSG91) doesn't actually hit the network, but successfully writes to the database.

## Evaluation Batch

To generate a synthetic held-out evaluation batch for testing precision and recall metrics:
```bash
cd packages/db
bun run scripts/generate.ts
```
This script intelligently maps coherent failure events (e.g., `checkout_abandoned` always maps to `checkout_friction`) and right-skews the monetary values, inserting 60 synthetic risk_events and cases into the database for dashboarding.
