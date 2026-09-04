# Undertow — Razorpay AI Buildathon Submission
**Track 03:** AI Revenue Recovery

## 1. The Problem
Money that looks lost is often still moving just beneath the surface. When a payment fails, a checkout is abandoned, or a mandate bounces, merchants typically resort to rigid, rule-based retry logic or blind batch-emailing. This approach is costly, burns customer goodwill, and leaves high-intent buyers stranded by technical glitches or issuer holds.

## 2. Our Solution: Undertow
**Undertow is a bounded, auditable agent that acts as a recovery operating system for merchant revenue leakage.**

Instead of blindly retrying, Undertow reads the unstructured context of a failure event, dynamically diagnoses the *root cause* using Claude 3.5 Haiku, and computes a precise recovery intervention bounded by strict merchant-defined spend ceilings and escalation ladders. 

It does not ask "did this fail?" It asks, *"why did this fail, how much is at risk, and what is the most cost-efficient channel (email, SMS, WhatsApp) to pull it back?"*

## 3. Core Architecture
- **Ingestion & Validation**: Webhooks (e.g., Razorpay) are ingested securely, validated for signatures, and checked for idempotency using database-level constraints.
- **Orchestration (Inngest)**: The recovery lifecycle (Detect, Diagnose, Decide, Act, Escalate) is managed by Inngest, ensuring that steps are durable, resumable, and auditable.
- **Agentic Reasoning (LangGraph & Anthropic)**: 
  - The `detect` phase evaluates an interpretable logistic regression scoring function.
  - The `diagnose` phase uses LangGraph and Claude Haiku (`claude-haiku-4-5-20251001`) with vector-similarity few-shot context to classify raw events into a controlled vocabulary of 9 root causes.
  - The `decide` phase uses a Thompson-sampling Contextual Bandit that dynamically balances exploration and exploitation across channels/tiers using live Beta distributions.
- **Data Model (Drizzle + PostgreSQL)**: Strongly typed schema utilizing `pgEnum`, composite unique constraints, pgvector, and relations to ensure structural integrity across Customers, Risk Events, Cases, Interventions, and Audit Trails (`agentRuns`).
- **Control Plane (React + Hono tRPC)**: A live operations dashboard displaying real-time aggregated KPIs (Amount at Risk, Recovered, Cost per Rupee) and a dynamic timeline queue of agent decisions.

## 4. Compliance & Control
In autonomous recovery, trust is paramount. Undertow is designed with "brakes built in":
- **Idempotency**: Strict `externalEventId` uniqueness prevents double-billing or spamming.
- **Spend Ceilings**: Before dispatching high-touch interventions (e.g., WhatsApp), the agent checks aggregate marginal `costPaise` against the merchant's configured budget limits.
- **Escalation Ceilings**: A cron-driven `evaluateEscalation` loop safely steps up interventions (Tier 1 -> Tier 2) but automatically halts cases that breach the max threshold (`escalation_ceiling_reached`) or receive a `disputed` flag.
- **Audit Trails**: Every LLM invocation captures exact `inputSnapshot` and `outputSnapshot` JSON blobs in the database, allowing merchants to debug exactly *why* the agent made a specific routing decision.

## 5. What We Built
The prototype implements the full structural skeleton and reasoning logic end-to-end:
1. **Real DB & Schemas**: Enforced with Postgres FKs, Enums, and Unique constraints.
2. **Real API Surface**: Hono + tRPC providing deeply typed contexts and RBAC (owner vs analyst).
3. **Real Agent Logic**: LangGraph diagnosis paired with a Thompson-sampling bandit for optimal channel routing.
4. **Real UI Synchronization**: A React dashboard powered dynamically by live Postgres queries, mapping live trend-lines and tracking the marginal cost per recovered Rupee.

*Undertow pulls revenue back before it reaches the open sea of a written-off receivable.*
