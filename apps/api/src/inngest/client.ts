import { Inngest } from 'inngest';

type Events = {
  'case/detected': {
    data: {
      caseId: string;
      source: string;
      eventType: string;
      amountPaise: number;
      currency: string;
      customerId: string;
      rawPayload: any;
    };
  };
  'intervention/intended': {
    data: {
      caseId: string;
      channel: string;
      tier: number;
    };
  };
};

export const inngest = new Inngest({ id: 'undertow', schemas: { events: {} as Events } });
