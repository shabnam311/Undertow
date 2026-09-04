import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  uuid,
  varchar,
  pgEnum,
  customType
} from 'drizzle-orm/pg-core';

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(384)';
  },
  toDriver(val: number[]): string {
    return `[${val.join(',')}]`;
  },
  fromDriver(val: unknown): number[] {
    if (typeof val === 'string') {
      return JSON.parse(val) as number[];
    }
    return val as number[];
  }
});

// Enums
export const roleEnum = pgEnum('role', ['owner', 'analyst', 'viewer']);

// --- Users & Merchants ---
export const merchants = pgTable('merchants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  razorpayAccountId: text('razorpay_account_id').notNull(),
  spendCeilingPaise: integer('spend_ceiling_paise').notNull(),
  escalationCeiling: integer('escalation_ceiling').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const merchantUsers = pgTable('merchant_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id').references(() => merchants.id).notNull(),
  workosUserId: text('workos_user_id').notNull(),
  email: text('email').notNull().unique(),
  role: roleEnum('role').notNull().default('viewer'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').references(() => merchants.id).notNull(),
  externalRef: text('external_ref'),
  displayName: text('display_name'),
  email: text('email'),
  phone: text('phone'),
  preferredLanguage: text('preferred_language'),
  consentChannels: jsonb('consent_channels').notNull().$type<string[]>(), // array of channels
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const riskEvents = pgTable('risk_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').references(() => merchants.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  source: text('source').notNull(), // 'razorpay_webhook' | 'synthetic_seed' | 'manual_upload'
  externalEventId: text('external_event_id').unique(),
  eventType: text('event_type').notNull(), // 'payment_failed' | 'checkout_abandoned' | 'mandate_failed' | 'invoice_overdue'
  rawPayload: jsonb('raw_payload').notNull(),
  amountPaise: integer('amount_paise').notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  occurredAt: timestamp('occurred_at').notNull(),
  ingestedAt: timestamp('ingested_at').defaultNow().notNull(),
});

export const cases = pgTable('cases', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').references(() => merchants.id).notNull(),
  customerId: uuid('customer_id').references(() => customers.id).notNull(),
  riskEventId: uuid('risk_event_id').references(() => riskEvents.id).notNull(),
  evaluationBatchId: uuid('evaluation_batch_id').references(() => evaluationBatches.id),
  status: text('status').notNull(), // 'detected' | 'diagnosing' | 'intervention_pending' | 'intervention_sent' | 'escalated' | 'recovered' | 'stopped_unrecovered' | 'stopped_manual'
  rootCause: text('root_cause'), // from controlled vocabulary
  rootCauseConfidence: integer('root_cause_confidence'), // 0-100
  amountAtRiskPaise: integer('amount_at_risk_paise').notNull(),
  amountRecoveredPaise: integer('amount_recovered_paise').default(0),
  openedAt: timestamp('opened_at').defaultNow().notNull(),
  closedAt: timestamp('closed_at'),
  closeReason: text('close_reason'),
  embedding: vector('embedding'),
});

export const interventions = pgTable('interventions', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => cases.id).notNull(),
  channel: text('channel').notNull(), // 'email' | 'sms' | 'whatsapp' | 'voice' | 'payment_link_retry'
  templateId: text('template_id').notNull(),
  templateVariables: jsonb('template_variables').notNull(),
  tier: integer('tier').notNull(),
  status: text('status').notNull(), // 'queued' | 'sent' | 'delivered' | 'failed' | 'responded'
  providerRef: text('provider_ref'),
  sentAt: timestamp('sent_at'),
  costPaise: integer('cost_paise').default(0),
});

export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => cases.id).notNull(),
  nodeName: text('node_name').notNull(), // 'detect' | 'diagnose' | 'decide' | 'act' | 'verify' | 'escalate' | 'stop'
  inngestRunId: text('inngest_run_id'),
  inputSnapshot: jsonb('input_snapshot').notNull(),
  outputSnapshot: jsonb('output_snapshot').notNull(),
  modelUsed: text('model_used'),
  latencyMs: integer('latency_ms'),
  tokenCostPaise: integer('token_cost_paise'),
  reasoningSummary: text('reasoning_summary').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stopEvents = pgTable('stop_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => cases.id).notNull(),
  reasonCode: text('reason_code').notNull(),
  isSystemTriggered: boolean('is_system_triggered').notNull().default(true),
  merchantUserId: uuid('merchant_user_id').references(() => merchantUsers.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const evaluationBatches = pgTable('evaluation_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').references(() => merchants.id).notNull(),
  label: text('label').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

import { relations } from 'drizzle-orm';

export const casesRelations = relations(cases, ({ one, many }) => ({
  customer: one(customers, {
    fields: [cases.customerId],
    references: [customers.id],
  }),
  riskEvent: one(riskEvents, {
    fields: [cases.riskEventId],
    references: [riskEvents.id],
  }),
  interventions: many(interventions),
  agentRuns: many(agentRuns),
  stopEvents: many(stopEvents),
}));

export const interventionsRelations = relations(interventions, ({ one }) => ({
  case: one(cases, {
    fields: [interventions.caseId],
    references: [cases.id],
  }),
}));

export const agentRunsRelations = relations(agentRuns, ({ one }) => ({
  case: one(cases, {
    fields: [agentRuns.caseId],
    references: [cases.id],
  }),
}));

export const stopEventsRelations = relations(stopEvents, ({ one }) => ({
  case: one(cases, {
    fields: [stopEvents.caseId],
    references: [cases.id],
  }),
}));

import { unique } from 'drizzle-orm/pg-core';

export const channelPerformance = pgTable('channel_performance', {
  id: uuid('id').defaultRandom().primaryKey(),
  merchantId: uuid('merchant_id').references(() => merchants.id).notNull(),
  channel: text('channel').notNull(),
  tier: integer('tier').notNull(),
  rootCause: text('root_cause').notNull(), // specific root cause context
  alpha: integer('alpha').notNull().default(1), // Successes (prior)
  beta: integer('beta').notNull().default(1),   // Failures (prior)
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  unq: unique('channel_performance_unq').on(t.merchantId, t.channel, t.tier, t.rootCause)
}));
