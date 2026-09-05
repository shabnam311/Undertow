export interface ComplianceRule {
  id: string;
  name: string;
  regulationCitation: string;
  description: string;
  action: 'halt' | 'route_channel' | 'allow';
  targetChannel?: string;
  badge: string;
}

export const DECLARATIVE_GUARDRAILS = {
  DISPUTE_HARD_STOP: {
    id: 'RULE-DISPUTE-001',
    name: 'Customer Dispute / Chargeback Hard Stop',
    regulationCitation: 'RBI/2019-20/67 (Customer Protection & Grievance Redressal)',
    description: 'Halts all autonomous outbound recovery communications when active chargebacks or disputes are reported.',
    action: 'halt',
    badge: 'Dispute Protected (Tier 0)'
  },
  OPT_OUT_HARD_STOP: {
    id: 'RULE-OPT-OUT-002',
    name: 'Voluntary Cancellation / Opt-Out Stop',
    regulationCitation: 'TRAI Telecom Commercial Communications Customer Preference Regulations (TCCCPR)',
    description: 'Halts communications immediately upon customer churn signal or explicit opt-out.',
    action: 'halt',
    badge: 'Opt-Out Honored (Tier 0)'
  },
  NPCI_MANDATE_CAP: {
    id: 'RULE-NPCI-003',
    name: 'NPCI UPI AutoPay 4-Attempt Retry Cap',
    regulationCitation: 'NPCI Circular No. 34 / 2021-22 (Operational Guidelines for UPI AutoPay)',
    description: 'Mandates a maximum of 4 automatic retry attempts per recurring debit cycle. Hard halt at 4.',
    action: 'halt',
    badge: 'NPCI Cap Reached (4/4)'
  },
  RBI_AFA_15K_RULE: {
    id: 'RULE-RBI-004',
    name: 'RBI ₹15,000+ Additional Factor of Authentication (AFA)',
    regulationCitation: 'RBI/2020-21/74 DPSS.CO.PD.No.750/02.14.003/2020-21',
    description: 'Recurring transactions >= ₹15,000 cannot be auto-debited without explicit OTP AFA. Routed to payment links.',
    action: 'route_channel',
    targetChannel: 'payment_link_retry',
    badge: 'RBI AFA Rule (₹15K+)'
  }
} as const;

export function evaluateGuardrails(params: {
  rootCause: string;
  eventType: string;
  amountPaise: number;
  attemptCount: number;
}) {
  const { rootCause, eventType, amountPaise, attemptCount } = params;

  if (rootCause === 'disputed_or_service_issue') {
    return {
      blocked: true,
      decision: {
        channel: 'none',
        tier: 0,
        complianceBadge: DECLARATIVE_GUARDRAILS.DISPUTE_HARD_STOP.badge,
        actionReason: DECLARATIVE_GUARDRAILS.DISPUTE_HARD_STOP.name + ' [' + DECLARATIVE_GUARDRAILS.DISPUTE_HARD_STOP.regulationCitation + ']'
      }
    };
  }

  if (rootCause === 'voluntary_cancellation_signal') {
    return {
      blocked: true,
      decision: {
        channel: 'none',
        tier: 0,
        complianceBadge: DECLARATIVE_GUARDRAILS.OPT_OUT_HARD_STOP.badge,
        actionReason: DECLARATIVE_GUARDRAILS.OPT_OUT_HARD_STOP.name + ' [' + DECLARATIVE_GUARDRAILS.OPT_OUT_HARD_STOP.regulationCitation + ']'
      }
    };
  }

  if (eventType === 'mandate_failed' && attemptCount >= 4) {
    return {
      blocked: true,
      decision: {
        channel: 'none',
        tier: 0,
        complianceBadge: DECLARATIVE_GUARDRAILS.NPCI_MANDATE_CAP.badge,
        actionReason: DECLARATIVE_GUARDRAILS.NPCI_MANDATE_CAP.name + ' [' + DECLARATIVE_GUARDRAILS.NPCI_MANDATE_CAP.regulationCitation + ']'
      }
    };
  }

  if (eventType === 'mandate_failed' && amountPaise >= 1500000) {
    return {
      blocked: false,
      forcedChannel: 'payment_link_retry',
      complianceBadge: DECLARATIVE_GUARDRAILS.RBI_AFA_15K_RULE.badge + ' · Attempt ' + attemptCount + '/4',
      actionReason: DECLARATIVE_GUARDRAILS.RBI_AFA_15K_RULE.name + ' [' + DECLARATIVE_GUARDRAILS.RBI_AFA_15K_RULE.regulationCitation + ']'
    };
  }

  return {
    blocked: false,
    forcedChannel: null,
    complianceBadge: eventType === 'mandate_failed' ? ('NPCI Compliant · Attempt ' + attemptCount + '/4') : undefined,
    actionReason: undefined
  };
}