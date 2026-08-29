import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@undertow/api/src/trpc';

export const trpc = createTRPCReact<AppRouter>();
