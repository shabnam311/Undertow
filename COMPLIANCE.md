# Undertow — Regulatory & Compliance Framework (COMPLIANCE.md)
**Razorpay AI Buildathon 2026 — Track 03: AI Revenue Recovery**

This document details the deterministic compliance guardrails, regulatory citations, and mathematical guarantees built into Undertow to ensure ethical, legal, and non-harassing autonomous merchant revenue recovery.

---

## 🏛️ Regulatory Authority & Circular Mapping

| Guardrail ID | Regulation & Circular Citation | Enforced Constraint | Implementation Location | Test Verification |
| :--- | :--- | :--- | :--- | :--- |
| `RULE-NPCI-003` | **NPCI Circular No. 34 / 2021-22** (UPI AutoPay Guidelines) | Strict maximum cap of 4 automated retry attempts per debit cycle on recurring mandates. Case permanently halts at attempt 4. | `apps/api/src/agent/guardrails.ts` | `apps/api/src/agent/workflow.test.ts` |
| `RULE-RBI-004` | **RBI Circular RBI/2020-21/74** (AFA for Recurring E-Mandates) | E-mandates >= 15,000 INR require Additional Factor of Authentication (AFA/OTP). Auto-debit retry is strictly blocked and force-routed to payment links. | `apps/api/src/agent/guardrails.ts` | `apps/api/src/agent/workflow.test.ts` |
| `RULE-DISPUTE-001` | **RBI/2019-20/67** (Customer Protection & Grievance Redressal) | Deterministic hard-stop (Tier 0 / none) upon chargeback, fraud notification, or customer dispute. Zero automated outreach. | `apps/api/src/agent/guardrails.ts` | `apps/api/src/agent/workflow.test.ts` |
| `RULE-OPT-OUT-002` | **TRAI TCCCPR Regulations** (Commercial Communications Preferences) | Immediate, irreversible cessation of outbound communications upon opt-out or churn signal. | `apps/api/src/agent/guardrails.ts` | `apps/api/src/agent/workflow.test.ts` |

---

## 🛡️ Declarative Guardrail Architecture

Unlike naive LLM prompts that suffer from prompt injection, jailbreaks, or hallucinations, Undertow enforces compliance via deterministic code brakes executed prior to any outbound communication.

---

## 🧪 Adversarial Test Suite

- **Hostile Chargeback Ingestion**: Verifies that high-value disputed cases cannot trigger any outbound messaging.
- **Overflow Attempt Injection**: Verifies that attempt counts >= 5 remain hard-halted despite any upstream errors.
- **Exact-Boundary Verification**: Verifies that transactions at exactly 15,000 INR trigger mandatory AFA payment-link redirection.

---

## 📜 Auditability & Non-Repudiation

Every single guardrail evaluation is immutably logged to the `agent_runs` table with exact input snapshots, compliance badges, and circular identifiers.

*Undertow — Built for compliance-first Indian merchant infrastructure.*